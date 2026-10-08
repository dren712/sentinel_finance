import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { SENTINEL_IDL } from '../idl/sentinel-idl';
import type { Sentinel } from '../idl/sentinel';
import { requiredRecoveryUnits, RecoveryPlan } from '../recovery';
import { WalletSigner } from '../types';
import { resolveRecoveryCustodyAccounts, parsePythPriceUpdateAccount, TOKEN_PROGRAM_ID } from '../custody';

export interface SolverConfig {
  connection: Connection;
  programId?: PublicKey;
  signer: Keypair | WalletSigner;
  priceUpdatePubkey: PublicKey;
  mode?: 'simulated' | 'custody';
  pollIntervalMs?: number;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface SolverRecoveryResult {
  vaultAddress: string;
  owner: string;
  statusBefore: string;
  plan: RecoveryPlan;
  signature?: string;
  error?: string;
  recovered: boolean;
}

export class SentinelSolverService {
  private connection: Connection;
  private programId: PublicKey;
  private signer: Keypair | WalletSigner;
  private priceUpdatePubkey: PublicKey;
  private mode: 'simulated' | 'custody';
  private pollIntervalMs: number;
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private program: Program;

  constructor(config: SolverConfig) {
    this.connection = config.connection;
    this.programId = config.programId || new PublicKey(SENTINEL_IDL.address);
    this.signer = config.signer;
    this.priceUpdatePubkey = config.priceUpdatePubkey;
    this.mode = config.mode || 'simulated';
    this.pollIntervalMs = config.pollIntervalMs || 2500;

    const dummyWallet = {
      publicKey: this.signer.publicKey,
      signTransaction: async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    };
    const provider = new AnchorProvider(this.connection, dummyWallet as any, {
      commitment: config.commitment || 'confirmed',
    });
    this.program = new Program(SENTINEL_IDL as any, provider);
  }

  /**
   * Scans for quarantined vaults and executes permissionless recovery
   */
  async solveQuarantinedVaults(): Promise<SolverRecoveryResult[]> {
    const results: SolverRecoveryResult[] = [];
    const vaultAccounts = await (this.program.account as any).portfolioVault.all();

    for (const v of vaultAccounts) {
      const vaultPubkey = v.publicKey;
      const vault = v.account as any;
      const statusKey = Object.keys(vault.status)[0] || vault.status;

      // Solver only targets Quarantined vaults
      if (statusKey !== 'quarantined') {
        continue;
      }

      const [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), vault.owner.toBuffer()],
        this.programId
      );
      const policy = (await (this.program.account as any).policyAccount.fetchNullable(policyPda)) as any;
      if (!policy) continue;

      const nonIndex = vault.positions.filter((p: any) => !p.isIndex);
      if (nonIndex.length === 0) continue;
      const pos = nonIndex[0];

      const currentSlot = await this.connection.getSlot('confirmed');
      const expirySlot = vault.recoveryExpiresSlot.toNumber();
      if (expirySlot > 0 && currentSlot > expirySlot) {
        continue; // Recovery window closed
      }

      let priceCents = pos.priceCents.toNumber() > 0 ? pos.priceCents.toNumber() : 10000;
      try {
        const priceAccInfo = await this.connection.getAccountInfo(this.priceUpdatePubkey, 'confirmed');
        if (priceAccInfo && priceAccInfo.data) {
          const parsed = parsePythPriceUpdateAccount(priceAccInfo.data);
          if (parsed.priceCents > 0) {
            priceCents = parsed.priceCents;
          }
        }
      } catch {
        // Fallback to stored price
      }

      const plan = requiredRecoveryUnits(
        {
          usdcBalanceCents: vault.usdcBalanceCents.toNumber(),
          positions: vault.positions.map((p: any) => ({
            amountUnits: p.amountUnits.toNumber(),
            priceCents: p.priceCents.toNumber(),
            isIndex: p.isIndex,
            mint: p.mint,
          })),
        },
        {
          maxSingleAssetBps: policy.maxSingleAssetBps,
          minStablecoinBps: policy.minStablecoinBps,
          maxRecoveryCostBps: policy.maxRecoveryCostBps,
        },
        priceCents,
        { mode: this.mode }
      );

      const recoveryResult: SolverRecoveryResult = {
        vaultAddress: vaultPubkey.toBase58(),
        owner: vault.owner.toBase58(),
        statusBefore: statusKey,
        plan,
        recovered: false,
      };

      if (plan.isViable) {
        try {
          const sellUnits = new BN(plan.sellUnits.toString());
          const expectedNonce = vault.recoveryNonce;

          let recoverBuilder = this.program.methods
            .recover(sellUnits, expectedNonce)
            .accountsPartial({
              vault: vaultPubkey,
              policy: policyPda,
              priceUpdate: this.priceUpdatePubkey,
              solver: this.signer.publicKey,
            });

          if (this.mode === 'custody') {
            const custodyAccounts = resolveRecoveryCustodyAccounts(
              vaultPubkey,
              policy.safeDestination,
              pos.mint
            );
            recoverBuilder = recoverBuilder.remainingAccounts(custodyAccounts);
          }

          const recoverIx = await recoverBuilder.instruction();
          const tx = new Transaction().add(recoverIx);
          const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = this.signer.publicKey;

          if ('secretKey' in this.signer) {
            tx.sign(this.signer as Keypair);
          } else if ('signTransaction' in this.signer && this.signer.signTransaction) {
            await this.signer.signTransaction(tx);
          } else {
            throw new Error('Signer cannot sign transactions');
          }

          const sig = await this.connection.sendRawTransaction(tx.serialize());
          await this.connection.confirmTransaction(sig, 'confirmed');

          recoveryResult.signature = sig;
          recoveryResult.recovered = true;
        } catch (err: any) {
          recoveryResult.error = err?.message || String(err);
        }
      }

      results.push(recoveryResult);
    }

    return results;
  }

  start(onSolve?: (results: SolverRecoveryResult[]) => void): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const results = await this.solveQuarantinedVaults();
        if (onSolve) onSolve(results);
      } catch (err) {
        if (this.isRunning) {
          console.error('[SentinelSolverService] Solve error:', err);
        }
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, this.pollIntervalMs);
        }
      }
    };

    poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
