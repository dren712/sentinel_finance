import {
  TradeIntent,
  PortfolioSnapshot,
  PromiseRecord,
  EvaluationOutcome,
  EvidenceRecord,
  PTAStatus,
  PromiseStatus,
  AuditExplanation,
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
  status: PromiseStatus | PTAStatus;
  timestamp: number;
}

export interface DemoScenarioResult {
  step1BadDecision: DecisionCycleReport;
  step2AdaptedDecision: DecisionCycleReport;
  summary: string;
}

// -----------------------------------------------------------------------------
// Autonomous Agent Reactive Adaptation Loop (Phase 8)
// -----------------------------------------------------------------------------

export type AgentLoopStage =
  | 'IDLE'
  | 'OBSERVE'
  | 'FORMULATE'
  | 'PROPOSE'
  | 'SENTINEL_CHECK'
  | 'REJECTED'
  | 'READ_FAILURE'
  | 'ADAPT'
  | 'REPROPOSE'
  | 'SENTINEL_RECHECK'
  | 'SETTLED';

export interface BreachedInvariant {
  name: string;
  actual: string;
  limit: string;
  rule: string;
}

export interface AdaptationDetails {
  initialAmountUsd: number;
  adaptedAmountUsd: number;
  breachedInvariants: BreachedInvariant[];
  explanationText: string;
  calculations: {
    limitByExposure: number;
    limitByReserve: number;
    limitByTradeSize: number;
    appliedLimit: number;
  };
}

export interface AgentLoopState {
  stage: AgentLoopStage;
  stageIndex: number;
  totalStages: number;
  strategyName: string;
  targetAssetSymbol: string;
  initialProposedAmountUsd: number;
  adaptedProposedAmountUsd?: number;
  status: 'IDLE' | 'RUNNING' | 'ADAPTED_AND_SETTLED' | 'BLOCKED';
  breachedInvariants: BreachedInvariant[];
  adaptationExplanation?: string;
  latestDecision?: {
    action: 'BUY' | 'SELL';
    assetSymbol: string;
    amountUsd: number;
    status: 'APPROVED' | 'REJECTED';
    approved: boolean;
    reasons: string[];
  };
  whyNarrative?: {
    initialProposalText: string;
    rejectionSummary: string;
    breachedInvariantsList: Array<{ name: string; actual: string; limit: string }>;
    recalculationText: string;
    sentinelStatusText: string;
  };
  updatedAt: number;
}

export interface AutonomousAdaptationResult {
  cycleId: string;
  agentId: string;
  step1RejectedDecision: DecisionCycleReport;
  step2SettledDecision: DecisionCycleReport;
  loopState: AgentLoopState;
  adaptationDetails: AdaptationDetails;
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

