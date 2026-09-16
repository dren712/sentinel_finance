'use client';

import React, { useState } from 'react';
import { FinancialPolicy } from '@sentinel/domain';
import {
  ShieldCheck,
  Save,
  Lock,
  Layers,
  ExternalLink,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatCurrency, formatBps, formatAddress } from '@/lib/formatters';

interface GuaranteesViewProps {
  policy: FinancialPolicy;
  onUpdatePolicy: (updated: Partial<FinancialPolicy>) => void;
}

export const GuaranteesView: React.FC<GuaranteesViewProps> = ({
  policy,
  onUpdatePolicy,
}) => {
  const [maxSingleAssetPct, setMaxSingleAssetPct] = useState(policy.maxSingleAssetBps / 100);
  const [minStablecoinPct, setMinStablecoinPct] = useState(policy.minStablecoinBps / 100);
  const [maxTradeValue, setMaxTradeValue] = useState(policy.maxTradeValueUsd);
  const [maxSlippagePct, setMaxSlippagePct] = useState(policy.maxSlippageBps / 100);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onUpdatePolicy({
      maxSingleAssetBps: Math.round(maxSingleAssetPct * 100),
      minStablecoinBps: Math.round(minStablecoinPct * 100),
      maxTradeValueUsd: maxTradeValue,
      maxSlippageBps: Math.round(maxSlippagePct * 100),
      policyVersion: policy.policyVersion + 1,
      updatedAt: Date.now(),
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Human-First Overview Banner */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-sentinel-accent" />
              <h2 className="text-lg font-bold text-sentinel-text">Financial Policy Guarantees</h2>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">
                Policy v{policy.policyVersion}
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-1 max-w-2xl leading-relaxed">
              These machine-checkable postconditions are enforced authoritatively by the Sentinel Anchor program on Solana Devnet. Any state transition proposed by an autonomous agent that breaches these invariants reverts atomically with zero capital loss.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Guarantees Updated!' : 'Update Policy'}</span>
            </button>
          </div>
        </div>

        {/* Human-Readable Promise Statement */}
        <div className="mt-4 p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border flex items-start gap-2.5 text-xs text-sentinel-text">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white block">Active Guarantee Summary:</span>
            <span className="text-sentinel-textMuted mt-0.5 block">
              &quot;The autonomous agent may only trade if single-equity exposure remains ≤{' '}
              <strong className="text-white">{maxSingleAssetPct.toFixed(1)}%</strong>, liquid USDC reserve remains ≥{' '}
              <strong className="text-white">{minStablecoinPct.toFixed(1)}%</strong>, trade sizing does not exceed{' '}
              <strong className="text-white">{formatCurrency(maxTradeValue, { maximumFractionDigits: 0 })}</strong>, and execution slippage stays within{' '}
              <strong className="text-white">{maxSlippagePct.toFixed(2)}%</strong>.&quot;
            </span>
          </div>
        </div>
      </div>

      {/* 2. Four Interactive Invariant Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invariant A: Max Single Asset Exposure */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Single-Asset Exposure</h3>
                <span className="text-[11px] text-sentinel-textSubtle font-mono">
                  post_asset / portfolio ≤ cap
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white tabular-nums">{maxSingleAssetPct.toFixed(1)}%</div>
              <div className="text-[11px] text-blue-400 font-mono">
                {Math.round(maxSingleAssetPct * 100)} bps
              </div>
            </div>
          </div>

          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={maxSingleAssetPct}
            onChange={(e) => setMaxSingleAssetPct(parseFloat(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-sentinel-textSubtle font-mono">
            <span>Conservative (10%)</span>
            <span>Balanced (25%)</span>
            <span>Aggressive (50%)</span>
          </div>

          <p className="text-xs text-sentinel-textMuted pt-1">
            Ensures portfolio diversification. No single tokenized stock (NVDAx, AAPLx, TSLAx) can exceed this fraction of total portfolio value after any trade.
          </p>
        </div>

        {/* Invariant B: Minimum Stablecoin Reserve Floor */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                B
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Minimum Stablecoin Reserve</h3>
                <span className="text-[11px] text-sentinel-textSubtle font-mono">
                  post_stablecoin / portfolio ≥ floor
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{minStablecoinPct.toFixed(1)}%</div>
              <div className="text-[11px] text-emerald-400 font-mono">
                {Math.round(minStablecoinPct * 100)} bps
              </div>
            </div>
          </div>

          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={minStablecoinPct}
            onChange={(e) => setMinStablecoinPct(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-sentinel-textSubtle font-mono">
            <span>Minimum (10%)</span>
            <span>Standard (20%)</span>
            <span>High Liquidity (50%)</span>
          </div>

          <p className="text-xs text-sentinel-textMuted pt-1">
            Guarantees cash liquidity. The agent is mathematically prevented from spending the portfolio into an illiquid state.
          </p>
        </div>

        {/* Invariant C: Maximum Trade Sizing Limit */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                C
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Trade Value Limit</h3>
                <span className="text-[11px] text-sentinel-textSubtle font-mono">
                  trade_amount ≤ max_limit
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(maxTradeValue, { maximumFractionDigits: 0 })}</div>
              <div className="text-[11px] text-purple-400 font-mono">USD Notional</div>
            </div>
          </div>

          <input
            type="range"
            min="1000"
            max="25000"
            step="1000"
            value={maxTradeValue}
            onChange={(e) => setMaxTradeValue(parseFloat(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-sentinel-textSubtle font-mono">
            <span>$1,000</span>
            <span>$10,000</span>
            <span>$25,000</span>
          </div>

          <p className="text-xs text-sentinel-textMuted pt-1">
            Hard cap on individual rebalancing transactions, preventing runaway order executions or sudden volatility exposure.
          </p>
        </div>

        {/* Invariant D: Maximum Slippage Tolerance */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                D
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Slippage Tolerance</h3>
                <span className="text-[11px] text-sentinel-textSubtle font-mono">
                  |exec - quoted| / quoted ≤ slippage
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white tabular-nums">{maxSlippagePct.toFixed(2)}%</div>
              <div className="text-[11px] text-amber-400 font-mono">
                {Math.round(maxSlippagePct * 100)} bps
              </div>
            </div>
          </div>

          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value={maxSlippagePct}
            onChange={(e) => setMaxSlippagePct(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-sentinel-textSubtle font-mono">
            <span>Tight (0.10%)</span>
            <span>Standard (1.00%)</span>
            <span>Loose (3.00%)</span>
          </div>

          <p className="text-xs text-sentinel-textMuted pt-1">
            Protects against MEV, sandwich attacks, and illiquid trading pools. Execution price must conform within bounded basis points of quoted reference price.
          </p>
        </div>

        {/* Invariant E: Pyth Market Truth & Peg Integrity */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs">
                E
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Pyth Market Truth &amp; Peg Integrity Guarantee</h3>
                <span className="text-[11px] text-sentinel-textSubtle font-mono">
                  |tokenized - underlying| / underlying ≤ 250 bps &amp; conf / price ≤ 150 bps
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-xs text-sentinel-textSubtle uppercase">Max Tracking Error</div>
                <div className="text-base font-bold text-purple-400 tabular-nums font-mono">2.50% (250 bps)</div>
              </div>
              <div>
                <div className="text-xs text-sentinel-textSubtle uppercase">Max Confidence Spread</div>
                <div className="text-base font-bold text-blue-400 tabular-nums font-mono">1.50% (150 bps)</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border/60 text-xs font-mono">
            <div>
              <span className="text-sentinel-textSubtle block text-[10px]">ACTIVE ORACLE VENUE</span>
              <span className="text-white font-bold">Pyth Network Hermes v2</span>
            </div>
            <div>
              <span className="text-sentinel-textSubtle block text-[10px]">MONITORED FEEDS</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                4 Active Dual-Feeds
              </span>
            </div>
            <div>
              <span className="text-sentinel-textSubtle block text-[10px]">ENFORCEMENT MECHANISM</span>
              <span className="text-purple-400 font-bold">SWARM PythOracleVerifier</span>
            </div>
          </div>

          <p className="text-xs text-sentinel-textMuted pt-1">
            Mathematically guarantees that tokenized equities trade in alignment with underlying US equity markets. If a secondary liquidity pool depegs by &gt; 2.50% or oracle spread widens past 1.50%, Sentinel halts autonomous execution and records a cryptographic evidence rejection.
          </p>
        </div>

        {/* Invariant F: Non-Custodial Real Asset Architecture (Phase 3) */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                F
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Non-Custodial Real Asset Guarantee</h3>
                <span className="text-[11px] text-sentinel-textSubtle font-mono">
                  Standard SPL Associated Token Accounts · Zero Smart Contract Lock-in
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-xs text-sentinel-textSubtle uppercase">Asset Custody</div>
                <div className="text-base font-bold text-emerald-400 font-mono">100% User ATAs</div>
              </div>
              <div>
                <div className="text-xs text-sentinel-textSubtle uppercase">PDA Authority</div>
                <div className="text-base font-bold text-blue-400 font-mono">Guarded Projection</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border/60 text-xs font-mono">
            <div>
              <span className="text-sentinel-textSubtle block text-[10px]">SPL TOKEN STANDARD</span>
              <span className="text-white font-bold">Standard SPL ATAs</span>
            </div>
            <div>
              <span className="text-sentinel-textSubtle block text-[10px]">INDEXER PROJECTION</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live Balance + Pyth
              </span>
            </div>
            <div>
              <span className="text-sentinel-textSubtle block text-[10px]">SENTINEL PDA ROLE</span>
              <span className="text-purple-400 font-bold">5-Fold Authority Guard</span>
            </div>
          </div>

          <p className="text-xs text-sentinel-textMuted pt-1">
            User assets are never locked into custom proprietary contract balances. All holdings remain standard Solana SPL tokens in the user&apos;s Associated Token Accounts. The Sentinel PDA operates strictly as the policy authority, portfolio configuration, execution guard, promise registry, and evidence anchor.
          </p>
        </div>
      </div>

      {/* 3. On-Chain Solana Anchor Details */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-sentinel-text">On-Chain Anchor PDA Commitment</h3>
        <p className="text-xs text-sentinel-textMuted">
          The Policy Account PDA and PortfolioVault PDA are anchored on Solana Devnet:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 font-mono text-xs">
          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block">SOLANA PROGRAM ID</span>
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-1 mt-1"
            >
              <span>{formatAddress(APP_CONFIG.sentinelProgramId, 8)}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block">PORTFOLIO VAULT PDA SEEDS</span>
            <span className="text-white mt-1 block">
              b&quot;vault&quot;, owner.key()
            </span>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block">ARITHMETIC PRECISION</span>
            <span className="text-emerald-400 mt-1 block font-semibold">
              u128 basis-point checked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
