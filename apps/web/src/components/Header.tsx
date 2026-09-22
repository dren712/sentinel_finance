'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Shield, Play, RotateCcw, Activity, Settings, ExternalLink, Cpu, ChevronDown } from 'lucide-react';
import { ClusterBadge } from './ui/ClusterBadge';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface HeaderProps {
  mode: 'SIMULATION' | 'LIVE';
  onToggleMode: () => void;
  onRunDemo: () => void;
  onRunPreStocksDemo?: () => void;
  onRunMeteoraDemo?: () => void;
  onRunPythDemo?: () => void;
  onReset: () => void;
  isRunningDemo: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onToggleMode,
  onRunDemo,
  onRunPreStocksDemo,
  onRunMeteoraDemo,
  onRunPythDemo,
  onReset,
  isRunningDemo,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDemoMenuOpen, setIsDemoMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const demoMenuRef = useRef<HTMLDivElement>(null);

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
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-sentinel-accent shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-wider text-sentinel-text">
                SENTINEL
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/30">
                ROBO
              </span>
            </div>
            <p className="text-[11px] text-sentinel-textMuted hidden sm:block">
              Autonomous Investing with Enforceable Financial Guarantees
            </p>
          </div>
        </div>

        {/* Action Controls & Top Right */}
        <div className="flex items-center gap-2.5">
          {/* Interactive Dual-Mode Badge (DEVNET vs SIMULATION) */}
          <button
            type="button"
            onClick={onToggleMode}
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition cursor-pointer ${
              mode === 'LIVE'
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 shadow-sm shadow-emerald-950'
                : 'bg-amber-950/50 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
            }`}
            title={`Active Mode: ${mode}. Click to switch to ${mode === 'LIVE' ? 'SIMULATION' : 'DEVNET LIVE'} mode.`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  mode === 'LIVE' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  mode === 'LIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="font-semibold tracking-wider">
              {mode === 'LIVE' ? 'DEVNET LIVE' : 'SIMULATION'}
            </span>
          </button>

          {/* Quick Demo Runner with Dropdown */}
          <div className="relative" ref={demoMenuRef}>
            <div className="hidden sm:flex items-center">
              <button
                onClick={onRunDemo}
                disabled={isRunningDemo}
                className="px-3 py-2 rounded-l-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer border-r border-blue-700"
                title="Run Flagship 5-Step Autonomous Demo"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningDemo ? 'animate-spin' : ''}`} />
                <span>{isRunningDemo ? 'Demo Running...' : 'Demo Scenarios'}</span>
              </button>
              <button
                onClick={() => setIsDemoMenuOpen(!isDemoMenuOpen)}
                disabled={isRunningDemo}
                className="px-2 py-2 rounded-r-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                title="Select Demo Scenario (Flagship, PreStocks $10K, Meteora $5K)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Demo Scenarios Dropdown Menu */}
            {isDemoMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-sentinel-surface border border-sentinel-border rounded-xl shadow-2xl z-50 p-2 text-xs font-mono">
                <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider px-2.5 py-1.5 font-bold">
                  Select Demo Scenario
                </div>

                {/* Scenario 1: Flagship */}
                <button
                  onClick={() => {
                    setIsDemoMenuOpen(false);
                    onRunDemo();
                  }}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 transition flex items-start gap-2.5 cursor-pointer group"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0" />
                  <div>
                    <div className="font-semibold text-white group-hover:text-blue-400 transition flex items-center gap-1">
                      Flagship: Robo Adaptation
                    </div>
                    <div className="text-[11px] text-sentinel-textMuted mt-0.5">
                      NVDA $15k momentum ➔ Reverted (35% &gt; 25%) ➔ Auto-adapts $5k
                    </div>
                  </div>
                </button>

                {/* Scenario 2: PreStocks $10K */}
                {onRunPreStocksDemo && (
                  <button
                    onClick={() => {
                      setIsDemoMenuOpen(false);
                      onRunPreStocksDemo();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-purple-950/40 border-t border-sentinel-border/50 transition flex items-start gap-2.5 cursor-pointer group mt-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-purple-400 transition flex items-center gap-1.5">
                        <span>PreStocks ($10K Bounty)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">$10K</span>
                      </div>
                      <div className="text-[11px] text-sentinel-textMuted mt-0.5">
                        OPENAI $30k ➔ Reverted (48% &gt; 20% Pre-IPO cap) ➔ Auto-adapts under cap
                      </div>
                    </div>
                  </button>
                )}

                {/* Scenario 3: Meteora $5K */}
                {onRunMeteoraDemo && (
                  <button
                    onClick={() => {
                      setIsDemoMenuOpen(false);
                      onRunMeteoraDemo();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-emerald-950/40 border-t border-sentinel-border/50 transition flex items-start gap-2.5 cursor-pointer group mt-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-emerald-400 transition flex items-center gap-1.5">
                        <span>Meteora ($5K Bounty)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">$5K</span>
                      </div>
                      <div className="text-[11px] text-sentinel-textMuted mt-0.5">
                        Sentinel Equity Market Guard: Blocks trade on shallow DBC pool depth
                      </div>
                    </div>
                  </button>
                )}

                {/* Scenario 4: Pyth Security Input */}
                {onRunPythDemo && (
                  <button
                    onClick={() => {
                      setIsDemoMenuOpen(false);
                      onRunPythDemo();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-amber-950/40 border-t border-sentinel-border/50 transition flex items-start gap-2.5 cursor-pointer group mt-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-white group-hover:text-amber-400 transition flex items-center gap-1.5">
                        <span>Pyth Oracle Security Guard</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">Pyth Pro</span>
                      </div>
                      <div className="text-[11px] text-sentinel-textMuted mt-0.5">
                        Stale quote (140s &gt; 60s) ➔ Execution Refused ➔ Pyth pull update ➔ Settled
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
              className="p-2 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-sentinel-textMuted hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Execution & Protocol Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isSettingsOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-sentinel-surface border border-sentinel-border shadow-2xl p-4 space-y-3 z-50 text-xs font-sans animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-sentinel-border text-sentinel-textSubtle font-semibold uppercase text-[10px]">
                  <span>System Controls</span>
                  <span className="font-mono text-emerald-400">v1.2.0</span>
                </div>

                {/* Mode Toggle */}
                <div>
                  <span className="text-sentinel-textMuted block text-[11px] mb-1.5 font-medium">
                    EXECUTION MODE
                  </span>
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between transition cursor-pointer ${
                      mode === 'LIVE'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5" />
                      <span>{mode === 'LIVE' ? 'Solana Devnet (Live)' : 'Simulation (Deterministic)'}</span>
                    </div>
                    <span className="text-[10px] underline">Switch</span>
                  </button>
                </div>

                {/* Reset Portfolio */}
                <div>
                  <span className="text-sentinel-textMuted block text-[11px] mb-1.5 font-medium">
                    STATE REINITIALIZATION
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onReset();
                      setIsSettingsOpen(false);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-sentinel-surfaceMuted hover:bg-slate-800 border border-sentinel-border text-white text-xs font-mono flex items-center gap-2 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                    <span>Reset to Reference Portfolio</span>
                  </button>
                </div>

                {/* Anchor Program Link */}
                <div className="pt-2 border-t border-sentinel-border text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>Anchor Program:</span>
                    <a
                      href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-[10px]"
                    >
                      <span>{formatAddress(APP_CONFIG.sentinelProgramId, 4)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-sentinel-textMuted">
                    <span>Market Data:</span>
                    <span className="text-purple-400 font-mono text-[10px]">Pyth Network</span>
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
