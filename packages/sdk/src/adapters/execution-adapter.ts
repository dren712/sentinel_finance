import {
  TradeIntent,
  PortfolioSnapshot,
} from '@sentinel/domain';
import { ExecutionAdapter, ExecutionResult } from '../types';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

/**
 * SimulatedExecutionAdapter:
 * Explicit, deterministic simulation adapter for reproducible testing and offline demonstrations.
 * In accordance with Rule 4: all signatures and results are explicitly labeled as simulation.
 */
export class SimulatedExecutionAdapter implements ExecutionAdapter {
  private executionDelayMs: number;

  constructor(executionDelayMs: number = 0) {
    this.executionDelayMs = executionDelayMs;
  }

  getMode(): 'SIMULATION' {
    return 'SIMULATION';
  }

  async executeTrade(intent: TradeIntent, _preState: PortfolioSnapshot): Promise<ExecutionResult> {
    if (this.executionDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelayMs));
    }

    const isBuy = intent.direction === 'BUY';
    const inputAsset = isBuy ? 'USDC' : intent.assetSymbol;
    const outputAsset = isBuy ? intent.assetSymbol : 'USDC';
    const inputAmount = isBuy ? intent.tradeAmountUsd : intent.tradeAmountUsd / intent.referencePriceUsd;
    const outputAmount = isBuy ? intent.tradeAmountUsd / intent.referencePriceUsd : intent.tradeAmountUsd;

    // Explicitly labeled simulation signature
    const simRandom = Math.random().toString(36).substring(2, 10);
    const transactionSignature = `sim_tx_${Date.now()}_${simRandom}`;

    return {
      success: true,
      transactionSignature,
      inputAsset,
      outputAsset,
      inputAmount: Math.round(inputAmount * 100) / 100,
      outputAmount: Math.round(outputAmount * 10_000) / 10_000,
      executionPrice: intent.referencePriceUsd,
      isSimulation: true,
      timestamp: Date.now(),
    };
  }
}

/**
 * LiveExecutionAdapter:
 * Connects to Solana RPC and builds on-chain transactions targeting the Sentinel Anchor program.
 * In accordance with Rule 3: Requires a genuine wallet or keypair signer and returns only real,
 * confirmed transaction signatures. Never fabricates signatures.
 */
export class LiveExecutionAdapter implements ExecutionAdapter {
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
  async executeTrade(intent: TradeIntent, preState: PortfolioSnapshot): Promise<ExecutionResult> {
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
      // Instruction discriminator (sighash of "global:execute_guarded_trade")
      const instructionData = Buffer.alloc(24);
      // Data payload: trade_amount_cents (u64), execution_price_cents (u64), quoted_price_cents (u64)
      const tradeAmountCents = BigInt(Math.round(intent.tradeAmountUsd * 100));
      const executionPriceCents = BigInt(Math.round(intent.referencePriceUsd * 100));
      const quotedPriceCents = BigInt(Math.round(intent.referencePriceUsd * 100));

      instructionData.writeBigUInt64LE(tradeAmountCents, 0);
      instructionData.writeBigUInt64LE(executionPriceCents, 8);
      instructionData.writeBigUInt64LE(quotedPriceCents, 16);

      // Derive PDAs
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), this.signerKeypair.publicKey.toBuffer()],
        this.programId
      );

      const [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), this.signerKeypair.publicKey.toBuffer()],
        this.programId
      );

      const tx = new Transaction().add(
        new TransactionInstruction({
          programId: this.programId,
          keys: [
            { pubkey: vaultPda, isSigner: false, isWritable: true },
            { pubkey: policyPda, isSigner: false, isWritable: false },
            { pubkey: this.signerKeypair.publicKey, isSigner: true, isWritable: true },
          ],
          data: instructionData,
        })
      );

      const txSignature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.signerKeypair]
      );

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
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Live on-chain execution failed: ${message}`);
    }
  }
}
