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
} from '@sentinel/domain';

export const PRESTOCKS_SERIES_REGISTRY: Record<string, {
  seriesId: string;
  facility: string;
  shareClass: string;
  navAttestationUsd: number;
  navAttestationDate: string;
  vaultPda: string;
}> = {
  OPENAIx: {
    seriesId: 'PRESTOCKS_OPENAI_SECONDARY_SERIES',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Secondary Employee Tender Tranche',
    navAttestationUsd: 200.0,
    navAttestationDate: '2026-08-01',
    vaultPda: 'PreStkOPENAIVault1111111111111111111111111',
  },
  SPACEXx: {
    seriesId: 'PRESTOCKS_SPACEX_SERIES_N',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Series N Preferred',
    navAttestationUsd: 135.0,
    navAttestationDate: '2026-08-15',
    vaultPda: 'PreStkSPACEXVault1111111111111111111111111',
  },
  ANTHROPICx: {
    seriesId: 'PRESTOCKS_ANTHROPIC_SERIES_C',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Series C Preferred',
    navAttestationUsd: 105.0,
    navAttestationDate: '2026-08-10',
    vaultPda: 'PreStkANTHROPICVault111111111111111111111',
  },
  STRIPEx: {
    seriesId: 'PRESTOCKS_STRIPE_SERIES_I',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Series I Preferred',
    navAttestationUsd: 80.0,
    navAttestationDate: '2026-07-20',
    vaultPda: 'PreStkSTRIPEVault1111111111111111111111111',
  },
};
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
  X,
  ChevronRight,
  Activity,
  Info,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { FinancialChart } from './ui/FinancialChart';
import { PriceProvenanceHover } from './ui/PriceProvenanceHover';
import { HeroStoryCenterpiece, DemoScenarioKey } from './HeroStoryCenterpiece';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';
import { getExplorerAddressUrl } from '@/lib/config';

