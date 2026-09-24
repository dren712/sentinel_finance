/**
 * Sentinel Finance — Domain Types
 * Single Source of Truth for Sentinel Robo-Portfolio Foundation
 */

export type PromiseStatus =
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'EXECUTING'
  | 'SETTLED'
  | 'REJECTED'
  | 'EXPIRED';

export type PTAStatus = PromiseStatus | 'CREATED' | 'PROMISED' | 'VALIDATING';
export type TradeDirection = 'BUY' | 'SELL';

// -----------------------------------------------------------------------------
// 1. Asset & AssetVenue
// -----------------------------------------------------------------------------

export type AssetClass = 'TOKENIZED_EQUITY' | 'TOKENIZED_INDEX' | 'STABLECOIN' | 'PRE_IPO';
export type AssetStatus = 'ACTIVE' | 'HALTED' | 'PRE_IPO' | 'DELISTED';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  mint: string;
  underlyingAsset: string;
  issuer: string;
  decimals: number;
  status: AssetStatus;
  isStablecoin?: boolean;
  isIndex?: boolean;
  sector?: string;
  colorHex?: string;
  description?: string;
  basePriceUsd?: number;
}

export type VenueType =
  | 'METEORA_DBC'
  | 'ORCA_WHIRLPOOL'
  | 'RAYDIUM_CPMM'
  | 'PRESTOCKS_SECONDARY'
  | 'PYTH_ORACLE';

export interface AssetVenue {
  id: string;
  assetId: string;
  symbol: string;
  venueType: VenueType;
  poolAddress: string;
  baseMint: string;
  quoteMint: string;
  minLiquidityUsd: number;
  feeBps: number;
  isActive: boolean;
}

// -----------------------------------------------------------------------------
// 2. PriceSource (Pyth Network & Oracle Valuation)
// -----------------------------------------------------------------------------

export type PriceStatus = 'LIVE' | 'STALE' | 'SIMULATED' | 'WIDE_SPREAD' | 'UNAVAILABLE' | 'TRADING_HALTED';
export type MarketStatus = 'MARKET_OPEN' | 'MARKET_CLOSED' | 'EXTENDED_HOURS';

export interface PriceSource {
  source: 'PYTH_PRICE_FEED' | 'PYTH_HERMES_LIVE' | 'PYTH_BENCHMARK' | 'METEORA_DBC' | 'SIMULATED_ORACLE';
  feedId: string;
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
  exponent: number;
  status: PriceStatus;
  isSimulation?: boolean;
  ageSeconds?: number;
  underlyingAsset?: string;
  underlyingPrice?: number;
  trackingErrorBps?: number;
  marketStatus?: MarketStatus;
}

export interface NormalizedMarketPrice {
  symbol: string;
  assetId: string;
  priceUsd: number;
  confidenceUsd: number;
  confidenceMinUsd: number;
  confidenceMaxUsd: number;
  confidenceRatioBps: number;
  publishTime: number;
  publishTimeFormatted: string;
  exponent: number;
  feedId: string;
  feedDisplayId: string;
  source: 'Pyth Network' | 'Pyth Hermes Live' | 'Pyth Benchmark' | string;
  status: PriceStatus;
  isSimulation?: boolean;
  ageSeconds?: number;

  // Underlying equity basis comparison (Pyth dual-feed)
  underlyingSymbol?: string;
  underlyingFeedId?: string;
  underlyingPriceUsd?: number;
  trackingErrorBps: number;
  deviationPct: number;
  marketStatus: MarketStatus;
}

export interface OracleProvenance {
  source: string;
  feedId: string;
  feedDisplayId: string;
  priceUsd: number;
  confidenceUsd: number;
  confidenceMinUsd: number;
  confidenceMaxUsd: number;
  publishTime: number;
  publishTimeFormatted: string;
  underlyingSymbol?: string;
  underlyingFeedId?: string;
  underlyingPriceUsd?: number;
  trackingErrorBps: number;
  deviationPct: number;
}

