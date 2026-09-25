'use client';

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowRight,
  Database,
  Layers,
  Lock,
} from 'lucide-react';
import { formatCurrency, formatAddress } from '@/lib/formatters';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { SourceBadge } from './SourceBadge';

interface SettlementGateProps {
  assetSymbol: string;
  direction?: 'BUY' | 'SELL';
  amountUsd: number;
  venueName?: string;
  poolAddress?: string;
  liquidityDepthUsd?: number;
  priceImpactBps?: number;
  pythFreshnessSec?: number;
  policyPassed?: boolean;
  postStatePassed?: boolean;
  onExecute?: () => void;
  isExecuting?: boolean;
  className?: string;
}

export const SettlementGateCard: React.FC<SettlementGateProps> = ({
  assetSymbol,
  direction = 'BUY',
  amountUsd,
  venueName = 'Meteora Dynamic Bonding Curve',
  poolAddress = 'Eo7WjKq67rjJQSZxS6z3YKapzY3eMj6Xy8DD5EkViQn7',
  liquidityDepthUsd = 31_842,
  priceImpactBps = 42,
  pythFreshnessSec = 8,
  policyPassed = true,
  postStatePassed = true,
  onExecute,
  isExecuting = false,
  className = '',
}) => {
  const isMarketQualityPass = liquidityDepthUsd >= 25_000 && priceImpactBps <= 150;
  const isOraclePass = pythFreshnessSec <= 60;
  const isOverallApproved = policyPassed && postStatePassed && isMarketQualityPass && isOraclePass;

  return (
    <div className={`rounded-xl border border-sentinel-border bg-sentinel-surface p-5 sm:p-6 font-mono text-xs shadow-xl space-y-4 ${className}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sentinel-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white uppercase tracking-wider text-xs">
                SETTLEMENT GATE
              </span>
              <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                Solana Devnet
              </span>
            </div>
            <p className="text-[10px] text-sentinel-textMuted font-sans">
              Deterministic invariant check before Anchor ticket commitment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-right">
          <div>
            <span className="text-[10px] text-sentinel-textSubtle block font-sans">INTENT TICKET</span>
            <span className="font-bold text-white tabular-nums">
              {direction} {assetSymbol} · {formatCurrency(amountUsd)}
            </span>
          </div>
        </div>
      </div>

      {/* Target Venue & Route */}
      <div className="bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-sentinel-textSubtle font-sans">EXECUTION VENUE:</span>
          <span className="font-semibold text-blue-400">{venueName}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-sentinel-textMuted">
          <span>Pool: {formatAddress(poolAddress, 6)}</span>
          <SourceBadge source="METEORA" detail="Bonding Curve" />
        </div>
      </div>

      {/* 5-Checkpoint Verification Matrix */}
      <div className="divide-y divide-sentinel-border/70 border border-sentinel-border rounded-lg bg-black/30">
        {/* 1. Market Quality & Liquidity */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMarketQualityPass ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="text-sentinel-text">Market Quality &amp; Liquidity</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-sentinel-textMuted font-mono">
              Depth: {formatCurrency(liquidityDepthUsd)} (≥ $25k)
            </span>
            <span className={`font-bold ${isMarketQualityPass ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isMarketQualityPass ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>

        {/* 2. Price Impact & Slippage */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {priceImpactBps <= 150 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="text-sentinel-text">Price Impact &amp; Slippage</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-sentinel-textMuted font-mono">
              Impact: {priceImpactBps} bps (≤ 150 bps)
            </span>
            <span className={`font-bold ${priceImpactBps <= 150 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {priceImpactBps <= 150 ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>

        {/* 3. Pyth Oracle Freshness */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOraclePass ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="text-sentinel-text">Pyth Hermès Dual-Feed</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-sentinel-textMuted font-mono">
              Freshness: {pythFreshnessSec}s (≤ 60s max)
            </span>
            <span className={`font-bold ${isOraclePass ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isOraclePass ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>

        {/* 4. Portfolio Policy Invariants */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {policyPassed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="text-sentinel-text">Policy Invariants (Cap &amp; Reserve)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-sentinel-textMuted font-mono">
              25% Cap · 20% Floor · $10K Max
            </span>
            <span className={`font-bold ${policyPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
              {policyPassed ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>

        {/* 5. Deterministic Post-State Root */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {postStatePassed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="text-sentinel-text">Post-State Root Pre-Calculation</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-sentinel-textMuted font-mono">
              PROVN SHA-256 Preimage Valid
            </span>
            <span className={`font-bold ${postStatePassed ? 'text-emerald-400' : 'text-rose-400'}`}>
              {postStatePassed ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>
      </div>

      {/* Final Verdict & Execution Button */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-sentinel-border">
        <div>
          <span className="text-[10px] text-sentinel-textSubtle block font-sans">SENTINEL FINAL VERDICT</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isOverallApproved ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 text-xs">
                ✓ APPROVED FOR ANCHOR SETTLEMENT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30 text-xs">
                ✕ BLOCKED — STATE TRANSITION FORBIDDEN
              </span>
            )}
          </div>
        </div>

        {onExecute && isOverallApproved && (
          <button
            type="button"
            disabled={isExecuting}
            onClick={onExecute}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition cursor-pointer sentinel-interactive sentinel-focus sentinel-btn-physical text-xs"
          >
            <span>{isExecuting ? 'Settling on Devnet...' : 'Commit to Solana Vault'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