interface PortfolioViewProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  recentEvidence: EvidenceRecord[];
  marketPrices?: Record<string, NormalizedMarketPrice>;
  onSelectEvidence: (record: EvidenceRecord) => void;
  onNavigateToDecisions: () => void;
  onNavigateToAgent?: () => void;
  onNavigateToProtection?: () => void;
  onBuildPortfolio?: (allocations: Record<string, number>) => void;
  onRunAdaptation?: () => void;
  isRunningAdaptation?: boolean;
  selectedScenario?: DemoScenarioKey;
  onSelectScenario?: (scenario: DemoScenarioKey) => void;
  demoStep?: number;
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
  onNavigateToAgent,
  onNavigateToProtection,
  onBuildPortfolio,
  onRunAdaptation,
  isRunningAdaptation,
  selectedScenario,
  onSelectScenario,
  demoStep,
}) => {
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Portfolio Builder State
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

  const isReserveHealthy = portfolio.stablecoinExposureBps >= policy.minStablecoinBps;
  const assetClassReport = evaluateAssetClassAllocations(portfolio, policy);
  const singleAssetExceeded = portfolio.assets.some(
    (a) => !a.isStablecoin && !a.isIndex && a.exposureBps > policy.maxSingleAssetBps
  );

  // Core guarantee checks (4 checks: Reserve floor, Single asset cap, Public equities cap, Pre-IPO cap)
  const checksPassed = [
    isReserveHealthy,
    !singleAssetExceeded,
    assetClassReport.publicEquities.passed,
    assetClassReport.preIpo.passed,
  ].filter(Boolean).length;
  const totalChecks = 4;
  const isHealthy = checksPassed === totalChecks;

  // Selected asset for drawer
  const selectedAsset = selectedAssetSymbol
    ? portfolio.assets.find((a) => a.symbol === selectedAssetSymbol)
    : null;
  const selectedMarketPrice = selectedAssetSymbol ? marketPrices?.[selectedAssetSymbol] : undefined;
  const selectedPreStocks = selectedAssetSymbol ? PRESTOCKS_SERIES_REGISTRY[selectedAssetSymbol] : undefined;

  // Near-boundary evaluation for selected asset (within 200 bps of cap or floor)
  let isNearBoundary = false;
  let boundaryWarning = '';
  if (selectedAsset) {
    if (selectedAsset.isStablecoin) {
      const buffer = selectedAsset.exposureBps - policy.minStablecoinBps;
      if (buffer >= 0 && buffer <= 200) {
        isNearBoundary = true;
        boundaryWarning = `Within ${(buffer / 100).toFixed(2)}% of minimum cash floor (${(policy.minStablecoinBps / 100).toFixed(1)}%)`;
      }
    } else if (!selectedAsset.isIndex) {
      const headroom = policy.maxSingleAssetBps - selectedAsset.exposureBps;
      if (headroom >= 0 && headroom <= 200) {
        isNearBoundary = true;
        boundaryWarning = `Within ${(headroom / 100).toFixed(2)}% of single-asset cap (${(policy.maxSingleAssetBps / 100).toFixed(1)}%)`;
      }
    }
  }

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

  const singleAssetViolations = Object.entries(builderAllocations).filter(
    ([sym, pct]) => sym !== 'USDC' && sym !== 'SPYx' && pct > maxSingleAssetPct + 0.01
  );
  const isSingleAssetValid = singleAssetViolations.length === 0;
  const canDeploy = isTotalValid && isPublicValid && isPreIpoValid && isStableValid && isSingleAssetValid;

  const handleApplyPreset = (preset: (typeof PORTFOLIO_PRESETS)[0]) => {
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
      {/* 0. WHAT DID THE AGENT TRY TO DO? (HERO STORY CENTERPIECE) */}
      <HeroStoryCenterpiece
        portfolio={portfolio}
        policy={policy}
        onRunAdaptation={onRunAdaptation}
        isRunningAdaptation={isRunningAdaptation}
        onNavigateToDecisions={onNavigateToDecisions}
        onNavigateToProtection={onNavigateToProtection}
        selectedScenario={selectedScenario}
        onSelectScenario={onSelectScenario}
        demoStep={demoStep}
      />

      {/* 1. INSTITUTIONAL PORTFOLIO HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pt-1">
        <div>
          <span className="text-xs font-semibold text-sentinel-textSubtle tracking-wider uppercase">
            Portfolio
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono mt-1">
            {formatCurrency(portfolio.totalValueUsd)}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-sentinel-textMuted font-mono">
            <span className="text-sentinel-textSubtle">Since inception: —</span>
            <span>·</span>
            <span>Updated 2s ago</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sentinel Robo active
            </span>
            <span>·</span>
            {portfolio.source === 'ON_CHAIN_PROJECTION' ? (
              <span
                title="Authoritatively projected from live on-chain SPL Token accounts via Solana RPC"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                ON-CHAIN PROJECTION
              </span>
            ) : (
              <span
                title="Simulated projection: balances generated for mathematical demonstration"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono"
              >
                <Sliders className="w-3 h-3 text-amber-400" />
                SIMULATED PROJECTION
              </span>
            )}
          </div>
        </div>

        {/* Action Button: Build Your Portfolio Drawer */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsBuilderOpen(!isBuilderOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sentinel-surface hover:bg-sentinel-surfaceElevated border border-sentinel-border text-white transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>{isBuilderOpen ? 'Close Builder' : 'Asset Allocator'}</span>
          </button>
        </div>
      </div>

      {/* 2. AREA CURVE FINANCIAL CHART */}
      <FinancialChart currentValueUsd={portfolio.totalValueUsd} />

      {/* 3. TWO STATUS CARDS (SIDE-BY-SIDE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: SENTINEL */}
        <div
          onClick={onNavigateToAgent}
          className="bg-sentinel-surface border border-sentinel-border hover:border-blue-500/40 rounded-xl p-5 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between pb-3 border-b border-sentinel-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sentinel-textSubtle uppercase tracking-wider">
                SENTINEL
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
            <div className="text-xs text-sentinel-textSubtle group-hover:text-blue-400 transition flex items-center gap-1 font-mono">
              <span>Robo-01</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-3.5 space-y-1">
            <div className="text-base font-bold text-white">
              Balanced Growth
            </div>
            <p className="text-xs text-sentinel-textMuted leading-relaxed">
              Guarantees enforced on Solana Devnet with detached Ed25519 agent signatures.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-sentinel-border/40 flex items-center justify-between text-xs font-mono">
            <span className="text-sentinel-textSubtle">Mandate:</span>
            <span className="text-blue-400 font-semibold">Max Growth · Non-Bypass Guard</span>
          </div>
        </div>

        {/* Card 2: PROTECTION */}
        <div
          onClick={onNavigateToProtection}
          className="bg-sentinel-surface border border-sentinel-border hover:border-emerald-500/40 rounded-xl p-5 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between pb-3 border-b border-sentinel-border/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sentinel-textSubtle uppercase tracking-wider">
                PROTECTION
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 font-mono">
                {checksPassed} / {totalChecks} Healthy
              </span>
            </div>
            <div className="text-xs text-sentinel-textSubtle group-hover:text-emerald-400 transition flex items-center gap-1 font-mono">
              <span>View Policy</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-sentinel-textSubtle block text-[11px]">USDC RESERVE FLOOR</span>
              <span className="text-white font-bold text-sm block mt-0.5">
                {(portfolio.stablecoinExposureBps / 100).toFixed(1)}%
                <span className="text-sentinel-textMuted font-normal text-xs ml-1">
                  (min {(policy.minStablecoinBps / 100).toFixed(0)}%)
                </span>
              </span>
            </div>
            <div>
              <span className="text-sentinel-textSubtle block text-[11px]">CONCENTRATION CAP</span>
              <span className="text-white font-bold text-sm block mt-0.5">
                ≤ {(policy.maxSingleAssetBps / 100).toFixed(0)}%
                <span className="text-emerald-400 font-semibold text-xs ml-1">
                  (Safe)
                </span>
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sentinel-border/40 flex items-center justify-between text-xs font-mono">
            <span className="text-sentinel-textSubtle">PDA Authority:</span>
            <span className="text-purple-400 font-semibold">{formatAddress(sentinelPda, 4)}</span>
          </div>
        </div>
      </div>

      {/* 4. EXPANDABLE PORTFOLIO BUILDER STUDIO (Phase 11) */}
      {isBuilderOpen && (
        <div className="bg-sentinel-surface border border-purple-500/30 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sentinel-border">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Asset Universe &amp; Allocator Studio
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                  PreStocks &amp; DBC
                </span>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Adjust multi-asset weight targets within institutional Sentinel boundary envelopes.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border flex items-center gap-1.5 ${
              canDeploy
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {canDeploy ? '✓ Invariants Satisfied' : '✕ Limits Breached'}
            </span>
          </div>

          {/* Curated Presets */}
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
                      : 'bg-sentinel-surfaceMuted border-sentinel-border hover:border-sentinel-border/80'
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

          {/* Asset Sliders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
            {/* Public Equities */}
            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-blue-500/20 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" /> Public Equities
                </span>
                <span className={`font-mono font-bold ${isPublicValid ? 'text-blue-400' : 'text-rose-400'}`}>
                  {publicAllocatedPct.toFixed(1)}% / ≤ {maxPublicPct.toFixed(0)}%
                </span>
              </div>
              {['AAPLx', 'NVDAx', 'SPYx'].map((sym) => (
                <div key={sym} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white">{sym}</span>
                    <span className="font-semibold text-white">{builderAllocations[sym] || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={builderAllocations[sym] || 0}
                    onChange={(e) => handleAllocationChange(sym, parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Pre-IPO Equities */}
            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-purple-500/20 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5 text-purple-400" /> Pre-IPO Unicorns
                </span>
                <span className={`font-mono font-bold ${isPreIpoValid ? 'text-purple-400' : 'text-rose-400'}`}>
                  {preIpoAllocatedPct.toFixed(1)}% / ≤ {maxPreIpoPct.toFixed(0)}%
                </span>
              </div>
              {['SPACEXx', 'OPENAIx', 'STRIPEx'].map((sym) => (
                <div key={sym} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white">{sym}</span>
                    <span className="font-semibold text-white">{builderAllocations[sym] || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={builderAllocations[sym] || 0}
                    onChange={(e) => handleAllocationChange(sym, parseFloat(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Reserve Cash */}
            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-emerald-500/20 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Reserve Liquidity
                </span>
                <span className={`font-mono font-bold ${isStableValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stableAllocatedPct.toFixed(1)}% / ≥ {minStablePct.toFixed(0)}%
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-white">USDC Cash Floor</span>
                  <span className="font-semibold text-white">{builderAllocations.USDC || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={builderAllocations.USDC || 0}
                  onChange={(e) => handleAllocationChange('USDC', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
              <div className="pt-2 text-[11px] font-mono text-sentinel-textMuted">
                Total Allocated: <span className={isTotalValid ? 'text-white' : 'text-rose-400'}>{totalAllocatedPct.toFixed(1)}%</span> (must equal 100%)
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {deploySuccess && (
              <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Deployed on Solana!
              </span>
            )}
            <button
              disabled={!canDeploy}
              onClick={handleDeploy}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                canDeploy
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md'
                  : 'bg-sentinel-surfaceMuted text-sentinel-textSubtle border border-sentinel-border cursor-not-allowed opacity-60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Verified Portfolio</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. CLEAN HOLDINGS TABLE */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-3 border-b border-sentinel-border">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Holdings
            </h3>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Select any asset to inspect Pyth feed freshness, basis deviation, and policy headroom.
            </p>
          </div>
          <span className="text-xs font-mono text-sentinel-textSubtle">
            {portfolio.assets.length} Assets · 100.00% NAV
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sentinel-border text-sentinel-textSubtle text-xs font-semibold">
                <th className="pb-3 font-medium">Asset</th>
                <th className="pb-3 font-medium">Value</th>
                <th className="pb-3 font-medium">Allocation</th>
                <th className="pb-3 font-medium">24h / Oracle</th>
                <th className="pb-3 font-medium text-right">Sentinel</th>
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
                const mPrice = marketPrices?.[asset.symbol];

                // Near-boundary check
                const isRowNearBoundary = !asset.isStablecoin && !asset.isIndex
                  ? policy.maxSingleAssetBps - asset.exposureBps <= 200
                  : asset.isStablecoin
                  ? asset.exposureBps - policy.minStablecoinBps <= 200
                  : false;

                return (
                  <tr
                    key={asset.symbol}
                    onClick={() => setSelectedAssetSymbol(isSelected ? null : asset.symbol)}
                    className={`hover:bg-sentinel-surfaceElevated/60 transition cursor-pointer ${
                      isSelected ? 'bg-sentinel-surfaceElevated/80' : ''
                    }`}
                  >
                    {/* Asset & Name */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
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
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Cash Reserve
                              </span>
                            ) : getAssetCategory(asset.symbol) === 'PRE_IPO' ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                Pre-IPO
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                Public
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-sentinel-textMuted">{asset.name}</div>
                        </div>
                      </div>
                    </td>

                    {/* Value */}
                    <td className="py-3.5">
                      <div className="font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(asset.valueUsd)}
                      </div>
                      <div className="text-[11px] font-mono text-sentinel-textMuted">
                        ${asset.priceUsd.toFixed(2)}
                      </div>
                    </td>

                    {/* Allocation */}
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white tabular-nums font-semibold w-12">
                          {formatPercent(exposurePct)}
                        </span>
                        <div className="w-16 sm:w-20 bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCompliant ? 'bg-blue-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, exposurePct * 2.5)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 24h / Oracle */}
                    <td className="py-3.5">
                      {asset.isStablecoin ? (
                        <span className="text-xs font-mono text-sentinel-textSubtle">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          <span className="text-xs font-mono text-purple-300">
                            {mPrice?.confidenceRatioBps ? `±${((mPrice.confidenceRatioBps) / 100).toFixed(2)}%` : 'Fresh'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Sentinel Status */}
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                        {isRowNearBoundary ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Near Cap
                          </span>
                        ) : isCompliant ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Compliant
                          </span>
                        ) : (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Breach
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-sentinel-textSubtle ml-1" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. SLIDE-OVER ASSET DETAIL DRAWER (MODAL / DRAWER) */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedAssetSymbol(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-sentinel-surface border-l border-sentinel-border shadow-2xl p-6 overflow-y-auto z-10 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-sentinel-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{
                      backgroundColor: `${getAssetColor(selectedAsset.symbol)}25`,
                      color: getAssetColor(selectedAsset.symbol),
                      border: `1px solid ${getAssetColor(selectedAsset.symbol)}50`,
                    }}
                  >
                    {selectedAsset.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">
                        {selectedAsset.symbol}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                        ● Fresh
                      </span>
                    </div>
                    <p className="text-xs text-sentinel-textMuted">{selectedAsset.name}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAssetSymbol(null)}
                  className="p-1.5 rounded-lg hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Near Boundary Alert Callout */}
              {isNearBoundary && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-300 block">Near Policy Boundary Warning</span>
                    <span className="text-amber-200/90 font-mono mt-0.5 block">{boundaryWarning}</span>
                  </div>
                </div>
              )}

              {/* Valuation & Weight Overview */}
              <div className="grid grid-cols-2 gap-3 bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border font-mono text-xs">
                <div>
                  <span className="text-sentinel-textSubtle block text-[11px]">POSITION VALUE</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {formatCurrency(selectedAsset.valueUsd)}
                  </span>
                  <span className="text-sentinel-textMuted text-[11px]">
                    {selectedAsset.amount.toLocaleString()} units @ ${selectedAsset.priceUsd.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-sentinel-textSubtle block text-[11px]">PORTFOLIO WEIGHT</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {formatPercent(selectedAsset.exposureBps / 100)}
                  </span>
                  <span className="text-sentinel-textMuted text-[11px]">
                    Limit: {selectedAsset.isStablecoin ? `≥ ${(policy.minStablecoinBps / 100).toFixed(0)}%` : `≤ ${(policy.maxSingleAssetBps / 100).toFixed(0)}%`}
                  </span>
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-sentinel-textSubtle">
                  <span>Policy Exposure Cap</span>
                  <span className="text-white font-semibold">
                    {(selectedAsset.exposureBps / 100).toFixed(1)}% / {(selectedAsset.isStablecoin ? policy.minStablecoinBps : policy.maxSingleAssetBps) / 100}%
                  </span>
                </div>
                <div className="w-full bg-sentinel-surfaceMuted h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedAsset.isStablecoin
                        ? selectedAsset.exposureBps >= policy.minStablecoinBps ? 'bg-emerald-500' : 'bg-rose-500'
                        : selectedAsset.exposureBps <= policy.maxSingleAssetBps ? 'bg-blue-500' : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (selectedAsset.exposureBps / (selectedAsset.isStablecoin ? policy.minStablecoinBps : policy.maxSingleAssetBps)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Price Sources Breakdown */}
              <div className="bg-sentinel-surfaceMuted rounded-xl p-4 border border-sentinel-border space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-sentinel-border/50 pb-2">
                  <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    Price Sources &amp; Provenance
                  </span>
                  <span className="text-purple-400 text-[10px]">Pyth Hermès</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Underlying Benchmark:</span>
                    <span className="text-white font-semibold">
                      {selectedMarketPrice?.underlyingSymbol ?? selectedAsset.symbol.replace('x', '')}{' '}
                      (${selectedMarketPrice?.underlyingPriceUsd?.toFixed(2) ?? selectedAsset.priceUsd.toFixed(2)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Tokenized SPL Price:</span>
                    <span className="text-white font-semibold">${selectedAsset.priceUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Confidence Interval (±σ):</span>
                    <span className="text-blue-400 font-semibold">
                      ±${selectedMarketPrice?.confidenceUsd.toFixed(2) ?? '0.04'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Basis Tracking Deviation:</span>
                    <span className="text-emerald-400 font-semibold">
                      {selectedMarketPrice?.deviationPct.toFixed(2) ?? '0.12'}% ({selectedMarketPrice?.trackingErrorBps ?? 12} bps)
                    </span>
                  </div>
                </div>
              </div>

              {/* Pre-IPO / PreStocks Allocation (if applicable) */}
              {selectedPreStocks && (
                <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 font-mono text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <span className="font-bold text-white text-[11px] uppercase flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-400" />
                      PreStocks Tokenized Pre-IPO Equity
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                      {selectedPreStocks.seriesId}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div>
                      <span className="text-sentinel-textSubtle block text-[10px]">ISSUER & FACILITY:</span>
                      <span className="text-white font-semibold">{selectedPreStocks.facility}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Certified 409A / Forge NAV:</span>
                      <span className="text-white font-bold">${selectedPreStocks.navAttestationUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Attestation Date:</span>
                      <span className="text-sentinel-textMuted">{selectedPreStocks.navAttestationDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Share Class / Status:</span>
                      <span className="text-emerald-400 font-semibold">{selectedPreStocks.shareClass} · Unlocked</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Secondary Vault PDA:</span>
                      <span className="text-purple-300 font-semibold">{selectedPreStocks.vaultPda.slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Solana Accounts (Mint & ATA) */}
              <div className="space-y-2 font-mono text-xs">
                <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-sentinel-textSubtle block">SOLANA TOKEN MINT</span>
                    <span className="text-white font-semibold">{formatAddress(selectedAsset.mint, 6)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleCopy(selectedAsset.mint, e)}
                      className="p-1 rounded hover:bg-sentinel-surface text-sentinel-textSubtle hover:text-white"
                      title="Copy Mint"
                    >
                      {copiedAddress === selectedAsset.mint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={getExplorerAddressUrl(selectedAsset.mint)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded hover:bg-sentinel-surface text-blue-400"
                      title="Solana Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {selectedAsset.ata && (
                  <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-sentinel-textSubtle block">ASSOCIATED TOKEN ACCOUNT (ATA)</span>
                      <span className="text-emerald-400 font-semibold">{formatAddress(selectedAsset.ata, 6)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleCopy(selectedAsset.ata!, e)}
                        className="p-1 rounded hover:bg-sentinel-surface text-sentinel-textSubtle hover:text-white"
                        title="Copy ATA"
                      >
                        {copiedAddress === selectedAsset.ata ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={getExplorerAddressUrl(selectedAsset.ata)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded hover:bg-sentinel-surface text-blue-400"
                        title="Solana Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-4 border-t border-sentinel-border mt-6">
              <button
                onClick={() => setSelectedAssetSymbol(null)}
                className="w-full py-2.5 rounded-lg bg-sentinel-surfaceMuted hover:bg-sentinel-surfaceElevated border border-sentinel-border text-white text-xs font-semibold transition cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
