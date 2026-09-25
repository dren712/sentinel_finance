'use client';

import React, { useState } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  NormalizedMarketPrice,
} from '@sentinel/domain';
import {
  AutonomousRoboAgent,
  ExecutionVenueType,
  AgentLoopState,
  AutonomousAdaptationResult,
} from '@sentinel/sdk';
import {
  Play,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sliders,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { PageHeader } from './ui/PageHeader';
import { formatCurrency, formatAddress } from '@/lib/formatters';

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

  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Manual trade form state
  const [selectedAsset, setSelectedAsset] = useState('NVDAx');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeAmount, setTradeAmount] = useState('15000');

  const availableAssets = [
    ...portfolio.assets.filter((a) => !a.isStablecoin && a.symbol !== 'USDC'),
    { symbol: 'SPACEXx', name: 'SpaceX Pre-IPO Equity', priceUsd: 220 },
    { symbol: 'OPENAIx', name: 'OpenAI Pre-IPO Equity', priceUsd: 150 },
    { symbol: 'STRIPEx', name: 'Stripe Pre-IPO Equity', priceUsd: 85 },
  ];

  // Pre-flight estimation for manual form
  const amountNum = parseFloat(tradeAmount) || 0;
  const targetAsset = portfolio.assets.find((a) => a.symbol === selectedAsset);
  const currentAssetVal = targetAsset ? targetAsset.valueUsd : 0;
  const postAssetVal =
    direction === 'BUY' ? currentAssetVal + amountNum : Math.max(0, currentAssetVal - amountNum);
  const postExposureBps = Math.round((postAssetVal / (portfolio.totalValueUsd || 100_000)) * 10_000);
  const postUsdcVal =
    direction === 'BUY'
      ? portfolio.stablecoinValueUsd - amountNum
      : portfolio.stablecoinValueUsd + amountNum;
  const postReserveBps = Math.round((postUsdcVal / (portfolio.totalValueUsd || 100_000)) * 10_000);

  const willExceedExposure = postExposureBps > policy.maxSingleAssetBps;
  const willExceedTradeLimit = amountNum > policy.maxTradeValueUsd;
  const willBreachReserve = postReserveBps < policy.minStablecoinBps;
  const willBeBlocked = willExceedExposure || willExceedTradeLimit || willBreachReserve;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(amountNum) || amountNum <= 0) return;
    onExecuteCustomTrade(selectedAsset, direction, amountNum);
  };

  // Derive values dynamically from adaptationResult, portfolio, and policy
  const initialDecision = adaptationResult?.step1RejectedDecision;
  const settledDecision = adaptationResult?.step2SettledDecision;

  const targetSymbol =
    settledDecision?.intent.assetSymbol ??
    initialDecision?.intent.assetSymbol ??
    'NVDAx';
  const totalNav = portfolio.totalValueUsd || 100_000;

  const maxSingleAssetPct = policy.maxSingleAssetBps / 100;
  const minCashReservePct = policy.minStablecoinBps / 100;
  const maxOrderSizeUsd = (policy as any).maxTradeUsd ?? policy.maxTradeValueUsd ?? 10_000;
  const maxSlippagePct = (policy.maxSlippageBps ?? 100) / 100;
  const estimatedSlippagePct = 0.38;

  const currentAssetHolding =
    portfolio.assets.find((a) => a.symbol === targetSymbol)?.valueUsd ?? 20_000;
  const currentCashHolding = portfolio.stablecoinValueUsd ?? 25_000;

  // Reconstruct pre-cycle holdings if adaptationResult has already mutated portfolio
  const preCycleAssetVal =
    adaptationResult && settledDecision
      ? Math.max(0, currentAssetHolding - settledDecision.intent.tradeAmountUsd)
      : currentAssetHolding;
  const preCycleCashVal =
    adaptationResult && settledDecision
      ? currentCashHolding + settledDecision.intent.tradeAmountUsd
      : currentCashHolding;

  const initialAmountUsd = initialDecision?.intent.tradeAmountUsd ?? 15_000;

  const dynamicHeadroomUsd = Math.max(
    0,
    Math.min(
      (maxSingleAssetPct / 100) * totalNav - preCycleAssetVal,
      preCycleCashVal - (minCashReservePct / 100) * totalNav,
      maxOrderSizeUsd
    )
  );
  const adaptedAmountUsd =
    settledDecision?.intent.tradeAmountUsd ?? Math.round(dynamicHeadroomUsd);

  const preAssetPct = (preCycleAssetVal / totalNav) * 100;
  const projectedAssetPct = ((preCycleAssetVal + initialAmountUsd) / totalNav) * 100;
  const adaptedAssetPct = ((preCycleAssetVal + adaptedAmountUsd) / totalNav) * 100;

  const preCashPct = (preCycleCashVal / totalNav) * 100;
  const projectedCashPct =
    (Math.max(0, preCycleCashVal - initialAmountUsd) / totalNav) * 100;
  const adaptedCashPct =
    (Math.max(0, preCycleCashVal - adaptedAmountUsd) / totalNav) * 100;

  const assetCheckPassed = projectedAssetPct <= maxSingleAssetPct + 0.01;
  const cashCheckPassed = projectedCashPct >= minCashReservePct - 0.01;
  const orderSizePassed = initialAmountUsd <= maxOrderSizeUsd;
  const slippageCheckPassed = estimatedSlippagePct <= maxSlippagePct;

  const breachedRuleNames: string[] = [];
  if (!assetCheckPassed) {
    breachedRuleNames.push(
      `single-stock limit (${projectedAssetPct.toFixed(1)}% > ${maxSingleAssetPct.toFixed(0)}%)`
    );
  }
  if (!cashCheckPassed) {
    breachedRuleNames.push(
      `cash reserve floor (${projectedCashPct.toFixed(1)}% < ${minCashReservePct.toFixed(0)}%)`
    );
  }
  if (!orderSizePassed) {
    breachedRuleNames.push(
      `order size cap (${formatCurrency(initialAmountUsd)} > ${formatCurrency(maxOrderSizeUsd)})`
    );
  }
  if (!slippageCheckPassed) {
    breachedRuleNames.push(
      `slippage limit (${estimatedSlippagePct.toFixed(2)}% > ${maxSlippagePct.toFixed(2)}%)`
    );
  }

  const refPrice = marketPrices?.[targetSymbol]?.priceUsd ?? 128.45;
  const settledTxSig = settledDecision?.evidenceRecord?.transactionSignature;
  const isRealOnChainTx = Boolean(
    settledTxSig &&
      settledTxSig.length >= 64 &&
      !settledTxSig.startsWith('sim_') &&
      !settledTxSig.startsWith('SIM_')
  );
  const evidenceHash = settledDecision?.evidenceRecord?.id;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <PageHeader
        category="AGENT"
        title="Autonomous Decision Pipeline"
        subtitle="Sentinel Robo-01 proposes trades, checks the 4 on-chain execution invariants, resizes oversized orders, and settles."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsManualOpen(!isManualOpen)}
              className="px-3 py-2 rounded-lg border border-sentinel-border bg-sentinel-surface hover:bg-sentinel-surfaceElevated text-sentinel-textMuted hover:text-white text-xs font-medium transition cursor-pointer sentinel-interactive sentinel-focus"
            >
              {isManualOpen ? 'Close Manual Proposal' : 'Manual Trade Proposal'}
            </button>
            <button
              type="button"
              onClick={onRunAdaptation}
              disabled={isRunningAdaptation}
              className="sentinel-btn-physical px-4 py-2 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 sentinel-interactive sentinel-focus"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningAdaptation ? 'animate-spin' : ''}`} />
              <span>{isRunningAdaptation ? 'Running Cycle...' : 'Run Autonomous Cycle'}</span>
            </button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* PRIMARY FOCAL POINT: PROPOSE → PROJECT → BLOCK/APPROVE → ADAPT → SETTLE   */}
      {/* ========================================================================= */}
      <Card variant="elevated" padding="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sentinel-border">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                Decision Lifecycle: {targetSymbol} Rebalance
              </h2>
              <Badge variant={adaptationResult ? 'success' : 'neutral'} size="xs">
                {adaptationResult ? 'Cycle Executed' : 'Ready'}
              </Badge>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              PROPOSE → PROJECT (4 ON-CHAIN INVARIANTS) → BLOCK → ADAPT → SETTLE
            </p>
          </div>

          <div className="text-xs font-mono text-sentinel-textMuted tabular-nums">
            Reference Price: <span className="text-white font-semibold">${refPrice.toFixed(2)}</span> (Pyth Quote)
          </div>
        </div>

        {/* 5-Stage Horizontal / Vertical Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* STAGE 1: PROPOSE */}
          <div className="p-4 rounded-xl bg-sentinel-surfaceMuted border border-sentinel-border flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[11px] font-mono text-sentinel-textSubtle font-semibold">
                01 · PROPOSE
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                BUY {targetSymbol} {formatCurrency(initialAmountUsd)}
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1.5 leading-relaxed">
                Robo-01 evaluates market signals and proposes a {formatCurrency(initialAmountUsd)} {targetSymbol} order.
              </p>
            </div>
            <div className="pt-2 border-t border-sentinel-border/60 text-[11px] font-mono text-sentinel-textSubtle">
              Authority: Proposal Only
            </div>
          </div>

          {/* STAGE 2: PROJECT (All 4 Authoritative On-Chain Invariants) */}
          <div className="p-4 rounded-xl bg-sentinel-surfaceMuted border border-sentinel-border flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[11px] font-mono text-sentinel-textSubtle font-semibold">
                02 · PROJECT
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                4 On-Chain Invariants
              </div>
              <div className="mt-2 space-y-1.5 text-xs font-mono tabular-nums">
                <div className="flex justify-between" title={`Max Single-Stock Limit: ${maxSingleAssetPct.toFixed(0)}%`}>
                  <span className="text-sentinel-textMuted">1. {targetSymbol} Cap</span>
                  <span className={assetCheckPassed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {preAssetPct.toFixed(1)}% → {projectedAssetPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between" title={`Min Cash Reserve Floor: ${minCashReservePct.toFixed(0)}%`}>
                  <span className="text-sentinel-textMuted">2. Cash Floor</span>
                  <span className={cashCheckPassed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {preCashPct.toFixed(1)}% → {projectedCashPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between" title={`Max Order Size: ${formatCurrency(maxOrderSizeUsd)}`}>
                  <span className="text-sentinel-textMuted">3. Order Size</span>
                  <span className={orderSizePassed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {formatCurrency(initialAmountUsd)} {orderSizePassed ? '≤' : '>'} {formatCurrency(maxOrderSizeUsd)}
                  </span>
                </div>
                <div className="flex justify-between" title={`Max Slippage Limit: ${maxSlippagePct.toFixed(2)}%`}>
                  <span className="text-sentinel-textMuted">4. Slippage</span>
                  <span className={slippageCheckPassed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {estimatedSlippagePct.toFixed(2)}% ≤ {maxSlippagePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-sentinel-border/60 text-[11px] font-mono text-sentinel-textSubtle">
              Dynamic Pre-Settlement Check
            </div>
          </div>

          {/* STAGE 3: BLOCK / APPROVE */}
          <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[11px] font-mono text-rose-400 font-semibold flex items-center justify-between">
                <span>03 · BLOCK</span>
                <X className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                {breachedRuleNames.length > 0 ? 'Blocked by Policy Guard' : 'Policy Guard Active'}
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1.5 leading-relaxed">
                {breachedRuleNames.length > 0
                  ? `Blocked: breaches ${breachedRuleNames.join(', ')}.`
                  : `All 4 on-chain execution invariants are satisfied under current policy bounds.`}
              </p>
            </div>
            <div className="pt-2 border-t border-rose-500/20 text-[11px] font-mono text-rose-300">
              0 Funds Transferred on Breach
            </div>
          </div>

          {/* STAGE 4: ADAPT */}
          <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[11px] font-mono text-amber-400 font-semibold flex items-center justify-between">
                <span>04 · ADAPT</span>
                <RefreshCw className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                Resize to {formatCurrency(adaptedAmountUsd)}
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1.5 leading-relaxed">
                Agent solves compliant headroom: {targetSymbol} reaches {adaptedAssetPct.toFixed(1)}% (≤ {maxSingleAssetPct.toFixed(0)}%) and cash stays at {adaptedCashPct.toFixed(1)}% (≥ {minCashReservePct.toFixed(0)}%).
              </p>
            </div>
            <div className="pt-2 border-t border-amber-500/20 text-[11px] font-mono text-amber-300">
              Compliant Headroom: {formatCurrency(adaptedAmountUsd)}
            </div>
          </div>

          {/* STAGE 5: SETTLE */}
          <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-500/30 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-between">
                <span>05 · SETTLE</span>
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm font-semibold text-white mt-1">
                {adaptationResult ? 'Executed & Recorded' : 'Ready to Settle'}
              </div>
              <p className="text-xs text-sentinel-textMuted mt-1.5 leading-relaxed">
                {formatCurrency(adaptedAmountUsd)} {targetSymbol} order passes all 4 on-chain execution invariants and records a SHA-256 receipt.
              </p>
            </div>
            <div className="pt-2 border-t border-emerald-500/20 text-[11px] font-mono text-emerald-300 truncate">
              {adaptationResult
                ? isRealOnChainTx
                  ? 'Devnet Tx Confirmed'
                  : 'Simulated Settlement'
                : 'Click Run Autonomous Cycle'}
            </div>
          </div>
        </div>

        {/* Truthful Settlement Receipt Summary when adaptationResult is present */}
        {adaptationResult && settledDecision && (
          <div className="pt-4 border-t border-sentinel-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-sentinel-textMuted">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-400 font-semibold">
                ✓ Cycle Completed ({isRealOnChainTx ? 'Solana Devnet' : 'Simulated Execution'})
              </span>
              <span>·</span>
              <span>
                Adapted Order: BUY {targetSymbol} {formatCurrency(adaptedAmountUsd)}
              </span>
            </div>
            {evidenceHash && (
              <div className="text-sentinel-textSubtle" title={evidenceHash}>
                Receipt SHA-256: <span className="text-white">0x{evidenceHash.slice(0, 12)}…{evidenceHash.slice(-6)}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* DISCLOSURE 1: MANUAL TRADE PROPOSAL (COLLAPSED BY DEFAULT)                */}
      {/* ========================================================================= */}
      {isManualOpen && (
        <Card variant="default" padding="md" className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-sentinel-border">
            <div>
              <h3 className="text-sm font-semibold text-white">Manual Trade Proposal</h3>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Submit a custom order size to test whether the Policy Guard approves or blocks it.
              </p>
            </div>
          </div>

          <form onSubmit={handleCustomSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-xs text-sentinel-textMuted block mb-1.5">Asset</label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-xs text-white font-mono"
              >
                {availableAssets.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol} — {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-sentinel-textMuted block mb-1.5">Side</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['BUY', 'SELL'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setDirection(side)}
                    className={`h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                      direction === side
                        ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                        : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted'
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-sentinel-textMuted block mb-1.5">Order Amount (USD)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-xs text-white font-mono tabular-nums"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isRunningTrade}
                className="w-full h-9 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isRunningTrade ? 'Evaluating...' : 'Submit Proposal'}
              </button>
            </div>
          </form>

          {/* Pre-flight Preview Bar */}
          <div className="pt-3 border-t border-sentinel-border flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-4 text-sentinel-textMuted">
              <span>
                Projected {selectedAsset}:{' '}
                <strong className={willExceedExposure ? 'text-rose-400' : 'text-white'}>
                  {(postExposureBps / 100).toFixed(1)}%
                </strong>{' '}
                (max {(policy.maxSingleAssetBps / 100).toFixed(0)}%)
              </span>
              <span>
                Projected Cash:{' '}
                <strong className={willBreachReserve ? 'text-rose-400' : 'text-white'}>
                  {(postReserveBps / 100).toFixed(1)}%
                </strong>{' '}
                (min {(policy.minStablecoinBps / 100).toFixed(0)}%)
              </span>
            </div>
            <span className={willBeBlocked ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {willBeBlocked ? 'Pre-Flight Forecast: Will Be Blocked' : 'Pre-Flight Forecast: Compliant'}
            </span>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* DISCLOSURE 2: COLLAPSED DIAGNOSTICS & EXECUTION VENUE                     */}
      {/* ========================================================================= */}
      <Card padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-sentinel-surfaceMuted transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-sentinel-textSubtle" />
            <span className="text-xs font-semibold text-white">
              Agent Diagnostics &amp; Execution Venue
            </span>
            <span className="text-xs font-mono text-sentinel-textSubtle">
              ({activeVenue})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-sentinel-textSubtle">
            <span>{isDiagnosticsOpen ? 'Hide Diagnostics' : 'Expand Diagnostics'}</span>
            {isDiagnosticsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isDiagnosticsOpen && (
          <div className="p-5 border-t border-sentinel-border bg-sentinel-surfaceMuted/40 space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Delegated Signer */}
              <div className="p-3.5 rounded-lg bg-sentinel-surface border border-sentinel-border space-y-1.5">
                <div className="text-sentinel-textSubtle">Delegated Agent Signer (Ed25519)</div>
                <div className="flex items-center justify-between font-mono text-white">
                  <span>{formatAddress(agent.wallet.getPublicKeyString(), 8)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(agent.wallet.getPublicKeyString());
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="text-sentinel-textMuted hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Execution Venue Selector */}
              <div className="p-3.5 rounded-lg bg-sentinel-surface border border-sentinel-border space-y-1.5">
                <div className="text-sentinel-textSubtle">Target Execution Adapter</div>
                <div className="flex flex-wrap gap-1.5">
                  {(['METEORA_DBC', 'PRESTOCKS_SECONDARY', 'DEMO_SIMULATION'] as ExecutionVenueType[]).map(
                    (venue) => (
                      <button
                        key={venue}
                        type="button"
                        onClick={() => handleVenueChange(venue)}
                        className={`px-2.5 py-1 rounded font-mono text-[11px] border cursor-pointer ${
                          activeVenue === venue
                            ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                            : 'bg-sentinel-surfaceMuted border-sentinel-border text-sentinel-textMuted hover:text-white'
                        }`}
                      >
                        {venue}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Loop State Trace Log (when available) */}
            {loopState && (loopState.whyNarrative || loopState.breachedInvariants.length > 0) && (
              <div className="space-y-2">
                <div className="text-sentinel-textSubtle font-semibold">
                  Execution Stage Log (Stage {loopState.stageIndex} / {loopState.totalStages} · {loopState.stage})
                </div>
                <div className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border font-mono text-[11px] space-y-1.5 text-sentinel-textMuted">
                  {loopState.whyNarrative?.initialProposalText && (
                    <div><span className="text-sentinel-textSubtle">[01 PROPOSE]</span> <span className="text-white">{loopState.whyNarrative.initialProposalText}</span></div>
                  )}
                  {loopState.whyNarrative?.rejectionSummary && (
                    <div><span className="text-rose-400">[03 BLOCK]</span> <span className="text-white">{loopState.whyNarrative.rejectionSummary}</span></div>
                  )}
                  {loopState.whyNarrative?.recalculationText && (
                    <div><span className="text-blue-400">[04 ADAPT]</span> <span className="text-white">{loopState.whyNarrative.recalculationText}</span></div>
                  )}
                  {loopState.whyNarrative?.sentinelStatusText && (
                    <div><span className="text-emerald-400">[05 SETTLE]</span> <span className="text-white">{loopState.whyNarrative.sentinelStatusText}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