// -----------------------------------------------------------------------------
// 3. Position & Portfolio
// -----------------------------------------------------------------------------

export interface Position {
  symbol: string;                // e.g. "AAPLx", "NVDAx", "SPYx", "USDC"
  name: string;                  // e.g. "Apple Tokenized Stock"
  mint: string;                  // Solana SPL Mint address
  amount: number;                // Quantity of tokens (UI units)
  priceUsd: number;              // Current price in USD
  valueUsd: number;              // amount * priceUsd
  exposureBps: number;           // valueUsd / totalValueUsd * 10000
  isStablecoin: boolean;
  isIndex?: boolean;             // e.g. SPYx (broad market ETF token)
  assetId?: string;
  assetClass?: AssetClass;
  costBasisUsd?: number;
  unrealizedPnlUsd?: number;

  // Real Token Account & ATA Projection (Phase 3)
  ata?: string;                  // Associated Token Account (ATA) address on Solana
  rawAmount?: string;            // Raw integer units in base atomic units (e.g. 125000000)
  decimals?: number;             // Standard SPL decimals (typically 6)
  verifiedPriceSource?: string;  // e.g. "Pyth Network (Crypto.AAPLX/USD)"
  sector?: string;               // e.g. "SEMICONDUCTORS", "TECHNOLOGY"
  issuer?: string;               // e.g. "Backed Finance", "PreStocks Protocol"
}

export interface Portfolio {
  portfolioId: string;
  owner: string;
  totalValueUsd: number;
  stablecoinValueUsd: number;
  stablecoinExposureBps: number;
  assets: Position[];            // Named `assets` for seamless backwards compatibility
  timestamp: number;

  // Real Portfolio State Projection (Phase 3)
  walletAddress?: string;        // Solana wallet holding the actual SPL ATAs
  sentinelPda?: string;          // Sentinel PDA acting as policy authority & execution guard
  projectionHash?: string;       // SHA-256 hash binding real token balances and Pyth oracle prices
  projectionTimestamp?: number;  // Timestamp of the verified on-chain projection
  source?: 'ON_CHAIN_PROJECTION' | 'SIMULATED_PROJECTION';
}

/**
 * Raw on-chain Solana SPL Token Holding
 */
export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  ataAddress: string;
  balanceRaw: string;            // Stringified BigInt to safely cross JSON boundaries
  balanceUi: number;             // Human-readable balance (balanceRaw / 10^decimals)
  owner: string;
}

/**
 * Verified Portfolio Projection Result
 */
export interface PortfolioProjectionResult {
  walletAddress: string;
  sentinelPda: string;
  holdings: TokenHolding[];
  normalizedPortfolio: Portfolio;
  projectionHash: string;
  verifiedAt: number;
}

/**
 * Institutional Sentinel PDA Authority Configuration
 */
export interface SentinelPdaConfig {
  pdaAddress: string;
  bump: number;
  owner: string;
  policyPda: string;
  agentPda: string;
  trackedMints: string[];
  roles: {
    isPolicyAuthority: boolean;
    isPortfolioConfiguration: boolean;
    isExecutionAuthority: boolean;
    isPromiseRegistry: boolean;
    isEvidenceAnchor: boolean;
  };
}

// -----------------------------------------------------------------------------
// 4. Policy
// -----------------------------------------------------------------------------

export interface Policy {
  policyId: string;
  owner: string;

  // Tier 1: Hard Constraints
  maxSingleAssetBps: number;      // e.g. 2500 for 25.00%
  minStablecoinBps: number;        // e.g. 2000 for 20.00%
  maxTradeValueUsd: number;        // e.g. 10000 ($10,000)
  maxSlippageBps: number;          // e.g. 100 for 1.00%

