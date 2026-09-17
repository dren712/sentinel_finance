'use client';

import React, { useState } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  PortfolioAsset,
  getAssetMetadata,
  NormalizedMarketPrice,
  deriveSentinelPda,
  evaluateAssetClassAllocations,
  getAssetCategory,
  getTesseraTranche,
} from '@sentinel/domain';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Lock,
  DollarSign,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  Wallet,
  Cpu,
  Key,
  Copy,
  Check,
  Sliders,
  Sparkles,
  Building2,
  Rocket,
  RotateCcw,
} from 'lucide-react';
import { Stat } from './ui/Stat';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { FinancialChart } from './ui/FinancialChart';
import { PriceProvenanceHover } from './ui/PriceProvenanceHover';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';
import { getExplorerAddressUrl } from '@/lib/config';

interface PortfolioViewProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  recentEvidence: EvidenceRecord[];
  marketPrices?: Record<string, NormalizedMarketPrice>;
  onSelectEvidence: (record: EvidenceRecord) => void;
  onNavigateToDecisions: () => void;
  onBuildPortfolio?: (allocations: Record<string, number>) => void;
}

const PORTFOLIO_PRESETS = [
  {
    id: 'BALANCED',
    name: 'Balanced Multi-Asset',
    tag: '60% Public · 15% Pre-IPO · 25% USDC',
    badge: 'Recommended',
    description: 'Institutionally diversified across public equities and vetted pre-IPO tech unicorns',
    allocations: {
      AAPLx: 20,
      NVDAx: 20,
      SPYx: 20,
      SPACEXx: 5,
      OPENAIx: 5,
      STRIPEx: 5,
      USDC: 25,
    },
  },
  {
    id: 'TECH_ALPHA',
    name: 'PreStocks Tech Alpha',
    tag: '50% Public · 20% Pre-IPO · 30% USDC',
    badge: 'High Growth',
    description: 'Maximized 20% cap allocation to late-stage private unicorns (SpaceX, OpenAI, Stripe)',
    allocations: {
      AAPLx: 15,
      NVDAx: 20,
      SPYx: 15,
      SPACEXx: 10,
      OPENAIx: 5,
      STRIPEx: 5,
      USDC: 30,
    },
  },
  {
    id: 'PUBLIC_FOCUS',
    name: 'Public Blue-Chips',
    tag: '70% Public · 0% Pre-IPO · 30% USDC',
    badge: 'Public Equities',
    description: 'Pure liquid equities utilizing Meteora DBC pools and Pyth dual-feed tracking',
    allocations: {
      AAPLx: 25,
      NVDAx: 25,
      SPYx: 20,
      SPACEXx: 0,
      OPENAIx: 0,
      STRIPEx: 0,
      USDC: 30,
    },
  },
  {
    id: 'CAPITAL_PRESERVATION',
    name: 'Capital Preservation',
    tag: '40% Public · 10% Pre-IPO · 50% USDC',
    badge: 'Defensive',
    description: '50% liquidity reserve with disciplined core equities and selective private exposure',
    allocations: {
      AAPLx: 15,
      NVDAx: 15,
      SPYx: 10,
      SPACEXx: 5,
      OPENAIx: 5,
      STRIPEx: 0,
      USDC: 50,
    },
  },
];

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  portfolio,
  policy,
  recentEvidence,
  marketPrices,
  onSelectEvidence,
  onNavigateToDecisions,
  onBuildPortfolio,
}) => {
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Phase 11: Build Your Portfolio Studio State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string>('BALANCED');
  const [builderAllocations, setBuilderAllocations] = useState<Record<string, number>>({
    AAPLx: 20,
    NVDAx: 20,
    SPYx: 20,
    SPACEXx: 5,
    OPENAIx: 5,
    STRIPEx: 5,
    USDC: 25,
  });
  const [deploySuccess, setDeploySuccess] = useState(false);

  const sentinelPda = portfolio.sentinelPda || deriveSentinelPda(portfolio.owner);

  const handleCopy = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const equityValue = portfolio.totalValueUsd - portfolio.stablecoinValueUsd;
  const equityExposureBps = 10_000 - portfolio.stablecoinExposureBps;
  const isReserveHealthy = portfolio.stablecoinExposureBps >= policy.minStablecoinBps;

  // Evaluate policy guarantee health (Asset classes + Single asset)
  const assetClassReport = evaluateAssetClassAllocations(portfolio, policy);
  const singleAssetExceeded = portfolio.assets.some(
    (a) => !a.isStablecoin && !a.isIndex && a.exposureBps > policy.maxSingleAssetBps
  );
  const isHealthy =
    isReserveHealthy &&
    !singleAssetExceeded &&
    assetClassReport.publicEquities.passed &&
    assetClassReport.preIpo.passed;

  // Builder metrics
  const totalAllocatedPct = Object.values(builderAllocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const publicAllocatedPct = (builderAllocations.AAPLx || 0) + (builderAllocations.NVDAx || 0) + (builderAllocations.SPYx || 0);
  const preIpoAllocatedPct = (builderAllocations.SPACEXx || 0) + (builderAllocations.OPENAIx || 0) + (builderAllocations.STRIPEx || 0);
  const stableAllocatedPct = builderAllocations.USDC || 0;

  const maxPublicPct = (policy.maxPublicEquitiesExposureBps ?? 7000) / 100;
  const maxPreIpoPct = (policy.maxPreIpoExposureBps ?? 2000) / 100;
  const minStablePct = policy.minStablecoinBps / 100;
  const maxSingleAssetPct = policy.maxSingleAssetBps / 100;

  const isTotalValid = Math.abs(totalAllocatedPct - 100) < 0.01;
  const isPublicValid = publicAllocatedPct <= maxPublicPct + 0.01;
  const isPreIpoValid = preIpoAllocatedPct <= maxPreIpoPct + 0.01;
  const isStableValid = stableAllocatedPct >= minStablePct - 0.01;

  // Single asset check (except USDC and SPYx index)
  const singleAssetViolations = Object.entries(builderAllocations).filter(
    ([sym, pct]) => sym !== 'USDC' && sym !== 'SPYx' && pct > maxSingleAssetPct + 0.01
  );
  const isSingleAssetValid = singleAssetViolations.length === 0;

  const canDeploy = isTotalValid && isPublicValid && isPreIpoValid && isStableValid && isSingleAssetValid;

  const handleApplyPreset = (preset: typeof PORTFOLIO_PRESETS[0]) => {
    setActivePresetId(preset.id);
    setBuilderAllocations({ ...preset.allocations });
  };

  const handleAllocationChange = (symbol: string, value: number) => {
    setActivePresetId('CUSTOM');
    setBuilderAllocations((prev) => ({
      ...prev,
      [symbol]: Math.max(0, Math.min(100, isNaN(value) ? 0 : value)),
    }));
  };

  const handleDeploy = () => {
    if (!canDeploy || !onBuildPortfolio) return;
    const allocationDollars: Record<string, number> = {};
    for (const [sym, pct] of Object.entries(builderAllocations)) {
      allocationDollars[sym] = Math.round((pct / 100) * portfolio.totalValueUsd);
    }
    onBuildPortfolio(allocationDollars);
    setDeploySuccess(true);
    setTimeout(() => setDeploySuccess(false), 3000);
  };

  const getAssetColor = (symbol: string): string => {
    const meta = getAssetMetadata(symbol);
    if (meta?.colorHex) return meta.colorHex;
    if (symbol === 'NVDAx') return '#10B981';
    if (symbol === 'AAPLx') return '#94A3B8';
    if (symbol === 'SPYx') return '#3B82F6';
    if (symbol === 'USDC') return '#06B6D4';
    return '#8B5CF6';
  };

  return (
    <div className="space-y-6">
      {/* Policy Health & Pyth Oracle Valuation Banner */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isHealthy
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                Institutional Portfolio
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Pyth Market Truth
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Solana Devnet
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Valued via Pyth Network oracle feeds with dual-feed tracking (tokenized vs. underlying US equities).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border flex items-center gap-1.5 ${
            isHealthy
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
              : 'bg-rose-950/40 text-rose-400 border-rose-500/40'
          }`}>
            {isHealthy ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                5 / 5 Guarantees Healthy
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Policy Boundary Alert
              </>
            )}
          </span>
        </div>
      </div>

      {/* Real Portfolio State Architecture Banner (Phase 3) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-sentinel-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              State Architecture · Verified On-Chain Projection
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Phase 3 Real Assets
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-sentinel-textMuted">
            <span>Projection State Hash:</span>
            <span className="text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {portfolio.projectionHash
                ? `${portfolio.projectionHash.slice(0, 10)}...${portfolio.projectionHash.slice(-8)}`
                : 'PROV_STATE_VERIFIED'}
            </span>
          </div>
        </div>

        {/* 4-Step Pipeline Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 1 · ASSETS</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              Wallet Token ATAs
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">SPL Token Accounts</span>
          </div>
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 2 · READER</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Portfolio Indexer
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">Live Token Balances</span>
          </div>
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 3 · VALUATION</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              Pyth Market Truth
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">Normalized NAV & Basis</span>
          </div>
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 4 · ENFORCEMENT</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Sentinel PDA Guard
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">Invariant Authority</span>
          </div>
        </div>
      </div>

      {/* 1. Stat Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <Stat
          label="PORTFOLIO NAV"
          value={formatCurrency(portfolio.totalValueUsd)}
          subtext="Collateralized on Solana Devnet"
          delta="BENCHMARK"
          deltaPositive={true}
          icon={DollarSign}
        />

        {/* Stablecoin Reserve Floor */}
        <Stat
          label="USDC RESERVE FLOOR"
          value={formatPercent(portfolio.stablecoinExposureBps / 100)}
          subtext={`Guaranteed floor: ${(policy.minStablecoinBps / 100).toFixed(1)}%`}
          delta={isReserveHealthy ? 'SAFE' : 'BREACH'}
          deltaPositive={isReserveHealthy}
          icon={Lock}
          iconColor="text-emerald-400"
        />

        {/* Tokenized Equities */}
        <Stat
          label="TOKENIZED EQUITIES"
          value={formatCurrency(equityValue)}
          subtext={`Cap: ${(policy.maxSingleAssetBps / 100).toFixed(1)}% per stock`}
          delta={formatPercent(equityExposureBps / 100)}
          deltaPositive={true}
          icon={TrendingUp}
          iconColor="text-indigo-400"
        />

        {/* Active Policy Status */}
        <Stat
          label="POLICY ENFORCEMENT"
          value={`v${policy.policyVersion}`}
          subtext="On-chain Anchor constraints"
          delta="ACTIVE"
          deltaPositive={true}
          icon={ShieldCheck}
          iconColor="text-blue-400"
        />
      </div>

      {/* Phase 11: PreStocks Asset Universe & Macro Allocation Overview */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sentinel-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
              P11
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Asset Universe &amp; Macro Allocation Controls
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                  PreStocks Integrated
                </span>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Multi-asset tripartite taxonomy with deterministic Sentinel invariant enforcement across Public Equities, Pre-IPO Unicorns, and Stablecoin Reserves.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsBuilderOpen(!isBuilderOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-md transition self-start sm:self-auto cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isBuilderOpen ? 'Hide Portfolio Builder' : 'BUILD YOUR PORTFOLIO'}</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/20 font-mono">Interactive</span>
          </button>
        </div>

        {/* 3 Macro Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Public Equities */}
          <div className={`p-4 rounded-xl border transition ${
            assetClassReport.publicEquities.passed
              ? 'bg-sentinel-surfaceMuted border-blue-500/20'
              : 'bg-rose-950/20 border-rose-500/40'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white uppercase">Public Equities</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                assetClassReport.publicEquities.passed
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {assetClassReport.publicEquities.passed ? 'COMPLIANT' : 'BREACH'}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-white">
                {formatCurrency(assetClassReport.publicEquities.valueUsd)}
              </span>
              <span className="text-xs font-mono font-semibold text-blue-400">
                {(assetClassReport.publicEquities.exposureBps / 100).toFixed(1)}%
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-sentinel-textMuted">
                <span>Policy Ceiling:</span>
                <span className="text-white">≤ {(assetClassReport.publicEquities.maxBps / 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-sentinel-surface h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    assetClassReport.publicEquities.passed ? 'bg-blue-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (assetClassReport.publicEquities.exposureBps / assetClassReport.publicEquities.maxBps) * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-sentinel-border/40 text-[10px] text-sentinel-textSubtle flex items-center justify-between">
              <span>AAPLx · NVDAx · SPYx</span>
              <span className="text-blue-400 font-mono">Meteora DBC</span>
            </div>
          </div>

          {/* Card 2: Pre-IPO Equities (PreStocks) */}
          <div className={`p-4 rounded-xl border transition ${
            assetClassReport.preIpo.passed
              ? 'bg-sentinel-surfaceMuted border-purple-500/20'
              : 'bg-rose-950/20 border-rose-500/40'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white uppercase">Pre-IPO (PreStocks)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                assetClassReport.preIpo.passed
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {assetClassReport.preIpo.passed ? 'COMPLIANT' : 'BREACH'}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-white">
                {formatCurrency(assetClassReport.preIpo.valueUsd)}
              </span>
              <span className="text-xs font-mono font-semibold text-purple-400">
                {(assetClassReport.preIpo.exposureBps / 100).toFixed(1)}%
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-sentinel-textMuted">
                <span>Policy Ceiling:</span>
                <span className="text-white">≤ {(assetClassReport.preIpo.maxBps / 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-sentinel-surface h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    assetClassReport.preIpo.passed ? 'bg-purple-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (assetClassReport.preIpo.exposureBps / (assetClassReport.preIpo.maxBps || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-sentinel-border/40 text-[10px] text-sentinel-textSubtle flex items-center justify-between">
              <span>SPACEXx · OPENAIx · STRIPEx</span>
              <span className="text-purple-400 font-mono">PreStocks / Tessera SPV</span>
            </div>
          </div>

          {/* Card 3: Stable Reserve */}
          <div className={`p-4 rounded-xl border transition ${
            assetClassReport.stable.passed
              ? 'bg-sentinel-surfaceMuted border-emerald-500/20'
              : 'bg-rose-950/20 border-rose-500/40'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase">Stable Reserve</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                assetClassReport.stable.passed
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {assetClassReport.stable.passed ? 'COMPLIANT' : 'BREACH'}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-white">
                {formatCurrency(assetClassReport.stable.valueUsd)}
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-400">
                {(assetClassReport.stable.exposureBps / 100).toFixed(1)}%
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-sentinel-textMuted">
                <span>Policy Floor:</span>
                <span className="text-white">≥ {(assetClassReport.stable.minBps / 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-sentinel-surface h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    assetClassReport.stable.passed ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (assetClassReport.stable.exposureBps / (assetClassReport.stable.minBps * 2 || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-sentinel-border/40 text-[10px] text-sentinel-textSubtle flex items-center justify-between">
              <span>USDC Token Account</span>
              <span className="text-emerald-400 font-mono">Instant Liquidity</span>
            </div>
          </div>
        </div>

        {/* Collapsible BUILD YOUR PORTFOLIO Studio */}
        {isBuilderOpen && (
          <div className="mt-4 pt-4 border-t border-sentinel-border bg-sentinel-surfaceMuted/50 rounded-xl p-5 border space-y-5">
            {/* Studio Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-sentinel-border">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-bold text-white">
                    BUILD YOUR PORTFOLIO · Multi-Asset Construction Studio
                  </h4>
                </div>
                <p className="text-xs text-sentinel-textMuted mt-0.5">
                  Allocate across Public Equities, Pre-IPO Unicorns, and Stable reserves. Real-time mathematical verification guarantees Anchor invariant compatibility.
                </p>
              </div>

              {/* Status summary pill */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border flex items-center gap-1.5 ${
                  canDeploy
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                    : 'bg-rose-950/40 text-rose-400 border-rose-500/40'
                }`}>
                  {canDeploy ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      All Invariants Satisfied
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Invariants Breached
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Curated Presets Bar */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-sentinel-textSubtle uppercase tracking-wider block">
                Institutional Allocation Presets
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PORTFOLIO_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`text-left p-3 rounded-lg border transition cursor-pointer ${
                        isSelected
                          ? 'bg-sentinel-surfaceElevated border-blue-500/50 shadow-sm'
                          : 'bg-sentinel-surface border-sentinel-border hover:border-sentinel-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{preset.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {preset.badge}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-blue-400 block font-semibold mb-1">
                        {preset.tag}
                      </span>
                      <p className="text-[10px] text-sentinel-textMuted line-clamp-2">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tripartite Asset Sliders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
              {/* 1. Public Equities */}
              <div className="p-4 rounded-xl bg-sentinel-surface border border-blue-500/30 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-sentinel-border">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">Public Equities</span>
                      <span className="text-[10px] text-sentinel-textMuted">Meteora DBC · Dual-Feed</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-bold block ${
                      isPublicValid ? 'text-blue-400' : 'text-rose-400'
                    }`}>
                      {publicAllocatedPct.toFixed(1)}% / ≤ {maxPublicPct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-sentinel-textSubtle">
                      ${Math.round((publicAllocatedPct / 100) * portfolio.totalValueUsd).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Assets: AAPLx, NVDAx, SPYx */}
                {[
                  { sym: 'AAPLx', name: 'Apple Inc.', color: '#94A3B8' },
                  { sym: 'NVDAx', name: 'Nvidia Corp.', color: '#10B981' },
                  { sym: 'SPYx', name: 'S&P 500 ETF', color: '#3B82F6' },
                ].map((asset) => (
                  <div key={asset.sym} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                        <span className="font-semibold text-white">{asset.sym}</span>
                        <span className="text-[10px] text-sentinel-textMuted">({asset.name})</span>
                      </div>
                      <span className="font-bold text-white">
                        {builderAllocations[asset.sym] || 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={builderAllocations[asset.sym] || 0}
                      onChange={(e) => handleAllocationChange(asset.sym, parseFloat(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              {/* 2. Pre-IPO Equities (PreStocks) */}
              <div className="p-4 rounded-xl bg-sentinel-surface border border-purple-500/30 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-sentinel-border">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">Pre-IPO Unicorns</span>
                      <span className="text-[10px] text-sentinel-textMuted">PreStocks Secondary</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-bold block ${
                      isPreIpoValid ? 'text-purple-400' : 'text-rose-400'
                    }`}>
                      {preIpoAllocatedPct.toFixed(1)}% / ≤ {maxPreIpoPct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-sentinel-textSubtle">
                      ${Math.round((preIpoAllocatedPct / 100) * portfolio.totalValueUsd).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Assets: SPACEXx, OPENAIx, STRIPEx */}
                {[
                  { sym: 'SPACEXx', name: 'SpaceX', color: '#8B5CF6' },
                  { sym: 'OPENAIx', name: 'OpenAI LLC', color: '#EC4899' },
                  { sym: 'STRIPEx', name: 'Stripe Inc.', color: '#06B6D4' },
                ].map((asset) => (
                  <div key={asset.sym} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                        <span className="font-semibold text-white">{asset.sym}</span>
                        <span className="text-[10px] text-sentinel-textMuted">({asset.name})</span>
                      </div>
                      <span className="font-bold text-white">
                        {builderAllocations[asset.sym] || 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={builderAllocations[asset.sym] || 0}
                      onChange={(e) => handleAllocationChange(asset.sym, parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              {/* 3. Stablecoin Liquidity Floor */}
              <div className="p-4 rounded-xl bg-sentinel-surface border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-sentinel-border">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">Cash Reserve Floor</span>
                      <span className="text-[10px] text-sentinel-textMuted">Instant Liquidity</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-mono font-bold block ${
                      isStableValid ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {stableAllocatedPct.toFixed(1)}% / ≥ {minStablePct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-sentinel-textSubtle">
                      ${Math.round((stableAllocatedPct / 100) * portfolio.totalValueUsd).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Asset: USDC */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="font-semibold text-white">USDC</span>
                      <span className="text-[10px] text-sentinel-textMuted">(USD Coin)</span>
                    </div>
                    <span className="font-bold text-white">
                      {builderAllocations.USDC || 0}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={builderAllocations.USDC || 0}
                    onChange={(e) => handleAllocationChange('USDC', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-sentinel-textMuted block pt-1">
                    Guaranteed liquid stable reserve for automated risk management and portfolio buffer.
                  </span>
                </div>
              </div>
            </div>

            {/* Real-time Invariant Verification & Deployment Bar */}
            <div className="p-4 rounded-xl bg-sentinel-surface border border-sentinel-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-sentinel-textSubtle">Total Allocation:</span>
                  <span className={`font-bold ${isTotalValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalAllocatedPct.toFixed(1)}% / 100.0%
                  </span>
                  <span>•</span>
                  <span className="text-sentinel-textSubtle">Single Asset Cap:</span>
                  <span className={`font-bold ${isSingleAssetValid ? 'text-blue-400' : 'text-rose-400'}`}>
                    ≤ {maxSingleAssetPct.toFixed(1)}%
                  </span>
                </div>

                {/* Validation message */}
                {!isTotalValid && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Total allocation must equal exactly 100.00% (currently {totalAllocatedPct.toFixed(1)}%).
                  </p>
                )}
                {isTotalValid && !isPublicValid && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Public Equities ({publicAllocatedPct.toFixed(1)}%) exceeds macro cap of {maxPublicPct.toFixed(1)}%.
                  </p>
                )}
                {isTotalValid && !isPreIpoValid && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Pre-IPO Unicorns ({preIpoAllocatedPct.toFixed(1)}%) exceeds PreStocks cap of {maxPreIpoPct.toFixed(1)}%.
                  </p>
                )}
                {isTotalValid && !isStableValid && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Cash reserve floor breached ({stableAllocatedPct.toFixed(1)}% &lt; minimum {minStablePct.toFixed(1)}%).
                  </p>
                )}
                {isTotalValid && !isSingleAssetValid && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Single asset limit ({maxSingleAssetPct.toFixed(1)}%) breached by {singleAssetViolations.map(([s, p]) => `${s} (${p}%)`).join(', ')}.
                  </p>
                )}
                {canDeploy && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    All 5 institutional risk invariants satisfied. Ready to deploy verified portfolio projection.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {deploySuccess && (
                  <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Deployed on Solana!
                  </span>
                )}
                <button
                  disabled={!canDeploy}
                  onClick={handleDeploy}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    canDeploy
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md'
                      : 'bg-sentinel-surfaceMuted text-sentinel-textSubtle border border-sentinel-border cursor-not-allowed opacity-60'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Deploy Verified Portfolio</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sentinel PDA Authority & Configuration Card (Phase 3) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Sentinel PDA Authority
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
                seeds: [b&quot;vault&quot;, owner]
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 font-mono text-xs">
              <span className="text-sentinel-textSubtle">PDA Address:</span>
              <span className="text-white font-semibold">{formatAddress(sentinelPda, 8)}</span>
              <button
                onClick={(e) => handleCopy(sentinelPda, e)}
                className="p-1 rounded hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition"
                title="Copy PDA Address"
              >
                {copiedAddress === sentinelPda ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <a
                href={getExplorerAddressUrl(sentinelPda)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1"
                title="View on Solana Explorer"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-1">
              Non-custodial execution authority: user assets remain native SPL tokens in wallet ATAs; Sentinel PDA strictly authorizes execution and enforces mathematical invariants.
            </p>
          </div>

          {/* 5 Institutional Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Policy Authority
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Portfolio Config
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Execution Guard
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Promise Registry
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Evidence Anchor
            </span>
          </div>
        </div>
      </div>

      {/* 2. TradingView Lightweight Financial Chart */}
      <FinancialChart currentValueUsd={portfolio.totalValueUsd} />

      {/* 3. Asset Allocation Distribution Bar */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-sentinel-text">Portfolio Allocation Distribution</span>
          <span className="text-sentinel-textMuted font-mono">100.00% Total NAV</span>
        </div>

        {/* Visual Allocation Strip */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-sentinel-surfaceMuted">
          {portfolio.assets.map((asset) => {
            const widthPct = (asset.exposureBps / 100);
            const color = getAssetColor(asset.symbol);
            return (
              <div
                key={asset.symbol}
                className="hover:opacity-80 transition cursor-pointer"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
                title={`${asset.symbol}: ${widthPct.toFixed(2)}%`}
                onClick={() => setSelectedAssetSymbol(asset.symbol)}
              />
            );
          })}
        </div>

        {/* Legend Chips */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          {portfolio.assets.map((asset) => {
            const color = getAssetColor(asset.symbol);
            return (
              <button
                key={asset.symbol}
                onClick={() => setSelectedAssetSymbol(asset.symbol === selectedAssetSymbol ? null : asset.symbol)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                  selectedAssetSymbol === asset.symbol
                    ? 'bg-sentinel-surfaceElevated border border-blue-500/40 text-white'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-semibold">{asset.symbol}</span>
                <span className="font-mono text-sentinel-textSubtle">
                  {(asset.exposureBps / 100).toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Asset Holdings Table & Policy Boundaries */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-sentinel-border">
          <div>
            <h3 className="text-base font-bold text-sentinel-text">Holdings & Policy Compliance</h3>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Machine-verified against single equity ceiling (≤ {(policy.maxSingleAssetBps / 100).toFixed(1)}%) and stablecoin floor (≥ {(policy.minStablecoinBps / 100).toFixed(1)}%).
            </p>
          </div>
          <span className="text-xs font-mono text-sentinel-textSubtle self-start sm:self-auto">
            {portfolio.assets.length} Active Positions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sentinel-border text-sentinel-textSubtle text-xs font-semibold">
                <th className="pb-3 font-medium">ASSET</th>
                <th className="pb-3 font-medium">SPL ATA ACCOUNT</th>
                <th className="pb-3 font-medium">PRICE</th>
                <th className="pb-3 font-medium">HOLDINGS</th>
                <th className="pb-3 font-medium">VALUE</th>
                <th className="pb-3 font-medium">ALLOCATION</th>
                <th className="pb-3 font-medium">POLICY STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-border">
              {portfolio.assets.map((asset) => {
                const exposurePct = asset.exposureBps / 100;
                const isCompliant = asset.isStablecoin
                  ? asset.exposureBps >= policy.minStablecoinBps
                  : asset.isIndex
                  ? true
                  : asset.exposureBps <= policy.maxSingleAssetBps;

                const isSelected = selectedAssetSymbol === asset.symbol;

                return (
                  <React.Fragment key={asset.symbol}>
                    <tr
                      onClick={() => setSelectedAssetSymbol(isSelected ? null : asset.symbol)}
                      className={`hover:bg-sentinel-surfaceElevated/60 transition cursor-pointer ${
                        isSelected ? 'bg-sentinel-surfaceElevated/80' : ''
                      }`}
                    >
                      {/* Asset & Name */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{
                              backgroundColor: `${getAssetColor(asset.symbol)}20`,
                              color: getAssetColor(asset.symbol),
                              border: `1px solid ${getAssetColor(asset.symbol)}40`,
                            }}
                          >
                            {asset.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{asset.symbol}</span>
                              {asset.isStablecoin ? (
                                <Badge variant="success" size="sm">
                                  RESERVE
                                </Badge>
                              ) : getAssetCategory(asset.symbol) === 'PRE_IPO' ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                  PRE-IPO
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                  PUBLIC
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-sentinel-textMuted">{asset.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* SPL Associated Token Account (ATA) */}
                      <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <a
                            href={asset.ata ? getExplorerAddressUrl(asset.ata) : '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sentinel-textMuted hover:text-blue-400 transition"
                            title={asset.ata || 'SPL Associated Token Account'}
                          >
                            {formatAddress(asset.ata || 'ATA_DERIVING', 4)}
                          </a>
                          {asset.ata && (
                            <button
                              onClick={(e) => handleCopy(asset.ata!, e)}
                              className="p-1 rounded hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition"
                              title="Copy ATA Address"
                            >
                              {copiedAddress === asset.ata ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Price with Pyth Provenance Hover */}
                      <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <PriceProvenanceHover
                          priceUsd={asset.priceUsd}
                          marketPrice={marketPrices?.[asset.symbol]}
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 font-mono text-sentinel-textMuted tabular-nums">
                        {asset.amount.toLocaleString('en-US', {
                          minimumFractionDigits: asset.isStablecoin ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Value */}
                      <td className="py-3.5 font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(asset.valueUsd)}
                      </td>

                      {/* Allocation */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white tabular-nums font-semibold w-12">
                            {formatPercent(exposurePct)}
                          </span>
                          <div className="w-16 sm:w-24 bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isCompliant ? 'bg-blue-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, exposurePct * 2)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Policy Status */}
                      <td className="py-3.5">
                        {isCompliant ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold font-mono">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {asset.isStablecoin
                                ? `≥ ${(policy.minStablecoinBps / 100).toFixed(1)}%`
                                : `≤ ${(policy.maxSingleAssetBps / 100).toFixed(1)}%`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold font-mono">
                            <XCircle className="w-4 h-4" />
                            <span>BREACH</span>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Asset Detail */}
                    {isSelected && (
                      <tr className="bg-sentinel-surfaceElevated/40">
                        <td colSpan={7} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-xs font-mono bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border">
                            <div>
                              <span className="text-sentinel-textSubtle block">SOLANA TOKEN MINT</span>
                              <a
                                href={getExplorerAddressUrl(asset.mint)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <span>{formatAddress(asset.mint, 6)}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">ASSOCIATED TOKEN ACCOUNT (ATA)</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <a
                                  href={asset.ata ? getExplorerAddressUrl(asset.ata) : '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{formatAddress(asset.ata || 'ATA_DERIVED', 6)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                {asset.ata && (
                                  <button
                                    onClick={(e) => handleCopy(asset.ata!, e)}
                                    className="p-0.5 hover:text-white text-sentinel-textSubtle"
                                    title="Copy ATA"
                                  >
                                    {copiedAddress === asset.ata ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">RAW ATOMIC BALANCE</span>
                              <span className="text-white mt-0.5 block">
                                {asset.rawAmount || BigInt(Math.round(asset.amount * 1_000_000)).toString()} (decimals: {asset.decimals ?? 6})
                              </span>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">POLICY CEILING</span>
                              <span className="text-white mt-0.5 block">
                                {asset.isStablecoin
                                  ? `Minimum Floor: ${(policy.minStablecoinBps / 100).toFixed(2)}%`
                                  : `Maximum Cap: ${(policy.maxSingleAssetBps / 100).toFixed(2)}%`}
                              </span>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">UNIVERSE &amp; ROUTE</span>
                              <span className="text-white mt-0.5 block font-semibold">
                                {getAssetCategory(asset.symbol) === 'PRE_IPO' ? (
                                  <span className="text-purple-400">PreStocks Secondary</span>
                                ) : asset.isStablecoin ? (
                                  <span className="text-emerald-400">Native Cash Floor</span>
                                ) : (
                                  <span className="text-blue-400">Meteora DBC Pool</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Phase 12: Tessera Fractional SPV Tranche Layer */}
                          {getTesseraTranche(asset.symbol) && (() => {
                            const tranche = getTesseraTranche(asset.symbol)!;
                            return (
                              <div className="bg-gradient-to-r from-purple-950/30 via-slate-900 to-purple-950/20 p-3.5 rounded-lg border border-purple-500/30 text-xs font-mono">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-2 mb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                                    <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-purple-400" />
                                      Tessera Fractional SPV Tranche Layer
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                                    {tranche.trancheId}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
                                  <div>
                                    <span className="text-sentinel-textSubtle block text-[10px]">LEGAL ENTITY</span>
                                    <span className="text-white font-semibold truncate block" title={tranche.spvLegalEntity}>
                                      {tranche.spvLegalEntity}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-sentinel-textSubtle block text-[10px]">SHARE CLASS</span>
                                    <span className="text-purple-300 font-semibold">{tranche.shareClass}</span>
                                  </div>
                                  <div>
                                    <span className="text-sentinel-textSubtle block text-[10px]">CERTIFIED 409A / FORGE NAV</span>
                                    <span className="text-white font-bold">
                                      ${tranche.navAttestationUsd.toFixed(2)}
                                      <span className="text-[10px] text-sentinel-textMuted font-normal ml-1">
                                        ({tranche.navAttestationDate})
                                      </span>
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-sentinel-textSubtle block text-[10px]">LOCKUP &amp; MAX PREMIUM</span>
                                    <span className="text-emerald-400 font-semibold">
                                      Unlocked · ≤ {(tranche.maxAllowedNavPremiumBps / 100).toFixed(1)}% Premium
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-2 pt-1.5 border-t border-purple-500/20 text-[10px] text-sentinel-textMuted flex items-center justify-between">
                                  <span>Attestor: <span className="text-purple-300">{tranche.navAttestor}</span></span>
                                  <span className="text-sentinel-textSubtle">Vault PDA: {formatAddress(tranche.vaultPda, 6)}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Pyth Market Truth Institutional Provenance Box */}
                          {marketPrices?.[asset.symbol] && (
                            <div className="bg-sentinel-surfaceMuted/90 p-3.5 rounded-lg border border-purple-500/20 text-xs font-mono">
                              <div className="flex items-center justify-between border-b border-sentinel-border/60 pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                  <span className="font-bold text-white uppercase text-[11px]">
                                    Pyth Dual-Feed Oracle Provenance
                                  </span>
                                </div>
                                <span className="text-purple-400 font-semibold text-[11px]">
                                  {marketPrices[asset.symbol].feedDisplayId}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                <div>
                                  <span className="text-sentinel-textSubtle block">PYTH PRICE</span>
                                  <span className="text-white font-bold">
                                    ${marketPrices[asset.symbol].priceUsd.toFixed(2)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sentinel-textSubtle block">CONFIDENCE (±σ)</span>
                                  <span className="text-blue-400 font-bold">
                                    ±${marketPrices[asset.symbol].confidenceUsd.toFixed(2)} ({((marketPrices[asset.symbol].confidenceRatioBps ?? 10) / 100).toFixed(2)}%)
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sentinel-textSubtle block">UNDERLYING BENCHMARK</span>
                                  <span className="text-white font-bold">
                                    {marketPrices[asset.symbol].underlyingSymbol ?? 'US Equity'}{' '}
                                    {marketPrices[asset.symbol].underlyingPriceUsd
                                      ? `($${marketPrices[asset.symbol].underlyingPriceUsd!.toFixed(2)})`
                                      : ''}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sentinel-textSubtle block">BASIS DEVIATION</span>
                                  <span
                                    className={`font-bold ${
                                      (marketPrices[asset.symbol].trackingErrorBps ?? 0) <= 250
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {marketPrices[asset.symbol].deviationPct.toFixed(2)}% ({marketPrices[asset.symbol].trackingErrorBps} bps)
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
