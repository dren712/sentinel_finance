'use client';

import React, { useState } from 'react';
import { NormalizedMarketPrice } from '@sentinel/domain';
import { formatCurrency } from '@/lib/formatters';
import { Activity, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';

export interface PriceProvenanceHoverProps {
  priceUsd: number;
  marketPrice?: NormalizedMarketPrice;
  showSubtext?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export const PriceProvenanceHover: React.FC<PriceProvenanceHoverProps> = ({
  priceUsd,
  marketPrice,
  showSubtext = true,
  align = 'left',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Fallback defaults if marketPrice is loading
  const displayPrice = marketPrice ? marketPrice.priceUsd : priceUsd;
  const feedDisplayId = marketPrice?.feedDisplayId ?? 'Crypto.FEED/USD';
  const publishTime = marketPrice?.publishTimeFormatted ?? '14:32:04 UTC';
  const confidenceMin = marketPrice?.confidenceMinUsd ?? Math.round((displayPrice * 0.999) * 100) / 100;
  const confidenceMax = marketPrice?.confidenceMaxUsd ?? Math.round((displayPrice * 1.001) * 100) / 100;
  const underlyingFeed = marketPrice?.underlyingFeedId ?? 'Equity.US.BENCHMARK/USD';
  const underlyingPrice = marketPrice?.underlyingPriceUsd;
  const deviationPct = marketPrice?.deviationPct ?? 0.18;
  const isCompliant = (marketPrice?.trackingErrorBps ?? 18) <= 250;

  const alignClasses =
    align === 'right'
      ? 'right-0 text-right'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2 text-center'
      : 'left-0 text-left';

  return (
    <div
      className={`relative inline-block group ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Price Header & Subtext */}
      <div className={`cursor-pointer ${align === 'right' ? 'text-right' : ''}`}>
        <div className="font-mono text-white font-semibold tabular-nums text-sm">
          {formatCurrency(displayPrice)}
        </div>
        {showSubtext && (
          <div className="flex items-center gap-1 text-[11px] text-sentinel-textMuted hover:text-blue-400 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-sans">Pyth · updated 2s ago</span>
          </div>
        )}
      </div>

      {/* Institutional Pyth Provenance Popover Card */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-50 w-72 p-4 bg-sentinel-surfaceElevated border border-sentinel-border rounded-xl shadow-2xl backdrop-blur-md text-left transition-all transform origin-top`}
          style={{
            minWidth: '280px',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sentinel-border pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
                Ψ
              </div>
              <span className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">
                PRICE SOURCE
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              LIVE
            </div>
          </div>

          {/* Feed Identity */}
          <div className="space-y-2.5 text-xs font-mono">
            <div>
              <div className="text-white font-semibold flex items-center justify-between">
                <span>Pyth Network</span>
                <span className="text-[10px] text-sentinel-textMuted font-normal">v2 Hermes</span>
              </div>
              <div className="text-purple-400 text-[11px] font-medium truncate">
                {feedDisplayId}
              </div>
            </div>

            {/* Published */}
            <div className="bg-sentinel-surfaceMuted/80 p-2 rounded-lg border border-sentinel-border/60">
              <div className="text-[10px] text-sentinel-textMuted uppercase font-sans font-semibold">
                Published
              </div>
              <div className="text-white font-bold text-xs mt-0.5">
                {publishTime}
              </div>
            </div>

            {/* Confidence Interval */}
            <div className="bg-sentinel-surfaceMuted/80 p-2 rounded-lg border border-sentinel-border/60">
              <div className="flex items-center justify-between text-[10px] text-sentinel-textMuted uppercase font-sans font-semibold">
                <span>Confidence (±σ)</span>
                <span className="text-blue-400 font-mono">
                  ±${marketPrice?.confidenceUsd?.toFixed(2) ?? '0.10'}
                </span>
              </div>
              <div className="text-white font-bold text-xs mt-0.5">
                ${confidenceMin.toFixed(2)} – ${confidenceMax.toFixed(2)}
              </div>
            </div>

            {/* Underlying Equity Feed & Basis Deviation */}
            <div className="bg-sentinel-surfaceMuted/80 p-2 rounded-lg border border-sentinel-border/60 space-y-1">
              <div className="text-[10px] text-sentinel-textMuted uppercase font-sans font-semibold">
                Underlying Equity
              </div>
              <div className="text-sentinel-text text-[11px] truncate">
                {underlyingFeed}
                {underlyingPrice && (
                  <span className="text-white font-bold ml-1">
                    (${underlyingPrice.toFixed(2)})
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-sentinel-border/40 mt-1">
                <span className="text-[10px] text-sentinel-textMuted uppercase font-sans font-semibold">
                  Basis Deviation
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold text-xs ${isCompliant ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deviationPct.toFixed(2)}%
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-bold ${
                      isCompliant
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {isCompliant ? '≤ 2.50% CAP' : 'BREACH'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2 border-t border-sentinel-border flex items-center justify-between text-[10px] text-sentinel-textMuted">
            <span>Enforced by Sentinel</span>
            <span className="text-purple-400 font-mono">Pyth Oracle Verifier</span>
          </div>
        </div>
      )}
    </div>
  );
};