  // Tier 2: Portfolio Constraints
  maxSectorExposureBps?: number;   // e.g. 4000 for 40.00% max exposure to any single sector
  maxIssuerExposureBps?: number;   // e.g. 5000 for 50.00% max issuer exposure
  maxPositions?: number;           // e.g. 8 max concurrent non-stablecoin positions
  minDiversificationAssets?: number; // e.g. 3 minimum distinct assets held
  maxTurnoverBps?: number;         // e.g. 2500 for 25.00% max 24h turnover limit

  // Tier 3: Trading Constraints
  maxPriceDeviationBps?: number;   // e.g. 200 for 2.00% max basis price deviation
  maxQuoteAgeSeconds?: number;     // e.g. 60 seconds freshness limit
  minLiquidityUsd?: number;        // e.g. 25000 ($25,000 liquidity floor)
  maxPriceImpactBps?: number;      // e.g. 75 for 0.75% max estimated price impact
  venueAllowlist?: string[];       // e.g. ['METEORA_DBC', 'PRESTOCKS_SECONDARY', 'DEMO_SIMULATION']
  assetAllowlist?: string[];       // e.g. ['NVDAx', 'AAPLx', 'SPYx', 'USDC', 'SPACEXx', 'OPENAIx', 'STRIPEx']

  // Tier 4: Agent Constraints
  dailyTradeBudgetUsd?: number;    // e.g. 50000 ($50,000 / 24h budget)
  maxConsecutiveFailures?: number; // e.g. 3 consecutive rejections triggers circuit breaker
  policyExpiresAt?: number;        // epoch timestamp ms after which policy expires
  isEmergencyPaused?: boolean;     // emergency kill switch

  // Tier 5: Market Constraints
  staleOracleMaxSeconds?: number;  // e.g. 120 seconds
  maxOracleConfidenceBps?: number; // e.g. 150 for 1.50% max confidence ratio (sigma / price)
  maxTrackingErrorBps?: number;    // e.g. 250 for 2.50% max deviation from underlying
  marketHoursOnly?: boolean;       // if true, only trades during market hours
  requireHealthyVenue?: boolean;   // if true, venue status must be healthy

  // Phase 11: PreStocks Asset Class Constraints
  maxPublicEquitiesExposureBps?: number; // e.g. 7000 for 70.00% max public equities
  maxPreIpoExposureBps?: number;         // e.g. 2000 for 20.00% max private equity (PreStocks)

  policyVersion: number;
  isActive: boolean;
  updatedAt: number;
}

export interface AgentRiskState {
  agentId: string;
  tradesExecuted24hUsd: number;
  dailyTurnoverBps: number;
  consecutiveFailures: number;
  isCircuitBreakerTriggered: boolean;
  lastFailureTimestamp?: number;
  lastTradeTimestamp?: number;
  updatedAt: number;
}

// -----------------------------------------------------------------------------
// 5. Intent & Promise
// -----------------------------------------------------------------------------

export interface Intent {
  intentId: string;
  agentId: string;
  assetSymbol: string;
  assetMint: string;
  direction: TradeDirection;
  tradeAmountUsd: number;
  referencePriceUsd: number;
  timestamp: number;
  strategyRationale?: string;
  assetId?: string;
  venueId?: string;
  signature?: string;
}

export interface PromiseExpectedConstraints {
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxTradeValueUsd: number;
  maxSlippageBps: number;
  maxTrackingErrorBps?: number;
}

export interface PromiseWho {
  agentId: string;
  agentName: string;
  portfolioId: string;
  walletAddress: string;
  owner?: string;
}

export interface PromiseWhat {
  assetSymbol: string;
  assetMint: string;
  side: 'BUY' | 'SELL';
  amountUsd: number;
  estimatedTokens?: number;
}

export interface PromiseWhy {
  strategyName: string;
  strategyRationale: string;
  rationaleHash: string;
}

export interface PromiseUnderWhichPolicy {
  policyId: string;
  policyHash: string;
  policyVersion: number;
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxTradeValueUsd: number;
  maxTrackingErrorBps?: number;
}

