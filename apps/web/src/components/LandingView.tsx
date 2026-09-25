'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { sha256Hex } from '@sentinel/domain';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';
import { Card } from './ui';

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
  // Single Hero Interaction: Interactive Guarantee Simulator
  const [tradeAmount, setTradeAmount] = useState<number>(15000);
  const [selectedAsset, setSelectedAsset] = useState<'NVDAx' | 'OPENAIx' | 'AAPLx'>('NVDAx');
  const [isAdapted, setIsAdapted] = useState<boolean>(false);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);

  const assetData = {
    NVDAx: {
      name: 'NVIDIA Tokenized',
      category: 'Public Equity',
      currentShare: 20,
      cap: 25,
      safeMax: 5000,
    },
    OPENAIx: {
      name: 'OpenAI Secondary',
      category: 'Pre-IPO Equity',
      currentShare: 18,
      cap: 20,
      safeMax: 2000,
    },
    AAPLx: {
      name: 'Apple Tokenized',
      category: 'Public Equity',
      currentShare: 15,
      cap: 30,
      safeMax: 5000,
    },
  };

  const current = assetData[selectedAsset];
  const projectedShare = Math.min(100, current.currentShare + (tradeAmount / 100000) * 100);
  const projectedCash = Math.max(0, 25 - (tradeAmount / 100000) * 100);

  const isConcentrationBreach = projectedShare > current.cap;
  const isCashFloorBreach = projectedCash < 20;
  const isOrderSizeBreach = tradeAmount > 10000;
  const isViolated = !isAdapted && (isConcentrationBreach || isCashFloorBreach || isOrderSizeBreach);

  // Deterministic SHA-256 commitment computed from actual simulator inputs (no fake hard-coded hashes)
  const simulationCommitmentHash = useMemo(() => {
    const payload = JSON.stringify({
      mode: 'SIMULATED_PREVIEW',
      asset: selectedAsset,
      tradeAmountUsd: tradeAmount,
      projectedSharePct: Number(projectedShare.toFixed(2)),
      projectedCashPct: Number(projectedCash.toFixed(2)),
      outcome: isViolated ? 'BLOCKED_BY_POLICY' : 'APPROVED_BY_POLICY',
    });
    return sha256Hex(payload);
  }, [selectedAsset, tradeAmount, projectedShare, projectedCash, isViolated]);

  const handlePreset = (asset: 'NVDAx' | 'OPENAIx' | 'AAPLx', amount: number) => {
    setSelectedAsset(asset);
    setTradeAmount(amount);
    setIsAdapted(false);
  };

  const handleAdapt = () => {
    setIsAdapted(true);
    setTradeAmount(current.safeMax);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-14">
      {/* ========================================================================= */}
      {/* 1. HERO + SINGLE INTERACTIVE GUARANTEE SIMULATOR                          */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* Left Column: Signature Robo-01 Visual Centerpiece + Human Financial Thesis */}
        <div className="lg:col-span-5 space-y-6 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <button
              type="button"
              onClick={onRunDemo}
              title="Click Robo-01 to launch guided autonomous demo"
              className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-sentinel-surface/80 border border-sentinel-border flex items-center justify-center shrink-0 cursor-pointer group hover:border-sentinel-borderStrong transition sentinel-focus shadow-xl"
            >
              <Image
                src="/Sentinel_Logo.png"
                alt="Sentinel Robo-01 Autonomous Portfolio Agent"
                width={184}
                height={184}
                priority
                className="w-36 h-36 sm:w-44 sm:h-44 object-contain sentinel-robo-drift select-none drop-shadow-[0_14px_28px_rgba(0,0,0,0.65)]"
              />
              <span className="absolute bottom-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 rounded bg-sentinel-surfaceElevated/90 border border-sentinel-border text-sentinel-textMuted group-hover:text-white transition">
                ROBO-01
              </span>
            </button>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Sentinel Robo-01</span>
              </div>
              <div className="text-sm font-semibold text-white">
                Solana Autonomous Portfolio Guard
              </div>
              <p className="text-xs text-sentinel-textMuted leading-relaxed">
                Holds proposal authority only. On-chain policy guarantees hold veto power over every trade.
              </p>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]">
            Autonomous investing.
            <br />
            <span className="text-sentinel-textMuted">Rigid guarantees.</span>
          </h1>

          <p className="text-base text-sentinel-textMuted leading-relaxed max-w-md">
            AI can choose the trade. It cannot choose what your portfolio is allowed to become. Every proposal is checked against your position limits and cash reserve floor before execution.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onEnterApp}
              className="sentinel-btn-physical flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white font-semibold text-sm transition-colors cursor-pointer sentinel-interactive sentinel-focus"
            >
              <span>Open Portfolio</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onRunDemo}
              disabled={isRunningDemo}
              className="sentinel-btn-physical flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sentinel-surface hover:bg-sentinel-surfaceElevated border border-sentinel-border text-sentinel-text font-medium text-sm transition-colors cursor-pointer disabled:opacity-50 sentinel-interactive sentinel-focus"
            >
              <Play className={`w-3.5 h-3.5 text-emerald-400 ${isRunningDemo ? 'animate-spin' : ''}`} />
              <span>{isRunningDemo ? 'Running Demo...' : 'Run Guided Demo'}</span>
            </button>
          </div>

          {/* Restrained Proof Line */}
          <div className="pt-6 border-t border-sentinel-border grid grid-cols-3 gap-4 text-left">
            <div>
              <div className="text-sm font-semibold text-white tabular-nums">4 Guarantees</div>
              <div className="text-xs text-sentinel-textSubtle mt-0.5">Position &amp; cash limits</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white tabular-nums">≤60s Freshness</div>
              <div className="text-xs text-sentinel-textSubtle mt-0.5">Pyth quote guard</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-white tabular-nums">Zero Bypass</div>
              <div className="text-xs text-sentinel-textSubtle mt-0.5">Pre-settlement check</div>
            </div>
          </div>
        </div>

        {/* Right Column: Single Hero Interaction — Interactive Guarantee Simulator */}
        <div className="lg:col-span-7">
          <Card variant="elevated" padding="lg" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sentinel-border">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Test the Portfolio Guard
                </h2>
                <p className="text-xs text-sentinel-textMuted mt-0.5">
                  Propose a trade on a $100,000 portfolio and see how Sentinel enforces limits.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset('NVDAx', 15000)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    selectedAsset === 'NVDAx' && tradeAmount === 15000 && !isAdapted
                      ? 'bg-sentinel-surfaceElevated text-white border border-sentinel-borderStrong'
                      : 'text-sentinel-textMuted hover:text-white'
                  }`}
                >
                  $15k NVDAx
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('OPENAIx', 12000)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    selectedAsset === 'OPENAIx' && tradeAmount === 12000 && !isAdapted
                      ? 'bg-sentinel-surfaceElevated text-white border border-sentinel-borderStrong'
                      : 'text-sentinel-textMuted hover:text-white'
                  }`}
                >
                  $12k OPENAIx
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('AAPLx', 5000)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    selectedAsset === 'AAPLx' && tradeAmount === 5000
                      ? 'bg-sentinel-surfaceElevated text-white border border-sentinel-borderStrong'
                      : 'text-sentinel-textMuted hover:text-white'
                  }`}
                >
                  $5k AAPLx
                </button>
              </div>
            </div>

            {/* Asset & Size Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div className="sm:col-span-5 flex gap-1.5">
                {(['NVDAx', 'OPENAIx', 'AAPLx'] as const).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      setSelectedAsset(sym);
                      setIsAdapted(false);
                    }}
                    className={`flex-1 py-2 px-2.5 rounded-lg border text-left transition cursor-pointer ${
                      selectedAsset === sym
                        ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                        : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold font-mono">{sym}</div>
                    <div className="text-[10px] text-sentinel-textSubtle mt-0.5">
                      Max {assetData[sym].cap}%
                    </div>
                  </button>
                ))}
              </div>

              <div className="sm:col-span-7 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sentinel-textMuted">Proposed Buy Order</span>
                  <span className="font-mono font-bold text-white tabular-nums text-sm">
                    ${tradeAmount.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={25000}
                  step={500}
                  value={tradeAmount}
                  onChange={(e) => {
                    setTradeAmount(Number(e.target.value));
                    setIsAdapted(false);
                  }}
                  className="w-full accent-blue-600 h-1.5 bg-sentinel-surfaceMuted rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-sentinel-textSubtle tabular-nums">
                  <span>$1,000</span>
                  <span>$10,000 Order Limit</span>
                  <span>$25,000</span>
                </div>
              </div>
            </div>

            {/* Clean Projected Post-State Rows (Flat Table Structure, No Nested Cards) */}
            <div className="divide-y divide-sentinel-border border-y border-sentinel-border text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-sentinel-textMuted">
                  {selectedAsset} Position Weight (Max {current.cap}%)
                </span>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-white">
                    {current.currentShare.toFixed(1)}% → {projectedShare.toFixed(1)}%
                  </span>
                  <span className={isConcentrationBreach && !isAdapted ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                    {isConcentrationBreach && !isAdapted ? 'Exceeds Limit' : 'Within Limit'}
                  </span>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-sentinel-textMuted">
                  USDC Cash Reserve (Min 20.0%)
                </span>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-white">
                    25.0% → {projectedCash.toFixed(1)}%
                  </span>
                  <span className={isCashFloorBreach && !isAdapted ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                    {isCashFloorBreach && !isAdapted ? 'Below Floor' : 'Safe Reserve'}
                  </span>
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-sentinel-textMuted">
                  Single Order Cap (Max $10,000)
                </span>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-white">${tradeAmount.toLocaleString()}</span>
                  <span className={isOrderSizeBreach && !isAdapted ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                    {isOrderSizeBreach && !isAdapted ? 'Exceeds Cap' : 'Within Cap'}
                  </span>
                </div>
              </div>
            </div>

            {/* Simulator Decision Outcome */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {isViolated ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-rose-300">
                        Blocked by Policy Guard (Simulated Preview)
                      </div>
                      <div className="text-xs text-sentinel-textMuted mt-0.5">
                        Maximum compliant trade size is{' '}
                        <span className="font-mono font-semibold text-white">
                          ${current.safeMax.toLocaleString()}
                        </span>
                        .
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdapt}
                    className="sentinel-btn-physical px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center justify-center gap-1.5 shrink-0 cursor-pointer sentinel-interactive sentinel-focus"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Adapt to ${current.safeMax.toLocaleString()}</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-emerald-300">
                        Approved by Policy Guard (Simulated Preview)
                      </div>
                      <div className="text-xs text-sentinel-textMuted mt-0.5">
                        ${tradeAmount.toLocaleString()} order satisfies all position and cash reserve rules.
                      </div>
                    </div>
                  </div>
                  {isAdapted && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdapted(false);
                        setTradeAmount(15000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sentinel-surfaceMuted hover:bg-sentinel-border text-sentinel-textMuted hover:text-white text-xs cursor-pointer shrink-0"
                    >
                      Reset to $15,000
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Progressive Disclosure for Computed Simulation Commitment */}
            <div className="pt-2 border-t border-sentinel-border">
              <button
                type="button"
                onClick={() => setShowReceipt((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs text-sentinel-textSubtle hover:text-sentinel-text transition cursor-pointer py-1"
              >
                <span>Inspect computed simulation commitment</span>
                {showReceipt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showReceipt && (
                <div className="mt-2 pt-2 border-t border-sentinel-border/60 font-mono text-[11px] space-y-1 text-sentinel-textMuted">
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Execution Context</span>
                    <span>LOCAL_SIMULATOR_PREVIEW (No on-chain tx)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Computed SHA-256 Commitment</span>
                    <span className="text-white" title={simulationCommitmentHash}>
                      0x{simulationCommitmentHash.slice(0, 12)}…{simulationCommitmentHash.slice(-6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sentinel-textSubtle">Target Policy PDA (Devnet)</span>
                    <span>{formatAddress(APP_CONFIG.policyPda, 6)}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SHORT 5-STEP EXPLANATION                                               */}
      {/* ========================================================================= */}
      <section className="border-t border-sentinel-border pt-10">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
          <h2 className="text-lg font-semibold text-white">How Sentinel Works</h2>
          <p className="text-xs text-sentinel-textMuted">
            Every autonomous decision passes through five deterministic stages.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
          {[
            {
              step: '01',
              title: 'Propose',
              desc: 'Agent proposes a trade from market signals.',
            },
            {
              step: '02',
              title: 'Project',
              desc: 'Sentinel calculates the resulting portfolio weights and cash reserve.',
            },
            {
              step: '03',
              title: 'Enforce',
              desc: 'Any breach of position caps or cash floors is blocked pre-trade.',
            },
            {
              step: '04',
              title: 'Adapt',
              desc: 'Agent resizes the order to the maximum compliant headroom.',
            },
            {
              step: '05',
              title: 'Settle',
              desc: 'Compliant orders settle and record a verifiable SHA-256 receipt.',
            },
          ].map((item) => (
            <div key={item.step} className="space-y-1.5 border-l border-sentinel-border pl-4">
              <div className="text-xs font-mono text-sentinel-textSubtle">{item.step}</div>
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <p className="text-xs text-sentinel-textMuted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. ECOSYSTEM                                                              */}
      {/* ========================================================================= */}
      <section className="border-t border-sentinel-border pt-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-white">Built on Solana Market Infrastructure</h2>
          <p className="text-xs text-sentinel-textMuted">
            Pyth Network Dual-Feeds · PreStocks Secondary Facility · Meteora DBC Pools · Solana Anchor PDAs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-lg bg-sentinel-surface hover:bg-sentinel-surfaceElevated border border-sentinel-border text-xs font-mono text-sentinel-textMuted hover:text-white flex items-center gap-1.5 transition"
          >
            <span>Program {formatAddress(APP_CONFIG.sentinelProgramId, 4)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={onEnterApp}
            className="px-4 py-2 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition"
          >
            <span>Open Portfolio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
