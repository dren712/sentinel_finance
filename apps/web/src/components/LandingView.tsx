'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Play,
  ExternalLink,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';
import { Card, CardHeader, Badge, SourceBadge } from './ui';

interface LandingViewProps {
  onEnterApp: () => void;
  onRunDemo: () => void;
  isRunningDemo?: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterApp,
  onRunDemo,
  isRunningDemo = false,
}) => {
  // Interactive Guarantee Simulator State
  const [tradeAmount, setTradeAmount] = useState<number>(15000);
  const [selectedAsset, setSelectedAsset] = useState<'NVDAx' | 'OPENAIx' | 'AAPLx'>('NVDAx');
  const [isAdapted, setIsAdapted] = useState<boolean>(false);
  const [showEvidence, setShowEvidence] = useState<boolean>(false);

  // Asset profiles for simulation
  const assetData = {
    NVDAx: {
      name: 'NVIDIA Tokenized',
      type: 'Listed Equity',
      currentPrice: 128.45,
      currentShare: 20,
      cap: 25,
      cashImpact: (tradeAmount / 100000) * 100,
      safeMax: 5000,
    },
    OPENAIx: {
      name: 'OpenAI Pre-IPO',
      type: 'Pre-IPO Equity',
      currentPrice: 420.0,
      currentShare: 18,
      cap: 20,
      cashImpact: (tradeAmount / 100000) * 100,
      safeMax: 2000,
    },
    AAPLx: {
      name: 'Apple Tokenized',
      type: 'Listed Equity',
      currentPrice: 224.3,
      currentShare: 15,
      cap: 30,
      cashImpact: (tradeAmount / 100000) * 100,
      safeMax: 10000,
    },
  };

  const current = assetData[selectedAsset];
  const projectedShare = Math.min(100, current.currentShare + (tradeAmount / 100000) * 100);
  const projectedCash = Math.max(0, 25 - current.cashImpact);

  // Invariant checks
  const isConcentrationBreach = projectedShare > current.cap;
  const isCashFloorBreach = projectedCash < 20;
  const isOrderSizeBreach = tradeAmount > 10000;
  const isViolated = !isAdapted && (isConcentrationBreach || isCashFloorBreach || isOrderSizeBreach);

  const handlePreset = (asset: 'NVDAx' | 'OPENAIx' | 'AAPLx', amount: number) => {
    setSelectedAsset(asset);
    setTradeAmount(amount);
    setIsAdapted(false);
  };

  const handleAdapt = () => {
    setIsAdapted(true);
    setTradeAmount(current.safeMax);
  };

  const handleReset = () => {
    setIsAdapted(false);
    setTradeAmount(15000);
  };

  return (
    <div className="relative overflow-hidden pb-16 space-y-12">
      {/* ========================================================================= */}
      {/* 1. HERO: THESIS, SIGNATURE ROBO ARTWORK & CONSTRAINT TRACE                */}
      {/* ========================================================================= */}
      <section className="pt-8 sm:pt-12 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Thesis & Primary Actions */}
          <div className="lg:col-span-6 text-left">
            {/* Proof Strip */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sentinel-surface border border-sentinel-border text-xs font-mono text-sentinel-textMuted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-purple-300 font-semibold">SOLANA DEVNET</span>
              <span className="text-sentinel-textSubtle">•</span>
              <span className="text-sentinel-text font-medium">POLICY ENFORCED</span>
              <span className="text-sentinel-textSubtle">•</span>
              <span className="text-emerald-400 font-medium">PROVN VERIFIED</span>
            </div>

            {/* Dominant Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] mb-5">
              AUTONOMOUS INVESTING.<br />
              <span className="text-sentinel-textMuted">RIGID GUARANTEES.</span>
            </h1>

            {/* Supporting Sentence */}
            <p className="text-base sm:text-lg text-sentinel-textMuted max-w-xl font-normal leading-relaxed mb-8">
              AI can choose the trade. It cannot choose what the portfolio is allowed to become.
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <button
                type="button"
                onClick={onEnterApp}
                className="sentinel-btn-physical flex items-center gap-2 px-6 py-3 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm sentinel-interactive sentinel-focus"
              >
                <span>Launch Sentinel</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onRunDemo}
                disabled={isRunningDemo}
                className="sentinel-btn-physical flex items-center gap-2 px-5 py-3 rounded-lg bg-sentinel-surface hover:bg-sentinel-surfaceElevated border border-sentinel-border text-sentinel-text font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 sentinel-interactive sentinel-focus"
              >
                <Play className={`w-3.5 h-3.5 text-emerald-400 ${isRunningDemo ? 'animate-spin' : ''}`} />
                <span>{isRunningDemo ? 'Running 5-Step Demo...' : 'Watch 90s Demo'}</span>
              </button>
            </div>

            {/* Compact Verified Guarantee Metrics */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-sentinel-border max-w-md">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white font-mono tabular-nums">4 Invariants</div>
                <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold mt-0.5">
                  Policy PDA Enforced
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular-nums">100% Atomic</div>
                <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold mt-0.5">
                  Revert on Breach
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-purple-400 font-mono tabular-nums">≤60s</div>
                <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold mt-0.5">
                  Quote Freshness Gate
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Signature Restrained Robo Hero + Invariant Trace */}
          <div className="lg:col-span-6 space-y-4">
            {/* Restored Signature Robo Visual Card (Restrained Drift + Hover + Click to Demo) */}
            <div className="p-4 sm:p-5 rounded-xl bg-sentinel-surface border border-sentinel-border flex flex-col sm:flex-row items-center gap-5">
              <button
                type="button"
                onClick={onRunDemo}
                title="Click to launch Flagship 5-Step Invariant Demo"
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-sentinel-surfaceMuted border border-sentinel-borderStrong flex items-center justify-center shrink-0 cursor-pointer group sentinel-focus"
              >
                <Image
                  src="/Sentinel_Logo.png"
                  alt="Sentinel Robo-01 Autonomous Executor"
                  width={108}
                  height={108}
                  priority
                  className="object-contain sentinel-robo-drift select-none"
                />
                <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-sentinel-surfaceElevated border border-sentinel-border text-[9px] font-mono text-emerald-400">
                  ROBO-01
                </span>
              </button>

              <div className="text-center sm:text-left space-y-2 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge variant="info" dot>
                    PROPOSAL AUTHORITY ONLY
                  </Badge>
                  <SourceBadge source="SOLANA" detail="Anchor Gate" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Sentinel Robo-01 Autonomous Co-Pilot
                </h2>
                <p className="text-xs text-sentinel-textMuted leading-relaxed">
                  Scans Pyth Hermes dual-feeds and Meteora DBC curves to propose optimal allocations—while the Anchor Policy PDA holds deterministic veto authority over every state transition.
                </p>
                <div className="pt-1 flex items-center justify-center sm:justify-start gap-3 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={onRunDemo}
                    className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Trigger live invariant check →
                  </button>
                  <span className="text-sentinel-textSubtle">·</span>
                  <span className="text-sentinel-textSubtle">
                    PDA: {formatAddress(APP_CONFIG.sentinelProgramId, 4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Constraint Trace Motif */}
            <Card variant="elevated" padding="md" className="shadow-xl">
              <div className="flex items-center justify-between pb-3.5 border-b border-sentinel-border">
                <div className="text-xs font-semibold text-white font-mono flex items-center gap-2">
                  <span>SENTINEL INVARIANT GATE</span>
                  <Badge variant="danger">0x1771 PRE-FLIGHT TRACE</Badge>
                </div>
                <div className="text-[10px] font-mono text-sentinel-textSubtle">
                  PROGRAM: {formatAddress(APP_CONFIG.sentinelProgramId, 4)}
                </div>
              </div>

              <div className="pt-4 space-y-3.5 font-mono text-xs">
                {/* 1. Agent Intent */}
                <div className="relative pl-5 pb-1.5 border-l border-sentinel-border">
                  <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-sentinel-surfaceElevated" />
                  <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold">
                    01 • AGENT PROPOSAL
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                    BUY NVDAx $15,000 <span className="text-xs text-sentinel-textMuted font-normal">($128.45/sh via Pyth Hermes)</span>
                  </div>
                </div>

                {/* 2. Post-State Calculation */}
                <div className="relative pl-5 pb-1.5 border-l border-sentinel-border">
                  <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-sentinel-surfaceElevated" />
                  <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold">
                    02 • PROJECTED POST-STATE
                  </div>
                  <div className="mt-1.5 space-y-1 bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sentinel-textMuted">NVDAx Concentration</span>
                      <span className="text-rose-400 font-semibold tabular-nums">20.0% → 35.0% (Limit 25.0%) ✕</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sentinel-textMuted">USDC Reserve Floor</span>
                      <span className="text-rose-400 font-semibold tabular-nums">25.0% → 10.0% (Floor 20.0%) ✕</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sentinel-textMuted">Single Order Cap</span>
                      <span className="text-rose-400 font-semibold tabular-nums">$15,000 (Limit $10,000) ✕</span>
                    </div>
                  </div>
                </div>

                {/* 3. Policy Gate Decision */}
                <div className="relative pl-5">
                  <div className="absolute -left-[5px] top-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-sentinel-surfaceElevated" />
                  <div className="text-[10px] text-rose-400 uppercase tracking-wider font-bold">
                    03 • POLICY GATE OUTCOME
                  </div>
                  <div className="mt-1.5 p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/40 text-rose-300">
                    <div className="font-bold flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5 text-rose-400" />
                      <span>BLOCKED ON-CHAIN (0x1771) → ADAPTED TO $5,000</span>
                    </div>
                    <p className="text-[11px] text-sentinel-textMuted mt-0.5 font-sans">
                      Sentinel aborted non-compliant state commit and solved maximum compliant headroom ($5,000).
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. INTERACTIVE GUARANTEE: TEST THE INVARIANT GATE                         */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Card variant="elevated" padding="lg">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-sentinel-border">
            <div>
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400 mb-1">
                2 • Interactive Guarantee
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Test the Invariant Gate
              </h2>
              <p className="text-sm text-sentinel-textMuted mt-1">
                Simulate what happens when an AI agent proposes an out-of-bounds trade. Watch Sentinel reject and calculate compliant headroom.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-sentinel-textSubtle font-mono">Presets:</span>
              <button
                type="button"
                onClick={() => handlePreset('NVDAx', 15000)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer sentinel-interactive sentinel-focus ${
                  selectedAsset === 'NVDAx' && tradeAmount === 15000 && !isAdapted
                    ? 'bg-rose-950/50 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white border border-sentinel-border'
                }`}
              >
                Rogue $15k NVDAx
              </button>
              <button
                type="button"
                onClick={() => handlePreset('OPENAIx', 25000)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer sentinel-interactive sentinel-focus ${
                  selectedAsset === 'OPENAIx' && tradeAmount === 25000 && !isAdapted
                    ? 'bg-rose-950/50 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white border border-sentinel-border'
                }`}
              >
                Pre-IPO $25k Overcap
              </button>
              <button
                type="button"
                onClick={() => handlePreset('AAPLx', 5000)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer sentinel-interactive sentinel-focus ${
                  selectedAsset === 'AAPLx' && tradeAmount === 5000
                    ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white border border-sentinel-border'
                }`}
              >
                Compliant $5k AAPLx
              </button>
            </div>
          </div>

          {/* Interactive Simulation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
            {/* Left Column: Intent Formulation (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <label className="text-xs font-mono text-sentinel-textSubtle uppercase tracking-wider block mb-2 font-semibold">
                  Target Equity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NVDAx', 'OPENAIx', 'AAPLx'] as const).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(sym);
                        setIsAdapted(false);
                      }}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer sentinel-interactive sentinel-focus ${
                        selectedAsset === sym
                          ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white shadow-xs'
                          : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted hover:border-sentinel-borderStrong'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{sym}</div>
                      <div className="text-[11px] truncate text-sentinel-textSubtle mt-0.5">
                        {assetData[sym].name}
                      </div>
                      <div className="text-[10px] font-mono text-sentinel-textMuted mt-1">
                        Cap: {assetData[sym].cap}%
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider for Trade Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono text-sentinel-textSubtle uppercase tracking-wider font-semibold">
                    Agent Proposes Size
                  </label>
                  <span className="text-base font-bold font-mono text-white tabular-nums">
                    ${tradeAmount.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={30000}
                  step={500}
                  value={tradeAmount}
                  onChange={(e) => {
                    setTradeAmount(Number(e.target.value));
                    setIsAdapted(false);
                  }}
                  className="w-full accent-blue-600 h-2 bg-sentinel-surfaceMuted rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-sentinel-textSubtle mt-1.5">
                  <span>$1,000 (Safe)</span>
                  <span className="text-amber-400 font-medium">$10,000 (Max Single Order)</span>
                  <span>$30,000 (Oversized)</span>
                </div>
              </div>

              {/* Enter Console CTA */}
              <button
                type="button"
                onClick={onEnterApp}
                className="w-full py-3 rounded-lg bg-sentinel-surfaceElevated hover:bg-sentinel-border border border-sentinel-border text-white font-semibold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 cursor-pointer transition sentinel-interactive sentinel-focus"
              >
                <span>Enter Trading Console</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
              </button>
            </div>

            {/* Right Column: Projected State & Decision (7 cols) */}
            <div className="lg:col-span-7 bg-sentinel-surfaceMuted border border-sentinel-border rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-sentinel-border mb-4">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-sentinel-textSubtle">
                    Projected Portfolio State
                  </span>
                  <span className="text-xs font-mono text-sentinel-textSubtle">
                    Portfolio Total: $100,000
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {/* Concentration */}
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isConcentrationBreach && !isAdapted
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                        : 'bg-sentinel-surface border-sentinel-border text-sentinel-text'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] text-sentinel-textSubtle uppercase">Concentration</div>
                      <div className="font-bold tabular-nums mt-0.5">
                        {current.currentShare.toFixed(1)}% → {projectedShare.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-sentinel-textSubtle uppercase">
                        Policy Cap: {current.cap}%
                      </div>
                      <div
                        className={`font-bold mt-0.5 ${
                          isConcentrationBreach && !isAdapted ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isConcentrationBreach && !isAdapted
                          ? `✕ ${projectedShare.toFixed(1)}% (Limit Exceeded)`
                          : '✓ Compliant'}
                      </div>
                    </div>
                  </div>

                  {/* Cash Floor */}
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isCashFloorBreach && !isAdapted
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                        : 'bg-sentinel-surface border-sentinel-border text-sentinel-text'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] text-sentinel-textSubtle uppercase">Cash Reserve Floor</div>
                      <div className="font-bold tabular-nums mt-0.5">
                        25.0% → {projectedCash.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-sentinel-textSubtle uppercase">Minimum: 20.0%</div>
                      <div
                        className={`font-bold mt-0.5 ${
                          isCashFloorBreach && !isAdapted ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isCashFloorBreach && !isAdapted
                          ? `✕ ${projectedCash.toFixed(1)}% (Floor Breached)`
                          : '✓ Safe Reserves'}
                      </div>
                    </div>
                  </div>

                  {/* Order Cap */}
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isOrderSizeBreach && !isAdapted
                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                        : 'bg-sentinel-surface border-sentinel-border text-sentinel-text'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] text-sentinel-textSubtle uppercase">Order Size Cap</div>
                      <div className="font-bold tabular-nums mt-0.5">${tradeAmount.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-sentinel-textSubtle uppercase">
                        Max Single Order: $10,000
                      </div>
                      <div
                        className={`font-bold mt-0.5 ${
                          isOrderSizeBreach && !isAdapted ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isOrderSizeBreach && !isAdapted ? '✕ Oversized Order' : '✓ Within Cap'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outcome & Adaptation Action */}
                <div className="mt-4 pt-4 border-t border-sentinel-border">
                  {isViolated ? (
                    <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 font-mono">
                          <X className="w-3.5 h-3.5" />
                          <span>BLOCKED: 0x1771 Invariant Breach</span>
                        </div>
                        <div className="text-[11px] text-sentinel-textMuted mt-1">
                          Sentinel calculated compliant headroom:{' '}
                          <span className="font-mono font-bold text-amber-300">
                            ${current.safeMax.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAdapt}
                        className="sentinel-btn-physical px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer sentinel-interactive sentinel-focus"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-400" />
                        <span>Let the agent adapt</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                          <Check className="w-3.5 h-3.5" />
                          <span>APPROVED: Invariants Satisfied</span>
                        </div>
                        <div className="text-[11px] text-sentinel-textMuted mt-1">
                          Order (${tradeAmount.toLocaleString()}) satisfies all portfolio invariants and is ready for on-chain dispatch.
                        </div>
                      </div>
                      {isAdapted && (
                        <button
                          type="button"
                          onClick={handleReset}
                          className="px-3 py-1.5 rounded bg-sentinel-surfaceElevated hover:bg-sentinel-border text-sentinel-text text-xs font-mono cursor-pointer shrink-0 sentinel-interactive sentinel-focus"
                        >
                          Reset Simulation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* View Decision Evidence Affordance */}
              <div className="mt-4 pt-3 border-t border-sentinel-border">
                <button
                  type="button"
                  onClick={() => setShowEvidence((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-mono text-sentinel-textSubtle hover:text-sentinel-text transition cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-sentinel-textSubtle" />
                    <span>View decision evidence</span>
                  </span>
                  {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showEvidence && (
                  <div className="mt-2.5 p-3 rounded bg-sentinel-surface border border-sentinel-border font-mono text-[11px] space-y-1.5 text-sentinel-textMuted">
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">PROVN Evidence Hash</span>
                      <span className="text-sentinel-text font-bold">0x7f9a12e8...c3b21</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Policy Account PDA</span>
                      <span className="text-sentinel-text">{formatAddress(APP_CONFIG.policyPda, 6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Vault Custody PDA</span>
                      <span className="text-sentinel-text">{formatAddress(APP_CONFIG.vaultPda, 6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sentinel-textSubtle">Anchor Gate Status</span>
                      <span className={isViolated ? 'text-rose-400' : 'text-emerald-400'}>
                        {isViolated ? 'ABORT_TRANSACTION_REVERT' : 'DISPATCH_INSTRUCTION_PASS'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* 3. HOW IT WORKS: 5-STEP DETERMINISTIC LIFECYCLE                           */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Card variant="default" padding="lg">
          <CardHeader
            category="3 • HOW IT WORKS"
            title="The 5-Stage Invariant Lifecycle"
            subtitle="Every autonomous trade follows a deterministic, 5-stage cryptographic lifecycle from proposal to verified settlement."
          />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
            <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border">
              <div className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider mb-1.5">
                01 • PROPOSE
              </div>
              <div className="text-sm font-semibold text-white mb-1.5">AI Intent</div>
              <div className="text-xs text-sentinel-textMuted leading-relaxed">
                Autonomous agent formulates trade proposal based on strategy and Pyth market inputs.
              </div>
            </div>

            <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border">
              <div className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider mb-1.5">
                02 • PROJECT
              </div>
              <div className="text-sm font-semibold text-white mb-1.5">Post-State</div>
              <div className="text-xs text-sentinel-textMuted leading-relaxed">
                Sentinel models prospective portfolio state before submitting any instruction to Solana.
              </div>
            </div>

            <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border">
              <div className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                03 • ENFORCE
              </div>
              <div className="text-sm font-semibold text-white mb-1.5">Policy Gate</div>
              <div className="text-xs text-sentinel-textMuted leading-relaxed">
                Policy PDA evaluates invariants. Any breach triggers an immediate, atomic pre-flight revert.
              </div>
            </div>

            <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border">
              <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                04 • ADAPT
              </div>
              <div className="text-sm font-semibold text-white mb-1.5">Safe Headroom</div>
              <div className="text-xs text-sentinel-textMuted leading-relaxed">
                Agent reads structured rejection telemetry and re-submits an adapted order within compliant limits.
              </div>
            </div>

            <div className="p-4 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border">
              <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                05 • PROVE
              </div>
              <div className="text-sm font-semibold text-white mb-1.5">Solana + PROVN</div>
              <div className="text-xs text-sentinel-textMuted leading-relaxed">
                Settles via Vault PDA and registers an immutable SHA-256 cryptographic trace on-chain.
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ========================================================================= */}
      {/* 4. INFRASTRUCTURE & FINAL CTA                                             */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Card variant="elevated" padding="lg" className="space-y-6">
          <CardHeader
            category="4 • INFRASTRUCTURE & ON-CHAIN VERIFICATION"
            title="The Sentinel Protocol Stack"
            subtitle="Integrated with Solana ecosystem infrastructure for oracle data integrity, private equity tokenization, and cryptographic proof."
          />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border space-y-2">
              <SourceBadge source="PYTH" />
              <div className="text-white font-semibold">Dual-Feed Oracle Gate</div>
              <p className="text-sentinel-textMuted text-[11px] font-sans leading-relaxed">
                Validates tokenized stocks against underlying equity feeds; fails closed if quotes lag &gt;60s.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border space-y-2">
              <SourceBadge source="PRESTOCKS" />
              <div className="text-white font-semibold">Pre-IPO Secondary Facility</div>
              <p className="text-sentinel-textMuted text-[11px] font-sans leading-relaxed">
                Tokenized private unicorns (SpaceX, OpenAI, Stripe) with certified NAV attestations.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border space-y-2">
              <SourceBadge source="METEORA" />
              <div className="text-white font-semibold">DBC Liquidity Verifier</div>
              <p className="text-sentinel-textMuted text-[11px] font-sans leading-relaxed">
                Pre-trade bonding curve verification enforcing $25,000 liquidity floor and slippage bounds.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border space-y-2">
              <SourceBadge source="SOLANA" />
              <div className="text-white font-semibold">Anchor Policy PDA</div>
              <p className="text-sentinel-textMuted text-[11px] font-sans leading-relaxed">
                Deterministic on-chain invariant checks, non-custodial Vault PDAs, and atomic settlement.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border space-y-2">
              <SourceBadge source="PROVN" />
              <div className="text-white font-semibold">Cryptographic Receipts</div>
              <p className="text-sentinel-textMuted text-[11px] font-sans leading-relaxed">
                Immutable SHA-256 commitment index anchoring intent, policy, and outcome hashes.
              </p>
            </div>
          </div>

          {/* Final Devnet Verification & Launch Bar */}
          <div className="pt-5 border-t border-sentinel-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-xs font-mono text-purple-300 font-semibold uppercase tracking-wider">
                  Solana Devnet Live Deployment
                </span>
              </div>
              <div className="text-sm sm:text-base font-bold text-white font-mono">
                Anchor Program: {formatAddress(APP_CONFIG.sentinelProgramId, 8)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
                target="_blank"
                rel="noreferrer"
                className="sentinel-btn-physical px-4 py-2.5 rounded-lg bg-sentinel-surfaceMuted hover:bg-sentinel-surfaceElevated border border-sentinel-border text-xs font-mono text-sentinel-text flex items-center gap-1.5 transition sentinel-interactive sentinel-focus"
              >
                <span>View Program on Explorer</span>
                <ExternalLink className="w-3.5 h-3.5 text-sentinel-textSubtle" />
              </a>

              <button
                type="button"
                onClick={onEnterApp}
                className="sentinel-btn-physical px-5 py-2.5 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition sentinel-interactive sentinel-focus shadow-sm"
              >
                <span>Enter Trading Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
