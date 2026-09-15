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
  Play,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';

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
  const [strategy, setStrategy] = useState<'Momentum Growth' | 'Balanced Allocation' | 'Conservative Capital Preservation'>('Momentum Growth');

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

  // Calculate pre-flight estimation
  const amountNum = parseFloat(tradeAmount) || 0;
  const targetAsset = portfolio.assets.find(a => a.symbol === selectedAsset);
  const currentAssetVal = targetAsset ? targetAsset.valueUsd : 0;
  const postAssetVal = direction === 'BUY' ? currentAssetVal + amountNum : Math.max(0, currentAssetVal - amountNum);
  const postExposureBps = Math.round((postAssetVal / portfolio.totalValueUsd) * 10_000);
  const willExceedExposure = postExposureBps > policy.maxSingleAssetBps;
  const willExceedTradeLimit = amountNum > policy.maxTradeValueUsd;
  const postUsdcVal = direction === 'BUY'
    ? portfolio.stablecoinValueUsd - amountNum
    : portfolio.stablecoinValueUsd + amountNum;
  const postReserveBps = Math.round((postUsdcVal / portfolio.totalValueUsd) * 10_000);
  const willBreachReserve = postReserveBps < policy.minStablecoinBps;

  const willBeRejected = willExceedExposure || willExceedTradeLimit || willBreachReserve;

  return (
    <div className="space-y-6">
      {/* 1. Agent Identity Card */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-sentinel-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-sentinel-accent">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-sentinel-text">{agent.name}</h2>
                <Badge variant="success" dot={true}>
                  AUTONOMOUS ACTIVE
                </Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1">
                Authorized via ClawPump Autonomous Agent Wallet protocol on Solana Devnet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-sentinel-textSubtle">Enforcement Mode:</span>
            <span className="px-2.5 py-1 rounded bg-sentinel-surfaceMuted text-sentinel-text font-mono border border-sentinel-border font-semibold">
              Deterministic Invariant-Bound
            </span>
          </div>
        </div>

        {/* 3 Detail Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          {/* Box 1: Agent Authority */}
          <div className="bg-sentinel-surfaceMuted rounded-lg p-4 border border-sentinel-border">
            <div className="flex items-center gap-2 text-xs text-sentinel-textSubtle font-semibold">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>AGENT AUTHORITY (ED25519)</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-white truncate">
                {formatAddress(agent.wallet.getPublicKeyString(), 10)}
              </span>
              <button
                onClick={copyAuthority}
                className="text-sentinel-textMuted hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                title="Copy Agent Public Key"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-1 text-[11px] text-sentinel-textSubtle">
              Detached cryptographic intent signer
            </div>
          </div>

          {/* Box 2: Active Strategy */}
          <div className="bg-sentinel-surfaceMuted rounded-lg p-4 border border-sentinel-border">
            <div className="text-xs text-sentinel-textSubtle font-semibold">
              ACTIVE STRATEGY
            </div>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="mt-1.5 w-full bg-sentinel-surface border border-sentinel-border rounded-md px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="Momentum Growth">Momentum Growth</option>
              <option value="Balanced Allocation">Balanced Allocation</option>
              <option value="Conservative Capital Preservation">Conservative Capital Preservation</option>
            </select>
            <div className="mt-1 text-[11px] text-sentinel-textSubtle">
              Rebalances equity basket dynamically
            </div>
          </div>

          {/* Box 3: Postcondition Guard */}
          <div className="bg-sentinel-surfaceMuted rounded-lg p-4 border border-sentinel-border">
            <div className="text-xs text-sentinel-textSubtle font-semibold">
              POSTCONDITION PROTECTION
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Sentinel Invariants Active</span>
            </div>
            <div className="mt-1 text-[11px] text-sentinel-textSubtle">
              Single cap: {(policy.maxSingleAssetBps / 100).toFixed(1)}% • Reserve: ≥ {(policy.minStablecoinBps / 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Custom Trade Proposer with Sentinel Pre-Flight Warning */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <div className="border-b border-sentinel-border pb-3">
          <h3 className="text-base font-bold text-sentinel-text">Propose Autonomous Decision</h3>
          <p className="text-xs text-sentinel-textMuted mt-0.5">
            Submit a trade intent from the agent authority. Sentinel evaluates invariants before state settlement.
          </p>
        </div>

        <form onSubmit={handleCustomSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Asset Selection */}
            <div>
              <label className="block text-xs font-semibold text-sentinel-textSubtle mb-1">
                TARGET ASSET
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full bg-sentinel-surfaceMuted border border-sentinel-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                {portfolio.assets
                  .filter((a) => !a.isStablecoin && a.symbol !== 'USDC')
                  .map((a) => (
                    <option key={a.symbol} value={a.symbol}>
                      {a.symbol} (${a.priceUsd.toFixed(2)})
                    </option>
                  ))}
              </select>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-xs font-semibold text-sentinel-textSubtle mb-1">
                DIRECTION
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('BUY')}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    direction === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-sentinel-surfaceMuted text-sentinel-textMuted border-sentinel-border hover:text-white'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SELL')}
                  className={`py-2 text-xs font-bold rounded-lg border transition ${
                    direction === 'SELL'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-sentinel-surfaceMuted text-sentinel-textMuted border-sentinel-border hover:text-white'
                  }`}
                >
                  SELL
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-sentinel-textSubtle mb-1">
                NOTIONAL AMOUNT (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-sentinel-textMuted">$</span>
                <input
                  type="number"
                  min="100"
                  step="500"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full bg-sentinel-surfaceMuted border border-sentinel-border rounded-lg pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Real-time Invariant Pre-Flight Warning Box */}
          <div
            className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
              willBeRejected
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold font-mono">
              {willBeRejected ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>PRE-FLIGHT CHECK: SENTINEL WILL ABORT THIS TRADE</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>PRE-FLIGHT CHECK: WITHIN COMPLIANT BOUNDS</span>
                </>
              )}
            </div>

            <div className="text-[11px] space-y-1 pl-6">
              <div>
                • {selectedAsset} Exposure: Currently {(currentAssetVal / portfolio.totalValueUsd * 100).toFixed(1)}% →{' '}
                <span className="font-bold">{(postExposureBps / 100).toFixed(1)}%</span> (Max allowed: {(policy.maxSingleAssetBps / 100).toFixed(1)}%)
                {willExceedExposure && <span className="text-rose-400 font-bold ml-1.5">[EXCEEDS CAP]</span>}
              </div>
              <div>
                • USDC Reserve: Currently {(portfolio.stablecoinExposureBps / 100).toFixed(1)}% →{' '}
                <span className="font-bold">{(postReserveBps / 100).toFixed(1)}%</span> (Floor: ≥ {(policy.minStablecoinBps / 100).toFixed(1)}%)
                {willBreachReserve && <span className="text-rose-400 font-bold ml-1.5">[BREACHES FLOOR]</span>}
              </div>
              {willExceedTradeLimit && (
                <div className="text-rose-400 font-bold">
                  • Trade size of {formatCurrency(amountNum)} exceeds policy max of {formatCurrency(policy.maxTradeValueUsd)}!
                </div>
              )}
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-sentinel-textSubtle">Test Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAsset('NVDAx');
                  setDirection('BUY');
                  setTradeAmount('15000');
                }}
                className="px-2.5 py-1 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40 text-xs font-mono hover:bg-rose-900/40"
              >
                $15,000 NVDA (Non-Compliant)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAsset('NVDAx');
                  setDirection('BUY');
                  setTradeAmount('5000');
                }}
                className="px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 text-xs font-mono hover:bg-emerald-900/40"
              >
                $5,000 NVDA (Compliant)
              </button>
            </div>

            <button
              type="submit"
              disabled={isRunningTrade}
              className="px-5 py-2 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTrade ? 'animate-spin' : ''}`} />
              <span>{isRunningTrade ? 'Evaluating Invariants...' : 'Submit Intent to Sentinel'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Narrative Decision Lifecycle Diagram */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-sentinel-text">Autonomous Decision Flow</h3>
        <p className="text-xs text-sentinel-textMuted">
          How Sentinel guarantees safety when an autonomous agent interacts with tokenized stocks on Solana:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border text-xs space-y-2">
            <div className="font-mono text-sentinel-accent font-bold">01. INTENT</div>
            <div className="font-semibold text-white">Agent Proposes Action</div>
            <p className="text-sentinel-textMuted text-[11px]">
              Agent generates trade intent with detached Ed25519 signature from ClawPump authority.
            </p>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border text-xs space-y-2">
            <div className="font-mono text-blue-400 font-bold">02. PREFLIGHT</div>
            <div className="font-semibold text-white">SWARM-Lite Verifiers</div>
            <p className="text-sentinel-textMuted text-[11px]">
              Off-chain verifiers simulate the state mutation and compute prospective exposure basis points.
            </p>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border text-xs space-y-2">
            <div className="font-mono text-purple-400 font-bold">03. ON-CHAIN GUARD</div>
            <div className="font-semibold text-white">Anchor Vault Check</div>
            <p className="text-sentinel-textMuted text-[11px]">
              Solana program mutates PortfolioVault PDA balances and checks all invariants in safe u128 math.
            </p>
          </div>

          <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border text-xs space-y-2">
            <div className="font-mono text-emerald-400 font-bold">04. SETTLEMENT / ROLLBACK</div>
            <div className="font-semibold text-white">Atomic Finality</div>
            <p className="text-sentinel-textMuted text-[11px]">
              If any invariant is breached, transaction reverts atomically. If valid, trade settles and PROVN records proof.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
