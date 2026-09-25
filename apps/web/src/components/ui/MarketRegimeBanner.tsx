'use client';

import React from 'react';
import { ShieldCheck, Activity, Database, ExternalLink, Zap } from 'lucide-react';
import { SourceBadge } from './SourceBadge';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';

interface MarketRegimeBannerProps {
  onNavigateToProof?: () => void;
  pythFreshnessSec?: number;
}

export const MarketRegimeBanner: React.FC<MarketRegimeBannerProps> = ({
  onNavigateToProof,
  pythFreshnessSec = 8,
}) => {
  return (
    <div className="mb-6 rounded-xl border border-sentinel-border bg-sentinel-surface/90 backdrop-blur shadow-sm overflow-hidden font-mono">
      {/* Top micro-ticker: Session Regime & Core Axiom */}
      <div className="px-4 py-2.5 bg-sentinel-surfaceElevated/70 border-b border-sentinel-border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-sentinel-text tracking-wide uppercase">
            REGIME: US EQUITIES CLOSED · SOLANA ACTIVE 24/7 · PYTH HERMES LIVE
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-sentinel-textMuted font-sans">
          <span className="italic font-medium text-white">
            &ldquo;The AI chooses the trade. Sentinel controls the outcome.&rdquo;
          </span>
        </div>
      </div>

      {/* Main banner strip: Active Invariant Governance & Provenance */}
      <div className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle tracking-wider">
            GROUND TRUTH:
          </span>
          <SourceBadge source="PYTH" detail={`${pythFreshnessSec}s quote`} />
          <SourceBadge source="PRESTOCKS" detail="409A private equity" />
          <SourceBadge source="METEORA" detail="$31.8K depth verified" />
          <SourceBadge source="SOLANA" detail="Devnet Anchor" />
          <SourceBadge source="PROVN" detail="SHA-256 sealed" />
        </div>

        <div className="flex items-center gap-3 self-end lg:self-auto shrink-0">
          {onNavigateToProof ? (
            <button
              onClick={onNavigateToProof}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/35 text-blue-300 text-xs font-semibold sentinel-interactive sentinel-focus sentinel-btn-physical cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Inspect 11 Adversarial Proofs</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                11/11 BLOCKED
              </span>
            </button>
          ) : (
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sentinel-textMuted hover:text-white transition"
            >
              <span>Anchor Program: 3gh1...WEvAJK</span>
              <ExternalLink className="w-3 h-3 text-sentinel-textSubtle" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
