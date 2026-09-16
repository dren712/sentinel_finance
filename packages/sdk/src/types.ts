import {
  TradeIntent,
  PortfolioSnapshot,
  PromiseRecord,
  EvaluationOutcome,
  EvidenceRecord,
  PTAStatus,
  SentinelAuthorizationTicket,
} from '@sentinel/domain';

export type ExecutionVenueType = 'METEORA_DBC' | 'PRESTOCKS_SECONDARY' | 'DEMO_SIMULATION' | 'SOLANA_MAINNET';

export class SecurityViolationError extends Error {
  public readonly violationType: 'BYPASS_ATTEMPT' | 'INVALID_TICKET' | 'EXPIRED_TICKET' | 'POLICY_BREACH';

  constructor(
    message: string,
    violationType: 'BYPASS_ATTEMPT' | 'INVALID_TICKET' | 'EXPIRED_TICKET' | 'POLICY_BREACH' = 'BYPASS_ATTEMPT'
  ) {
    super(message);
    this.name = 'SecurityViolationError';
    this.violationType = violationType;
  }
}

export interface ExecutionResult {
  success: boolean;
  transactionSignature: string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: number;
  outputAmount: number;
  executionPrice: number;
  isSimulation: boolean;
  timestamp: number;
  venueType: ExecutionVenueType;
  venueName: string;
  poolAddress: string;
  route: string;
  executionDurationMs: number;
  marketQuality?: MeteoraVerificationResult;
  error?: string;
}

export interface ExecutionAdapter {
  readonly venueType: ExecutionVenueType;
  readonly venueName: string;
  getMode(): 'LIVE' | 'SIMULATION';
  executeTrade(
    intent: TradeIntent,
    preState: PortfolioSnapshot,
    authorization?: SentinelAuthorizationTicket
  ): Promise<ExecutionResult>;
}

export interface DecisionCycleReport {
  cycleId: string;
  agentId: string;
  intent: TradeIntent;
  promise: PromiseRecord;
  evaluation: EvaluationOutcome;
  executionResult?: ExecutionResult;
  evidenceRecord: EvidenceRecord;
  resultingPortfolio: PortfolioSnapshot;
  status: PTAStatus;
  timestamp: number;
}

export interface DemoScenarioResult {
  step1BadDecision: DecisionCycleReport;
  step2AdaptedDecision: DecisionCycleReport;
  summary: string;
}

export interface MeteoraDBCMetrics {
  poolAddress: string;
  assetSymbol: string;
  liquidityDepthUsd: number;
  currentPriceUsd: number;
  referencePriceUsd: number;
  isGraduated: boolean;
}

export interface MeteoraVerificationResult {
  passed: boolean;
  liquidityPassed: boolean;
  priceDeviationPassed: boolean;
  actualDeviationBps: number;
  details: string;
}
