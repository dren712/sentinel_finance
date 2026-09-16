import {
  TradeIntent,
  PortfolioSnapshot,
  SentinelAuthorizationTicket,
  hashTradeIntent,
} from '@sentinel/domain';
import { createHash } from 'crypto';
import {
  ExecutionAdapter,
  ExecutionResult,
  ExecutionVenueType,
  SecurityViolationError,
} from '../types';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

export { DemoExecutionAdapter, SimulatedExecutionAdapter } from './demo-adapter';
export { MeteoraExecutionAdapter, METEORA_DBC_POOLS } from './meteora-adapter';
export { PreStocksExecutionAdapter, PRESTOCKS_SECONDARY_POOLS } from './prestocks-adapter';

/**
 * LiveExecutionAdapter:
 * Connects to Solana RPC and builds on-chain transactions targeting the Sentinel Anchor program.
 * In accordance with Phase 4 security invariants: Requires a genuine wallet or keypair signer
 * and strictly verifies Sentinel authorization tickets before on-chain execution.
 */
export class LiveExecutionAdapter implements ExecutionAdapter {
  public readonly venueType: ExecutionVenueType = 'SOLANA_MAINNET';
  public readonly venueName: string = 'Solana On-Chain Anchor Program';
  private connection: Connection;
  public readonly programId: PublicKey;
  private signerKeypair?: Keypair;

  constructor(
    rpcEndpoint: string = 'http://127.0.0.1:8899',
    signerKeypair?: Keypair
  ) {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    this.programId = new PublicKey('3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK');
    this.signerKeypair = signerKeypair;
  }

  getMode(): 'LIVE' {
    return 'LIVE';
  }

  setSignerKeypair(keypair: Keypair): void {
    this.signerKeypair = keypair;
  }

  getConnection(): Connection {
    return this.connection;
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

    if (!this.signerKeypair) {
      throw new Error(
        'Live execution requires an authorized Solana signer keypair or connected wallet. ' +
        'Please connect a funded Solana wallet or use SIMULATION mode for deterministic offline evaluation.'
      );
    }

    try {
      // Check RPC connection liveness
      await this.connection.getLatestBlockhash();

      const isBuy = intent.direction === 'BUY';
      const inputAsset = isBuy ? 'USDC' : intent.assetSymbol;
      const outputAsset = isBuy ? intent.assetSymbol : 'USDC';
      const inputAmount = isBuy ? intent.tradeAmountUsd : intent.tradeAmountUsd / intent.referencePriceUsd;
      const outputAmount = isBuy ? intent.tradeAmountUsd / intent.referencePriceUsd : intent.tradeAmountUsd;

      // Construct Anchor instruction data for execute_guarded_trade
      const discriminator = createHash('sha256')
        .update('global:execute_guarded_trade')
        .digest()
        .subarray(0, 8);

      const instructionData = Buffer.alloc(32);
      discriminator.copy(instructionData, 0);

      const tradeAmountCents = BigInt(Math.round(intent.tradeAmountUsd * 100));
      const executionPriceCents = BigInt(Math.round(intent.referencePriceUsd * 100));
      const quotedPriceCents = BigInt(Math.round(intent.referencePriceUsd * 100));

      instructionData.writeBigUInt64LE(tradeAmountCents, 8);
      instructionData.writeBigUInt64LE(executionPriceCents, 16);
      instructionData.writeBigUInt64LE(quotedPriceCents, 24);

      // Derive PDAs matching Anchor on-chain constraints
      const authorityPubkey = this.signerKeypair.publicKey;
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

      const tx = new Transaction().add(
        new TransactionInstruction({
          programId: this.programId,
          keys: [
            { pubkey: promisePda, isSigner: false, isWritable: true },
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: agentPda, isSigner: false, isWritable: false },
            { pubkey: policyPda, isSigner: false, isWritable: false },
            { pubkey: authorityPubkey, isSigner: true, isWritable: true },
          ],
          data: instructionData,
        })
      );

      const txSignature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.signerKeypair]
      );

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
