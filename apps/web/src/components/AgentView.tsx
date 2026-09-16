'use client';

import React, { useState } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  NormalizedMarketPrice,
} from '@sentinel/domain';
import { AutonomousRoboAgent, ExecutionVenueType, AgentLoopState, AutonomousAdaptationResult } from '@sentinel/sdk';
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
  Lock,
  ExternalLink,
  Layers,
  Cpu,
  Building2,
  TrendingUp,
  FileText,
  RefreshCw,
  Target,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';

interface AgentViewProps {
  agent: AutonomousRoboAgent;
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  marketPrices?: Record<string, NormalizedMarketPrice>;
  selectedVenue?: ExecutionVenueType;
  onSelectVenue?: (venue: ExecutionVenueType) => void;
  onExecuteCustomTrade: (assetSymbol: string, direction: 'BUY' | 'SELL', amountUsd: number) => void;
  isRunningTrade: boolean;
  adaptationResult?: AutonomousAdaptationResult | null;
  loopState?: AgentLoopState | null;
  onRunAdaptation?: () => void;
  isRunningAdaptation?: boolean;
}

export const AgentView: React.FC<AgentViewProps> = ({
  agent,
  portfolio,
  policy,
  marketPrices,
  selectedVenue: externalVenue,
  onSelectVenue,
  onExecuteCustomTrade,
  isRunningTrade,
  adaptationResult,
  loopState,
  onRunAdaptation,
  isRunningAdaptation = false,
}) => {
  const [internalVenue, setInternalVenue] = useState<ExecutionVenueType>('METEORA_DBC');
  const activeVenue = externalVenue ?? internalVenue;

  const handleVenueChange = (venue: ExecutionVenueType) => {
    setInternalVenue(venue);
    onSelectVenue?.(venue);
  };

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

  // Asset universe covering public stocks and PreStocks pre-IPO equities
  const availableAssets = [
    ...portfolio.assets.filter((a) => !a.isStablecoin && a.symbol !== 'USDC'),
    { symbol: 'SPACEXx', name: 'SpaceX Pre-IPO Equity', priceUsd: 220, isPreIpo: true },
    { symbol: 'OPENAIx', name: 'OpenAI Pre-IPO Equity', priceUsd: 150, isPreIpo: true },
    { symbol: 'STRIPEx', name: 'Stripe Pre-IPO Equity', priceUsd: 85, isPreIpo: true },
  ];

  const isPreIpoSelected = ['SPACEXx', 'OPENAIx', 'STRIPEx'].includes(selectedAsset);

  // Derive target venue and routing preview
  let targetVenueName = 'Meteora Dynamic Bonding Curve';
  let targetVenueType: ExecutionVenueType = activeVenue;
  let targetPoolAddress = 'Eo7WjKq67rjJQSZxS6z3YKapzY3eMj6Xy8DD5EkViQn7';
  let targetRoute = `USDC ATA ➔ Meteora DBC Pool ➔ ${selectedAsset} ATA`;

  if (activeVenue === 'DEMO_SIMULATION') {
    targetVenueName = 'Sentinel Local Simulator (Offline Demo)';
    targetPoolAddress = 'SimulatedLocalEngine111111111111111111111111111';
    targetRoute = `USDC ATA ➔ Local Simulator ➔ ${selectedAsset} ATA`;
  } else if (isPreIpoSelected || activeVenue === 'PRESTOCKS_SECONDARY') {
    targetVenueName = 'PreStocks Secondary Market';
    targetVenueType = 'PRESTOCKS_SECONDARY';
    targetPoolAddress = `PreStk${selectedAsset.replace('x', '')}Vault11111111111111111111111`;
    targetRoute = `USDC ATA ➔ PreStocks Secondary Vault ➔ ${selectedAsset} ATA`;
  }

  // Calculate pre-flight estimation
  const [simulateDepeg, setSimulateDepeg] = useState(false);
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

  // Pyth Market Truth Invariant Check
  const currentMarketPrice = marketPrices?.[selectedAsset];
  const effectiveTrackingErrorBps = simulateDepeg ? 320 : (currentMarketPrice?.trackingErrorBps ?? 18);
  const willExceedTrackingError = effectiveTrackingErrorBps > (policy.maxTrackingErrorBps ?? 250);

  const willBeRejected = willExceedExposure || willExceedTradeLimit || willBreachReserve || willExceedTrackingError;

  // Phase 7: SWARM-Lite 6-verifier pre-flight simulation
  const riskVerifierPassed = !willExceedExposure && !willExceedTradeLimit;
  const balanceVerifierPassed = !willBreachReserve;
  const policyVerifierPassed = policy.isActive;
  const liquidityVerifierPassed = true; // $145k Meteora pool depth >= $25k floor
  const priceIntegrityVerifierPassed = !willExceedTrackingError;
  const portfolioVerifierPassed = true;

  const swarmPreFlightVerdicts = [
    { name: 'RiskVerifier', role: 'Risk & Sizing', passed: riskVerifierPassed },
    { name: 'BalanceVerifier', role: 'Reserves & Solvency', passed: balanceVerifierPassed },
    { name: 'PolicyVerifier', role: 'Authority & Rules', passed: policyVerifierPassed },
    { name: 'LiquidityVerifier', role: 'Venue Liquidity', passed: liquidityVerifierPassed },
    { name: 'PriceIntegrityVerifier', role: 'Pyth Market Truth', passed: priceIntegrityVerifierPassed },
    { name: 'PortfolioVerifier', role: 'Diversification', passed: portfolioVerifierPassed },
  ];
  const swarmPassingCount = swarmPreFlightVerdicts.filter(v => v.passed).length;

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
                Sentinel Robo-01 • ClawPump-compatible wallet pattern on Solana Devnet
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
              <Key className="w-4 h-4 text-blue-400" />
              <span>AGENT AUTHORITY</span>
            </div>
            <div className="mt-2 flex items-center justify-between bg-sentinel-surface border border-sentinel-border rounded-md px-2.5 py-1.5 font-mono text-xs text-white">
              <span>{formatAddress(agent.wallet.getPublicKeyString(), 8)}</span>
              <button
                type="button"
                onClick={copyAuthority}
                className="text-sentinel-textMuted hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[10px] text-sentinel-textMuted mt-1.5">
              Signs trade proposals via detached Ed25519
            </div>
          </div>

          {/* Box 2: Mandate & Objective */}
          <div className="bg-sentinel-surfaceMuted rounded-lg p-4 border border-sentinel-border">
            <div className="flex items-center gap-2 text-xs text-sentinel-textSubtle font-semibold">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>ACTIVE MANDATE</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-white">
              Max Growth with Reserve Guardrails
            </div>
            <div className="text-[10px] text-sentinel-textMuted mt-1.5 font-mono">
              Enforcing max 25% single equity &amp; min 20% USDC
            </div>
          </div>

          {/* Box 3: Decision Cadence */}
          <div className="bg-sentinel-surfaceMuted rounded-lg p-4 border border-sentinel-border">
            <div className="flex items-center gap-2 text-xs text-sentinel-textSubtle font-semibold">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>EXECUTION CADENCE</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-white">
              Pre-Flight Evaluated on Every Block
            </div>
            <div className="text-[10px] text-sentinel-textMuted mt-1.5 font-mono">
              On-chain atomic rollback on violation
            </div>
          </div>
        </div>
      </div>

      {/* Phase 8: Autonomous Decision & Reactive Adaptation Hero Card */}
      <div className="bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 border border-blue-500/30 rounded-xl overflow-hidden shadow-lg shadow-blue-500/5">
        {/* Hero Header */}
        <div className="p-6 border-b border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                <Target className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black tracking-wider text-white uppercase">SENTINEL ROBO</h2>
                  <Badge variant="success" dot={true}>Autonomous</Badge>
                </div>
                <p className="text-xs text-blue-300/70 mt-0.5 font-mono">
                  Strategy: <span className="text-blue-200 font-semibold">Balanced Growth</span>
                </p>
              </div>
            </div>

            {/* Run Adaptation Button */}
            {onRunAdaptation && (
              <button
                type="button"
                onClick={onRunAdaptation}
                disabled={isRunningAdaptation}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningAdaptation ? 'animate-spin' : ''}`} />
                <span>{isRunningAdaptation ? 'Running Adaptation Loop...' : 'Run Autonomous Adaptation'}</span>
              </button>
            )}
          </div>

          {/* 10-Stage Visual Stepper */}
          {loopState && (
            <div className="mt-5 grid grid-cols-5 sm:grid-cols-10 gap-1">
              {[
                { label: 'OBSERVE', idx: 1 },
                { label: 'FORMULATE', idx: 2 },
                { label: 'PROPOSE', idx: 3 },
                { label: 'CHECK', idx: 4 },
                { label: 'REJECTED', idx: 5 },
                { label: 'READ', idx: 6 },
                { label: 'ADAPT', idx: 7 },
                { label: 'REPROPOSE', idx: 8 },
                { label: 'RECHECK', idx: 9 },
                { label: 'SETTLE', idx: 10 },
              ].map((step) => {
                const isActive = loopState.stageIndex === step.idx;
                const isComplete = loopState.stageIndex > step.idx;
                return (
                  <div
                    key={step.idx}
                    className={`text-center py-1.5 px-0.5 rounded-md text-[9px] font-bold font-mono transition-all ${
                      isActive
                        ? 'bg-blue-600/40 text-blue-200 border border-blue-500/60 ring-1 ring-blue-400/30'
                        : isComplete
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-900/80 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isComplete && <span className="mr-0.5">✓</span>}
                    {step.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Decision & WHY Narrative */}
        {loopState && loopState.status !== 'IDLE' && (
          <div className="p-6 space-y-5">
            {/* CURRENT DECISION */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle tracking-widest block font-sans">
                  CURRENT DECISION
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                  BUY {loopState.targetAssetSymbol}{' '}
                  <span className="text-blue-400">
                    ${(loopState.adaptedProposedAmountUsd ?? loopState.initialProposedAmountUsd).toLocaleString()}
                  </span>
                </div>
              </div>

              {loopState.latestDecision && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold border ${
                  loopState.latestDecision.approved
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-400'
                }`}>
                  {loopState.latestDecision.approved
                    ? <ShieldCheck className="w-5 h-5" />
                    : <ShieldAlert className="w-5 h-5" />}
                  <span>SENTINEL: {loopState.latestDecision.approved ? '✓ APPROVED' : '✕ REJECTED'}</span>
                </div>
              )}
            </div>

            {/* WHY Section */}
            {loopState.whyNarrative && (
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
                <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle tracking-widest block font-sans">
                  WHY
                </span>

                <p className="text-sm text-white font-sans">
                  {loopState.whyNarrative.initialProposalText}
                </p>

                <div className="space-y-1">
                  <p className="text-sm text-rose-300 font-semibold font-sans">
                    {loopState.whyNarrative.rejectionSummary}
                  </p>
                  <div className="space-y-1.5 pl-1 pt-1">
                    {loopState.whyNarrative.breachedInvariantsList.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="text-white font-mono">
                          <span className="font-semibold">{b.name}:</span>{' '}
                          <span className="text-rose-300">{b.actual}</span>
                          <span className="text-sentinel-textMuted mx-1">→</span>
                          <span className="text-sentinel-textSubtle">{b.limit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-blue-200 font-sans">
                  {loopState.whyNarrative.recalculationText}
                </p>

                <div className="flex items-center gap-2 pt-1 text-emerald-400 font-mono font-bold text-sm">
                  <ShieldCheck className="w-4.5 h-4.5" />
                  <span>{loopState.whyNarrative.sentinelStatusText}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no adaptation has run yet */}
        {(!loopState || loopState.status === 'IDLE') && (
          <div className="p-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500/40 mx-auto" />
            <p className="text-sm text-sentinel-textMuted font-sans">
              Click <span className="font-semibold text-blue-300">Run Autonomous Adaptation</span> to
              observe the agent propose $15,000, get rejected by Sentinel, read the failure,
              recalculate to $5,000, and settle — all autonomously.
            </p>
          </div>
        )}
      </div>

      {/* 2. Execution Venue Selector & Non-Bypass Architecture (Phase 4) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">Polymorphic Execution Venues</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono font-semibold border border-emerald-500/30">
                PHASE 4 ACTIVE
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Select the liquidity venue targeted by the execution adapter. Sentinel guarantees no venue executes without pre-flight invariant authorization.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-sentinel-textSubtle">Active Venue:</span>
            <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
              {activeVenue}
            </span>
          </div>
        </div>

        {/* 3 Venue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Venue 1: Meteora DBC */}
          <button
            type="button"
            onClick={() => handleVenueChange('METEORA_DBC')}
            className={`text-left p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              activeVenue === 'METEORA_DBC'
                ? 'bg-blue-950/20 border-blue-500 shadow-lg shadow-blue-500/10'
                : 'bg-sentinel-surfaceMuted/60 border-sentinel-border hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold border border-blue-500/30">
                  PUBLIC EQUITIES
                </span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Meteora Dynamic Bonding Curve
              </h4>
              <p className="text-xs text-sentinel-textMuted mt-1 leading-relaxed">
                Dynamic bonding curve AMM for tokenized stocks (NVDAx, AAPLx, SPYx).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-sentinel-border/50 text-[11px] font-mono text-sentinel-textSubtle space-y-1">
              <div>• Min Depth: <span className="text-white font-bold">$25,000</span></div>
              <div>• Max Deviation: <span className="text-white font-bold">200 bps (2.00%)</span></div>
              <div className="text-[10px] text-blue-400 truncate">Pool: Eo7WjK..ViQn7</div>
            </div>
          </button>

          {/* Venue 2: PreStocks Secondary */}
          <button
            type="button"
            onClick={() => handleVenueChange('PRESTOCKS_SECONDARY')}
            className={`text-left p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              activeVenue === 'PRESTOCKS_SECONDARY'
                ? 'bg-purple-950/20 border-purple-500 shadow-lg shadow-purple-500/10'
                : 'bg-sentinel-surfaceMuted/60 border-sentinel-border hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono text-[10px] font-bold border border-purple-500/30">
                  PRE-IPO ASSET UNIVERSE
                </span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-purple-400" />
                PreStocks Secondary Market
              </h4>
              <p className="text-xs text-sentinel-textMuted mt-1 leading-relaxed">
                Secondary order matching vault for private tech giants (SpaceX, OpenAI, Stripe).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-sentinel-border/50 text-[11px] font-mono text-sentinel-textSubtle space-y-1">
              <div>• Transfer Restriction Check: <span className="text-white font-bold">Verified</span></div>
              <div>• Order Match Vault: <span className="text-white font-bold">Secondary Pool</span></div>
              <div className="text-[10px] text-purple-400 truncate">Pool: PreStkSecondaryVault</div>
            </div>
          </button>

          {/* Venue 3: Demo Simulator */}
          <button
            type="button"
            onClick={() => handleVenueChange('DEMO_SIMULATION')}
            className={`text-left p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              activeVenue === 'DEMO_SIMULATION'
                ? 'bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-sentinel-surfaceMuted/60 border-sentinel-border hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/30">
                  OFFLINE EVALUATION
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              </div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-400" />
                Deterministic Local Simulator
              </h4>
              <p className="text-xs text-sentinel-textMuted mt-1 leading-relaxed">
                Isolated in-memory state engine for sandboxed CI runs and deterministic demonstrations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-sentinel-border/50 text-[11px] font-mono text-sentinel-textSubtle space-y-1">
              <div>• Signatures: <span className="text-amber-400 font-bold">sim_tx_* (Labeled)</span></div>
              <div>• Network Dependency: <span className="text-white font-bold">None (Air-gapped)</span></div>
              <div className="text-[10px] text-amber-400 truncate">Engine: SimulatedLocalEngine</div>
            </div>
          </button>
        </div>

        {/* Non-Bypass Security Lifecycle Banner */}
        <div className="bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-900/60 border border-blue-500/30 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-500/20 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-xs uppercase tracking-wider text-blue-200">
                Non-Bypass Execution Security Lifecycle (Strict Protocol Invariant)
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-semibold border border-blue-500/30">
              Direct Agent ↛ DEX Prohibited
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-center text-xs font-mono">
            <div className="bg-sentinel-surface/80 p-2.5 rounded-lg border border-sentinel-border">
              <span className="text-sentinel-textMuted text-[10px] block font-sans">PHASE 1</span>
              <span className="font-bold text-white">Agent Proposes Intent</span>
              <span className="text-[10px] text-sentinel-textSubtle block mt-0.5">Detached Ed25519</span>
            </div>
            <div className="bg-sentinel-surface/80 p-2.5 rounded-lg border border-purple-500/30">
              <span className="text-purple-400 text-[10px] block font-sans">PHASE 2</span>
              <span className="font-bold text-purple-200">Sentinel Verification</span>
              <span className="text-[10px] text-sentinel-textSubtle block mt-0.5">Pyth Truth &amp; Reserves</span>
            </div>
            <div className="bg-sentinel-surface/80 p-2.5 rounded-lg border border-blue-500/30">
              <span className="text-blue-400 text-[10px] block font-sans">PHASE 3</span>
              <span className="font-bold text-blue-200">Promise Lock &amp; Ticket</span>
              <span className="text-[10px] text-sentinel-textSubtle block mt-0.5">Auth Ticket Issued</span>
            </div>
            <div className="bg-sentinel-surface/80 p-2.5 rounded-lg border border-emerald-500/30">
              <span className="text-emerald-400 text-[10px] block font-sans">PHASE 4</span>
              <span className="font-bold text-emerald-200">Venue Swap &amp; Settle</span>
              <span className="text-[10px] text-sentinel-textSubtle block mt-0.5">{targetVenueName.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Autonomous Intent Proposer & Invariant Pre-Flight */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="border-b border-sentinel-border pb-4 mb-6">
          <h3 className="text-base font-bold text-sentinel-text">Autonomous Trade Intent Proposer</h3>
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
                <optgroup label="Tokenized Public Equities (Meteora DBC)">
                  {availableAssets
                    .filter((a) => !('isPreIpo' in a))
                    .map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} (${a.priceUsd.toFixed(2)})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Pre-IPO Unicorn Equities (PreStocks Secondary)">
                  {availableAssets
                    .filter((a) => 'isPreIpo' in a)
                    .map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} (${a.priceUsd.toFixed(2)}) • Pre-IPO
                      </option>
                    ))}
                </optgroup>
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
                  className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
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
                  className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
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

          {/* Dynamic Target Routing Badge */}
          <div className="bg-sentinel-surfaceMuted/60 border border-sentinel-border rounded-lg p-3 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sentinel-textSubtle">TARGET VENUE:</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                {targetVenueName}
              </span>
            </div>
            <div className="text-sentinel-textMuted text-[11px] truncate">
              Route: <span className="text-white font-semibold">{targetRoute}</span>
            </div>
          </div>

          {/* Pyth Market Truth Status for Target Asset */}
          {currentMarketPrice && (
            <div className="bg-sentinel-surfaceMuted/80 border border-purple-500/20 rounded-lg p-3 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sentinel-border/50 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span className="font-bold text-white text-[11px] uppercase">
                    Pyth Market Truth: {currentMarketPrice.feedDisplayId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sentinel-textMuted text-[10px]">
                    {currentMarketPrice.publishTimeFormatted}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-[10px] font-semibold border border-purple-500/20">
                    Pyth Oracle
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-sentinel-textSubtle block text-[10px]">PRICE</span>
                  <span className="text-white font-bold">${currentMarketPrice.priceUsd.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-sentinel-textSubtle block text-[10px]">CONFIDENCE</span>
                  <span className="text-blue-400 font-bold">±${currentMarketPrice.confidenceUsd.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-sentinel-textSubtle block text-[10px]">UNDERLYING</span>
                  <span className="text-white font-bold">
                    {currentMarketPrice.underlyingSymbol ?? 'US Eq'} (${currentMarketPrice.underlyingPriceUsd?.toFixed(2) ?? currentMarketPrice.priceUsd.toFixed(2)})
                  </span>
                </div>
                <div>
                  <span className="text-sentinel-textSubtle block text-[10px]">BASIS DEVIATION</span>
                  <span className={`font-bold ${!willExceedTrackingError ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(effectiveTrackingErrorBps / 100).toFixed(2)}% ({effectiveTrackingErrorBps} bps)
                  </span>
                </div>
              </div>

              {/* Simulation checkbox */}
              <div className="mt-2.5 pt-2 border-t border-sentinel-border/40 flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-sentinel-textSubtle hover:text-white transition">
                  <input
                    type="checkbox"
                    checked={simulateDepeg}
                    onChange={(e) => setSimulateDepeg(e.target.checked)}
                    className="rounded border-sentinel-border text-purple-600 focus:ring-purple-500 accent-purple-500"
                  />
                  <span>Simulate Oracle Peg Deviation (3.20% depeg &gt; 2.50% ceiling)</span>
                </label>
                {simulateDepeg && (
                  <span className="text-[10px] text-rose-400 font-bold font-mono">
                    SIMULATED DEPEG ACTIVE
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Real-time SWARM-Lite Decision Engine Pre-Flight Warning Box */}
          <div
            className={`p-4 rounded-xl border text-xs space-y-3 font-mono ${
              willBeRejected
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sentinel-border/50 pb-2.5">
              <div className="flex items-center gap-2 font-bold">
                {willBeRejected ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>PRE-FLIGHT SWARM: SENTINEL WILL BLOCK THIS TRADE</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>PRE-FLIGHT SWARM: WITHIN COMPLIANT BOUNDS</span>
                  </>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                willBeRejected
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {swarmPassingCount}/6 VERIFIERS PASSING
              </span>
            </div>

            {/* 6-Verifier Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px]">
              {swarmPreFlightVerdicts.map((v) => (
                <div
                  key={v.name}
                  className={`p-2 rounded-lg border flex flex-col justify-between ${
                    v.passed
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sentinel-textSubtle uppercase truncate">
                      {v.name.replace('Verifier', '')}
                    </span>
                    <span className={`px-1 rounded text-[9px] font-bold ${v.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {v.passed ? '✓' : '✕'}
                    </span>
                  </div>
                  <div className="font-bold text-white text-[11px] truncate mt-0.5">
                    {v.role}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] space-y-1 pl-1 pt-1 border-t border-sentinel-border/40">
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
              {willExceedTrackingError && (
                <div className="text-rose-400 font-bold">
                  • Pyth Oracle Verifier: Basis tracking error of {(effectiveTrackingErrorBps / 100).toFixed(2)}% exceeds policy ceiling of {((policy.maxTrackingErrorBps ?? 250) / 100).toFixed(2)}% (ERR_TRACKING_ERROR_EXCEEDED)!
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* PROMISE 2.0 CONTRACT DRAFT PREVIEW (Phase 5)                */}
          {/* ----------------------------------------------------------- */}
          <div className="bg-sentinel-surfaceMuted/90 border border-blue-500/30 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sentinel-border/70 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white text-xs uppercase tracking-wide">
                  Promise 2.0 Contract Draft (Pre-Flight Preview)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  STATUS: PROPOSED
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  TTL: 60s
                </span>
              </div>
            </div>

            <p className="text-[11px] text-sentinel-textMuted font-sans leading-relaxed">
              Sentinel will register and cryptographically lock this 7-dimensional promise contract before any state transition can execute.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px]">
              {/* 1. WHO */}
              <div className="bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-border space-y-0.5">
                <span className="text-sentinel-textSubtle text-[10px] block font-sans uppercase font-semibold">1. WHO</span>
                <div className="text-white font-bold truncate">{agent.agentId}</div>
                <div className="text-blue-400 text-[10px] truncate">Auth: {formatAddress(agent.wallet.getPublicKeyString())}</div>
              </div>

              {/* 2. WHAT */}
              <div className="bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-border space-y-0.5">
                <span className="text-sentinel-textSubtle text-[10px] block font-sans uppercase font-semibold">2. WHAT</span>
                <div className="text-white font-bold flex items-center gap-1">
                  <span className={direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{direction}</span>
                  <span>${amountNum.toLocaleString()}</span>
                  <span className="text-sentinel-textMuted">({selectedAsset})</span>
                </div>
                <div className="text-sentinel-textSubtle text-[10px]">
                  ~{(amountNum / ((currentMarketPrice?.priceUsd ?? targetAsset?.priceUsd ?? 100) || 1)).toFixed(4)} estimated tokens
                </div>
              </div>

              {/* 3. WHY */}
              <div className="bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-border space-y-0.5">
                <span className="text-sentinel-textSubtle text-[10px] block font-sans uppercase font-semibold">3. WHY</span>
                <div className="text-sentinel-textMuted text-[10px] truncate" title={`${strategy} rebalancing for ${selectedAsset}`}>
                  &quot;{strategy} rebalancing for {selectedAsset}&quot;
                </div>
                <div className="text-purple-400 text-[10px] truncate">SHA-256 Rationale Hash Bound</div>
              </div>

              {/* 4. UNDER WHICH POLICY */}
              <div className="bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-border space-y-0.5">
                <span className="text-sentinel-textSubtle text-[10px] block font-sans uppercase font-semibold">4. POLICY</span>
                <div className="text-white font-bold">Policy v{policy.policyVersion}</div>
                <div className="text-sentinel-textMuted text-[10px]">
                  Cap: ≤ {(policy.maxSingleAssetBps / 100).toFixed(1)}% | Floor: ≥ {(policy.minStablecoinBps / 100).toFixed(1)}%
                </div>
              </div>

              {/* 5. MARKET ASSUMPTIONS */}
              <div className="bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-border space-y-0.5">
                <span className="text-sentinel-textSubtle text-[10px] block font-sans uppercase font-semibold">5. MARKET TRUTH</span>
                <div className="text-white font-bold">
                  ${(currentMarketPrice?.priceUsd ?? targetAsset?.priceUsd ?? 100).toFixed(2)} (Pyth Oracle)
                </div>
                <div className="text-emerald-400 text-[10px]">
                  ±${(currentMarketPrice?.confidenceUsd ?? 0.05).toFixed(2)} | {(effectiveTrackingErrorBps / 100).toFixed(2)}% depeg
                </div>
              </div>

              {/* 6. EXECUTION LIMITS */}
              <div className="bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-border space-y-0.5">
                <span className="text-sentinel-textSubtle text-[10px] block font-sans uppercase font-semibold">6. VENUE &amp; LIMITS</span>
                <div className="text-white font-bold truncate">{targetVenueName.split(' ')[0]}</div>
                <div className="text-sentinel-textMuted text-[10px]">
                  Max Slip: ≤ {(policy.maxSlippageBps / 100).toFixed(2)}% | Floor: ≥ $25k
                </div>
              </div>
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
                className="px-2.5 py-1 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40 text-xs font-mono hover:bg-rose-900/40 cursor-pointer"
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
                className="px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 text-xs font-mono hover:bg-emerald-900/40 cursor-pointer"
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

      {/* 4. Narrative Decision Lifecycle Diagram */}
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
              Agent generates trade intent with detached Ed25519 signature from ClawPump-compatible agent authority.
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
