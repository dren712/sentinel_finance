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

interface GuaranteesViewProps {
  policy: FinancialPolicy;
  onUpdatePolicy: (updated: Partial<FinancialPolicy>) => void;
  agentRiskState?: AgentRiskState;
  onResetCircuitBreaker?: () => void;
}

const AVAILABLE_ASSETS = ['NVDAx', 'AAPLx', 'SPYx', 'USDC', 'SPACEXx', 'OPENAIx', 'STRIPEx'];
const AVAILABLE_VENUES = ['METEORA_DBC', 'PRESTOCKS_SECONDARY', 'DEMO_SIMULATION'];

export const GuaranteesView: React.FC<GuaranteesViewProps> = ({
  policy,
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
  const [isSaved, setIsSaved] = useState(false);
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

  const handleSave = () => {
    onUpdatePolicy({
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
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const toggleEmergencyPause = () => {
    const nextState = !isEmergencyPaused;
    setIsEmergencyPaused(nextState);
    onUpdatePolicy({
      isEmergencyPaused: nextState,
      policyVersion: policy.policyVersion + 1,
      updatedAt: Date.now(),
    });
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
      {/* 1. HEADLINE & SUBTITLE */}
      <div className="space-y-1.5 pt-1">
        <span className="text-xs font-semibold text-sentinel-textSubtle tracking-wider uppercase">
          Protection
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Your money moves only within these boundaries.
        </h2>
        <p className="text-xs text-sentinel-textMuted max-w-2xl leading-relaxed">
          Every autonomous trade proposal must satisfy these mathematical invariants on-chain before settlement.
        </p>
      </div>

      {/* ON-CHAIN PDA NOTICE CALLOUT */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <Key className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <span className="text-sentinel-textSubtle block text-[11px]">ENFORCEMENT AUTHORITY</span>
            <span className="text-white font-semibold">
              Enforced on-chain with the Sentinel PDA:{' '}
              <span className="text-purple-300">{formatAddress(sentinelPda, 6)}</span>
            </span>
          </div>
        </div>

        <a
          href={getExplorerAddressUrl(sentinelPda)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold self-start sm:self-auto hover:underline"
        >
          <span>View on Solana Explorer</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* 2. FOUR CORE CONTROLS (THE INSTITUTIONAL FOUNDATION) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Control 1: Maximum Asset Exposure */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Maximum asset exposure
            </span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {maxSingleAssetPct.toFixed(0)}%
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
            className="w-full accent-blue-500 cursor-pointer"
          />

          <div className="w-full bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${(maxSingleAssetPct / 50) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-1">
            <span className="font-semibold text-white">What it protects:</span> No single stock can dominate the portfolio, even during extreme momentum.
          </p>
        </div>

        {/* Control 2: Minimum Stable Reserve */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Minimum stable reserve
            </span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {minStablecoinPct.toFixed(0)}%
            </span>
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
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${(minStablecoinPct / 50) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-1">
            <span className="font-semibold text-white">What it protects:</span> Ensures liquidity for redemptions and opportunistic buying.
          </p>
        </div>

        {/* Control 3: Maximum Trade Size */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Maximum trade size
            </span>
            <span className="text-xl font-bold font-mono text-purple-400">
              {formatCurrency(maxTradeValue, { maximumFractionDigits: 0 })}
            </span>
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
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${(maxTradeValue / 25000) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-1">
            <span className="font-semibold text-white">What it protects:</span> Limits blast radius of any single algorithmic decision.
          </p>
        </div>

        {/* Control 4: Maximum Slippage */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Maximum slippage
            </span>
            <span className="text-xl font-bold font-mono text-amber-400">
              {maxSlippagePct.toFixed(2)}%
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

          <div className="w-full bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${(maxSlippagePct / 3.0) * 100}%` }}
            />
          </div>

          <p className="text-xs text-sentinel-textMuted leading-relaxed pt-1">
            <span className="font-semibold text-white">What it protects:</span> Prevents toxic execution in thin liquidity pools.
          </p>
        </div>
      </div>

      {/* 3. MACRO ASSET CLASS LIMITS (PHASE 11 & 12) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sentinel-border pb-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Macro Asset Class Allocations
            </h3>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Portfolio-level guardrails across public equities, pre-IPO secondaries, and agent tokens.
            </p>
          </div>
          <span className="text-xs font-mono text-sentinel-textSubtle">
            Tripartite Taxonomy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Public Equities */}
          <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-blue-500/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Public Equities Cap</span>
              <span className="text-blue-400 font-bold">≤ {maxPublicEquitiesExposurePct.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="90"
              step="5"
              value={maxPublicEquitiesExposurePct}
              onChange={(e) => setMaxPublicEquitiesExposurePct(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] text-sentinel-textMuted block font-sans">
              AAPLx, NVDAx, SPYx (Meteora DBC pools)
            </span>
          </div>

          {/* Pre-IPO Unicorns */}
          <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-purple-500/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Pre-IPO Unicorns Cap</span>
              <span className="text-purple-400 font-bold">≤ {maxPreIpoExposurePct.toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="5"
              value={maxPreIpoExposurePct}
              onChange={(e) => setMaxPreIpoExposurePct(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <span className="text-[10px] text-sentinel-textMuted block font-sans">
              SpaceX, OpenAI, Stripe (PreStocks secondary)
            </span>
          </div>
        </div>
      </div>

      {/* 4. EMERGENCY KILL-SWITCH & SAVE ACTION */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isEmergencyPaused ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {isEmergencyPaused ? <OctagonAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{isEmergencyPaused ? 'Emergency Pause Active' : 'Sentinel Armed & Operational'}</span>
              <span className={`text-[10px] px-2 py-0.2 rounded font-mono font-semibold ${
                isEmergencyPaused ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {isEmergencyPaused ? 'Execution Frozen' : 'Online'}
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              {isEmergencyPaused
                ? 'All autonomous trade intents will immediately revert. Capital is safe.'
                : 'All proposals must pass pre-flight verification against this policy.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={toggleEmergencyPause}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
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
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaved ? 'Saved!' : 'Save Boundaries'}</span>
          </button>
        </div>
      </div>

      {/* 5. EXPANDABLE SECTION: ADVANCED POLICY TIERS & CANONICAL DSL */}
      <div className="border border-sentinel-border rounded-xl overflow-hidden bg-sentinel-surface">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-sentinel-surfaceMuted transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sentinel-textSubtle" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Advanced Institutional Tiers &amp; Declarative DSL
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 font-mono">
              Policy v{policy.policyVersion}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-sentinel-textSubtle">
            <span>{isAdvancedOpen ? 'Hide Detail' : 'Inspect DSL & Templates'}</span>
            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-5 border-t border-sentinel-border space-y-5 bg-sentinel-surfaceMuted/30">
            {/* Presets */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-sentinel-textSubtle uppercase tracking-wider block">
                Canonical Institutional Templates
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => loadProfile(CONSERVATIVE_INSTITUTIONAL_POLICY, 'conservative')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    activeProfile === 'conservative'
                      ? 'bg-blue-500/10 border-blue-500 text-white'
                      : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted'
                  }`}
                >
                  <div className="font-bold text-xs text-blue-400">Conservative Institutional</div>
                  <div className="text-[10px] text-sentinel-textSubtle mt-0.5 font-mono">
                    15% Single Cap · 30% Cash Floor
                  </div>
                </button>

                <button
                  onClick={() => loadProfile(BALANCED_MULTI_ASSET_POLICY, 'balanced')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    activeProfile === 'balanced'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted'
                  }`}
                >
                  <div className="font-bold text-xs text-emerald-400">Balanced Multi-Asset</div>
                  <div className="text-[10px] text-sentinel-textSubtle mt-0.5 font-mono">
                    25% Single Cap · 20% Cash Floor
                  </div>
                </button>

                <button
                  onClick={() => loadProfile(HIGH_ALPHA_GROWTH_POLICY, 'growth')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    activeProfile === 'growth'
                      ? 'bg-purple-500/10 border-purple-500 text-white'
                      : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted'
                  }`}
                >
                  <div className="font-bold text-xs text-purple-400">High-Alpha Growth</div>
                  <div className="text-[10px] text-sentinel-textSubtle mt-0.5 font-mono">
                    35% Single Cap · 15% Cash Floor
                  </div>
                </button>
              </div>
            </div>

            {/* DSL JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sentinel-textSubtle uppercase tracking-wider">
                  Raw Canonical Policy DSL (SHA-256 Hashed)
                </span>
                <button
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
      </div>
    </div>
  );
};
