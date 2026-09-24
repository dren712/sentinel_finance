'use client';

import React from 'react';
import { Activity, Building2, Cpu, Database, ExternalLink, Zap } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

export type SponsorPillarKey = 'PYTH' | 'PRESTOCKS' | 'METEORA' | 'SOLANA';

interface SponsorInfrastructureStripProps {
  onOpenSponsorDetail: (sponsor: SponsorPillarKey) => void;
  pythFreshnessSec?: number;
  pythConfidenceUsd?: number;
  activeVenueName?: string;
}

export const SponsorInfrastructureStrip: React.FC<SponsorInfrastructureStripProps> = ({
  onOpenSponsorDetail,
  pythFreshnessSec = 12,
  pythConfidenceUsd = 0.04,
  activeVenueName = 'Meteora DBC',
}) => {
  return (
    <div className="mb-6 p-4 rounded-xl bg-sentinel-surface border border-sentinel-border font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-sentinel-border/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">
            Sentinel Stack · Verified Infrastructure
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/25 font-semibold">
            Stocklana Ecosystem
          </span>
        </div>
        <span className="text-[10px] text-sentinel-textMuted font-sans">
          Click any infrastructure pillar to inspect live endpoints, invariants &amp; on-chain proof
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* 1. Market Data: Pyth Network */}
        <button
          type="button"
          onClick={() => onOpenSponsorDetail('PYTH')}
          className="text-left p-3 rounded-lg bg-sentinel-surfaceMuted/80 hover:bg-sentinel-surfaceElevated border border-purple-500/25 hover:border-purple-500/50 transition cursor-pointer sentinel-interactive sentinel-focus group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                Market Data
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold border border-purple-500/30">
                Pyth Network
              </span>
            </div>
            <div className="font-bold text-white text-xs truncate">
              Hermès Live Feed
            </div>
            <p className="text-[11px] text-sentinel-textMuted mt-0.5 font-sans">
              Dual-feed truth · {pythFreshnessSec}s freshness · ±${pythConfidenceUsd.toFixed(2)} conf
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-purple-500/15 flex items-center justify-between text-[10px] text-purple-400 group-hover:text-purple-300 font-semibold">
            <span>Inspect Oracle Proof</span>
            <span>↗</span>
          </div>
        </button>

        {/* 2. Pre-IPO Assets: PreStocks */}
        <button
          type="button"
          onClick={() => onOpenSponsorDetail('PRESTOCKS')}
          className="text-left p-3 rounded-lg bg-sentinel-surfaceMuted/80 hover:bg-sentinel-surfaceElevated border border-blue-500/25 hover:border-blue-500/50 transition cursor-pointer sentinel-interactive sentinel-focus group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Pre-IPO Assets
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                PreStocks
              </span>
            </div>
            <div className="font-bold text-white text-xs truncate">
              Private Equity Universe
            </div>
            <p className="text-[11px] text-sentinel-textMuted mt-0.5 font-sans">
              SPACEXx, OPENAIx, STRIPEx · 20% cap invariant
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-blue-500/15 flex items-center justify-between text-[10px] text-blue-400 group-hover:text-blue-300 font-semibold">
            <span>Inspect Asset Universe</span>
            <span>↗</span>
          </div>
        </button>

        {/* 3. Liquidity & Execution: Meteora DBC */}
        <button
          type="button"
          onClick={() => onOpenSponsorDetail('METEORA')}
          className="text-left p-3 rounded-lg bg-sentinel-surfaceMuted/80 hover:bg-sentinel-surfaceElevated border border-amber-500/25 hover:border-amber-500/50 transition cursor-pointer sentinel-interactive sentinel-focus group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Execution Venue
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                Meteora DBC
              </span>
            </div>
            <div className="font-bold text-white text-xs truncate">
              Dynamic Bonding Curve
            </div>
            <p className="text-[11px] text-sentinel-textMuted mt-0.5 font-sans">
              Pool Eo7WjKq6... · 0.15% fee · Pre-trade guard
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-amber-500/15 flex items-center justify-between text-[10px] text-amber-400 group-hover:text-amber-300 font-semibold">
            <span>Inspect DBC Liquidity</span>
            <span>↗</span>
          </div>
        </button>

        {/* 4. Settlement & Enforcement: Solana Devnet */}
        <button
          type="button"
          onClick={() => onOpenSponsorDetail('SOLANA')}
          className="text-left p-3 rounded-lg bg-sentinel-surfaceMuted/80 hover:bg-sentinel-surfaceElevated border border-emerald-500/25 hover:border-emerald-500/50 transition cursor-pointer sentinel-interactive sentinel-focus group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Settlement &amp; Enforcement
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                Solana Devnet
              </span>
            </div>
            <div className="font-bold text-white text-xs truncate">
              Anchor Vault PDA
            </div>
            <p className="text-[11px] text-sentinel-textMuted mt-0.5 font-sans">
              Program {formatAddress(APP_CONFIG.sentinelProgramId, 4)} · Atomic Revert
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-emerald-500/15 flex items-center justify-between text-[10px] text-emerald-400 group-hover:text-emerald-300 font-semibold">
            <span>Inspect Anchor PDAs</span>
            <span>↗</span>
          </div>
        </button>
      </div>
    </div>
  );
};
