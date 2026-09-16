/**
 * Sentinel Finance — Domain Types
 * Single Source of Truth for Sentinel Robo-Portfolio Foundation
 */

export type PTAStatus = 'CREATED' | 'PROMISED' | 'VALIDATING' | 'SETTLED' | 'REJECTED';
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

export type PriceStatus = 'LIVE' | 'STALE' | 'SIMULATED' | 'UNAVAILABLE' | 'TRADING_HALTED';
export type MarketStatus = 'MARKET_OPEN' | 'MARKET_CLOSED' | 'EXTENDED_HOURS';

export interface PriceSource {
  source: 'PYTH_PRICE_FEED' | 'PYTH_BENCHMARK' | 'METEORA_DBC' | 'SIMULATED_ORACLE';
  feedId: string;
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
  exponent: number;
  status: PriceStatus;
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
  source: 'Pyth Network' | 'Pyth Hermes Live' | 'Pyth Benchmark';
  status: PriceStatus;

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
  maxSingleAssetBps: number;      // e.g. 2500 for 25.00%
  minStablecoinBps: number;        // e.g. 2000 for 20.00%
  maxTradeValueUsd: number;        // e.g. 10000 ($10,000)
  maxSlippageBps: number;          // e.g. 100 for 1.00%
  maxPreIpoExposureBps?: number;   // e.g. 1500 for 15.00% max private equity
  maxOracleConfidenceBps?: number; // e.g. 150 for 1.50% max confidence ratio (sigma / price)
  maxTrackingErrorBps?: number;    // e.g. 250 for 2.50% max deviation from underlying
  policyVersion: number;
  isActive: boolean;
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

export interface Promise {
  promiseId: string;
  agentId: string;
  policyHash: string;
  policyVersion: number;
  intentHash: string;
  intent: Intent;
  expectedConstraints: PromiseExpectedConstraints;
  status: PTAStatus;
  createdAt: number;
  updatedAt: number;
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
  | 'ERR_STALE_POLICY'
  | 'ERR_UNAUTHORIZED'
  | 'ERR_ORACLE_CONFIDENCE_TOO_WIDE'
  | 'ERR_TRACKING_ERROR_EXCEEDED'
  | 'ERR_LIQUIDITY_DEPTH_INSUFFICIENT';

export interface PostconditionCheckResult {
  checkName: 'MAX_SINGLE_ASSET' | 'MIN_STABLECOIN' | 'MAX_TRADE_SIZE' | 'SLIPPAGE' | 'ORACLE_CONFIDENCE' | 'TRACKING_ERROR';
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
  postState: Portfolio;
}

export interface VerifierVerdict {
  name: 'RiskVerifier' | 'BalanceVerifier' | 'PolicyVerifier' | 'PythOracleVerifier' | 'MeteoraDBCVerifier';
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
  venueType: 'METEORA_DBC' | 'PRESTOCKS_SECONDARY' | 'DEMO_SIMULATION' | 'SOLANA_MAINNET';
  venueName: string;
  poolAddress?: string;
  route?: string;
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
// Backwards-Compatible Type Aliases
// -----------------------------------------------------------------------------

export type PortfolioAsset = Position;
export type PortfolioSnapshot = Portfolio;
export type FinancialPolicy = Policy;
export type TradeIntent = Intent;
export type PromiseRecord = Promise;
export type EvidenceRecord = Evidence;
