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
} from '../types';

/**
 * DemoExecutionAdapter:
 * Explicit, deterministic simulation adapter for reproducible testing and offline hackathon demonstrations.
 * In accordance with Phase 4 security invariants: even the demo adapter enforces Sentinel authorization ticket validation.
 */
export class DemoExecutionAdapter implements ExecutionAdapter {
  public readonly venueType: ExecutionVenueType = 'DEMO_SIMULATION';
  public readonly venueName: string = 'Sentinel Local Simulator (Offline Demo)';
  private executionDelayMs: number;

  constructor(executionDelayMs: number = 0) {
    this.executionDelayMs = executionDelayMs;
  }

  getMode(): 'SIMULATION' {
    return 'SIMULATION';
  }

  async executeTrade(
    intent: TradeIntent,
    _preState: PortfolioSnapshot,
    authorization?: SentinelAuthorizationTicket
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. Non-Bypass Invariant: Direct Agent -> DEX is prohibited!
    if (!authorization) {
      throw new SecurityViolationError(
        'Direct Agent->DEX execution prohibited: DemoExecutionAdapter requires an authorized SentinelAuthorizationTicket. Direct execution bypasses Sentinel risk governance.',
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

    if (this.executionDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelayMs));
    }

    const isBuy = intent.direction === 'BUY';
    const inputAsset = isBuy ? 'USDC' : intent.assetSymbol;
    const outputAsset = isBuy ? intent.assetSymbol : 'USDC';
    const inputAmount = isBuy ? intent.tradeAmountUsd : intent.tradeAmountUsd / intent.referencePriceUsd;
    const outputAmount = isBuy ? intent.tradeAmountUsd / intent.referencePriceUsd : intent.tradeAmountUsd;

    const simRandom = Math.random().toString(36).substring(2, 10);
    const transactionSignature = `sim_tx_${Date.now()}_${simRandom}`;
    const poolAddress = 'SimulatedLocalEngine111111111111111111111111111';
    const route = isBuy
      ? `USDC ATA ➔ Local Simulator ➔ ${intent.assetSymbol} ATA`
      : `${intent.assetSymbol} ATA ➔ Local Simulator ➔ USDC ATA`;

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
      venueType: this.venueType,
      venueName: this.venueName,
      poolAddress,
      route,
      executionDurationMs: Math.max(1, Date.now() - startTime),
    };
  }
}

// Backwards-compatible alias for existing tests and client consumers
export const SimulatedExecutionAdapter = DemoExecutionAdapter;
