'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Shield, Play, RotateCcw, Activity } from 'lucide-react';

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
    <header className="border-b border-sentinel-cardBorder bg-sentinel-card/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider text-white">SENTINEL</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/30">
                ROBO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Guaranteed Postcondition Execution • Solana Tokenized Stocks
            </p>
          </div>
        </div>

        {/* Action Controls & Wallet */}
        <div className="flex items-center gap-3">
          {/* Mode Badge / Toggle */}
          <button
            onClick={onToggleMode}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              mode === 'LIVE'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/60'
                : 'bg-amber-950/60 border-amber-500/50 text-amber-400 hover:bg-amber-900/60'
            }`}
            title="Click to toggle between Simulation and Live Solana modes"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>MODE: {mode}</span>
          </button>

          {/* Reset Demo State */}
          <button
            onClick={onReset}
            disabled={isRunningDemo}
            className="p-2 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Reset Portfolio & Policy to reference state"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Core Demo Scenario Runner */}
          <button
            onClick={onRunDemo}
            disabled={isRunningDemo}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningDemo ? 'animate-spin' : ''}`} />
            <span>{isRunningDemo ? 'Running Agent Demo...' : 'Run Autonomous Demo'}</span>
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
