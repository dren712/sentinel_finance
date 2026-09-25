'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Play, RotateCcw, Settings, ExternalLink, ChevronDown, CheckCircle2 } from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface HeaderProps {
  mode: 'SIMULATION' | 'LIVE';
  portfolioSource?: 'ON_CHAIN_PROJECTION' | 'SIMULATED_PROJECTION';
  pythSource?: string;
  walletAddress?: string;
  walletBalanceSol?: number | null;
  vaultPda?: string;
  policyPda?: string;
  onToggleMode: () => void;
  onRunDemo: () => void;
  onRunPreStocksDemo?: () => void;
  onRunMeteoraDemo?: () => void;
  onRunPythDemo?: () => void;
  onReset: () => void;
  onNavigateToOverview?: () => void;
  isRunningDemo: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  portfolioSource = 'SIMULATED_PROJECTION',
  pythSource = 'Pyth Benchmark',
  walletAddress,
  walletBalanceSol,
  vaultPda,
  policyPda,
  onToggleMode,
  onRunDemo,
  onRunPreStocksDemo,
  onRunMeteoraDemo,
  onRunPythDemo,
  onReset,
  onNavigateToOverview,
  isRunningDemo,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDemoMenuOpen, setIsDemoMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const demoMenuRef = useRef<HTMLDivElement>(null);

  const isOnChainState = portfolioSource === 'ON_CHAIN_PROJECTION';

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (demoMenuRef.current && !demoMenuRef.current.contains(event.target as Node)) {
        setIsDemoMenuOpen(false);
      }
    };
    if (isSettingsOpen || isDemoMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen, isDemoMenuOpen]);

  return (
    <header className="border-b border-sentinel-border bg-sentinel-surface/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Subtitle (Clickable to Overview) */}
        <button
          type="button"
          onClick={onNavigateToOverview}
          className="flex items-center gap-3 text-left cursor-pointer group focus:outline-none shrink-0"
        >
          <div className="relative w-9 h-9 rounded-lg bg-sentinel-surfaceElevated border border-sentinel-border flex items-center justify-center shrink-0 p-1 group-hover:border-cyan-400/50 transition-all shadow-xs">
            <Image
              src="/Sentinel_Logo.png"
              alt="Sentinel Logo"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-wider text-white group-hover:text-cyan-300 transition-colors">
                SENTINEL
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sentinel-surfaceElevated text-sentinel-textMuted font-medium border border-sentinel-border font-mono tracking-tight">
                ROBO-01
              </span>
            </div>
            <p className="text-[11px] text-sentinel-textSubtle hidden lg:block tracking-tight">
              Outcome-Bounded Autonomous Portfolios on Solana
            </p>
          </div>
        </button>

        {/* Action Controls & Top Right */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Subtle Environment State Pill Indicator */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium ${
              mode === 'LIVE'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
            title={`Environment: ${mode === 'LIVE' ? 'Solana Devnet Live' : 'Deterministic Simulation'}. Open Settings to change.`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${mode === 'LIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="tracking-tight">{mode === 'LIVE' ? 'Devnet Live' : 'Simulated'}</span>
          </div>

          {/* Quick Demo Runner with Restrained Dropdown */}
          <div className="relative" ref={demoMenuRef}>
            <button
              type="button"
              onClick={() => setIsDemoMenuOpen(!isDemoMenuOpen)}
              disabled={isRunningDemo}
              className="h-9 px-2.5 sm:px-3 rounded-lg bg-sentinel-surfaceElevated hover:bg-sentinel-surfaceMuted border border-sentinel-border text-sentinel-text hover:text-white text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              title="Run Demo Scenarios"
            >
              <Play className={`w-3.5 h-3.5 text-cyan-400 ${isRunningDemo ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-sans">{isRunningDemo ? 'Running...' : 'Run Demo'}</span>
              <span className="sm:hidden font-sans">{isRunningDemo ? '...' : 'Demo'}</span>
              <ChevronDown className="w-3 h-3 text-sentinel-textSubtle" />
            </button>

            {/* Demo Scenarios Dropdown Menu */}
            {isDemoMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-sentinel-surface border border-sentinel-border rounded-xl shadow-2xl z-50 p-2 text-xs font-mono animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider px-2.5 py-1.5 font-bold font-sans">
                  Select Demo Scenario
                </div>

                {/* Scenario 1: Flagship */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDemoMenuOpen(false);
                    onRunDemo();
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 transition flex items-start gap-2.5 cursor-pointer group"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-white group-hover:text-cyan-300 transition flex items-center gap-1 font-sans">
                      Flagship: Robo Adaptation
                    </div>
                    <div className="text-[11px] text-sentinel-textMuted mt-0.5 font-mono">
                      NVDA $15k momentum ➔ Reverted (35% &gt; 25%) ➔ Auto-adapts $5k
                    </div>
                  </div>
                </button>

                {/* Scenario 2: PreStocks */}
                {onRunPreStocksDemo && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDemoMenuOpen(false);
                      onRunPreStocksDemo();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 border-t border-sentinel-border/50 transition flex items-start gap-2.5 cursor-pointer group mt-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-purple-300 transition flex items-center gap-1.5 font-sans">
                        <span>PreStocks Pre-IPO Ceiling</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">Pre-IPO</span>
                      </div>
                      <div className="text-[11px] text-sentinel-textMuted mt-0.5 font-mono">
                        OPENAI $30k ➔ Reverted (48% &gt; 20% Pre-IPO cap) ➔ Auto-adapts under cap
                      </div>
                    </div>
                  </button>
                )}

                {/* Scenario 3: Meteora */}
                {onRunMeteoraDemo && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDemoMenuOpen(false);
                      onRunMeteoraDemo();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 border-t border-sentinel-border/50 transition flex items-start gap-2.5 cursor-pointer group mt-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-emerald-300 transition flex items-center gap-1.5 font-sans">
                        <span>Meteora DBC Liquidity Guard</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">DBC Curve</span>
                      </div>
                      <div className="text-[11px] text-sentinel-textMuted mt-0.5 font-mono">
                        Sentinel Equity Guard: Blocks trade on shallow DBC pool depth
                      </div>
                    </div>
                  </button>
                )}

                {/* Scenario 4: Pyth Security Input */}
                {onRunPythDemo && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDemoMenuOpen(false);
                      onRunPythDemo();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 border-t border-sentinel-border/50 transition flex items-start gap-2.5 cursor-pointer group mt-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-amber-300 transition flex items-center gap-1.5 font-sans">
                        <span>Pyth Oracle Security Guard</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">Hermes</span>
                      </div>
                      <div className="text-[11px] text-sentinel-textMuted mt-0.5 font-mono">
                        Stale quote (140s &gt; 60s) ➔ Security Refusal ➔ Pyth pull update ➔ Settled
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Connected Wallet Adapter Button */}
          <div className="wallet-button-container text-xs">
            <WalletMultiButtonDynamic />
          </div>

          {/* Settings / Controls Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-sentinel-surfaceElevated hover:bg-sentinel-surfaceMuted border border-sentinel-border text-sentinel-textMuted hover:text-white transition cursor-pointer"
              title="Execution & Protocol Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Dropdown Popover */}
            {isSettingsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-xl bg-sentinel-surface border border-sentinel-border shadow-2xl p-4 space-y-4 z-50 text-xs font-sans animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-sentinel-border text-sentinel-textSubtle font-semibold uppercase text-[10px]">
                  <span>System Controls &amp; Architecture</span>
                  <span className="font-mono text-emerald-400">v1.2.0</span>
                </div>

                {/* Execution Mode Segmented Control */}
                <div>
                  <span className="text-sentinel-textMuted block text-[11px] mb-1.5 font-medium uppercase tracking-wider">
                    Execution Mode
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-sentinel-surfaceElevated rounded-lg border border-sentinel-border font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (mode !== 'SIMULATION') onToggleMode();
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition cursor-pointer ${
                        mode === 'SIMULATION'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                          : 'text-sentinel-textMuted hover:text-white'
                      }`}
                    >
                      Simulated
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (mode !== 'LIVE') onToggleMode();
                      }}
                      className={`py-1.5 px-2 rounded-md font-medium text-center transition cursor-pointer ${
                        mode === 'LIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                          : 'text-sentinel-textMuted hover:text-white'
                      }`}
                    >
                      Devnet Live
                    </button>
                  </div>
                  <p className="text-[10px] text-sentinel-textSubtle mt-1.5 leading-relaxed font-sans">
                    {mode === 'LIVE'
                      ? 'Solana Devnet: Submits transactions to Anchor program with connected wallet signature.'
                      : 'Simulation: Deterministic local SDK sandbox testing invariant proofs.'}
                  </p>
                </div>

                {/* Reset Portfolio */}
                <div>
                  <span className="text-sentinel-textMuted block text-[11px] mb-1.5 font-medium uppercase tracking-wider">
                    State Controls
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onReset();
                      setIsSettingsOpen(false);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-sentinel-surfaceElevated hover:bg-slate-800 border border-sentinel-border text-white text-xs font-mono flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Reset Reference Portfolio</span>
                  </button>
                </div>

                {/* Connected Wallet Info (if connected) */}
                {walletAddress && (
                  <div className="pt-2 border-t border-sentinel-border text-[11px] space-y-1 font-mono">
                    <div className="flex items-center justify-between text-sentinel-textMuted">
                      <span>Connected Wallet:</span>
                      <span className="text-white font-semibold">{formatAddress(walletAddress, 4)}</span>
                    </div>
                    {walletBalanceSol !== undefined && walletBalanceSol !== null && (
                      <div className="flex items-center justify-between text-sentinel-textMuted">
                        <span>Balance:</span>
                        <span className="text-emerald-400 font-semibold">{walletBalanceSol.toFixed(3)} SOL</span>
                      </div>
                    )}
                    <div className="flex justify-end pt-0.5">
                      <a
                        href={getExplorerAddressUrl(walletAddress)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px]"
                      >
                        <span>View on Solana Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Protocol Telemetry & PDAs */}
                <div className="pt-2 border-t border-sentinel-border text-[11px] space-y-1.5 font-mono">
                  <div className="text-[10px] font-bold text-sentinel-textSubtle uppercase tracking-wider mb-1 font-sans">
                    Protocol Architecture
                  </div>
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>Cluster:</span>
                    <span className="text-emerald-400 font-bold">{APP_CONFIG.clusterLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>Anchor Program:</span>
                    <a
                      href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px]"
                    >
                      <span>{formatAddress(APP_CONFIG.sentinelProgramId, 4)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {vaultPda && (
                    <div className="flex items-center justify-between text-sentinel-textMuted">
                      <span>Vault PDA:</span>
                      <a
                        href={getExplorerAddressUrl(vaultPda)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px]"
                      >
                        <span>{formatAddress(vaultPda, 4)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {policyPda && (
                    <div className="flex items-center justify-between text-sentinel-textMuted">
                      <span>Policy PDA:</span>
                      <a
                        href={getExplorerAddressUrl(policyPda)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px]"
                      >
                        <span>{formatAddress(policyPda, 4)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>State Source:</span>
                    <span className="text-amber-300 text-[10px]">
                      {isOnChainState ? 'On-Chain SPL RPC' : 'Simulated Projection'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>Oracle Feed:</span>
                    <span className="text-purple-400 text-[10px]">{pythSource}</span>
                  </div>
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>Proof Engine:</span>
                    <span className="text-slate-300 text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      PROVN SHA-256
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
