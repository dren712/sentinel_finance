import { createHash } from 'crypto';
import {
  PortfolioSnapshot,
  TradeIntent,
  FinancialPolicy,
  EvidenceRecord,
  SwarmVerificationSummary,
  PostconditionCheckResult,
  FailureCode,
} from './types';

/**
 * Generates deterministic SHA-256 hash of any JSON-serializable object with sorted keys
 */
export function canonicalHash(data: unknown): string {
  const canonicalString = JSON.stringify(data, Object.keys(data as object).sort());
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
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
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
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
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
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
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
    timestamp: Date.now(),
    isSimulation: params.isSimulation ?? false,
  };
}
