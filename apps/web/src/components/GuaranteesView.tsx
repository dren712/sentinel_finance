'use client';

import React, { useState } from 'react';
import {
  FinancialPolicy,
  AgentRiskState,
  CONSERVATIVE_INSTITUTIONAL_POLICY,
  BALANCED_MULTI_ASSET_POLICY,
  HIGH_ALPHA_GROWTH_POLICY,
  canonicalJsonStringify,
  hashFinancialPolicy,
} from '@sentinel/domain';
import {
  ShieldCheck,
  Save,
  Lock,
  Layers,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  Copy,
  Check,
  RotateCcw,
  Cpu,
  Coins,
  Gauge,
  Activity,
  Sliders,
  FileCode,
  Flame,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatCurrency, formatBps, formatAddress } from '@/lib/formatters';

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
  // Tier 1: Hard Invariants
  const [maxSingleAssetPct, setMaxSingleAssetPct] = useState(policy.maxSingleAssetBps / 100);
  const [minStablecoinPct, setMinStablecoinPct] = useState(policy.minStablecoinBps / 100);
  const [maxTradeValue, setMaxTradeValue] = useState(policy.maxTradeValueUsd);
  const [maxSlippagePct, setMaxSlippagePct] = useState(policy.maxSlippageBps / 100);

  // Tier 2: Portfolio Constraints
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

  // Tier 3: Trading Constraints
  const [maxQuoteAgeSeconds, setMaxQuoteAgeSeconds] = useState(policy.maxQuoteAgeSeconds ?? 60);
  const [maxPriceImpactPct, setMaxPriceImpactPct] = useState(
    (policy.maxPriceImpactBps ?? 75) / 100
  );
  const [minLiquidityUsd, setMinLiquidityUsd] = useState(policy.minLiquidityUsd ?? 25000);
  const [assetAllowlist, setAssetAllowlist] = useState<string[]>(
    policy.assetAllowlist ?? [...AVAILABLE_ASSETS]
  );
  const [venueAllowlist, setVenueAllowlist] = useState<string[]>(
    policy.venueAllowlist ?? [...AVAILABLE_VENUES]
  );

  // Tier 4: Agent Constraints
  const [dailyTradeBudgetUsd, setDailyTradeBudgetUsd] = useState(
    policy.dailyTradeBudgetUsd ?? 50000
  );
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState(
    policy.maxConsecutiveFailures ?? 3
  );
  const [isEmergencyPaused, setIsEmergencyPaused] = useState(policy.isEmergencyPaused ?? false);

  // Tier 5: Market Constraints
  const [maxTrackingErrorBps, setMaxTrackingErrorBps] = useState(
    policy.maxTrackingErrorBps ?? 250
  );
  const [maxOracleConfidenceBps, setMaxOracleConfidenceBps] = useState(
    policy.maxOracleConfidenceBps ?? 150
  );
  const [requireHealthyVenue, setRequireHealthyVenue] = useState(
    policy.requireHealthyVenue ?? true
  );
  const [marketHoursOnly, setMarketHoursOnly] = useState(policy.marketHoursOnly ?? false);

  // UI States
  const [activeTab, setActiveTab] = useState<'tiers' | 'dsl'>('tiers');
  const [isSaved, setIsSaved] = useState(false);
  const [copiedDsl, setCopiedDsl] = useState(false);
  const [activeProfile, setActiveProfile] = useState<string>('custom');

  // Load Canonical Profile
  const loadProfile = (profile: FinancialPolicy, name: string) => {
    setActiveProfile(name);
    setMaxSingleAssetPct(profile.maxSingleAssetBps / 100);
    setMinStablecoinPct(profile.minStablecoinBps / 100);
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
    setAssetAllowlist(profile.assetAllowlist ?? [...AVAILABLE_ASSETS]);
    setVenueAllowlist(profile.venueAllowlist ?? [...AVAILABLE_VENUES]);
    setDailyTradeBudgetUsd(profile.dailyTradeBudgetUsd ?? 50000);
    setMaxConsecutiveFailures(profile.maxConsecutiveFailures ?? 3);
    setIsEmergencyPaused(profile.isEmergencyPaused ?? false);
    setMaxTrackingErrorBps(profile.maxTrackingErrorBps ?? 250);
    setMaxOracleConfidenceBps(profile.maxOracleConfidenceBps ?? 150);
    setRequireHealthyVenue(profile.requireHealthyVenue ?? true);
    setMarketHoursOnly(profile.marketHoursOnly ?? false);
  };

  const handleSave = () => {
    onUpdatePolicy({
      maxSingleAssetBps: Math.round(maxSingleAssetPct * 100),
      minStablecoinBps: Math.round(minStablecoinPct * 100),
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
      assetAllowlist,
      venueAllowlist,
      dailyTradeBudgetUsd,
      maxConsecutiveFailures,
      isEmergencyPaused,
      maxTrackingErrorBps,
      maxOracleConfidenceBps,
      requireHealthyVenue,
      marketHoursOnly,
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

  const toggleAssetAllowlist = (symbol: string) => {
    if (assetAllowlist.includes(symbol)) {
      if (assetAllowlist.length <= 1) return; // Prevent empty
      setAssetAllowlist(assetAllowlist.filter((s) => s !== symbol));
    } else {
      setAssetAllowlist([...assetAllowlist, symbol]);
    }
  };

  const toggleVenueAllowlist = (venue: string) => {
    if (venueAllowlist.includes(venue)) {
      if (venueAllowlist.length <= 1) return; // Prevent empty
      setVenueAllowlist(venueAllowlist.filter((v) => v !== venue));
    } else {
      setVenueAllowlist([...venueAllowlist, venue]);
    }
  };

  const currentPolicyDsl: Partial<FinancialPolicy> = {
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    isEmergencyPaused,
    maxSingleAssetBps: Math.round(maxSingleAssetPct * 100),
    minStablecoinBps: Math.round(minStablecoinPct * 100),
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
    assetAllowlist,
    venueAllowlist,
    dailyTradeBudgetUsd,
    maxConsecutiveFailures,
    maxTrackingErrorBps,
    maxOracleConfidenceBps,
    requireHealthyVenue,
    marketHoursOnly,
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
      {/* 1. Header Banner */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <ShieldCheck className="w-6 h-6 text-sentinel-accent" />
              <h2 className="text-xl font-bold text-sentinel-text">
                Financial Risk Engine &amp; Policy DSL
              </h2>
              <span className="px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">
                Policy v{policy.policyVersion}
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[11px] font-mono border border-purple-500/30">
                Hash: {policyHash.slice(0, 10)}...
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-1.5 max-w-3xl leading-relaxed">
              Institutional declarative risk engine governing autonomous agent execution. Evaluates 5 orthogonal constraint tiers across hard financial invariants, portfolio concentration, trading guardrails, agent circuit breakers, and Pyth market truth.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto shrink-0">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Policy Saved!' : 'Save Policy DSL'}</span>
            </button>
          </div>
        </div>

        {/* Emergency Kill-Switch Bar */}
        <div
          className={`mt-5 p-4 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isEmergencyPaused
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            {isEmergencyPaused ? (
              <OctagonAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>
                  {isEmergencyPaused
                    ? 'EMERGENCY KILL-SWITCH ACTIVE'
                    : 'Sentinel Guardrails Armed & Operational'}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] rounded font-mono uppercase ${
                    isEmergencyPaused
                      ? 'bg-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {isEmergencyPaused ? 'Execution Frozen' : 'Live Policy'}
                </span>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                {isEmergencyPaused
                  ? 'All autonomous trade intents will immediately abort with ERR_EMERGENCY_PAUSE. Capital is frozen.'
                  : 'All proposed trades are checked against the 5-tier institutional risk DSL before settlement.'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleEmergencyPause}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition cursor-pointer shrink-0 ${
              isEmergencyPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isEmergencyPaused ? 'Deactivate Kill-Switch' : 'Trigger Emergency Pause'}</span>
          </button>
        </div>

        {/* Profile Selector */}
        <div className="mt-5 pt-4 border-t border-sentinel-border/70">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-sentinel-text uppercase tracking-wider">
              Canonical Institutional Templates
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('tiers')}
                className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  activeTab === 'tiers'
                    ? 'bg-sentinel-accent text-white'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white'
                }`}
              >
                <Sliders className="w-3 h-3 inline mr-1" />
                Risk Tiers Editor
              </button>
              <button
                onClick={() => setActiveTab('dsl')}
                className={`px-3 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  activeTab === 'dsl'
                    ? 'bg-sentinel-accent text-white'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white'
                }`}
              >
                <FileCode className="w-3 h-3 inline mr-1" />
                Raw DSL JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => loadProfile(CONSERVATIVE_INSTITUTIONAL_POLICY, 'conservative')}
              className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                activeProfile === 'conservative'
                  ? 'bg-blue-500/10 border-blue-500 text-white'
                  : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted hover:border-sentinel-borderHover'
              }`}
            >
              <div className="font-bold text-xs text-blue-400">Conservative Institutional</div>
              <div className="text-[11px] text-sentinel-textSubtle mt-0.5">
                15% Single Cap · 30% Cash Floor · 30% Sector · $25k Budget
              </div>
            </button>

            <button
              onClick={() => loadProfile(BALANCED_MULTI_ASSET_POLICY, 'balanced')}
              className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                activeProfile === 'balanced'
                  ? 'bg-emerald-500/10 border-emerald-500 text-white'
                  : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted hover:border-sentinel-borderHover'
              }`}
            >
              <div className="font-bold text-xs text-emerald-400">Balanced Multi-Asset</div>
              <div className="text-[11px] text-sentinel-textSubtle mt-0.5">
                25% Single Cap · 20% Cash Floor · 45% Sector · $50k Budget
              </div>
            </button>

            <button
              onClick={() => loadProfile(HIGH_ALPHA_GROWTH_POLICY, 'growth')}
              className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                activeProfile === 'growth'
                  ? 'bg-purple-500/10 border-purple-500 text-white'
                  : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted hover:border-sentinel-borderHover'
              }`}
            >
              <div className="font-bold text-xs text-purple-400">High-Alpha Growth</div>
              <div className="text-[11px] text-sentinel-textSubtle mt-0.5">
                35% Single Cap · 15% Cash Floor · 60% Sector · $100k Budget
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* View: Raw DSL JSON Inspector */}
      {activeTab === 'dsl' && (
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Declarative Risk DSL (Canonical JSON)</h3>
            </div>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded bg-sentinel-surfaceMuted hover:bg-sentinel-border text-xs text-sentinel-text flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedDsl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDsl ? 'Copied!' : 'Copy DSL'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-lg bg-black/50 border border-sentinel-border font-mono text-xs text-blue-300 overflow-x-auto leading-relaxed">
            {dslJson}
          </pre>

          <div className="text-xs text-sentinel-textMuted">
            This canonical JSON represents the exact cryptographic policy specification hashed into every promise, authorization ticket, and PROVN audit record.
          </div>
        </div>
      )}

      {/* View: 5-Tier Constraint Panels */}
      {activeTab === 'tiers' && (
        <div className="space-y-6">
          {/* TIER 1: Hard Financial Invariants */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-sentinel-border">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                T1
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tier 1: Hard Financial Invariants</h3>
                <p className="text-xs text-sentinel-textMuted">
                  Fundamental capital preservation constraints enforced on-chain by the Anchor program.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Max Single Asset */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Single-Asset Exposure</span>
                  <span className="text-sm font-bold text-blue-400 font-mono">
                    {maxSingleAssetPct.toFixed(1)}% ({Math.round(maxSingleAssetPct * 100)} bps)
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
                <span className="text-[11px] text-sentinel-textMuted block">
                  Cap on any single equity holding (e.g. NVDAx) as fraction of portfolio NAV.
                </span>
              </div>

              {/* Min Stablecoin Reserve */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Min Stablecoin Reserve Floor</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {minStablecoinPct.toFixed(1)}% ({Math.round(minStablecoinPct * 100)} bps)
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
                <span className="text-[11px] text-sentinel-textMuted block">
                  Guaranteed liquid USDC cash reserve floor that agent cannot spend below.
                </span>
              </div>

              {/* Max Trade Size */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Trade Size Limit</span>
                  <span className="text-sm font-bold text-purple-400 font-mono">
                    {formatCurrency(maxTradeValue, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={maxTradeValue}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxTradeValue(parseFloat(e.target.value));
                  }}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[11px] text-sentinel-textMuted block">
                  Maximum permissible USD notional for any individual execution intent.
                </span>
              </div>

              {/* Max Slippage */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Slippage Tolerance</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    {maxSlippagePct.toFixed(2)}% ({Math.round(maxSlippagePct * 100)} bps)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.05"
                  value={maxSlippagePct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxSlippagePct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] text-sentinel-textMuted block">
                  Reverts trade if executed venue price deviates beyond tolerance.
                </span>
              </div>
            </div>
          </div>

          {/* TIER 2: Portfolio & Concentration Limits */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-sentinel-border">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                T2
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tier 2: Portfolio Concentration &amp; Diversification</h3>
                <p className="text-xs text-sentinel-textMuted">
                  Macro risk parameters limiting sector concentration, issuer counterparty exposure, and turnover.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Max Sector Exposure */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Sector Exposure</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {maxSectorExposurePct.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="70"
                  step="5"
                  value={maxSectorExposurePct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxSectorExposurePct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Limits aggregate concentration in any single sector (e.g. Semiconductors).
                </span>
              </div>

              {/* Max Issuer Exposure */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Issuer Exposure</span>
                  <span className="text-xs font-bold text-blue-400 font-mono">
                    {maxIssuerExposurePct.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="5"
                  value={maxIssuerExposurePct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxIssuerExposurePct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Limits aggregate counterparty risk across underlying asset corporate issuers.
                </span>
              </div>

              {/* Max Positions */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Positions</span>
                  <span className="text-xs font-bold text-purple-400 font-mono">
                    {maxPositions} Assets
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={maxPositions}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxPositions(parseInt(e.target.value));
                  }}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Maximum number of distinct active risk positions permitted simultaneously.
                </span>
              </div>

              {/* Min Diversification */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Min Diversification</span>
                  <span className="text-xs font-bold text-cyan-400 font-mono">
                    {minDiversificationAssets} Assets
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={minDiversificationAssets}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMinDiversificationAssets(parseInt(e.target.value));
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Mandatory floor on active non-stable positions to avoid mono-asset concentration.
                </span>
              </div>

              {/* Max 24h Turnover */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5 sm:col-span-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max 24h Turnover Rate</span>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {maxTurnoverPct.toFixed(1)}% NAV / day
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={maxTurnoverPct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxTurnoverPct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Restricts excessive churn and rebalancing turnover within any rolling 24-hour window.
                </span>
              </div>
            </div>
          </div>

          {/* TIER 3: Trading & Market Access Guardrails */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-sentinel-border">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                T3
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tier 3: Trading Guardrails &amp; Allowlist Access</h3>
                <p className="text-xs text-sentinel-textMuted">
                  Pre-flight checks on quote freshness, market depth, authorized assets, and execution venues.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Max Quote Age */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Quote Freshness Ceiling</span>
                  <span className="text-xs font-bold text-blue-400 font-mono">{maxQuoteAgeSeconds}s</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={maxQuoteAgeSeconds}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxQuoteAgeSeconds(parseInt(e.target.value));
                  }}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Maximum age of reference quote before Pyth or venue is flagged as stale.
                </span>
              </div>

              {/* Max Price Impact */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Price Impact</span>
                  <span className="text-xs font-bold text-purple-400 font-mono">
                    {maxPriceImpactPct.toFixed(2)}% ({Math.round(maxPriceImpactPct * 100)} bps)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="3.0"
                  step="0.25"
                  value={maxPriceImpactPct}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxPriceImpactPct(parseFloat(e.target.value));
                  }}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Blocks trades estimated to move bonding curve or pool price past threshold.
                </span>
              </div>

              {/* Min Liquidity Depth */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Min Venue Liquidity</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {formatCurrency(minLiquidityUsd, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="100000"
                  step="5000"
                  value={minLiquidityUsd}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMinLiquidityUsd(parseInt(e.target.value));
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-sentinel-textMuted block">
                  Minimum DBC curve or pool depth required before executing orders.
                </span>
              </div>
            </div>

            {/* Allowlists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <span className="text-xs font-semibold text-white block">Authorized Asset Allowlist</span>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ASSETS.map((symbol) => {
                    const isAllowed = assetAllowlist.includes(symbol);
                    return (
                      <button
                        key={symbol}
                        onClick={() => toggleAssetAllowlist(symbol)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                          isAllowed
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'bg-black/30 text-sentinel-textSubtle border border-sentinel-border line-through opacity-60'
                        }`}
                      >
                        {symbol}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-sentinel-textMuted block">
                  Any asset not checked here is instantly rejected by Sentinel pre-flight verifiers.
                </span>
              </div>

              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-2.5">
                <span className="text-xs font-semibold text-white block">Authorized Venue Allowlist</span>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_VENUES.map((venue) => {
                    const isAllowed = venueAllowlist.includes(venue);
                    return (
                      <button
                        key={venue}
                        onClick={() => toggleVenueAllowlist(venue)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                          isAllowed
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-black/30 text-sentinel-textSubtle border border-sentinel-border line-through opacity-60'
                        }`}
                      >
                        {venue}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-sentinel-textMuted block">
                  Prohibits execution on untrusted or non-whitelisted routing adapters.
                </span>
              </div>
            </div>
          </div>

          {/* TIER 4: Autonomous Agent Guardrails */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-sentinel-border">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                T4
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tier 4: Agent Circuit Breakers &amp; Session Budget</h3>
                <p className="text-xs text-sentinel-textMuted">
                  Autonomous safety parameters preventing runaway trading, cascade failures, or budget exhaustion.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Budget */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">24h Daily Trade Budget</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    {formatCurrency(dailyTradeBudgetUsd, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="150000"
                  step="5000"
                  value={dailyTradeBudgetUsd}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setDailyTradeBudgetUsd(parseInt(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[11px] text-sentinel-textMuted block">
                  Hard ceiling on cumulative trade volume the agent may execute in any 24-hour rolling window.
                </span>
              </div>

              {/* Consecutive Failures Circuit Breaker */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Circuit Breaker Trip Threshold</span>
                  <span className="text-sm font-bold text-rose-400 font-mono">
                    {maxConsecutiveFailures} Consecutive Failures
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={maxConsecutiveFailures}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxConsecutiveFailures(parseInt(e.target.value));
                  }}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <span className="text-[11px] text-sentinel-textMuted block">
                  Trips circuit breaker if agent proposes repeatedly failing intents, locking out automated actions.
                </span>
              </div>
            </div>

            {/* Live Agent Telemetry Card */}
            {agentRiskState && (
              <div className="p-4 rounded-xl bg-black/40 border border-sentinel-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Live Agent Risk State Telemetry
                    </span>
                  </div>
                  {onResetCircuitBreaker && (
                    <button
                      onClick={onResetCircuitBreaker}
                      className="px-2.5 py-1 rounded bg-sentinel-surfaceMuted hover:bg-sentinel-border text-xs text-sentinel-text flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-blue-400" />
                      <span>Reset Circuit Breaker</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-sentinel-surfaceMuted">
                    <span className="text-sentinel-textSubtle block text-[10px]">24H SPENT</span>
                    <span className="text-white font-bold">
                      {formatCurrency(agentRiskState.tradesExecuted24hUsd)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-sentinel-surfaceMuted">
                    <span className="text-sentinel-textSubtle block text-[10px]">DAILY TURNOVER</span>
                    <span className="text-cyan-400 font-bold">
                      {(agentRiskState.dailyTurnoverBps / 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-sentinel-surfaceMuted">
                    <span className="text-sentinel-textSubtle block text-[10px]">CONSECUTIVE FAILS</span>
                    <span
                      className={`font-bold ${
                        agentRiskState.consecutiveFailures > 0 ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {agentRiskState.consecutiveFailures} / {maxConsecutiveFailures}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-sentinel-surfaceMuted">
                    <span className="text-sentinel-textSubtle block text-[10px]">CIRCUIT STATUS</span>
                    <span
                      className={`font-bold ${
                        agentRiskState.isCircuitBreakerTriggered ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {agentRiskState.isCircuitBreakerTriggered ? 'TRIPPED' : 'HEALTHY'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TIER 5: Market Truth & Venue Health */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-sentinel-border">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs">
                T5
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tier 5: Market Truth &amp; Venue Health</h3>
                <p className="text-xs text-sentinel-textMuted">
                  Dual-feed Pyth oracle verification ensuring tokenized equities reflect genuine market reality.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Max Tracking Error */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Basis Tracking Error</span>
                  <span className="text-sm font-bold text-cyan-400 font-mono">
                    {(maxTrackingErrorBps / 100).toFixed(2)}% ({maxTrackingErrorBps} bps)
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={maxTrackingErrorBps}
                  onChange={(e) => {
                    setActiveProfile('custom');
                    setMaxTrackingErrorBps(parseInt(e.target.value));
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[11px] text-sentinel-textMuted block">
                  Aborts trade if tokenized stock depegs beyond basis points from underlying US equity feed.
                </span>
              </div>

              {/* Max Oracle Confidence */}
              <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Max Oracle Confidence Ratio</span>
                  <span className="text-sm font-bold text-blue-400 font-mono">
                    {(maxOracleConfidenceBps / 100).toFixed(2)}% ({maxOracleConfidenceBps} bps)
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
                    setMaxOracleConfidenceBps(parseInt(e.target.value));
                  }}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-[11px] text-sentinel-textMuted block">
                  Rejects execution if Pyth price uncertainty interval (confidence / price) is wider than threshold.
                </span>
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-center justify-between p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-white block">Require Healthy Venue</span>
                  <span className="text-[11px] text-sentinel-textMuted block">
                    Verify DBC curve or DEX is reporting operational status
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={requireHealthyVenue}
                  onChange={(e) => setRequireHealthyVenue(e.target.checked)}
                  className="w-4 h-4 accent-sentinel-accent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-white block">Market Hours Only</span>
                  <span className="text-[11px] text-sentinel-textMuted block">
                    Only permit rebalancing during active US equity market sessions
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={marketHoursOnly}
                  onChange={(e) => setMarketHoursOnly(e.target.checked)}
                  className="w-4 h-4 accent-sentinel-accent cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 3. On-Chain Solana Anchor Details */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-sentinel-text">On-Chain Anchor PDA Commitment</h3>
        <p className="text-xs text-sentinel-textMuted">
          The Policy Account PDA and PortfolioVault PDA are anchored on Solana Devnet:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 font-mono text-xs">
          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block">SOLANA PROGRAM ID</span>
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-1 mt-1"
            >
              <span>{formatAddress(APP_CONFIG.sentinelProgramId, 8)}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block">PORTFOLIO VAULT PDA SEEDS</span>
            <span className="text-white mt-1 block">
              b&quot;vault&quot;, owner.key()
            </span>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block">ARITHMETIC PRECISION</span>
            <span className="text-emerald-400 mt-1 block font-semibold">
              u128 basis-point checked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
