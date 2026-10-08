import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { SENTINEL_IDL } from '../idl/sentinel-idl';
import type { Sentinel } from '../idl/sentinel';
import { WalletSigner } from '../types';
import { parsePythPriceUpdateAccount } from '../custody';

export interface WatcherConfig {
  connection: Connection;
  programId?: PublicKey;
  signer: Keypair | WalletSigner;
  priceUpdatePubkey: PublicKey;
  pollIntervalMs?: number;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface WatcherScanResult {
  vaultAddress: string;
  owner: string;
  status: string;
  exposureBps: number;
  maxAllowedBps: number;
  isViolating: boolean;
  actionTaken?: 'FLAGGED_PENDING' | 'FLAGGED_QUARANTINE' | 'NONE';
  signature?: string;
  error?: string;
}

export class SentinelWatcherService {
  private connection: Connection;
  private programId: PublicKey;
  private signer: Keypair | WalletSigner;
  private priceUpdatePubkey: PublicKey;
  private pollIntervalMs: number;
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private program: Program;

  constructor(config: WatcherConfig) {
    this.connection = config.connection;
    this.programId = config.programId || new PublicKey(SENTINEL_IDL.address);
    this.signer = config.signer;
    this.priceUpdatePubkey = config.priceUpdatePubkey;
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
   * Scans all vaults and detects invariant breaches
   */
  async scanVaults(): Promise<WatcherScanResult[]> {
    const results: WatcherScanResult[] = [];
    const vaultAccounts = await (this.program.account as any).portfolioVault.all();

    for (const v of vaultAccounts) {
      const vaultPubkey = v.publicKey;
      const vault = v.account as any;
      const statusKey = Object.keys(vault.status)[0] || vault.status;

      // Watcher only monitors Active or Pending vaults
      if (statusKey !== 'active') {
        continue;
      }

      const [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), vault.owner.toBuffer()],
        this.programId
      );
      const policy = (await (this.program.account as any).policyAccount.fetchNullable(policyPda)) as any;
      if (!policy || !policy.active) {
        continue;
      }

      // Check volatile asset exposure
      const nonIndex = vault.positions.filter((p: any) => !p.isIndex);
      if (nonIndex.length === 0) continue;

      const pos = nonIndex[0];
      const amountUnits = BigInt(pos.amountUnits);
      let effectivePriceCents = BigInt(pos.priceCents);

      // Read fresh Pyth oracle price
      try {
        const priceAccInfo = await this.connection.getAccountInfo(this.priceUpdatePubkey, 'confirmed');
        if (priceAccInfo && priceAccInfo.data) {
          const parsed = parsePythPriceUpdateAccount(priceAccInfo.data);
          if (parsed.priceCents > 0) {
            effectivePriceCents = BigInt(parsed.priceCents);
          }
        }
      } catch {
        // Fallback to stored price if RPC error
      }

      const usdcCents = BigInt(vault.usdcBalanceCents);
      const targetCents = amountUnits * effectivePriceCents;
      const totalCents = usdcCents + targetCents;
      if (totalCents <= BigInt(0)) continue;

      const exposureBps = Number((targetCents * BigInt(10000)) / totalCents);
      const maxAllowedBps = policy.maxSingleAssetBps;
      const isViolating = exposureBps > maxAllowedBps;

      const scanResult: WatcherScanResult = {
        vaultAddress: vaultPubkey.toBase58(),
        owner: vault.owner.toBase58(),
        status: statusKey,
        exposureBps,
        maxAllowedBps,
        isViolating,
        actionTaken: 'NONE',
      };

      if (isViolating) {
        try {
          const currentSlot = await this.connection.getSlot('confirmed');
          const pendingSlot = vault.pendingViolationSlot.toNumber();
          const confirmSlots = policy.confirmSlots;

          const flagIx = await this.program.methods
            .flagViolation()
            .accountsPartial({
              vault: vaultPubkey,
              policy: policyPda,
              priceUpdate: this.priceUpdatePubkey,
              signer: this.signer.publicKey,
            })
            .instruction();

          const tx = new Transaction().add(flagIx);
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

          scanResult.signature = sig;
          if (pendingSlot === 0) {
            scanResult.actionTaken = 'FLAGGED_PENDING';
          } else if (currentSlot >= pendingSlot + confirmSlots) {
            scanResult.actionTaken = 'FLAGGED_QUARANTINE';
          }
        } catch (err: any) {
          scanResult.error = err?.message || String(err);
        }
      }

      results.push(scanResult);
    }

    return results;
  }

  start(onScan?: (results: WatcherScanResult[]) => void): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const results = await this.scanVaults();
        if (onScan) onScan(results);
      } catch (err) {
        if (this.isRunning) {
          console.error('[SentinelWatcherService] Scan error:', err);
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
