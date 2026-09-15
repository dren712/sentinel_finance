'use client';

import React, { useState } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
} from '@sentinel/domain';
import { AutonomousRoboAgent } from '@sentinel/sdk';
import {
  Bot,
  Key,
  Target,
  Play,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

interface AgentViewProps {
  agent: AutonomousRoboAgent;
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  onExecuteCustomTrade: (assetSymbol: string, direction: 'BUY' | 'SELL', amountUsd: number) => void;
  isRunningTrade: boolean;
}

export const AgentView: React.FC<AgentViewProps> = ({
  agent,
  portfolio,
  policy,
  onExecuteCustomTrade,
  isRunningTrade,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('NVDAx');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeAmount, setTradeAmount] = useState('15000');

  const copyAuthority = () => {
    navigator.clipboard.writeText(agent.wallet.getPublicKeyString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return;
    onExecuteCustomTrade(selectedAsset, direction, amount);
  };

  return (
    <div className="space-y-6">
      {/* Agent Identity & Status Card */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-sentinel-cardBorder">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white">{agent.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  AUTONOMOUS ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Authorized via ClawPump Autonomous Agent Wallet protocol
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status Mode:</span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-xs font-mono border border-slate-700">
              Deterministic Invariant-Bound
            </span>
          </div>
        </div>

        {/* Agent Authority & Key Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>AGENT AUTHORITY WALLET</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-white truncate">
                {agent.wallet.getPublicKeyString()}
              </span>
              <button
                onClick={copyAuthority}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                title="Copy Agent Public Key"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Registered in on-chain AgentAccount PDA
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              <span>CURRENT MANDATE</span>
            </div>
            <div className="mt-2 font-semibold text-xs text-white">
              {agent.objective}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Target: Maximize NVDAx up to 25.00% policy ceiling
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>AUTHORITY RESTRICTION</span>
            </div>
            <div className="mt-2 text-xs text-amber-300 font-semibold">
              Zero Unchecked Authority
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Cannot settle state that violates policy v{policy.policyVersion}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Trade Proposer: Test Sentinel Limits Interactively */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Interactive Autonomous Trade Generator</span>
            <span className="text-xs font-normal text-slate-400">(Test Any Guarantee Limit)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Propose custom trade intents through the autonomous agent to observe how Sentinel PTA validates or rejects them.
          </p>
        </div>

        <form onSubmit={handleCustomSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              TARGET EQUITY ASSET
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {portfolio.assets
                .filter((a) => !a.isStablecoin)
                .map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol} ({a.name})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              DIRECTION
            </label>
            <div className="flex rounded-lg bg-slate-900 border border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                  direction === 'BUY'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                  direction === 'SELL'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              PROPOSED TRADE VALUE (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-500">$</span>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                min="100"
                step="500"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                placeholder="10000"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isRunningTrade}
              className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50 transition cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTrade ? 'animate-spin' : ''}`} />
              <span>{isRunningTrade ? 'Evaluating PTA...' : 'Propose to Sentinel'}</span>
            </button>
          </div>
        </form>

        {/* Quick Test Presets */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Quick Test Presets:</span>
          <button
            type="button"
            onClick={() => {
              setSelectedAsset('NVDAx');
              setDirection('BUY');
              setTradeAmount('15000');
            }}
            className="px-2.5 py-1 rounded bg-red-950/40 text-red-300 border border-red-800/40 hover:bg-red-900/40 transition text-[11px]"
          >
            Trigger Violations: BUY NVDAx $15,000 (Exceeds 25% exposure & $10k size)
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedAsset('NVDAx');
              setDirection('BUY');
              setTradeAmount('5000');
            }}
            className="px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/40 transition text-[11px]"
          >
            Trigger Settlement: BUY NVDAx $5,000 (Hits exactly 25.00% cap)
          </button>
        </div>
      </div>
    </div>
  );
};
