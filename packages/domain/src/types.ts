/**
 * Sentinel Finance — Domain Types
 * Single Source of Truth for Sentinel Robo-Portfolio
 */

export type PTAStatus = 'CREATED' | 'PROMISED' | 'VALIDATING' | 'SETTLED' | 'REJECTED';

export interface FinancialPolicy {
  policyId: string;
  owner: string;
  maxSingleAssetBps: number;    // e.g. 2500 for 25.00%
  minStablecoinBps: number;      // e.g. 2000 for 20.00%
  maxTradeValueUsd: number;      // e.g. 10000 ($10,000)
  maxSlippageBps: number;        // e.g. 100 for 1.00%
  policyVersion: number;
  isActive: boolean;
  updatedAt: number;
}

export interface PortfolioAsset {
  symbol: string;                // e.g. "AAPLx", "NVDAx", "SPYx", "USDC"
  name: string;                  // e.g. "Apple Tokenized Stock"
  mint: string;                  // Solana SPL Mint address
  amount: number;                // Quantity of tokens
  priceUsd: number;              // Current price in USD
  valueUsd: number;              // amount * priceUsd
  exposureBps: number;           // valueUsd / totalValueUsd * 10000
  isStablecoin: boolean;
  isIndex?: boolean;             // e.g. SPYx (broad market ETF token)
}

export interface PortfolioSnapshot {
  portfolioId: string;
  owner: string;
  totalValueUsd: number;
  stablecoinValueUsd: number;
  stablecoinExposureBps: number;
  assets: PortfolioAsset[];
  timestamp: number;
}

export type TradeDirection = 'BUY' | 'SELL';

export interface TradeIntent {
  intentId: string;
  agentId: string;
  assetSymbol: string;
  assetMint: string;
  direction: TradeDirection;
  tradeAmountUsd: number;
  referencePriceUsd: number;
  timestamp: number;
  strategyRationale?: string;
}

export interface PromiseExpectedConstraints {
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxTradeValueUsd: number;
  maxSlippageBps: number;
}

export interface PromiseRecord {
  promiseId: string;
  agentId: string;
  policyHash: string;
  policyVersion: number;
  intentHash: string;
  intent: TradeIntent;
  expectedConstraints: PromiseExpectedConstraints;
  status: PTAStatus;
  createdAt: number;
  updatedAt: number;
}

export type FailureCode = 
  | 'ERR_EXPOSURE_EXCEEDED'
  | 'ERR_STABLECOIN_RESERVE_BREACHED'
  | 'ERR_TRADE_SIZE_EXCEEDED'
  | 'ERR_SLIPPAGE_EXCEEDED'
  | 'ERR_INSUFFICIENT_FUNDS'
  | 'ERR_STALE_POLICY'
  | 'ERR_UNAUTHORIZED';

export interface PostconditionCheckResult {
  checkName: 'MAX_SINGLE_ASSET' | 'MIN_STABLECOIN' | 'MAX_TRADE_SIZE' | 'SLIPPAGE';
  passed: boolean;
  expectedBpsOrValue: number;
  actualBpsOrValue: number;
  description: string;
  failureCode?: FailureCode;
}

export interface EvaluationOutcome {
  allPassed: boolean;
  checks: PostconditionCheckResult[];
  failureCode?: FailureCode;
  failureReason?: string;
  postState: PortfolioSnapshot;
}

export interface VerifierVerdict {
  name: 'RiskVerifier' | 'BalanceVerifier' | 'PolicyVerifier';
  passed: boolean;
  message: string;
  timestamp: number;
}

export interface SwarmVerificationSummary {
  verdicts: VerifierVerdict[];
  passedCount: number;
  totalCount: number;
  consensus: boolean;
}

export interface EvidenceRecord {
  id: string;
  agentId: string;
  promiseId: string;
  policyVersion: number;
  policyHash: string;
  intentHash: string;
  transactionSignature: string;
  preStateHash: string;
  postStateHash: string;
  verificationResult: 'SETTLED' | 'REJECTED';
  failureCode?: FailureCode;
  failureReason?: string;
  swarmSummary: SwarmVerificationSummary;
  checks: PostconditionCheckResult[];
  timestamp: number;
  isSimulation: boolean;
}

export interface AgentProfile {
  agentId: string;
  name: string;
  owner: string;
  agentAuthority: string;
  portfolioId: string;
  status: 'ACTIVE' | 'PAUSED' | 'STEP_BY_STEP';
  currentObjective: string;
  createdAt: number;
}
