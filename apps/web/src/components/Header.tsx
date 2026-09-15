'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Shield, Play, RotateCcw, Activity } from 'lucide-react';
import { ClusterBadge } from './ui/ClusterBadge';

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
  return (
    <header className="border-b border-sentinel-border bg-sentinel-surface/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-sentinel-accent">
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
              <ClusterBadge showSubtitle={false} className="hidden md:inline-flex" />
            </div>
            <p className="text-[11px] text-sentinel-textMuted hidden sm:block">
              Autonomous Investing with Enforceable Financial Guarantees
            </p>
          </div>
        </div>

        {/* Action Controls & Wallet */}
        <div className="flex items-center gap-2.5">
          {/* Cluster Pill on small screens */}
          <div className="md:hidden">
            <ClusterBadge showSubtitle={false} />
          </div>

          {/* Mode Badge / Toggle */}
          <button
            onClick={onToggleMode}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === 'LIVE'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/60'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-400 hover:bg-amber-900/60'
            }`}
            title="Click to toggle between Simulation and Live Solana modes"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MODE:</span>
            <span>{mode}</span>
          </button>

          {/* Reset Demo State */}
          <button
            onClick={onReset}
            disabled={isRunningDemo}
            className="p-2 rounded-md bg-sentinel-surfaceMuted border border-sentinel-border text-sentinel-textMuted hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
            title="Reset Portfolio & Policy to default reference state"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Core Demo Scenario Runner */}
          <button
            onClick={onRunDemo}
            disabled={isRunningDemo}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningDemo ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isRunningDemo ? 'Running Agent Demo...' : 'Run Autonomous Demo'}
            </span>
            <span className="sm:hidden">Demo</span>
          </button>

          {/* Solana Wallet Adapter Button */}
          <div className="wallet-button-container text-xs">
            <WalletMultiButtonDynamic />
          </div>
        </div>
      </div>
    </header>
  );
};
