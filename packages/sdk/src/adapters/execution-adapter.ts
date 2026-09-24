import {
  TradeIntent,
  PortfolioSnapshot,
  SentinelAuthorizationTicket,
  hashTradeIntent,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  ExecutionResult,
  ExecutionVenueType,
  SecurityViolationError,
  WalletSigner,
  SolanaCluster,
} from '../types';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { SENTINEL_IDL, Sentinel } from '../idl';

export { DemoExecutionAdapter, SimulatedExecutionAdapter } from './demo-adapter';
export {
  MeteoraExecutionAdapter,
  METEORA_DBC_POOLS,
  METEORA_DBC_PROGRAM_ID,
  METEORA_DBC_AUTHORITY,
  deriveMeteoraDbcPoolPda,
} from './meteora-adapter';
export { PreStocksExecutionAdapter, PRESTOCKS_SECONDARY_POOLS } from './prestocks-adapter';

/**
 * LiveExecutionAdapter:
 * Connects to Solana RPC and builds on-chain transactions targeting the Sentinel Anchor program.
 * In accordance with Phase 4 security invariants: Requires a genuine wallet or keypair signer
 * and strictly verifies Sentinel authorization tickets before on-chain execution.
 */
export class LiveExecutionAdapter implements ExecutionAdapter {
  public readonly venueType: ExecutionVenueType = 'SOLANA';
  public readonly venueName: string;
  public readonly cluster: SolanaCluster;
  private connection: Connection;
  public readonly programId: PublicKey;
  private signer?: Keypair | WalletSigner;

  constructor(
    rpcEndpoint: string = 'https://api.devnet.solana.com',
    signer?: Keypair | WalletSigner,
    programId: string = '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK',
    cluster: SolanaCluster = 'devnet'
  ) {
    this.cluster = cluster;
    this.venueName = cluster === 'mainnet' ? 'Solana Mainnet' : 'Solana Devnet';
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    this.programId = new PublicKey(programId);
    this.signer = signer;
  }

  getMode(): 'LIVE' {
    return 'LIVE';
  }

  setSignerKeypair(keypair: Keypair): void {
    this.signer = keypair;
  }

  setWalletSigner(signer: WalletSigner): void {
    this.signer = signer;
  }

  getSigner(): Keypair | WalletSigner | undefined {
    return this.signer;
  }

  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Initializes a typed Anchor Program client instance targeting the Sentinel IDL
   */
  public getProgram(): Program<Sentinel> {
    const dummyWallet = {
      publicKey: this.signer?.publicKey ?? PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    const provider = new AnchorProvider(this.connection, dummyWallet, {
      commitment: 'confirmed',
    });
    return new Program<Sentinel>(SENTINEL_IDL as Idl as Sentinel, provider);
  }

  /**
   * Builds and submits a real on-chain transaction to execute a guarded trade
   */
  async executeTrade(
    intent: TradeIntent,
    _preState: PortfolioSnapshot,
    authorization?: SentinelAuthorizationTicket
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. Non-Bypass Invariant: Direct Agent -> DEX is prohibited!
    if (!authorization) {
      throw new SecurityViolationError(
        'Direct Agent->DEX execution prohibited: LiveExecutionAdapter requires an authorized SentinelAuthorizationTicket. Direct execution bypasses Sentinel risk governance.',
        'BYPASS_ATTEMPT'
      );
    }

    // 2. Ticket expiration check
    if (authorization.expiresAt < Date.now()) {
      throw new SecurityViolationError(
        `Authorization ticket expired at ${new Date(authorization.expiresAt).toISOString()} (current time: ${new Date().toISOString()})`,
        'EXPIRED_TICKET'
      );
    }

    // 3. Intent hash binding check
    const currentIntentHash = hashTradeIntent(intent);
    if (authorization.intentHash !== currentIntentHash) {
      throw new SecurityViolationError(
        `Authorization ticket intent hash mismatch. Expected ${authorization.intentHash}, got ${currentIntentHash}`,
        'INVALID_TICKET'
      );
    }

    if (!this.signer) {
      throw new Error(
        'Live execution requires an authorized Solana signer keypair or connected wallet. ' +
        'Please connect a funded Solana wallet or use SIMULATION mode for deterministic offline evaluation.'
      );
    }

    try {
      // Check RPC connection liveness
      const { blockhash } = await this.connection.getLatestBlockhash();

      const isBuy = intent.direction === 'BUY';
      const inputAsset = isBuy ? 'USDC' : intent.assetSymbol;
      const outputAsset = isBuy ? intent.assetSymbol : 'USDC';
      const inputAmount = isBuy ? intent.tradeAmountUsd : intent.tradeAmountUsd / intent.referencePriceUsd;
      const outputAmount = isBuy ? intent.tradeAmountUsd / intent.referencePriceUsd : intent.tradeAmountUsd;

      // Derive PDAs matching Anchor on-chain constraints
      const authorityPubkey = this.signer.publicKey;
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), authorityPubkey.toBuffer()],
        this.programId
      );

