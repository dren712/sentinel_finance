import { createHash } from 'crypto';
import {
  PortfolioSnapshot,
  TradeIntent,
  FinancialPolicy,
  EvidenceRecord,
  SwarmVerificationSummary,
  PostconditionCheckResult,
  FailureCode,
  OracleProvenance,
  Promise,
  AuditExplanation,
  AuditExplanationInvariant,
  ExecutionVenueDetails,
} from './types';

/**
 * Deterministic Canonical JSON Serializer
 * Recursively orders object keys lexicographically and preserves array ordering.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(item => canonicalJsonStringify(item)).join(',') + ']';
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const val = record[key];
    if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
      entries.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val)}`);
    }
  }

  return '{' + entries.join(',') + '}';
}

/**
 * Generates deterministic SHA-256 hash using canonical JSON serialization
 */
export function canonicalHash(data: unknown): string {
  const canonicalString = canonicalJsonStringify(data);
  return createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Computes canonical commitment hash of a portfolio state snapshot
 */
export function hashPortfolioState(snapshot: PortfolioSnapshot): string {
  // Sort assets by mint for consistent canonical order
  const sortedAssets = [...snapshot.assets].sort((a, b) => a.mint.localeCompare(b.mint));
  const payload = {
    portfolioId: snapshot.portfolioId,
    totalValueUsd: Math.round(snapshot.totalValueUsd * 100) / 100,
    stablecoinValueUsd: Math.round(snapshot.stablecoinValueUsd * 100) / 100,
    stablecoinExposureBps: snapshot.stablecoinExposureBps,
    assets: sortedAssets.map(a => ({
      mint: a.mint,
      symbol: a.symbol,
      amount: Math.round(a.amount * 10_000) / 10_000,
      valueUsd: Math.round(a.valueUsd * 100) / 100,
      exposureBps: a.exposureBps,
    })),
  };
  return canonicalHash(payload);
}

/**
 * Computes canonical hash of a trade intent
 */
export function hashTradeIntent(intent: TradeIntent): string {
  const payload = {
    intentId: intent.intentId,
    agentId: intent.agentId,
    assetMint: intent.assetMint,
    assetSymbol: intent.assetSymbol,
    direction: intent.direction,
    tradeAmountUsd: intent.tradeAmountUsd,
    referencePriceUsd: intent.referencePriceUsd,
  };
  return canonicalHash(payload);
}

/**
 * Computes canonical hash of an active financial policy
 */
export function hashFinancialPolicy(policy: FinancialPolicy): string {
  const payload = {
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    maxSingleAssetBps: policy.maxSingleAssetBps,
    minStablecoinBps: policy.minStablecoinBps,
    maxTradeValueUsd: policy.maxTradeValueUsd,
    maxSlippageBps: policy.maxSlippageBps,
    isActive: policy.isActive,
    maxSectorExposureBps: policy.maxSectorExposureBps,
    maxIssuerExposureBps: policy.maxIssuerExposureBps,
    maxPositions: policy.maxPositions,
    minDiversificationAssets: policy.minDiversificationAssets,
    dailyTradeBudgetUsd: policy.dailyTradeBudgetUsd,
    maxConsecutiveFailures: policy.maxConsecutiveFailures,
    isEmergencyPaused: policy.isEmergencyPaused,
  };
  return canonicalHash(payload);
}

/**
 * Generates an institutional, human-readable AuditExplanation answering:
 * "Why did Sentinel allow this?" (or "Why did Sentinel block this?")
 */
export function generateAuditExplanation(params: {
  promise: Promise;
  checks: PostconditionCheckResult[];
  verificationResult: 'SETTLED' | 'REJECTED';
  failureReason?: string;
  failureCode?: FailureCode;
  oracleProvenance?: OracleProvenance;
  executionVenue?: ExecutionVenueDetails;
}): AuditExplanation {
  const isAllowed = params.verificationResult === 'SETTLED';
  const asset = params.promise.what?.assetSymbol ?? params.promise.intent?.assetSymbol ?? 'ASSET';
  const side = params.promise.what?.side ?? params.promise.intent?.direction ?? 'BUY';
  const amountUsd = params.promise.what?.amountUsd ?? params.promise.intent?.tradeAmountUsd ?? 0;

  const invariantsEvaluated: AuditExplanationInvariant[] = params.checks.map(c => {
    let actualValue = `${c.actualBpsOrValue}`;
    let threshold = `${c.expectedBpsOrValue}`;

    const numActual = typeof c.actualBpsOrValue === 'number' ? c.actualBpsOrValue : Number(c.actualBpsOrValue) || 0;
    const numExpected = typeof c.expectedBpsOrValue === 'number' ? c.expectedBpsOrValue : Number(c.expectedBpsOrValue) || 0;

    if (c.checkName === 'MAX_SINGLE_ASSET' || c.checkName === 'MIN_STABLECOIN') {
      actualValue = `${(numActual / 100).toFixed(2)}%`;
      threshold = `${c.checkName === 'MAX_SINGLE_ASSET' ? '≤ ' : '≥ '}${(numExpected / 100).toFixed(2)}%`;
    } else if (c.checkName === 'SECTOR_EXPOSURE' || c.checkName === 'ISSUER_EXPOSURE') {
      actualValue = `${(numActual / 100).toFixed(2)}%`;
      threshold = `≤ ${(numExpected / 100).toFixed(2)}%`;
    } else if (c.checkName === 'MAX_TRADE_SIZE' || c.checkName === 'DAILY_TRADE_BUDGET') {
      actualValue = `$${numActual.toLocaleString()}`;
      threshold = `≤ $${numExpected.toLocaleString()}`;
    } else if (c.checkName === 'SLIPPAGE' || c.checkName === 'PRICE_IMPACT' || c.checkName === 'ORACLE_CONFIDENCE') {
      actualValue = `${(numActual / 100).toFixed(2)}%`;
      threshold = `≤ ${(numExpected / 100).toFixed(2)}%`;
    } else if (c.checkName === 'TRACKING_ERROR') {
      actualValue = `${numActual} bps`;
      threshold = `≤ ${numExpected} bps`;
    } else if (c.checkName === 'MAX_POSITIONS') {
      actualValue = `${numActual} positions`;
      threshold = `≤ ${numExpected} positions`;
    } else if (c.checkName === 'DIVERSIFICATION') {
      actualValue = `${numActual} assets`;
      threshold = `≥ ${numExpected} assets`;
    } else if (c.checkName === 'CIRCUIT_BREAKER') {
      actualValue = `${numActual} consecutive failures`;
      threshold = `< ${numExpected} allowed`;
    } else if (c.checkName === 'EMERGENCY_PAUSE') {
      actualValue = numActual === 1 ? 'PAUSED' : 'ACTIVE';
      threshold = 'ACTIVE';
    } else if (c.checkName === 'QUOTE_FRESHNESS' || c.checkName === 'ORACLE_FRESHNESS') {
      actualValue = `${numActual}s`;
      threshold = `≤ ${numExpected}s`;
    } else if (c.checkName === 'ASSET_ALLOWLIST' || c.checkName === 'VENUE_ALLOWLIST') {
      actualValue = c.passed ? 'ALLOWLISTED' : 'NOT ALLOWLISTED';
      threshold = 'ALLOWLISTED';
    } else if (c.checkName === 'VENUE_HEALTH' || c.checkName === 'MARKET_STATUS') {
      actualValue = c.passed ? 'ONLINE' : 'DEGRADED';
      threshold = 'ONLINE';
    }

    return {
      name: c.checkName,
      description: c.description,
      passed: c.passed,
      actualValue,
      threshold,
      failureCode: c.failureCode,
    };
  });

  const headline = isAllowed
    ? `Sentinel Authorized: All mathematical risk bounds, Pyth oracle confidence intervals, and venue liquidity verified.`
    : `Sentinel Blocked Trade: Invariant violation detected (${params.failureCode ?? 'RISK_CEILING_EXCEEDED'}). Capital preserved.`;

  const summary = isAllowed
    ? `Autonomous intent to ${side} $${amountUsd.toLocaleString()} of ${asset} strictly satisfies single-asset cap (${((params.promise.underWhichPolicy?.maxSingleAssetBps ?? 2500) / 100).toFixed(2)}%), stablecoin reserve floor (${((params.promise.underWhichPolicy?.minStablecoinBps ?? 2000) / 100).toFixed(2)}%), and Pyth market pricing integrity.`
    : `Autonomous intent to ${side} $${amountUsd.toLocaleString()} of ${asset} was rejected: ${params.failureReason ?? 'Policy bounds exceeded'}. Portfolio state remained completely untouched.`;

  const marketTruthSummary = params.oracleProvenance
    ? `Pyth feed ${params.oracleProvenance.feedDisplayId} at $${params.oracleProvenance.priceUsd.toFixed(2)} (±$${params.oracleProvenance.confidenceUsd.toFixed(2)}). Basis tracking error: ${(params.oracleProvenance.deviationPct ?? 0).toFixed(2)}%.`
    : `Reference price $${(params.promise.marketAssumptions?.quotedPriceUsd ?? 100).toFixed(2)} sourced from ${params.promise.marketAssumptions?.priceSource ?? 'Oracle'}.`;

  const venueQualitySummary = params.executionVenue
    ? `${params.executionVenue.venueName} via ${params.executionVenue.route ?? 'standard route'}. Pool: ${params.executionVenue.poolAddress ?? 'Deterministic engine'}.`
    : `Execution target: ${params.promise.executionLimits?.targetVenue ?? 'Sentinel Execution Adapter'}.`;

  return {
    headline,
    summary,
    decision: isAllowed ? 'ALLOWED' : 'BLOCKED',
    invariantsEvaluated,
    marketTruthSummary,
    venueQualitySummary,
    timestamp: Date.now(),
  };
}

/**
 * Creates an immutable PROVN evidence record for an accepted or rejected state transition
 */
export function createEvidenceRecord(params: {
  agentId: string;
  promiseId: string;
  policy: FinancialPolicy;
  intent: TradeIntent;
  preState: PortfolioSnapshot;
  postState: PortfolioSnapshot;
  transactionSignature: string;
  verificationResult: 'SETTLED' | 'REJECTED';
  checks: PostconditionCheckResult[];
  swarmSummary: SwarmVerificationSummary;
  failureCode?: FailureCode;
  failureReason?: string;
  isSimulation?: boolean;
  oracleProvenance?: OracleProvenance;
  executionVenue?: ExecutionVenueDetails;
  auditExplanation?: AuditExplanation;
  promise?: Promise;
}): EvidenceRecord {
  const id = `provn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const policyHash = hashFinancialPolicy(params.policy);
  const intentHash = hashTradeIntent(params.intent);
  const preStateHash = hashPortfolioState(params.preState);
  const postStateHash = hashPortfolioState(params.postState);

  return {
    id,
    agentId: params.agentId,
    promiseId: params.promiseId,
    policyVersion: params.policy.policyVersion,
    policyHash,
    intentHash,
    transactionSignature: params.transactionSignature,
    preStateHash,
    postStateHash,
    verificationResult: params.verificationResult,
    failureCode: params.failureCode,
    failureReason: params.failureReason,
    swarmSummary: params.swarmSummary,
    checks: params.checks,
    oracleProvenance: params.oracleProvenance,
    executionVenue: params.executionVenue,
    auditExplanation: params.auditExplanation,
    promise: params.promise,
    timestamp: Date.now(),
    isSimulation: params.isSimulation ?? false,
  };
}

export const createEvidence = createEvidenceRecord;
