'use client';

import React, { useState } from 'react';
import {
  FinancialPolicy,
  AgentRiskState,
  CONSERVATIVE_INSTITUTIONAL_POLICY,
  BALANCED_MULTI_ASSET_POLICY,
  HIGH_ALPHA_GROWTH_POLICY,
  hashFinancialPolicy,
  deriveSentinelPda,
  PortfolioSnapshot,
} from '@sentinel/domain';
import {
  Save,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getExplorerAddressUrl } from '@/lib/config';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { PageHeader } from './ui/PageHeader';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

export interface PolicySaveOutcome {
  status: 'committed_pda' | 'saved_simulation' | 'failed';
  signature?: string;
  error?: string;
}

interface GuaranteesViewProps {
  policy: FinancialPolicy;
  portfolio?: PortfolioSnapshot;
  mode?: 'SIMULATION' | 'LIVE';
  onUpdatePolicy: (
    updated: Partial<FinancialPolicy>
  ) => Promise<PolicySaveOutcome | void> | PolicySaveOutcome | void;
  agentRiskState?: AgentRiskState;
  onResetCircuitBreaker?: () => void;
}

export const GuaranteesView: React.FC<GuaranteesViewProps> = ({
  policy,
  portfolio,
  mode = 'SIMULATION',
  onUpdatePolicy,
  agentRiskState,
  onResetCircuitBreaker,
}) => {
  // Four Core Controls (On-Chain Enforced by PolicyAccount PDA)
  const [maxSingleAssetPct, setMaxSingleAssetPct] = useState(policy.maxSingleAssetBps / 100);
  const [minStablecoinPct, setMinStablecoinPct] = useState(policy.minStablecoinBps / 100);
  const [maxTradeValue, setMaxTradeValue] = useState(policy.maxTradeValueUsd);
  const [maxSlippagePct, setMaxSlippagePct] = useState(policy.maxSlippageBps / 100);

  // Advanced / Advisory Controls (Collapsed by default)
  const [maxPublicEquitiesExposurePct, setMaxPublicEquitiesExposurePct] = useState(
    (policy.maxPublicEquitiesExposureBps ?? 7000) / 100
  );
  const [maxPreIpoExposurePct, setMaxPreIpoExposurePct] = useState(
    (policy.maxPreIpoExposureBps ?? 2000) / 100
  );
  const [isEmergencyPaused, setIsEmergencyPaused] = useState(policy.isEmergencyPaused ?? false);
  const [maxSectorExposurePct, setMaxSectorExposurePct] = useState(
    (policy.maxSectorExposureBps ?? 4500) / 100
  );
  const [maxIssuerExposurePct, setMaxIssuerExposurePct] = useState(
    (policy.maxIssuerExposureBps ?? 3500) / 100
  );
  const [maxPositions, setMaxPositions] = useState(policy.maxPositions ?? 8);
  const [minDiversificationAssets, setMinDiversificationAssets] = useState(
    policy.minDiversificationAssets ?? 2
  );
  const [maxTurnoverPct, setMaxTurnoverPct] = useState((policy.maxTurnoverBps ?? 2500) / 100);
  const [maxQuoteAgeSeconds, setMaxQuoteAgeSeconds] = useState(policy.maxQuoteAgeSeconds ?? 60);
  const [maxPriceImpactPct, setMaxPriceImpactPct] = useState(
    (policy.maxPriceImpactBps ?? 75) / 100
  );
  const [minLiquidityUsd, setMinLiquidityUsd] = useState(policy.minLiquidityUsd ?? 25000);
  const [dailyTradeBudgetUsd, setDailyTradeBudgetUsd] = useState(
    policy.dailyTradeBudgetUsd ?? 50000
  );
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState(
    policy.maxConsecutiveFailures ?? 3
  );
  const [maxTrackingErrorBps, setMaxTrackingErrorBps] = useState(
    policy.maxTrackingErrorBps ?? 250
  );
  const [maxOracleConfidenceBps, setMaxOracleConfidenceBps] = useState(
    policy.maxOracleConfidenceBps ?? 150
  );

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<PolicySaveOutcome | null>(null);
  const [copiedDsl, setCopiedDsl] = useState(false);
  const [activeProfile, setActiveProfile] = useState<string>('custom');

  const sentinelPda = deriveSentinelPda(policy.policyId);

  const highestAssetExposurePct = React.useMemo(() => {
    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) return 20.0;
    const nonCash = portfolio.assets.filter((a) => !a.isStablecoin && !a.isIndex);
    if (nonCash.length === 0) return 0;
    return Math.max(...nonCash.map((a) => a.exposureBps)) / 100;
  }, [portfolio]);

  const currentStableReservePct = React.useMemo(() => {
    if (!portfolio) return 25.0;
    return (portfolio.stablecoinExposureBps ?? 2500) / 100;
  }, [portfolio]);

  const hasUnsavedChanges =
    Math.round(maxSingleAssetPct * 100) !== policy.maxSingleAssetBps ||
    Math.round(minStablecoinPct * 100) !== policy.minStablecoinBps ||
    maxTradeValue !== policy.maxTradeValueUsd ||
    Math.round(maxSlippagePct * 100) !== policy.maxSlippageBps ||
    Math.round(maxPublicEquitiesExposurePct * 100) !==
      (policy.maxPublicEquitiesExposureBps ?? 7000) ||
    Math.round(maxPreIpoExposurePct * 100) !== (policy.maxPreIpoExposureBps ?? 2000) ||
    maxOracleConfidenceBps !== (policy.maxOracleConfidenceBps ?? 150) ||
    (policy.isEmergencyPaused ?? false) !== isEmergencyPaused;

  const loadProfile = (profile: FinancialPolicy, name: string) => {
    setActiveProfile(name);
    setMaxSingleAssetPct(profile.maxSingleAssetBps / 100);
    setMinStablecoinPct(profile.minStablecoinBps / 100);
    setMaxPublicEquitiesExposurePct((profile.maxPublicEquitiesExposureBps ?? 7000) / 100);
    setMaxPreIpoExposurePct((profile.maxPreIpoExposureBps ?? 2000) / 100);
    setMaxTradeValue(profile.maxTradeValueUsd);
    setMaxSlippagePct(profile.maxSlippageBps / 100);
    setMaxSectorExposurePct((profile.maxSectorExposureBps ?? 4500) / 100);
    setMaxIssuerExposurePct((profile.maxIssuerExposureBps ?? 3500) / 100);
    setMaxPositions(profile.maxPositions ?? 8);
    setMinDiversificationAssets(profile.minDiversificationAssets ?? 2);
    setMaxTurnoverPct((profile.maxTurnoverBps ?? 2500) / 100);
    setMaxQuoteAgeSeconds(profile.maxQuoteAgeSeconds ?? 60);
    setMaxPriceImpactPct((profile.maxPriceImpactBps ?? 75) / 100);
    setMinLiquidityUsd(profile.minLiquidityUsd ?? 25000);
    setDailyTradeBudgetUsd(profile.dailyTradeBudgetUsd ?? 50000);
    setMaxConsecutiveFailures(profile.maxConsecutiveFailures ?? 3);
    setIsEmergencyPaused(profile.isEmergencyPaused ?? false);
    setMaxTrackingErrorBps(profile.maxTrackingErrorBps ?? 250);
    setMaxOracleConfidenceBps(profile.maxOracleConfidenceBps ?? 150);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveOutcome(null);
    setIsSaved(false);
    try {
      const outcome = await onUpdatePolicy({
        maxSingleAssetBps: Math.round(maxSingleAssetPct * 100),
        minStablecoinBps: Math.round(minStablecoinPct * 100),
        maxPublicEquitiesExposureBps: Math.round(maxPublicEquitiesExposurePct * 100),
        maxPreIpoExposureBps: Math.round(maxPreIpoExposurePct * 100),
        maxTradeValueUsd: maxTradeValue,
        maxSlippageBps: Math.round(maxSlippagePct * 100),
        maxSectorExposureBps: Math.round(maxSectorExposurePct * 100),
        maxIssuerExposureBps: Math.round(maxIssuerExposurePct * 100),
        maxPositions,
        minDiversificationAssets,
        maxTurnoverBps: Math.round(maxTurnoverPct * 100),
        maxQuoteAgeSeconds,
        maxPriceImpactBps: Math.round(maxPriceImpactPct * 100),
        minLiquidityUsd,
        dailyTradeBudgetUsd,
        maxConsecutiveFailures,
        isEmergencyPaused,
        maxTrackingErrorBps,
        maxOracleConfidenceBps,
        policyVersion: policy.policyVersion + 1,
        updatedAt: Date.now(),
      });

      if (outcome && outcome.status === 'failed') {
        setSaveOutcome(outcome);
        setIsSaved(false);
        return;
      }

      const resolvedOutcome: PolicySaveOutcome =
        outcome ?? { status: mode === 'LIVE' ? 'committed_pda' : 'saved_simulation' };
      setSaveOutcome(resolvedOutcome);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    } catch (err) {
      setSaveOutcome({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Policy commit failed',
      });
      setIsSaved(false);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEmergencyPause = async () => {
    const nextState = !isEmergencyPaused;
    setIsEmergencyPaused(nextState);
    setSaveOutcome(null);
    const outcome = await onUpdatePolicy({
      isEmergencyPaused: nextState,
      policyVersion: policy.policyVersion + 1,
      updatedAt: Date.now(),
    });
    if (outcome) {
      setSaveOutcome(outcome);
      if (outcome.status === 'failed') {
        setIsEmergencyPaused(!nextState);
      }
    }
  };

  const currentPolicyDsl: Partial<FinancialPolicy> = {
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    isEmergencyPaused,
    maxSingleAssetBps: Math.round(maxSingleAssetPct * 100),
    minStablecoinBps: Math.round(minStablecoinPct * 100),
    maxPublicEquitiesExposureBps: Math.round(maxPublicEquitiesExposurePct * 100),
    maxPreIpoExposureBps: Math.round(maxPreIpoExposurePct * 100),
    maxTradeValueUsd: maxTradeValue,
    maxSlippageBps: Math.round(maxSlippagePct * 100),
    maxQuoteAgeSeconds,
    maxOracleConfidenceBps,
  };

  const dslJson = JSON.stringify(currentPolicyDsl, null, 2);
  const policyHash = hashFinancialPolicy(currentPolicyDsl as FinancialPolicy);

  return (
    <div className="space-y-6">
      {/* 1. HEADER & PRIMARY CONTROLS */}
      <PageHeader
        category="PROTECTION"
        title="Portfolio Protection Rules"
        subtitle="Set the hard limits your portfolio must obey before any autonomous trade is allowed to settle."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Presets */}
            <div className="flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() => loadProfile(CONSERVATIVE_INSTITUTIONAL_POLICY, 'conservative')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  activeProfile === 'conservative'
                    ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                    : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
                }`}
              >
                Conservative
              </button>
              <button
                type="button"
                onClick={() => loadProfile(BALANCED_MULTI_ASSET_POLICY, 'balanced')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  activeProfile === 'balanced'
                    ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                    : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
                }`}
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => loadProfile(HIGH_ALPHA_GROWTH_POLICY, 'growth')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  activeProfile === 'growth'
                    ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                    : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
                }`}
              >
                Growth
              </button>
            </div>

            {agentRiskState?.isCircuitBreakerTriggered && onResetCircuitBreaker && (
              <button
                type="button"
                onClick={onResetCircuitBreaker}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Breaker</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleEmergencyPause}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                isEmergencyPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40'
              }`}
            >
              {isEmergencyPaused ? 'Resume Trading' : 'Emergency Pause'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={(!hasUnsavedChanges && !isSaved && saveOutcome?.status !== 'failed') || isSaving}
              className={`px-4 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                saveOutcome?.status === 'failed'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : isSaved && saveOutcome?.status === 'committed_pda'
                  ? 'bg-emerald-600'
                  : isSaved && saveOutcome?.status === 'saved_simulation'
                  ? 'bg-amber-600'
                  : hasUnsavedChanges
                  ? 'bg-sentinel-accent hover:bg-sentinel-accentHover'
                  : 'bg-sentinel-surfaceElevated text-sentinel-textMuted border border-sentinel-border opacity-60 cursor-not-allowed'
              }`}
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>
                {isSaving
                  ? mode === 'LIVE'
                    ? 'Signing...'
                    : 'Saving...'
                  : saveOutcome?.status === 'failed'
                  ? 'Save Failed — Retry'
                  : isSaved && saveOutcome?.status === 'committed_pda'
                  ? 'Committed to Devnet PDA ✓'
                  : isSaved && saveOutcome?.status === 'saved_simulation'
                  ? 'Saved locally / simulation state'
                  : hasUnsavedChanges
                  ? 'Save Rules'
                  : 'Rules Synced'}
              </span>
            </button>
          </div>
        }
      />

      {/* Explicit Save Status / Error Banner */}
      {saveOutcome?.status === 'failed' && (
        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Save Failed:</strong> {saveOutcome.error || 'Transaction declined or API unreachable.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-semibold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {isSaved && saveOutcome?.status === 'saved_simulation' && (
        <div className="p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/30 text-xs text-amber-200">
          ✓ <strong>Saved locally / simulation state:</strong> Active in Sentinel simulator &amp; session store (Switch to Live mode + connect wallet to commit to Devnet PDA).
        </div>
      )}

      {isSaved && saveOutcome?.status === 'committed_pda' && (
        <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-xs text-emerald-200">
          ✓ <strong>Committed to Devnet PDA:</strong> Signed by wallet and confirmed on Solana Devnet{saveOutcome.signature ? ` (${formatAddress(saveOutcome.signature, 6)})` : ''}.
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRIMARY FOCAL POINT: 4 CORE GUARANTEES (ON-CHAIN ENFORCED)                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Rule 1: Single-Stock Position Limit */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Single-Stock Position Limit</h2>
                <Badge variant="success" size="xs">ON-CHAIN ENFORCED</Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1">
                Prevents any single stock from exceeding this share of your total portfolio.
              </p>
            </div>
            <span className="text-xl font-bold font-mono tabular-nums text-white shrink-0">
              ≤ {maxSingleAssetPct.toFixed(0)}%
            </span>
          </div>

          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={maxSingleAssetPct}
            onChange={(e) => {
              setActiveProfile('custom');
              setMaxSingleAssetPct(parseFloat(e.target.value));
            }}
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="flex justify-between text-xs font-mono text-sentinel-textSubtle tabular-nums">
            <span>Current Largest Position: {highestAssetExposurePct.toFixed(1)}%</span>
            <span>Anchor Field: max_single_asset_bps</span>
          </div>
        </Card>

        {/* Rule 2: Cash Reserve Floor */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Minimum Cash Reserve</h2>
                <Badge variant="success" size="xs">ON-CHAIN ENFORCED</Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1">
                Blocks any buy order that would drain your USDC reserve below this floor.
              </p>
            </div>
            <span className="text-xl font-bold font-mono tabular-nums text-white shrink-0">
              ≥ {minStablecoinPct.toFixed(0)}%
            </span>
          </div>

          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={minStablecoinPct}
            onChange={(e) => {
              setActiveProfile('custom');
              setMinStablecoinPct(parseFloat(e.target.value));
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />

          <div className="flex justify-between text-xs font-mono text-sentinel-textSubtle tabular-nums">
            <span>Current Cash Reserve: {currentStableReservePct.toFixed(1)}%</span>
            <span>Anchor Field: min_stablecoin_bps</span>
          </div>
        </Card>

        {/* Rule 3: Maximum Single Order Size */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Maximum Order Size</h2>
                <Badge variant="success" size="xs">ON-CHAIN ENFORCED</Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1">
                Caps the dollar value of any single autonomous trade instruction.
              </p>
            </div>
            <span className="text-xl font-bold font-mono tabular-nums text-white shrink-0">
              {formatCurrency(maxTradeValue, { maximumFractionDigits: 0 })}
            </span>
          </div>

          <input
            type="range"
            min="1000"
            max="25000"
            step="500"
            value={maxTradeValue}
            onChange={(e) => {
              setActiveProfile('custom');
              setMaxTradeValue(parseInt(e.target.value, 10));
            }}
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="flex justify-between text-xs font-mono text-sentinel-textSubtle tabular-nums">
            <span>Range: $1,000 – $25,000</span>
            <span>Anchor Field: max_trade_value_usd</span>
          </div>
        </Card>

        {/* Rule 4: Maximum Slippage Limit */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Maximum Slippage Limit</h2>
                <Badge variant="success" size="xs">ON-CHAIN ENFORCED</Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1">
                Protects against shallow pool depth and price impact on Meteora DBC curves.
              </p>
            </div>
            <span className="text-xl font-bold font-mono tabular-nums text-white shrink-0">
              ≤ {maxSlippagePct.toFixed(2)}%
            </span>
          </div>

          <input
            type="range"
            min="0.25"
            max="3.0"
            step="0.05"
            value={maxSlippagePct}
            onChange={(e) => {
              setActiveProfile('custom');
              setMaxSlippagePct(parseFloat(e.target.value));
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />

          <div className="flex justify-between text-xs font-mono text-sentinel-textSubtle tabular-nums">
            <span>{(maxSlippagePct * 100).toFixed(0)} bps ceiling</span>
            <span>Anchor Field: max_slippage_bps</span>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* COLLAPSED DISCLOSURE: ADVANCED RULES (OFF-CHAIN ADVISORY) & POLICY JSON   */}
      {/* ========================================================================= */}
      <Card padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-sentinel-surfaceMuted transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-sentinel-textSubtle" />
            <span className="text-xs font-semibold text-white">
              Advanced Asset-Class &amp; Oracle Rules
            </span>
            <Badge variant="neutral" size="xs">OFF-CHAIN ADVISORY</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-sentinel-textSubtle">
            <span>{isAdvancedOpen ? 'Hide Advanced Rules' : 'Expand Advanced Rules & PDA'}</span>
            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-5 border-t border-sentinel-border bg-sentinel-surfaceMuted/40 space-y-6 text-xs">
            {/* Off-Chain Advisory Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-sentinel-surface border border-sentinel-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Public Equities Cap</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    ≤ {maxPublicEquitiesExposurePct.toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="90"
                  step="5"
                  value={maxPublicEquitiesExposurePct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxPublicEquitiesExposurePct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="text-[11px] text-sentinel-textSubtle">
                  Enforced pre-trade by Sentinel SDK (AAPLx, NVDAx, SPYx)
                </div>
              </div>

              <div className="p-4 rounded-lg bg-sentinel-surface border border-sentinel-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Pre-IPO Equities Cap</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    ≤ {maxPreIpoExposurePct.toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={maxPreIpoExposurePct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxPreIpoExposurePct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="text-[11px] text-sentinel-textSubtle">
                  Enforced pre-trade by Sentinel SDK (SpaceX, OpenAI, Stripe)
                </div>
              </div>

              <div className="p-4 rounded-lg bg-sentinel-surface border border-sentinel-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Pyth Confidence Limit</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    ≤ {maxOracleConfidenceBps} bps
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="25"
                  value={maxOracleConfidenceBps}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxOracleConfidenceBps(parseInt(e.target.value, 10));
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="text-[11px] text-sentinel-textSubtle">
                  Max quote age ≤ {maxQuoteAgeSeconds}s · Pool depth ≥ {formatCurrency(minLiquidityUsd, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Policy PDA & Canonical JSON */}
            <div className="pt-4 border-t border-sentinel-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex items-center gap-3 text-sentinel-textMuted">
                  <span>
                    Policy Account PDA:{' '}
                    <a
                      href={getExplorerAddressUrl(sentinelPda)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      {formatAddress(sentinelPda, 6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                  <span>·</span>
                  <span title={policyHash}>
                    SHA-256: <span className="text-white">0x{policyHash.slice(0, 12)}…{policyHash.slice(-4)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(dslJson);
                    setCopiedDsl(true);
                    setTimeout(() => setCopiedDsl(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-sentinel-surface border border-sentinel-border text-sentinel-textMuted hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedDsl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDsl ? 'Copied' : 'Copy Policy JSON'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-lg bg-sentinel-surface border border-sentinel-border font-mono text-[11px] text-sentinel-textMuted overflow-x-auto max-h-48">
                {dslJson}
              </pre>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