export interface PromiseMarketAssumptions {
  quotedPriceUsd: number;
  priceSource: string;
  feedId?: string;
  confidenceUsd?: number;
  basisTrackingErrorBps?: number;
  publishTimeUtc?: string;
}

export interface PromiseExecutionLimits {
  maxSlippageBps: number;
  maxTradeValueUsd: number;
  minLiquidityDepthUsd?: number;
  targetVenue?: string;
}

export interface PromiseValidity {
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
}

export interface AuditExplanationInvariant {
  name: string;
  description: string;
  passed: boolean;
  actualValue: string;
  threshold: string;
  failureCode?: FailureCode;
}

export interface AuditExplanation {
  headline: string;
  summary: string;
  decision: 'ALLOWED' | 'BLOCKED';
  invariantsEvaluated: AuditExplanationInvariant[];
  marketTruthSummary: string;
  venueQualitySummary: string;
  timestamp: number;
}

export interface Promise {
  promiseId: string;

  // Conceptual Promise 2.0 Dimensions
  who: PromiseWho;
  what: PromiseWhat;
  why: PromiseWhy;
  underWhichPolicy: PromiseUnderWhichPolicy;
  marketAssumptions: PromiseMarketAssumptions;
  executionLimits: PromiseExecutionLimits;
  validity: PromiseValidity;
  status: PromiseStatus | PTAStatus;
  explanation?: AuditExplanation;

