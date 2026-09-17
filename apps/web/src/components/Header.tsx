'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Shield, Play, RotateCcw, Activity, Settings, ExternalLink, Cpu } from 'lucide-react';
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
  onReset: () => void;
  isRunningDemo: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onToggleMode,
  onRunDemo,
  onReset,
  isRunningDemo,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

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
          {/* Devnet Cluster Pill */}
          <ClusterBadge showSubtitle={false} />

          {/* Quick Demo Runner */}
          <button
            onClick={onRunDemo}
            disabled={isRunningDemo}
            className="hidden sm:flex px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs items-center gap-2 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningDemo ? 'animate-spin' : ''}`} />
            <span>{isRunningDemo ? 'Evaluating...' : 'Demo Adapt Loop'}</span>
          </button>

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
