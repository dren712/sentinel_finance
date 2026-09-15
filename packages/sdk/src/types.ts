import {
  TradeIntent,
  PortfolioSnapshot,
  PromiseRecord,
  EvaluationOutcome,
  EvidenceRecord,
  PTAStatus,
} from '@sentinel/domain';

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
  error?: string;
}

export interface ExecutionAdapter {
  getMode(): 'LIVE' | 'SIMULATION';
  executeTrade(intent: TradeIntent, preState: PortfolioSnapshot): Promise<ExecutionResult>;
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