  // Backwards-Compatible Flat Fields
  agentId: string;
  policyHash: string;
  policyVersion: number;
  intentHash: string;
  intent: Intent;
  expectedConstraints: PromiseExpectedConstraints;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

// -----------------------------------------------------------------------------
// 6. Execution
// -----------------------------------------------------------------------------

export interface Execution {
  executionId: string;
  intentId: string;
  promiseId: string;
  venueType: VenueType | string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: number;
  outputAmount: number;
  executionPrice: number;
  quotedPrice: number;
  slippageBps: number;
  transactionSignature: string;
  isSimulation: boolean;
  timestamp: number;
}

// -----------------------------------------------------------------------------
// 7. Verification & Postcondition Checks
// -----------------------------------------------------------------------------

export type FailureCode = 
  | 'ERR_EXPOSURE_EXCEEDED'
  | 'ERR_STABLECOIN_RESERVE_BREACHED'
  | 'ERR_TRADE_SIZE_EXCEEDED'
  | 'ERR_SLIPPAGE_EXCEEDED'
  | 'ERR_INSUFFICIENT_FUNDS'
  | 'ERR_SOLVENCY_VIOLATION'
  | 'ERR_STALE_POLICY'
  | 'ERR_UNAUTHORIZED'
  | 'ERR_ORACLE_CONFIDENCE_TOO_WIDE'
  | 'ERR_TRACKING_ERROR_EXCEEDED'
  | 'ERR_LIQUIDITY_DEPTH_INSUFFICIENT'
  // Phase 6 Risk Engine DSL Failure Codes
  | 'ERR_SECTOR_EXPOSURE_EXCEEDED'
  | 'ERR_ISSUER_EXPOSURE_EXCEEDED'
  | 'ERR_MAX_POSITIONS_EXCEEDED'
  | 'ERR_DIVERSIFICATION_BREACHED'
  | 'ERR_TURNOVER_EXCEEDED'
  | 'ERR_QUOTE_STALE'
  | 'ERR_PRICE_IMPACT_EXCEEDED'
  | 'ERR_ASSET_NOT_ALLOWED'
  | 'ERR_VENUE_NOT_ALLOWED'
  | 'ERR_DAILY_BUDGET_EXCEEDED'
  | 'ERR_CIRCUIT_BREAKER_TRIGGERED'
  | 'ERR_POLICY_EXPIRED'
  | 'ERR_EMERGENCY_PAUSE'
  | 'ERR_MARKET_UNAVAILABLE'
  | 'ERR_VENUE_UNHEALTHY'
  | 'ERR_PUBLIC_EQUITIES_EXCEEDED';

/**
 * The Three Canonical Rejection Modes of Sentinel:
 * An autonomous investment agent bounded by both portfolio state and market reality.
 */
export type SentinelRejectionMode =
  | 'PORTFOLIO_FAILURE'       // Invariant breach: Single-asset exposure or Pre-IPO asset-class ceiling
  | 'MARKET_FAILURE'          // Venue context breach: Meteora DBC price impact vs. user slippage limit or shallow depth
  | 'DATA_INTEGRITY_FAILURE';  // Oracle security breach: Pyth price quote stale or confidence interval wide

/**
 * Maps a FailureCode to its corresponding SentinelRejectionMode
 */
export function getRejectionModeFromFailureCode(code?: FailureCode): SentinelRejectionMode {
  if (!code) return 'PORTFOLIO_FAILURE';
  switch (code) {
    case 'ERR_SLIPPAGE_EXCEEDED':
    case 'ERR_PRICE_IMPACT_EXCEEDED':
    case 'ERR_LIQUIDITY_DEPTH_INSUFFICIENT':
    case 'ERR_VENUE_NOT_ALLOWED':
    case 'ERR_VENUE_UNHEALTHY':
    case 'ERR_MARKET_UNAVAILABLE':
      return 'MARKET_FAILURE';

    case 'ERR_QUOTE_STALE':
    case 'ERR_ORACLE_CONFIDENCE_TOO_WIDE':
    case 'ERR_TRACKING_ERROR_EXCEEDED':
      return 'DATA_INTEGRITY_FAILURE';

    default:
      return 'PORTFOLIO_FAILURE';
  }
}

export type RiskCheckName =
  | 'MAX_SINGLE_ASSET'
  | 'MIN_STABLECOIN'
  | 'MAX_TRADE_SIZE'
  | 'SLIPPAGE'
  | 'ORACLE_CONFIDENCE'
  | 'TRACKING_ERROR'
  | 'SECTOR_EXPOSURE'
  | 'ISSUER_EXPOSURE'
  | 'MAX_POSITIONS'
  | 'DIVERSIFICATION'
  | 'MAX_TURNOVER'
  | 'QUOTE_FRESHNESS'
  | 'PRICE_IMPACT'
  | 'ASSET_ALLOWLIST'
  | 'VENUE_ALLOWLIST'
  | 'DAILY_TRADE_BUDGET'
  | 'CIRCUIT_BREAKER'
  | 'POLICY_EXPIRY'
  | 'EMERGENCY_PAUSE'
  | 'MARKET_STATUS'
  | 'VENUE_HEALTH';

export interface PostconditionCheckResult {
  checkName: RiskCheckName | string;
  passed: boolean;
  expectedBpsOrValue: number | string;
  actualBpsOrValue: number | string;
  description: string;
  failureCode?: FailureCode;
}

export interface EvaluationOutcome {
  allPassed: boolean;
  checks: PostconditionCheckResult[];
  failureCode?: FailureCode;
  failureReason?: string;
  postState: Portfolio;
}

export interface VerifierSubCheck {
  name: string;
  passed: boolean;
  actual: string;
  limit: string;
  description: string;
  failureCode?: FailureCode;
}

export interface VerifierVerdict {
  name:
    | 'RiskVerifier'
    | 'BalanceVerifier'
    | 'PolicyVerifier'
    | 'LiquidityVerifier'
    | 'PriceIntegrityVerifier'
    | 'PortfolioVerifier'
    | 'PythOracleVerifier'
    | 'MeteoraDBCVerifier';
  passed: boolean;
  message: string;
  timestamp: number;
  subChecks?: VerifierSubCheck[];
  details?: string;
}

export interface SwarmVerificationSummary {
  verdicts: VerifierVerdict[];
  passedCount: number;
  totalCount: number;
  consensus: boolean;
  checksPassedCount?: number;
  checksTotalCount?: number;
  failedChecks?: Array<{ name: string; actual: string; limit: string; description: string }>;
  passedChecks?: Array<{ name: string; actual: string; limit: string; description: string }>;
}

export interface Verification {
  verificationId: string;
  intentId: string;
  promiseId: string;
  checks: PostconditionCheckResult[];
  allPassed: boolean;
  verdicts: VerifierVerdict[];
  consensus: boolean;
  failureCode?: FailureCode;
  failureReason?: string;
  timestamp: number;
}

export interface SentinelAuthorizationTicket {
  ticketId: string;
  promiseId: string;
  agentId: string;
  intentHash: string;
  policyHash: string;
  preStateHash: string;
  authorizedAt: number;
  expiresAt: number;
  authorizedAmountUsd: number;
  authorizedDirection: 'BUY' | 'SELL';
  targetAssetSymbol: string;
  maxSlippageBps: number;
  signature?: string;
}

export interface ExecutionVenueDetails {
  venueType: 'METEORA_DBC' | 'PRESTOCKS_SECONDARY' | 'DEMO_SIMULATION' | 'SOLANA' | 'SOLANA_MAINNET';
  venueName: string;
  cluster?: 'devnet' | 'mainnet' | 'localnet';
  explorerUrl?: string;
  poolAddress?: string;
  route?: string;
  isHealthy?: boolean;
  liquidityDepthUsd?: number;
  marketQuality?: {
    liquidityPassed: boolean;
    liquidityDepthUsd: number;
    priceDeviationPassed: boolean;
    actualDeviationBps: number;
    details: string;
  };
  durationMs?: number;
}

export interface Evidence {
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
  oracleProvenance?: OracleProvenance;
  executionVenue?: ExecutionVenueDetails;
  auditExplanation?: AuditExplanation;
  promise?: Promise;
  timestamp: number;
  isSimulation: boolean;
}

// -----------------------------------------------------------------------------
// Agent Profile
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Financial Audit Receipt (Phase 9)
// -----------------------------------------------------------------------------

export interface SolanaVerificationMetadata {
  programId: string;
  pda: string;
  slot: number;
  cluster: string;
  explorerUrl?: string;
  isMainnetEquivalent: boolean;
}

export interface SentinelReceipt {
  receiptNumber: string;         // e.g. "Decision #00421"
  decisionId: string;            // e.g. "cycle_1789481213745"
  intentSummary: string;         // e.g. "BUY NVDAx $5,000"
  agentName: string;             // e.g. "Sentinel Robo-01"
  policyName: string;            // e.g. "Balanced Growth v4"
  marketDataSource: string;      // e.g. "Pyth Network"
  preStateShortHash: string;     // e.g. "0x7f4a...9b12"
  postStateShortHash: string;    // e.g. "0x3c2e...88ad"
  decision: 'APPROVED' | 'REJECTED';
  executionSignature: string;    // e.g. "5tZ9... (Solana Base58) or sim_tx_..."
  evidenceHash: string;          // e.g. "sha256:a81c...2f09"
  integrityVerified: boolean;    // true (✓ VERIFIED)
  timestamp: number;
  formattedTimestamp: string;
  solanaVerification: SolanaVerificationMetadata;

  // Technical drawer detail fields (Developer/Judge view)
  technicalDetails: {
    policyHash: string;
    intentHash: string;
    preStateHash: string;
    postStateHash: string;
    rationaleHash?: string;
    evidenceHash: string;
    transactionSignature: string;
    swarmConsensus: {
      passedCount: number;
      totalCount: number;
      consensus: boolean;
    };
    underlyingEquity?: string;
    trackingErrorBps?: number;
    oracleConfidenceUsd?: number;
  };
}

// -----------------------------------------------------------------------------
// Backwards-Compatible Type Aliases
// -----------------------------------------------------------------------------

export type PortfolioAsset = Position;
export type PortfolioSnapshot = Portfolio;
export type FinancialPolicy = Policy;
export type TradeIntent = Intent;
export type PromiseRecord = Promise;
export type EvidenceRecord = Evidence;

