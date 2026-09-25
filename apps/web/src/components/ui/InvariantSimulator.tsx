'use client';

import React, { useState, useMemo } from 'react';
import { PortfolioSnapshot, FinancialPolicy } from '@sentinel/domain';
import { ShieldCheck, ShieldAlert, Scale, Sliders, ArrowRight, RotateCcw } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/formatters';

interface InvariantSimulatorProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  onApplyTrade?: (assetSymbol: string, direction: 'BUY' | 'SELL', amountUsd: number) => void;
  className?: string;
}

export const InvariantSimulator: React.FC<InvariantSimulatorProps> = ({
  portfolio,
  policy,
  onApplyTrade,
  className = '',
}) => {
  const [selectedAsset, setSelectedAsset] = useState<string>('NVDAx');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [amountUsd, setAmountUsd] = useState<number>(5000);

  const totalNav = portfolio.totalValueUsd || 100_000;
  const targetAsset = portfolio.assets.find((a) => a.symbol === selectedAsset);
  const currentAssetVal = targetAsset ? targetAsset.valueUsd : 20_000;
  const currentUsdcVal = portfolio.stablecoinValueUsd || 25_000;

  const currentAssetPct = (currentAssetVal / totalNav) * 100;
  const currentUsdcPct = (currentUsdcVal / totalNav) * 100;

  // Post-state calculations
  const postAssetVal =
    direction === 'BUY'
      ? currentAssetVal + amountUsd
      : Math.max(0, currentAssetVal - amountUsd);
  const postAssetPct = (postAssetVal / totalNav) * 100;

  const postUsdcVal =
    direction === 'BUY'
      ? Math.max(0, currentUsdcVal - amountUsd)
      : currentUsdcVal + amountUsd;
  const postUsdcPct = (postUsdcVal / totalNav) * 100;

  // Invariant limits
  const maxAssetCapPct = (policy.maxSingleAssetBps || 2500) / 100; // e.g. 25.0%
  const minStablecoinFloorPct = (policy.minStablecoinBps || 2000) / 100; // e.g. 20.0%
  const maxTradeCeilingUsd = policy.maxTradeValueUsd || 10_000;

  const isPreIpo = selectedAsset === 'SPACEXx';
  const preIpoCapPct = ((policy.maxPreIpoExposureBps || 2000) / 100);

  // Invariant evaluations (0.01% epsilon for floating precision)
  const isAssetCapOk = postAssetPct <= maxAssetCapPct + 0.01;
  const isReserveFloorOk = postUsdcPct >= minStablecoinFloorPct - 0.01;
  const isTradeSizeOk = amountUsd <= maxTradeCeilingUsd;
  const isPreIpoCapOk = !isPreIpo || postAssetPct <= preIpoCapPct + 0.01;

  const isApproved = isAssetCapOk && isReserveFloorOk && isTradeSizeOk && isPreIpoCapOk;

  // Exact maximum compliant headroom calculation
  const maxHeadroomUsd = useMemo(() => {
    // Limited by:
    // 1. Asset cap: totalNav * maxAssetCapPct - currentAssetVal
    // 2. Reserve floor: currentUsdcVal - totalNav * minStablecoinFloorPct
    // 3. Trade size ceiling
    const capHeadroom = Math.max(0, (maxAssetCapPct / 100) * totalNav - currentAssetVal);
    const floorHeadroom = Math.max(0, currentUsdcVal - (minStablecoinFloorPct / 100) * totalNav);
    return Math.min(capHeadroom, floorHeadroom, maxTradeCeilingUsd);
  }, [totalNav, maxAssetCapPct, currentAssetVal, currentUsdcVal, minStablecoinFloorPct, maxTradeCeilingUsd]);

  const handleSnapToHeadroom = () => {
    setAmountUsd(Math.floor(maxHeadroomUsd));
  };

  return (
    <div className={`p-5 sm:p-6 rounded-xl border border-sentinel-border bg-sentinel-surface text-xs font-mono shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sentinel-border">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="font-extrabold text-white uppercase text-sm tracking-wide">
              Test the Agent · Invariant Risk Simulator
            </h3>
            <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold border border-blue-500/30">
              Interactive Pre-Flight
            </span>
          </div>
          <p className="text-[11px] text-sentinel-textMuted font-sans mt-0.5">
            Slide trade size to observe live state projections and watch Sentinel switch between Blocked and Approved.
          </p>
        </div>

        {/* Asset Universe Selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(['NVDAx', 'AAPLx', 'SPYx', 'SPACEXx'] as const).map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedAsset(sym)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer sentinel-interactive sentinel-focus ${
                selectedAsset === sym
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white border border-sentinel-border'
              }`}
            >
              {sym === 'SPACEXx' ? 'SpaceX (Pre-IPO)' : sym}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Slider & Direction Toggle */}
      <div className="py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sentinel-textSubtle font-sans text-xs">Action:</span>
            <div className="flex rounded-md border border-sentinel-border overflow-hidden">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`px-3 py-1 font-bold transition cursor-pointer sentinel-interactive ${
                  direction === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`px-3 py-1 font-bold transition cursor-pointer sentinel-interactive ${
                  direction === 'SELL'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-sentinel-surfaceMuted text-sentinel-textMuted hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-sentinel-textSubtle block font-sans">TRADE INTENT SIZE</span>
            <span className="text-lg font-black text-white tabular-nums tracking-tight">
              {formatCurrency(amountUsd)}
            </span>
          </div>
        </div>

        {/* Range Slider */}
        <div className="space-y-1.5">
          <input
            type="range"
            min="0"
            max="20000"
            step="250"
            value={amountUsd}
            onChange={(e) => setAmountUsd(parseFloat(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-2 bg-sentinel-surfaceMuted rounded-lg border border-sentinel-border"
          />
          <div className="flex justify-between text-[10px] text-sentinel-textSubtle tabular-nums font-mono">
            <span>$0</span>
            <span className="text-emerald-400 font-semibold cursor-pointer hover:underline" onClick={handleSnapToHeadroom}>
              Compliant Ceiling: {formatCurrency(maxHeadroomUsd)}
            </span>
            <span>$10,000 (Limit)</span>
            <span>$20,000</span>
          </div>
        </div>
      </div>

      {/* Live State Transition Grid */}
      <div className="p-4 rounded-xl bg-sentinel-surfaceMuted/80 border border-sentinel-border space-y-3">
        <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle tracking-wider block">
          PROJECTED PORTFOLIO STATE TRANSITION
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* 1. Asset Concentration */}
          <div className={`p-3 rounded-lg border space-y-1 ${
            isAssetCapOk ? 'bg-slate-900/60 border-slate-800' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}>
            <span className="text-[10px] text-sentinel-textSubtle block font-sans">
              {selectedAsset} CONCENTRATION
            </span>
            <div className="flex items-baseline justify-between tabular-nums">
              <span className="text-sentinel-textMuted">{currentAssetPct.toFixed(1)}%</span>
              <span className="text-sentinel-textSubtle">→</span>
              <span className={`font-bold text-sm ${isAssetCapOk ? 'text-white' : 'text-rose-400'}`}>
                {postAssetPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-[10px] text-sentinel-textSubtle flex items-center justify-between">
              <span>Cap: {maxAssetCapPct.toFixed(0)}%</span>
              <span className={isAssetCapOk ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isAssetCapOk ? '✓ PASS' : '✕ BREACH'}
              </span>
            </div>
          </div>

          {/* 2. Stablecoin Reserve */}
          <div className={`p-3 rounded-lg border space-y-1 ${
            isReserveFloorOk ? 'bg-slate-900/60 border-slate-800' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}>
            <span className="text-[10px] text-sentinel-textSubtle block font-sans">
              USDC CASH RESERVE
            </span>
            <div className="flex items-baseline justify-between tabular-nums">
              <span className="text-sentinel-textMuted">{currentUsdcPct.toFixed(1)}%</span>
              <span className="text-sentinel-textSubtle">→</span>
              <span className={`font-bold text-sm ${isReserveFloorOk ? 'text-white' : 'text-rose-400'}`}>
                {postUsdcPct.toFixed(1)}%
              </span>
            </div>
            <div className="text-[10px] text-sentinel-textSubtle flex items-center justify-between">
              <span>Floor: {minStablecoinFloorPct.toFixed(0)}%</span>
              <span className={isReserveFloorOk ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isReserveFloorOk ? '✓ PASS' : '✕ BREACH'}
              </span>
            </div>
          </div>

          {/* 3. Trade Size Ceiling */}
          <div className={`p-3 rounded-lg border space-y-1 ${
            isTradeSizeOk ? 'bg-slate-900/60 border-slate-800' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}>
            <span className="text-[10px] text-sentinel-textSubtle block font-sans">
              TRADE SIZE CEILING
            </span>
            <div className="flex items-baseline justify-between tabular-nums">
              <span className="text-sentinel-textMuted">—</span>
              <span className="text-sentinel-textSubtle">→</span>
              <span className={`font-bold text-sm ${isTradeSizeOk ? 'text-white' : 'text-rose-400'}`}>
                {formatCurrency(amountUsd)}
              </span>
            </div>
            <div className="text-[10px] text-sentinel-textSubtle flex items-center justify-between">
              <span>Max: {formatCurrency(maxTradeCeilingUsd)}</span>
              <span className={isTradeSizeOk ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isTradeSizeOk ? '✓ PASS' : '✕ BREACH'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sentinel Deterministic Verdict Banner */}
      <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {isApproved ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="font-sans">
                <span className="font-bold text-xs uppercase block text-emerald-300">
                  SENTINEL VERDICT: APPROVED ✓
                </span>
                <span className="text-[10px] text-emerald-400/80">
                  State transition maintains all 3 invariant guarantees. Anchor execution authorized.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="font-sans">
                <span className="font-bold text-xs uppercase block text-rose-300">
                  SENTINEL VERDICT: BLOCKED ✕
                </span>
                <span className="text-[10px] text-rose-400/80">
                  Guarantees breached. Sentinel will reject the state transition and protect portfolio.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Auto-Adapt / Apply Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!isApproved && (
            <button
              type="button"
              onClick={handleSnapToHeadroom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold transition cursor-pointer sentinel-interactive sentinel-focus sentinel-btn-physical"
            >
              <Scale className="w-3.5 h-3.5 text-blue-400" />
              <span>Auto-Adapt to Headroom ({formatCurrency(maxHeadroomUsd)})</span>
            </button>
          )}

          {onApplyTrade && isApproved && amountUsd > 0 && (
            <button
              type="button"
              onClick={() => onApplyTrade(selectedAsset, direction, amountUsd)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer sentinel-interactive sentinel-focus sentinel-btn-physical shadow-sm"
            >
              <span>Execute Compliant Trade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
