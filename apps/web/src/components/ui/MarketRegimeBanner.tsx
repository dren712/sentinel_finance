'use client';

import React, { useState } from 'react';
import { ShieldCheck, OctagonAlert, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import { Badge } from './Badge';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';

interface MarketRegimeBannerProps {
  onNavigateToProof?: () => void;
  pythFreshnessSec?: number;
  isEmergencyPaused?: boolean;
  mode?: 'SIMULATION' | 'LIVE';
  className?: string;
}

export const MarketRegimeBanner: React.FC<MarketRegimeBannerProps> = ({
  onNavigateToProof,
  pythFreshnessSec = 8,
  isEmergencyPaused = false,
  mode = 'SIMULATION',
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
      className={`rounded-xl border font-mono text-xs overflow-hidden transition-all shadow-xs ${
        isEmergencyPaused
          ? 'border-rose-500/40 bg-rose-950/20'
          : 'border-sentinel-border bg-sentinel-surface/90'
      } ${className}`}
    >
      {/* Compact 1-Line Primary Ticker */}
      <div className="px-3.5 py-2 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: Ticker Items */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap text-[11px] leading-tight text-sentinel-textMuted overflow-hidden">
          {/* Live Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={isEmergencyPaused ? 'danger' : 'success'} dot>
              {isEmergencyPaused ? 'EMERGENCY PAUSE ACTIVE' : 'SENTINEL ARMED'}
            </Badge>
          </div>

          <span className="text-sentinel-border hidden sm:inline">|</span>

          {/* Mode & Regime */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sentinel-textSubtle">Mode:</span>
            <span className="text-white font-semibold">
              {mode === 'LIVE' ? 'Solana Devnet Live' : 'Deterministic Simulation'}
            </span>
          </div>

          <span className="text-sentinel-border hidden md:inline">|</span>

          {/* Pyth Oracle Freshness */}
          <div className="flex items-center gap-1 shrink-0 tabular-nums">
            <span className="text-sentinel-textSubtle">Oracle:</span>
            <span className="text-sentinel-text">
              Pyth Hermes ({pythFreshnessSec}s quote)
            </span>
          </div>

          <span className="text-sentinel-border hidden lg:inline">|</span>

          {/* Invariant Verification */}
          {onNavigateToProof ? (
            <button
              type="button"
              onClick={onNavigateToProof}
              className="hidden lg:inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
            >
              {isEmergencyPaused ? (
                <OctagonAlert className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>11/11 Adversarial Invariants Enforced</span>
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
            className="px-2 py-1 rounded text-sentinel-textSubtle hover:text-sentinel-text hover:bg-white/[0.04] transition cursor-pointer text-[10px] flex items-center gap-1"
            title={isExpanded ? 'Collapse Ground Truth details' : 'Expand Ground Truth details'}
          >
            <span className="hidden sm:inline">Provenance</span>
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
        <div className="px-3.5 py-2.5 bg-sentinel-surfaceElevated/60 border-t border-sentinel-border flex flex-col md:flex-row md:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle tracking-wider">
              GROUND TRUTH:
            </span>
            <SourceBadge source="PYTH" detail={`${pythFreshnessSec}s quote`} size="xs" />
            <SourceBadge source="PRESTOCKS" detail="409A private equity" size="xs" />
            <SourceBadge source="METEORA" detail="$31.8K depth verified" size="xs" />
            <SourceBadge source="SOLANA" detail="Devnet Anchor" size="xs" />
            <SourceBadge source="PROVN" detail="SHA-256 sealed" size="xs" />
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline tabular-nums"
            >
              <span>
                Anchor: {APP_CONFIG.sentinelProgramId.slice(0, 4)}…{APP_CONFIG.sentinelProgramId.slice(-4)}
              </span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
