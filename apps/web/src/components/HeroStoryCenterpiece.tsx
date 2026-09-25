'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Bot,
  Zap,
  Lock,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { PortfolioSnapshot, FinancialPolicy, EvidenceRecord } from '@sentinel/domain';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { FlagshipEnforcementCard } from './ui/FlagshipEnforcementCard';

export type DemoScenarioKey = 'FLAGSHIP' | 'PRESTOCKS' | 'METEORA' | 'PYTH';

interface HeroStoryCenterpieceProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  latestEvidence?: EvidenceRecord | null;
  onRunAdaptation?: () => void;
  isRunningAdaptation?: boolean;
  onNavigateToDecisions?: () => void;
  onNavigateToProtection?: () => void;
  selectedScenario?: DemoScenarioKey;
  onSelectScenario?: (scenario: DemoScenarioKey) => void;
  demoStep?: number;
  totalDemoSteps?: number;
}

export const HeroStoryCenterpiece: React.FC<HeroStoryCenterpieceProps> = ({
  portfolio,
  policy,
  latestEvidence,
  onRunAdaptation,
  isRunningAdaptation = false,
  onNavigateToDecisions,
  onNavigateToProtection,
  selectedScenario = 'FLAGSHIP',
  onSelectScenario,
  demoStep = 0,
}) => {
  const [internalScenario, setInternalScenario] = useState<DemoScenarioKey>('FLAGSHIP');
  const activeScenario = selectedScenario ?? internalScenario;

  const handleScenarioChange = (scenario: DemoScenarioKey) => {
    setInternalScenario(scenario);
    onSelectScenario?.(scenario);
  };

  return (
    <div className="bg-sentinel-surface border border-sentinel-borderStrong rounded-2xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">

      {/* TOP HEADER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              AUTHORITATIVE ON-CHAIN ENFORCEMENT
            </span>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">Solana Devnet</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 font-mono uppercase">
            What did the agent try to do?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            The AI agent proposes any trade it wants. Sentinel enforces postconditions on Solana before state commit, atomically aborting any violation.
          </p>
        </div>

        {/* Action Button & Scenario Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Scenario Tabs */}
          <div className="flex flex-wrap items-center p-1 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => handleScenarioChange('FLAGSHIP')}
              className={`px-2.5 py-1 rounded font-semibold sentinel-interactive sentinel-focus cursor-pointer ${
                activeScenario === 'FLAGSHIP'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Case A: Agent Trust (NVDAx)
            </button>
            <button
              type="button"
              onClick={() => handleScenarioChange('METEORA')}
              className={`px-2.5 py-1 rounded font-semibold sentinel-interactive sentinel-focus cursor-pointer ${
                activeScenario === 'METEORA'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Case B: Market Trust (Meteora)
            </button>
            <button
              type="button"
              onClick={() => handleScenarioChange('PYTH')}
              className={`px-2.5 py-1 rounded font-semibold sentinel-interactive sentinel-focus cursor-pointer ${
                activeScenario === 'PYTH'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Case C: Data Trust (Pyth)
            </button>
            <button
              type="button"
              onClick={() => handleScenarioChange('PRESTOCKS')}
              className={`px-2.5 py-1 rounded font-semibold sentinel-interactive sentinel-focus cursor-pointer ${
                activeScenario === 'PRESTOCKS'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PreStocks ($10K)
            </button>
          </div>

          {/* Trigger Adaptation */}
          {onRunAdaptation && (
            <button
              type="button"
              onClick={onRunAdaptation}
              disabled={isRunningAdaptation}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50 sentinel-interactive sentinel-focus cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningAdaptation ? 'animate-spin' : ''}`} />
              <span>{isRunningAdaptation ? 'Evaluating...' : 'Replay Enforcement'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KILLER ARCHITECTURAL PIPELINE (Scroll-Craft Visual Flow) */}
      <div className="mt-4 p-3.5 rounded-xl bg-sentinel-surfaceMuted/90 border border-sentinel-border relative z-10 font-mono">
        <div className="flex items-center justify-between text-[10px] text-sentinel-textSubtle uppercase tracking-wider mb-2.5">
          <span className="font-bold text-sentinel-text">Sentinel State Pipeline</span>
          <span className="text-sentinel-accent font-semibold">Solana Invariant Gate</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-sentinel-surface border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block uppercase">1. Agent</span>
            <span className="font-bold text-sentinel-text">robo-01</span>
          </div>
          <div className="p-2 rounded-lg bg-sentinel-surface border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block uppercase">2. Intent</span>
            <span className="font-bold text-rose-400">BUY $15K</span>
          </div>
          <div className="p-2 rounded-lg bg-sentinel-surface border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block uppercase">3. Sentinel</span>
            <span className="font-bold text-amber-400">Post-State</span>
          </div>
          <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30">
            <span className="text-[10px] text-rose-300 block uppercase">4. Blocked</span>
            <span className="font-bold text-rose-400">3 Breaches</span>
          </div>
          <div className="p-2 rounded-lg bg-sentinel-surface border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block uppercase">5. Adapted</span>
            <span className="font-bold text-emerald-400">BUY $5K</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
            <span className="text-[10px] text-emerald-300 block uppercase">6. Proof</span>
            <span className="font-bold text-emerald-400">PROVN v2</span>
          </div>
        </div>
      </div>

      {/* THREE AUTONOMOUS FLAGSHIP AHA CASES */}
      <div className="mt-4 pt-3 pb-3 border-b border-slate-800/80 space-y-2 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
            SENTINEL DOES NOT BLINDLY TRUST: THE AGENT · THE MARKET · THE DATA
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            3 Flagship Aha Demonstrations
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
          <div className={`p-2.5 rounded-lg border transition ${
            activeScenario === 'FLAGSHIP' || activeScenario === 'PRESTOCKS'
              ? 'bg-blue-950/30 border-blue-500/40 text-blue-300'
              : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Case A · Doesn't Trust The Agent
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              <strong>Portfolio Invariant Breach</strong>: BUY NVDAx $15k ➔ Concentration (35% &gt; 25%) ➔ <strong>BLOCK</strong> ➔ <strong>ADAPT</strong> ➔ BUY $5k.
            </p>
          </div>

          <div className={`p-2.5 rounded-lg border transition ${
            activeScenario === 'METEORA'
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Case B · Doesn't Trust The Market
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              <strong>Meteora Curve Impact</strong>: BUY $8k ➔ DBC price impact 1.70% &gt; 1.00% cap ➔ <strong>BLOCK</strong> ➔ <strong>ADAPT along curve</strong> ➔ BUY $2,500.
            </p>
          </div>

          <div className={`p-2.5 rounded-lg border transition ${
            activeScenario === 'PYTH'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Case C · Doesn't Trust The Data
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              <strong>Pyth Oracle Freshness</strong>: BUY $4k ➔ Quote stale 140s &gt; 60s ➔ <strong>BLOCK</strong> ➔ <strong>WAIT / REPRICE</strong> via Hermès ➔ Settle fresh.
            </p>
          </div>
        </div>
      </div>

      {/* SCENARIO 1: FLAGSHIP (NVDAx $15K -> 3 FAILURES -> $5K -> APPROVED) */}
      {activeScenario === 'FLAGSHIP' && (
        <div className="mt-5 space-y-5 relative z-10">
          {/* P18 + P19: THE IMMACULATE SINGLE SCREEN + VERIFIED SENTINEL RECEIPT */}
          <FlagshipEnforcementCard
            latestEvidence={latestEvidence}
            onRunAdaptation={onRunAdaptation}
            isRunningAdaptation={isRunningAdaptation}
            onViewFullReceipt={onNavigateToDecisions}
          />
        </div>
      )}

      {/* SCENARIO 2: PRESTOCKS ($10,000 BOUNTY) */}
      {activeScenario === 'PRESTOCKS' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-stretch">
            {/* PROPOSED */}
            <div className="md:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase block">
                  PROPOSED
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    BUY OPENAIx
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-purple-400">
                    $5,000
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  PreStocks Secondary · Single-trade sizing ($5k ≤ $10k cap) PASSES
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Asset Class: Pre-IPO</span>
                <span className="text-emerald-400 font-semibold">Trade Sizing: OK</span>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="md:col-span-2 hidden md:flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-1">
                ASSET CLASS CHECK
              </span>
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-rose-400 shadow-sm">
                <ArrowRight className="w-5 h-5 animate-pulse" />
              </div>
              <span className="text-[9px] font-mono text-slate-500 mt-1">Pre-IPO Cap (20%)</span>
            </div>

            {/* SENTINEL BLOCKED */}
            <div className="md:col-span-5 bg-rose-950/25 border border-rose-500/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg shadow-rose-950/20">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-rose-400 uppercase block">
                    SENTINEL
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    PORTFOLIO FAILURE
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xl sm:text-2xl font-black font-mono text-rose-400 tracking-tight">
                  <XCircle className="w-6 h-6 shrink-0" />
                  <span>BLOCKED</span>
                </div>
                <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">
                  Pre-IPO allocation would reach 23.0% ($23,000 / $100k), breaching the 20.0% ($20,000) Pre-IPO ceiling. Trade size was compliant, but portfolio asset class invariant failed.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-rose-500/20 flex items-center justify-between text-[11px] font-mono text-rose-300 font-semibold">
                <span>Pre-IPO: 18% → 23%</span>
                <span>Policy Ceiling: 20.0%</span>
              </div>
            </div>
          </div>

          {/* ADAPTATION BRIDGE */}
          <div className="bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-slate-950 border border-purple-500/30 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white uppercase tracking-wider">ROBO-01</span>
                  <span className="text-purple-400 font-bold">SOLVED CAPACITY: $2,000</span>
                </div>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  ($100,000 × 20% cap) - $18,000 current = exact $2,000 headroom remaining.
                </p>
              </div>
            </div>
            <span className="text-purple-300 text-[11px] font-semibold bg-purple-950/60 px-2.5 py-1 rounded border border-purple-500/20 self-start sm:self-auto">
              PreStocks Headroom Solver
            </span>
          </div>

          {/* NEW PROPOSAL & APPROVED */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-stretch">
            <div className="md:col-span-5 bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase block">
                  NEW PROPOSAL
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    BUY OPENAIx
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    $2,000
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  Calibrated to hit exactly 20.00% category allocation
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Result: 20.00% Pre-IPO</span>
                <span className="text-emerald-400 font-semibold">Exclusivity Verified</span>
              </div>
            </div>

            <div className="md:col-span-2 hidden md:flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 tracking-wider mb-1">
                VAULT ROUTE
              </span>
              <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-mono text-emerald-400 mt-1">PreStocks Secondary</span>
            </div>

            <div className="md:col-span-5 bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg shadow-emerald-950/20">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase block">
                    SENTINEL
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    SETTLED VIA PRESTOCKS
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <span>APPROVED</span>
                </div>
                <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                  Settled via PreStocks Secondary Vault PDA. 100% PreStocks certified ecosystem exclusivity preserved.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-mono text-emerald-300 font-semibold">
                <span>Vault: PreStkOPENAI...</span>
                <span>PROVN Receipt Sealed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCENARIO 3: METEORA ($5,000 BOUNTY) */}
      {activeScenario === 'METEORA' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-stretch">
            {/* PROPOSED */}
            <div className="md:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase block">
                  PROPOSED
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    BUY NVDAx
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-blue-400">
                    $8,000
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Meteora DBC Pool · Single-asset ($8k ≤ $10k ✓) &amp; Exposure (28% ≤ 30% ✓) PASS
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Portfolio Check: PASS</span>
                <span className="text-emerald-400 font-semibold">User Policy: OK</span>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="md:col-span-2 hidden md:flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-400 tracking-wider mb-1">
                MARKET GUARD
              </span>
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
                <ArrowRight className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-mono text-amber-400 mt-1">DBC Slippage &amp; Depth</span>
            </div>

            {/* SENTINEL MARKET GUARD BLOCKED */}
            <div className="md:col-span-5 bg-amber-950/25 border border-amber-500/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg shadow-amber-950/20">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase block">
                    SENTINEL EQUITY MARKET GUARD
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    MARKET FAILURE
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight">
                  <ShieldAlert className="w-6 h-6 shrink-0" />
                  <span>BLOCKED</span>
                </div>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  Estimated DBC curve price impact is 1.70% (170 bps), violating user max slippage limit of 1.00% (100 bps). Pool reserve ($12k &lt; $25k floor) is shallow.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] font-mono text-amber-300 font-semibold">
                <span>Impact: 1.70% &gt; 1.00% cap</span>
                <span>Protected from Toxic Slippage</span>
              </div>
            </div>
          </div>

          {/* ADAPTATION BRIDGE ALONG DBC CURVE */}
          <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-950 border border-amber-500/30 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white uppercase tracking-wider">ROBO-01</span>
                  <span className="text-amber-400 font-bold">SOLVED DBC CAPACITY: $2,500</span>
                </div>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Recomputed along Meteora DBC bonding curve: scaled down from $8,000 to $2,500 where price impact is 0.45% (≤ 1.00% slippage ceiling).
                </p>
              </div>
            </div>
            <span className="text-amber-300 text-[11px] font-semibold bg-amber-950/60 px-2.5 py-1 rounded border border-amber-500/20 self-start sm:self-auto">
              Curve Sizing Adapter
            </span>
          </div>

          {/* NEW PROPOSAL & APPROVED */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-stretch">
            <div className="md:col-span-5 bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase block">
                  ADAPTED PROPOSAL
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    BUY NVDAx
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    $2,500
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  Price impact along Meteora DBC curve: 0.45% (45 bps) ≤ 1.00% limit
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Impact: 0.45% ≤ 1.00%</span>
                <span className="text-emerald-400 font-semibold">Curve Verified</span>
              </div>
            </div>

            <div className="md:col-span-2 hidden md:flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 tracking-wider mb-1">
                METEORA DBC
              </span>
              <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-mono text-emerald-400 mt-1">Bonding Curve</span>
            </div>

            <div className="md:col-span-5 bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg shadow-emerald-950/20">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase block">
                    SENTINEL
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    SETTLED ON METEORA DBC
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <span>APPROVED</span>
                </div>
                <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                  Settled on-chain via Meteora DBC Bonding Curve PDA. Zero dislocation execution achieved.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-mono text-emerald-300 font-semibold">
                <span>Pool: Meteora NVDAx DBC</span>
                <span>PROVN Receipt Sealed</span>
              </div>
            </div>
          </div>

          {/* VALUE PROPOSITION BANNER */}
          <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-amber-400 font-bold text-sm">FORMULA:</span>
              <span className="text-slate-300">
                Meteora Market Quality + Sentinel Portfolio Protection = <strong className="text-white">Market Protection + Account Protection</strong>
              </span>
            </div>
            <span className="text-emerald-400 font-bold bg-emerald-950/50 px-2.5 py-1 rounded border border-emerald-500/30">
              Zero Dislocation Execution
            </span>
          </div>
        </div>
      )}

      {/* SCENARIO 4: PYTH SECURITY INPUT (STALE QUOTE -> PULL UPDATE -> SETTLE) */}
      {activeScenario === 'PYTH' && (
        <div className="mt-5 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-stretch">
            {/* STALE PROPOSAL */}
            <div className="md:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase block">
                  PROPOSED (STALE DATA)
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    BUY AAPLx
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                    $4,000
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Sizing ($4k ≤ $10k) &amp; Exposure (29% ≤ 30%) PASS · Oracle age is 140 seconds
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-amber-400">
                <span>Pyth Quote Age: 140s</span>
                <span className="text-rose-400 font-semibold">&gt; 60s Max Freshness</span>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="md:col-span-2 hidden md:flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-400 tracking-wider mb-1">
                SECURITY INPUT
              </span>
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
                <ArrowRight className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-mono text-amber-400 mt-1">Pyth Pull Guard</span>
            </div>

            {/* SENTINEL REFUSAL */}
            <div className="md:col-span-5 bg-rose-950/25 border border-rose-500/40 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-lg shadow-rose-950/20">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-rose-400 uppercase block">
                    SENTINEL
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    ERR_QUOTE_STALE
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xl sm:text-2xl font-black font-mono text-rose-400 tracking-tight">
                  <XCircle className="w-6 h-6 shrink-0" />
                  <span>REFUSED</span>
                </div>
                <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">
                  Pyth price quote is stale (140s &gt; 60s max allowed). Execution refused before submission.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-rose-500/20 flex items-center justify-between text-[11px] font-mono text-rose-300 font-semibold">
                <span>STALE / LOW CONFIDENCE</span>
                <span>➔ NO EXECUTION</span>
              </div>
            </div>
          </div>

          {/* HERMÈS PULL UPDATE */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-slate-950 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white uppercase tracking-wider">PYTH HERMÈS PULL UPDATE</span>
                  <span className="text-emerald-400 font-bold">FRESH TRUTH POSTED</span>
                </div>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Requested fresh price payload from Hermès API → Posted to Solana Devnet (Quote age: 2s).
                </p>
              </div>
            </div>
            <span className="text-emerald-300 text-[11px] font-semibold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/20 self-start sm:self-auto">
              Fresh Quote: ±$0.03
            </span>
          </div>

          {/* SETTLEMENT WITH FRESH TRUTH */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>TRADE EXECUTED WITH VERIFIED PYTH MARKET TRUTH</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-mono">
                BUY AAPLx $4,000 settled cleanly on-chain. PROVN logs authoritative oracle verification proof.
              </p>
            </div>
            {onNavigateToDecisions && (
              <button
                type="button"
                onClick={onNavigateToDecisions}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
              >
                <span>View Oracle Evidence</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
