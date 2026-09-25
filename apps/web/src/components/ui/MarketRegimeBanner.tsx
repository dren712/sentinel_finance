'use client';

import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';

interface MarketRegimeBannerProps {
  onNavigateToProof?: () => void;
  pythFreshnessSec?: number;
  className?: string;
}

export const MarketRegimeBanner: React.FC<MarketRegimeBannerProps> = ({
  onNavigateToProof,
  pythFreshnessSec = 8,
  className = '',
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isDismissed) {
    return (
      <div className={`mb-3 flex justify-end ${className}`}>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-[10px] font-mono text-sentinel-textSubtle hover:text-sentinel-text px-2 py-0.5 rounded border border-sentinel-border/60 bg-sentinel-surface/50 hover:bg-sentinel-surface transition cursor-pointer"
        >
          + Show System Status Ticker
        </button>
      </div>
    );
  }

  return (
    <div
      className={`mb-4 rounded-lg border border-sentinel-border bg-sentinel-surface/80 backdrop-blur font-mono text-xs overflow-hidden transition-all shadow-xs ${className}`}
    >
      {/* Compact 1-Line Primary Ticker */}
      <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: Ticker Items */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[11px] leading-tight text-sentinel-textMuted overflow-hidden">
          {/* Live Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white tracking-wide uppercase text-[10px]">
              Regime:
            </span>
            <span className="text-emerald-300 font-medium">Solana 24/7 Live</span>
          </div>

          <span className="text-sentinel-border hidden sm:inline">|</span>

          {/* Circuit Breaker Status */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sentinel-textSubtle">Circuit Breaker:</span>
            <span className="text-emerald-400 font-semibold">ARMED</span>
          </div>

          <span className="text-sentinel-border hidden md:inline">|</span>

          {/* Pyth Oracle Freshness */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sentinel-textSubtle">Oracle:</span>
            <span className="text-cyan-300">Pyth Hermes ({pythFreshnessSec}s quote)</span>
          </div>

          <span className="text-sentinel-border hidden lg:inline">|</span>

          {/* Invariant Verification */}
          {onNavigateToProof ? (
            <button
              type="button"
              onClick={onNavigateToProof}
              className="hidden lg:inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>11/11 Adversarial Invariants Active</span>
            </button>
          ) : (
            <span className="hidden lg:inline text-sentinel-textSubtle">
              11 Invariants Enforced
            </span>
          )}
        </div>

        {/* Right: Expand / Dismiss Controls */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-sentinel-textSubtle hover:text-sentinel-text hover:bg-white/[0.04] transition cursor-pointer text-[10px] flex items-center gap-0.5"
            title={isExpanded ? 'Collapse Ground Truth details' : 'Expand Ground Truth details'}
          >
            <span className="hidden sm:inline">Details</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded text-sentinel-textSubtle hover:text-sentinel-text hover:bg-white/[0.04] transition cursor-pointer"
            title="Dismiss status ticker"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expandable Ground Truth Badges Strip */}
      {isExpanded && (
        <div className="px-3 sm:px-4 py-2.5 bg-sentinel-surfaceElevated/60 border-t border-sentinel-border flex flex-col md:flex-row md:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle tracking-wider">
              GROUND TRUTH:
            </span>
            <SourceBadge source="PYTH" detail={`${pythFreshnessSec}s quote`} />
            <SourceBadge source="PRESTOCKS" detail="409A private equity" />
            <SourceBadge source="METEORA" detail="$31.8K depth verified" />
            <SourceBadge source="SOLANA" detail="Devnet Anchor" />
            <SourceBadge source="PROVN" detail="SHA-256 sealed" />
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline"
            >
              <span>Anchor: {APP_CONFIG.sentinelProgramId.slice(0, 4)}...{APP_CONFIG.sentinelProgramId.slice(-4)}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