      const [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), authorityPubkey.toBuffer()],
        this.programId
      );

      const agentId = intent.agentId || 'sentinel-robo-01';
      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent'), authorityPubkey.toBuffer(), Buffer.from(agentId)],
        this.programId
      );

      const promiseId = intent.intentId || 'promise_default';
      const [promisePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
        this.programId
      );

      const program = this.getProgram();
      const tx = new Transaction();

      // Check if promise exists, otherwise build create_promise instruction via Anchor IDL
      const promiseAccountInfo = await this.connection.getAccountInfo(promisePda);
      if (!promiseAccountInfo) {
        let mintPubkey: PublicKey;
        try {
          mintPubkey = new PublicKey(intent.assetMint);
        } catch {
          mintPubkey = PublicKey.default;
        }

        const intentHashBytes = Array.from(Buffer.from(authorization.intentHash.slice(0, 32), 'utf8'));
        while (intentHashBytes.length < 32) {
          intentHashBytes.push(0);
        }

        const createPromiseIx = await program.methods
          .createPromise(
            promiseId,
            intentHashBytes,
            mintPubkey,
            intent.direction === 'BUY' ? 0 : 1,
            new BN(Math.round(intent.tradeAmountUsd))
          )
          .accountsPartial({
            promise: promisePda,
            agent: agentPda,
            policy: policyPda,
            authority: authorityPubkey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        tx.add(createPromiseIx);
      }

      // Build execute_guarded_trade instruction via Anchor IDL typed method builder
      const tradeAmountCents = new BN(Math.round(intent.tradeAmountUsd * 100));
      const executionPriceCents = new BN(Math.round(intent.referencePriceUsd * 100));
      const quotedPriceCents = new BN(Math.round(intent.referencePriceUsd * 100));

      const executeTradeIx = await program.methods
        .executeGuardedTrade(
          tradeAmountCents,
          executionPriceCents,
          quotedPriceCents
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          authority: authorityPubkey,
        })
        .instruction();

      tx.add(executeTradeIx);

      tx.recentBlockhash = blockhash;
      tx.feePayer = authorityPubkey;

      let txSignature: string;
      if ('secretKey' in this.signer) {
        txSignature = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [this.signer]
        );
      } else if (this.signer.signTransaction) {
        // Preferred browser wallet pipeline: signTransaction -> sendRawTransaction -> confirmTransaction -> Explorer
        const signedTx = await this.signer.signTransaction(tx);
        txSignature = await this.connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
        await this.connection.confirmTransaction(
          {
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed'
        );
      } else if (this.signer.sendTransaction) {
        txSignature = await this.signer.sendTransaction(tx, this.connection);
        const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
        await this.connection.confirmTransaction(
          {
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed'
        );
      } else {
        throw new Error('Signer cannot sign or send transaction');
      }

      const clusterParam = this.cluster === 'mainnet' ? '' : `?cluster=${this.cluster}`;
      const explorerUrl = `https://explorer.solana.com/tx/${txSignature}${clusterParam}`;

      const route = isBuy
        ? `USDC ATA ➔ Sentinel Program ➔ ${intent.assetSymbol} ATA`
        : `${intent.assetSymbol} ATA ➔ Sentinel Program ➔ USDC ATA`;

      return {
        success: true,
        transactionSignature: txSignature,
        inputAsset,
        outputAsset,
        inputAmount: Math.round(inputAmount * 100) / 100,
        outputAmount: Math.round(outputAmount * 10_000) / 10_000,
        executionPrice: intent.referencePriceUsd,
        isSimulation: false,
        timestamp: Date.now(),
        venueType: this.venueType,
        venueName: this.venueName,
        cluster: this.cluster,
        explorerUrl,
        poolAddress: vaultPda.toBase58(),
        route,
        executionDurationMs: Math.max(1, Date.now() - startTime),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Live on-chain execution failed: ${message}`);
    }
  }
}
