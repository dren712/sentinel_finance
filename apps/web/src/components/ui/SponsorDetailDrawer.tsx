'use client';

import React, { useState } from 'react';
import {
  Activity,
  Building2,
  Cpu,
  Database,
  ExternalLink,
  Lock,
  Play,
  ShieldCheck,
  X,
  Zap,
  Check,
  Copy,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl, getExplorerTxUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';
import { PRESTOCKS_SERIES_REGISTRY } from '../PortfolioView';
import { SponsorPillarKey } from './SponsorInfrastructureStrip';

interface SponsorDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SponsorPillarKey;
  onRunPythDemo?: () => void;
  onRunPreStocksDemo?: () => void;
  onRunMeteoraDemo?: () => void;
}

export const SponsorDetailDrawer: React.FC<SponsorDetailDrawerProps> = ({
  isOpen,
  onClose,
  initialTab = 'PYTH',
  onRunPythDemo,
  onRunPreStocksDemo,
  onRunMeteoraDemo,
}) => {
  const [activeTab, setActiveTab] = useState<SponsorPillarKey>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync initial tab when changed
  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop blur */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Panel */}
      <div className="relative w-full max-w-3xl bg-sentinel-surface border border-sentinel-border rounded-2xl shadow-2xl p-6 sm:p-7 z-10 space-y-6 overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-sentinel-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                SENTINEL STACK · TECHNICAL PROOF
              </span>
              <span className="text-xs text-sentinel-textMuted font-mono">Stocklana Ecosystem</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight mt-1.5 uppercase">
              Infrastructure &amp; Sponsor Invariants
            </h3>
            <p className="text-xs text-sentinel-textMuted font-sans mt-0.5">
              How Pyth Network, PreStocks, Meteora, and Solana act as cryptographic postcondition checks in Sentinel.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition cursor-pointer sentinel-interactive sentinel-focus"
            aria-label="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-sentinel-surfaceMuted border border-sentinel-border text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('PYTH')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer sentinel-interactive sentinel-focus ${
              activeTab === 'PYTH'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-sentinel-textMuted hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Pyth Network</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PRESTOCKS')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer sentinel-interactive sentinel-focus ${
              activeTab === 'PRESTOCKS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-sentinel-textMuted hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>PreStocks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('METEORA')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer sentinel-interactive sentinel-focus ${
              activeTab === 'METEORA'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-sentinel-textMuted hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Meteora DBC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SOLANA')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer sentinel-interactive sentinel-focus ${
              activeTab === 'SOLANA'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-sentinel-textMuted hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Solana Devnet</span>
          </button>
        </div>

        {/* Tab 1: Pyth Network */}
        {activeTab === 'PYTH' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Pyth Network · Dual-Feed Market Integrity
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold text-[10px]">
                  LIVE HERMÈS STREAM
                </span>
              </div>
              <p className="text-sentinel-textMuted font-sans text-xs leading-relaxed">
                Sentinel uses Pyth Network as the infallible price oracle truth source. The autonomous agent is forbidden from relying on arbitrary unverified pricing. If an oracle quote is stale (&gt;60s) or confidence interval expands beyond bounds, Sentinel aborts the state transition before Solana transaction signing.
              </p>
            </div>

            {/* Invariant Table */}
            <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-3">
              <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-bold block">
                PYTH INVARIANT SPECIFICATION &amp; TELEMETRY
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">HERMÈS API ENDPOINT</span>
                  <div className="text-white font-semibold truncate">
                    https://hermes.pyth.network/v2/updates/price/latest
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">MAX AGE INVARIANT (STALENESS GUARD)</span>
                  <div className="text-emerald-400 font-semibold tabular-nums">
                    ≤ 60 seconds (Fails closed if violated)
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">NVDA / NVDAx PRICE FEED ID</span>
                  <div className="flex items-center justify-between gap-1 text-purple-300 font-semibold truncate">
                    <span className="truncate">0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b</span>
                    <button
                      onClick={() => handleCopy('0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b', 'pyth-nvda')}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      {copiedKey === 'pyth-nvda' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">CONFIDENCE INTERVAL TOLERANCE</span>
                  <div className="text-blue-400 font-semibold tabular-nums">
                    σ ≤ $0.50 (±$0.04 observed)
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Demo Trigger */}
            {onRunPythDemo && (
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-white block">Test Case C: Stale Pyth Quote Refusal</span>
                  <span className="text-[11px] text-sentinel-textMuted font-sans">
                    Simulates a 140s stale Pyth quote and verifies Sentinel aborts execution before Solana submission.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRunPythDemo();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer sentinel-interactive sentinel-focus"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Stale Quote Test</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: PreStocks */}
        {activeTab === 'PRESTOCKS' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm uppercase flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  PreStocks · Pre-IPO Tokenized Equity Integration
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold text-[10px]">
                  ASSET UNIVERSE &amp; VAULT
                </span>
              </div>
              <p className="text-sentinel-textMuted font-sans text-xs leading-relaxed">
                PreStocks provides normalized private-equity asset metadata and secondary trading vaults on Solana. Sentinel enforces a strict 20% portfolio cap on private-equity holdings to insulate institutional investors from illiquidity risks.
              </p>
            </div>

            {/* Asset Table */}
            <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-3">
              <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-bold block">
                VERIFIED PRE-IPO EQUITIES IN SENTINEL REGISTRY
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px]">
                {Object.entries(PRESTOCKS_SERIES_REGISTRY).map(([symbol, asset]) => (
                  <div key={symbol} className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{symbol}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold">Eligible</span>
                    </div>
                    <div className="text-[10px] text-sentinel-textMuted font-sans truncate">{asset.shareClass}</div>
                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="text-sentinel-textSubtle">409A NAV:</span>
                      <span className="text-white font-bold tabular-nums">${asset.navAttestationUsd.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invariant Rule */}
            <div className="p-3 bg-sentinel-surface border border-sentinel-border rounded-xl space-y-1">
              <span className="text-[10px] text-sentinel-textSubtle uppercase font-bold">SENTINEL INVARIANT RULE</span>
              <div className="text-white">
                <span className="text-blue-400 font-bold">maxPreIpoExposureBps = 2000 (20.00%)</span> · Trades proposing greater allocation are blocked and adapted.
              </div>
            </div>

            {/* Quick Demo Trigger */}
            {onRunPreStocksDemo && (
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-white block">Test Case D: PreStocks Cap Breach &amp; Adaptation</span>
                  <span className="text-[11px] text-sentinel-textMuted font-sans">
                    Proposes $30,000 in PreStocks unicorns (breaching the 20% cap) and verifies automatic compliant adaptation.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRunPreStocksDemo();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer sentinel-interactive sentinel-focus"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run PreStocks Test</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Meteora DBC */}
        {activeTab === 'METEORA' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Meteora Dynamic Bonding Curve (DBC)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[10px]">
                  LIQUIDITY &amp; EXECUTION VENUE
                </span>
              </div>
              <p className="text-sentinel-textMuted font-sans text-xs leading-relaxed">
                Tokenized stocks in Sentinel trade through Meteora Dynamic Bonding Curves. Sentinel performs pre-trade liquidity verification and slippage evaluation, preventing execution if pool depth cannot support the trade or curve invariants are violated.
              </p>
            </div>

            {/* Pool Details */}
            <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-3">
              <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-bold block">
                METEORA DBC POOL TELEMETRY &amp; GUARDS
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">VERIFIED DBC POOL ADDRESS</span>
                  <div className="flex items-center justify-between gap-1 text-white font-semibold truncate">
                    <span className="truncate">Eo7WjKq67rjJQSZxS6z3YKapzY3eMj6Xy8DD5EkViQn7</span>
                    <button
                      onClick={() => handleCopy('Eo7WjKq67rjJQSZxS6z3YKapzY3eMj6Xy8DD5EkViQn7', 'meteora-pool')}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      {copiedKey === 'meteora-pool' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">CURVE MECHANISM &amp; FEE</span>
                  <div className="text-amber-400 font-semibold">
                    Dynamic Bonding Curve · 0.15% Protocol Fee
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">MAX SLIPPAGE INVARIANT</span>
                  <div className="text-emerald-400 font-semibold tabular-nums">
                    ≤ 150 bps (1.50% ceiling enforced on-chain)
                  </div>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border space-y-1">
                  <span className="text-sentinel-textSubtle block text-[10px]">PRE-TRADE DEPTH VERIFICATION</span>
                  <div className="text-blue-400 font-semibold">
                    Virtual Reserves Verified Before Intent Ticket Commit
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Demo Trigger */}
            {onRunMeteoraDemo && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-white block">Test Case B: Meteora Liquidity Guard Demo</span>
                  <span className="text-[11px] text-sentinel-textMuted font-sans">
                    Evaluates DBC virtual reserves and blocks trades if pool depth creates excessive market impact.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRunMeteoraDemo();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer sentinel-interactive sentinel-focus"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Meteora Test</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Solana Devnet */}
        {activeTab === 'SOLANA' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm uppercase flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Solana Devnet · Authoritative Settlement &amp; Enforcement
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                  ANCHOR PROGRAM PDAS
                </span>
              </div>
              <p className="text-sentinel-textMuted font-sans text-xs leading-relaxed">
                All financial authority resides exclusively in the Solana Anchor program. The agent possesses no unilateral signing authority over user funds. If any policy invariant is violated, the transaction atomically reverts with zero state change.
              </p>
            </div>

            {/* On-Chain Addresses */}
            <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-3">
              <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-bold block">
                VERIFIED ANCHOR PDAS &amp; CONTRACTS
              </span>

              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sentinel-textSubtle block text-[10px]">SENTINEL PROGRAM ID</span>
                    <span className="text-white font-semibold">{APP_CONFIG.sentinelProgramId}</span>
                  </div>
                  <a
                    href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 p-1"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sentinel-textSubtle block text-[10px]">POLICY PDA</span>
                    <span className="text-purple-300 font-semibold">{APP_CONFIG.policyPda}</span>
                  </div>
                  <a
                    href={getExplorerAddressUrl(APP_CONFIG.policyPda)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 p-1"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sentinel-textSubtle block text-[10px]">PORTFOLIO VAULT PDA (AUTHORITATIVE)</span>
                    <span className="text-emerald-400 font-semibold">{APP_CONFIG.vaultPda}</span>
                  </div>
                  <a
                    href={getExplorerAddressUrl(APP_CONFIG.vaultPda)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1 shrink-0 p-1"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Close */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-sentinel-surfaceMuted hover:bg-sentinel-surfaceElevated border border-sentinel-border text-white text-xs font-semibold transition cursor-pointer sentinel-interactive sentinel-focus"
          >
            Close Detail Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
