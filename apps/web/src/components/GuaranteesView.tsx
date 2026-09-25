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
} from '@sentinel/domain';
import {
  ShieldCheck,
  Save,
  Lock,
  Layers,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  Copy,
  Check,
  RotateCcw,
  Cpu,
  Coins,
  Activity,
  Sliders,
  FileCode,
  Flame,
  Key,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { PortfolioSnapshot } from '@sentinel/domain';
import { PageHeader } from './ui/PageHeader';
import { Card, CardHeader } from './ui/Card';
import { Badge } from './ui/Badge';
import { SourceBadge } from './ui/SourceBadge';

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

const AVAILABLE_ASSETS = ['NVDAx', 'AAPLx', 'SPYx', 'USDC', 'SPACEXx', 'OPENAIx', 'STRIPEx'];
const AVAILABLE_VENUES = ['METEORA_DBC', 'PRESTOCKS_SECONDARY', 'DEMO_SIMULATION'];

export const GuaranteesView: React.FC<GuaranteesViewProps> = ({
  policy,
  portfolio,
  mode = 'SIMULATION',
  onUpdatePolicy,
  agentRiskState,
  onResetCircuitBreaker,
}) => {
  // Four Core Controls
  const [maxSingleAssetPct, setMaxSingleAssetPct] = useState(policy.maxSingleAssetBps / 100);
  const [minStablecoinPct, setMinStablecoinPct] = useState(policy.minStablecoinBps / 100);
  const [maxTradeValue, setMaxTradeValue] = useState(policy.maxTradeValueUsd);
  const [maxSlippagePct, setMaxSlippagePct] = useState(policy.maxSlippageBps / 100);

  // Macro Asset Class Controls
  const [maxPublicEquitiesExposurePct, setMaxPublicEquitiesExposurePct] = useState(
    (policy.maxPublicEquitiesExposureBps ?? 7000) / 100
  );
  const [maxPreIpoExposurePct, setMaxPreIpoExposurePct] = useState(
    (policy.maxPreIpoExposureBps ?? 2000) / 100
  );

  // Emergency Pause
  const [isEmergencyPaused, setIsEmergencyPaused] = useState(policy.isEmergencyPaused ?? false);

  // Advanced Expansion & DSL
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tiers' | 'dsl'>('tiers');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<PolicySaveOutcome | null>(null);
  const [copiedDsl, setCopiedDsl] = useState(false);
  const [activeProfile, setActiveProfile] = useState<string>('custom');

  // Extended Tier controls
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

  const sentinelPda = deriveSentinelPda(policy.policyId);

  // Live portfolio comparison telemetry
  const highestAssetExposurePct = React.useMemo(() => {
    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) return 22.4;
    const nonCash = portfolio.assets.filter((a) => !a.isStablecoin && !a.isIndex);
    if (nonCash.length === 0) return 0;
    const maxBps = Math.max(...nonCash.map((a) => a.exposureBps));
    return maxBps / 100;
  }, [portfolio]);

  const currentStableReservePct = React.useMemo(() => {
    if (!portfolio) return 28.0;
    return (portfolio.stablecoinExposureBps ?? 2800) / 100;
  }, [portfolio]);

  const hasUnsavedChanges =
    Math.round(maxSingleAssetPct * 100) !== policy.maxSingleAssetBps ||
    Math.round(minStablecoinPct * 100) !== policy.minStablecoinBps ||
    maxTradeValue !== policy.maxTradeValueUsd ||
    Math.round(maxSlippagePct * 100) !== policy.maxSlippageBps ||
    Math.round(maxPublicEquitiesExposurePct * 100) !== (policy.maxPublicEquitiesExposureBps ?? 7000) ||
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
    maxTrackingErrorBps,
    maxOracleConfidenceBps,
  };

  const dslJson = JSON.stringify(currentPolicyDsl, null, 2);
  const policyHash = hashFinancialPolicy(currentPolicyDsl as FinancialPolicy);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dslJson);
    setCopiedDsl(true);
    setTimeout(() => setCopiedDsl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. PAGE HEADER WITH QUICK INSTITUTIONAL PRESETS */}
      <PageHeader
        category="PROTECTION & INVARIANTS"
        title="Your money moves only within these boundaries."
        subtitle="Every autonomous trade proposal must satisfy these mathematical invariants on-chain before settlement."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-sentinel-textSubtle mr-1">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => loadProfile(CONSERVATIVE_INSTITUTIONAL_POLICY, 'conservative')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border transition cursor-pointer ${
                activeProfile === 'conservative'
                  ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                  : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
              }`}
            >
              Conservative
            </button>
            <button
              type="button"
              onClick={() => loadProfile(BALANCED_MULTI_ASSET_POLICY, 'balanced')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border transition cursor-pointer ${
                activeProfile === 'balanced'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
              }`}
            >
              Balanced
            </button>
            <button
              type="button"
              onClick={() => loadProfile(HIGH_ALPHA_GROWTH_POLICY, 'growth')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border transition cursor-pointer ${
                activeProfile === 'growth'
                  ? 'bg-purple-500/15 border-purple-500/50 text-purple-300'
                  : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
              }`}
            >
              Growth
            </button>
          </div>
        }
      />

      {/* 2. CONSOLIDATED ON-CHAIN AUTHORITY, SHA-256 POLICY HASH & KILL-SWITCH STRIP */}
      <Card
        padding="md"
        className={
          isEmergencyPaused
            ? 'border-rose-500/40 bg-rose-950/10'
            : 'border-sentinel-borderStrong'
        }
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Authority & Cryptographic Hash */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                  isEmergencyPaused
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isEmergencyPaused ? (
                  <OctagonAlert className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {isEmergencyPaused ? 'Emergency Pause Active' : 'Sentinel PDA Armed'}
                  </span>
                  <Badge variant={isEmergencyPaused ? 'danger' : 'success'} dot={!isEmergencyPaused}>
                    {isEmergencyPaused ? 'EXECUTION FROZEN' : `POLICY v${policy.policyVersion}`}
                  </Badge>
                  <SourceBadge source="SOLANA" detail="Anchor PDA" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-mono text-sentinel-textMuted">
                  <span>
                    PDA:{' '}
                    <a
                      href={getExplorerAddressUrl(sentinelPda)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-300 hover:text-purple-200 underline inline-flex items-center gap-1"
                    >
                      {formatAddress(sentinelPda, 6)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                  <span className="text-sentinel-textSubtle">|</span>
                  <span title={policyHash}>
                    SHA-256 Commitment:{' '}
                    <span className="text-blue-300 font-semibold tabular-nums">
                      0x{policyHash.slice(0, 12)}…{policyHash.slice(-4)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Kill-Switch & Commit Controls */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {hasUnsavedChanges && !isSaved && (
              <Badge variant="warning" dot>
                Unsaved Delta
              </Badge>
            )}

            {agentRiskState?.isCircuitBreakerTriggered && onResetCircuitBreaker && (
              <button
                type="button"
                onClick={onResetCircuitBreaker}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Circuit Breaker</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleEmergencyPause}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold sentinel-interactive sentinel-focus cursor-pointer ${
                isEmergencyPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40'
              }`}
            >
              {isEmergencyPaused ? 'Deactivate Kill-Switch' : 'Emergency Pause'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={(!hasUnsavedChanges && !isSaved && saveOutcome?.status !== 'failed') || isSaving}
              className={`px-4 py-2 rounded-lg text-white text-xs font-bold sentinel-interactive sentinel-focus flex items-center gap-1.5 shadow-md cursor-pointer ${
                saveOutcome?.status === 'failed'
                  ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500/50'
                  : isSaved && saveOutcome?.status === 'committed_pda'
                  ? 'bg-emerald-600 border border-emerald-500/50'
                  : isSaved && saveOutcome?.status === 'saved_simulation'
                  ? 'bg-amber-600 border border-amber-500/50'
                  : hasUnsavedChanges
                  ? 'bg-blue-600 hover:bg-blue-500 border border-blue-500/50'
                  : 'bg-sentinel-surfaceElevated text-sentinel-textMuted border border-sentinel-border opacity-60 cursor-not-allowed'
              }`}
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>
                {isSaving
                  ? mode === 'LIVE'
                    ? 'Awaiting Wallet & Devnet...'
                    : 'Saving Policy...'
                  : saveOutcome?.status === 'failed'
                  ? 'Save Failed — Retry'
                  : isSaved && saveOutcome?.status === 'committed_pda'
                  ? 'Committed to Devnet PDA ✓'
                  : isSaved && saveOutcome?.status === 'saved_simulation'
                  ? 'Saved locally / simulation state'
                  : hasUnsavedChanges
                  ? 'Save Boundaries'
                  : 'Policy Synced'}
              </span>
            </button>
          </div>
        </div>

        {/* Explicit Save Outcome / Error Feedback Banner */}
        {saveOutcome?.status === 'failed' && (
          <div className="mt-3 p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 flex items-center justify-between gap-3 text-xs font-mono text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Policy Save Failed:</strong> {saveOutcome.error || 'Transaction declined or API unreachable. Policy was not committed to PDA.'}
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
          <div className="mt-3 p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/30 flex items-center justify-between gap-2 text-xs font-mono text-amber-200">
            <span>
              ✓ <strong>Saved locally / simulation state:</strong> Active in Sentinel simulator &amp; session store (Switch to Live mode + connect wallet to commit to Devnet PDA).
            </span>
          </div>
        )}

        {isSaved && saveOutcome?.status === 'committed_pda' && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs font-mono text-emerald-200">
            <span>
              ✓ <strong>Committed to Devnet PDA:</strong> Signed by wallet and confirmed on Solana Devnet{saveOutcome.signature ? ` (${formatAddress(saveOutcome.signature, 6)})` : ''}.
            </span>
          </div>
        )}
      </Card>

      {/* 3. FOUR CORE INVARIANTS (THE INSTITUTIONAL FOUNDATION) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Invariant 1: Maximum Asset Exposure */}
        <Card padding="md" className="space-y-3.5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sentinel-textSubtle block">
                INVARIANT 01 · CONCENTRATION CAP
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Maximum Single-Asset Exposure
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono tabular-nums text-blue-400 block">
                ≤ {maxSingleAssetPct.toFixed(0)}%
              </span>
              <span className="text-[10px] font-mono tabular-nums text-sentinel-textSubtle">
                Live Max: {highestAssetExposurePct.toFixed(1)}%
              </span>
            </div>
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
            className="w-full accent-blue-500 cursor-pointer"
          />

          <div className="w-full bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(maxSingleAssetPct / 50) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-0.5">
            <span className="font-semibold text-white">What it protects:</span> Prevents any single equity or pre-IPO position from dominating total vault NAV during momentum spikes.
          </p>
        </Card>

        {/* Invariant 2: Minimum Stable Reserve */}
        <Card padding="md" className="space-y-3.5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sentinel-textSubtle block">
                INVARIANT 02 · LIQUIDITY FLOOR
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Minimum USDC Stable Reserve
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono tabular-nums text-emerald-400 block">
                ≥ {minStablecoinPct.toFixed(0)}%
              </span>
              <span className="text-[10px] font-mono tabular-nums text-sentinel-textSubtle">
                Live Cash: {currentStableReservePct.toFixed(1)}%
              </span>
            </div>
          </div>

          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={minStablecoinPct}
            onChange={(e) => {
              setActiveProfile('custom');
              setMinStablecoinPct(parseFloat(e.target.value));
            }}
            className="w-full accent-emerald-500 cursor-pointer"
          />

          <div className="w-full bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(minStablecoinPct / 50) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-0.5">
            <span className="font-semibold text-white">What it protects:</span> Guarantees unencumbered USDC reserves for instant redemptions and drawdown buffering.
          </p>
        </Card>

        {/* Invariant 3: Maximum Trade Size */}
        <Card padding="md" className="space-y-3.5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sentinel-textSubtle block">
                INVARIANT 03 · ORDER TICKET CEILING
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Maximum Single Trade Notional
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono tabular-nums text-purple-400 block">
                {formatCurrency(maxTradeValue, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-sentinel-textSubtle">
                Daily Cap: {formatCurrency(dailyTradeBudgetUsd, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <input
            type="range"
            min="1000"
            max="25000"
            step="1000"
            value={maxTradeValue}
            onChange={(e) => {
              setActiveProfile('custom');
              setMaxTradeValue(parseFloat(e.target.value));
            }}
            className="w-full accent-purple-500 cursor-pointer"
          />

          <div className="w-full bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${(maxTradeValue / 25000) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-0.5">
            <span className="font-semibold text-white">What it protects:</span> Caps the maximum blast radius of any single autonomous execution cycle.
          </p>
        </Card>

        {/* Invariant 4: Maximum Slippage */}
        <Card padding="md" className="space-y-3.5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sentinel-textSubtle block">
                INVARIANT 04 · EXECUTION QUALITY
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Maximum Venue Slippage Tolerance
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono tabular-nums text-amber-400 block">
                ≤ {maxSlippagePct.toFixed(2)}%
              </span>
              <span className="text-[10px] font-mono tabular-nums text-sentinel-textSubtle">
                {(maxSlippagePct * 100).toFixed(0)} bps limit
              </span>
            </div>
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

          <div className="w-full bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(maxSlippagePct / 3.0) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-0.5">
            <span className="font-semibold text-white">What it protects:</span> Blocks toxic fills and MEV sandwich extraction across Meteora DBC and PreStocks pools.
          </p>
        </Card>
      </div>

      {/* 4. 3-PILLAR MACRO ASSET-CLASS & ORACLE BOUNDARIES */}
      <Card padding="md" className="space-y-4">
        <CardHeader
          category="TRIPARTITE TAXONOMY & ORACLE GATES"
          title="Macro Asset-Class & Pyth Confidence Envelopes"
          subtitle="Portfolio-wide exposure ceilings across public equities, pre-IPO secondaries, and Pyth oracle staleness gates."
          action={<SourceBadge source="PYTH" detail="Hermes & Taxonomy" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Pillar 1: Public Equities */}
          <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-blue-500/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Public Equities Cap</span>
              <span className="text-blue-400 font-bold tabular-nums">
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
            <span className="text-[11px] text-sentinel-textMuted block font-sans">
              AAPLx, NVDAx, SPYx (Meteora DBC pools)
            </span>
          </div>

          {/* Pillar 2: Pre-IPO Unicorns */}
          <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-purple-500/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Pre-IPO Unicorns Cap</span>
              <span className="text-purple-400 font-bold tabular-nums">
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
            <span className="text-[11px] text-sentinel-textMuted block font-sans">
              SpaceX, OpenAI, Stripe (PreStocks secondary)
            </span>
          </div>

          {/* Pillar 3: Pyth Oracle Confidence Ceiling */}
          <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-emerald-500/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Pyth Confidence Ceiling</span>
              <span className="text-emerald-400 font-bold tabular-nums">
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
            <span className="text-[11px] text-sentinel-textMuted block font-sans">
              Max quote age {maxQuoteAgeSeconds}s · Tracking error ≤ {maxTrackingErrorBps} bps
            </span>
          </div>
        </div>
      </Card>

      {/* 5. EXPANDABLE SECTION: ADVANCED POLICY TIERS & CANONICAL DSL */}
      <Card padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-sentinel-surfaceMuted transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-sentinel-textSubtle" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Advanced Institutional Tiers &amp; Declarative DSL
            </span>
            <Badge variant="neutral">Policy v{policy.policyVersion}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-sentinel-textSubtle font-mono">
            <span>{isAdvancedOpen ? 'Hide DSL' : 'Inspect Canonical JSON & Tiers'}</span>
            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-5 border-t border-sentinel-border space-y-5 bg-sentinel-surfaceMuted/30">
            {/* Extended Tier Telemetry Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border">
                <span className="text-[10px] text-sentinel-textSubtle block uppercase">Sector Exposure</span>
                <span className="text-sm font-bold text-white tabular-nums">≤ {maxSectorExposurePct.toFixed(0)}%</span>
              </div>
              <div className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border">
                <span className="text-[10px] text-sentinel-textSubtle block uppercase">Issuer Exposure</span>
                <span className="text-sm font-bold text-white tabular-nums">≤ {maxIssuerExposurePct.toFixed(0)}%</span>
              </div>
              <div className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border">
                <span className="text-[10px] text-sentinel-textSubtle block uppercase">Min Pool Depth</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {formatCurrency(minLiquidityUsd, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border">
                <span className="text-[10px] text-sentinel-textSubtle block uppercase">Circuit Breaker</span>
                <span className="text-sm font-bold text-white tabular-nums">{maxConsecutiveFailures} Rejects</span>
              </div>
            </div>

            {/* DSL JSON */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-sentinel-textSubtle uppercase tracking-wider">
                    Raw Canonical Policy DSL
                  </span>
                  <span className="text-[11px] font-mono text-blue-300">
                    SHA-256: 0x{policyHash}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-2.5 py-1 rounded bg-sentinel-surface hover:bg-sentinel-surfaceElevated border border-sentinel-border text-xs text-white flex items-center gap-1 cursor-pointer font-mono"
                >
                  {copiedDsl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDsl ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-lg bg-black/60 border border-sentinel-border font-mono text-[11px] text-purple-300 overflow-x-auto leading-relaxed max-h-64">
                {dslJson}
              </pre>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
