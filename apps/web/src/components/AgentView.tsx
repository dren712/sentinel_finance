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
  X,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { FlagshipEnforcementCard } from './ui/FlagshipEnforcementCard';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';
import { getExplorerAddressUrl } from '@/lib/config';

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

  // Action Review Modal / Bottom Sheet state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewedActionSettled, setReviewedActionSettled] = useState(false);

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

  const handleApproveReviewedAction = () => {
    onExecuteCustomTrade('AAPLx', 'BUY', 2840);
    setReviewedActionSettled(true);
    setTimeout(() => {
      setReviewedActionSettled(false);
      setIsReviewOpen(false);
    }, 1500);
  };

  // Asset universe covering public stocks and PreStocks pre-IPO equities
  const availableAssets = [
    ...portfolio.assets.filter((a) => !a.isStablecoin && a.symbol !== 'USDC'),
    { symbol: 'SPACEXx', name: 'SpaceX Pre-IPO Equity', priceUsd: 220, isPreIpo: true },
    { symbol: 'OPENAIx', name: 'OpenAI Pre-IPO Equity', priceUsd: 150, isPreIpo: true },
    { symbol: 'STRIPEx', name: 'Stripe Pre-IPO Equity', priceUsd: 85, isPreIpo: true },
    { symbol: 'ANTHROPICx', name: 'Anthropic Pre-IPO Equity', priceUsd: 110, isPreIpo: true },
  ];

  const isPreIpoSelected = ['SPACEXx', 'OPENAIx', 'STRIPEx', 'ANTHROPICx'].includes(selectedAsset);

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

  // Pre-flight estimation calculations
  const [simulateDepeg, setSimulateDepeg] = useState(false);
  const amountNum = parseFloat(tradeAmount) || 0;
  const targetAsset = portfolio.assets.find((a) => a.symbol === selectedAsset);
  const currentAssetVal = targetAsset ? targetAsset.valueUsd : 0;
  const postAssetVal = direction === 'BUY' ? currentAssetVal + amountNum : Math.max(0, currentAssetVal - amountNum);
  const postExposureBps = Math.round((postAssetVal / (portfolio.totalValueUsd || 100_000)) * 10_000);
  const willExceedExposure = postExposureBps > policy.maxSingleAssetBps;
  const willExceedTradeLimit = amountNum > policy.maxTradeValueUsd;
  const postUsdcVal =
    direction === 'BUY'
      ? portfolio.stablecoinValueUsd - amountNum
      : portfolio.stablecoinValueUsd + amountNum;
  const postReserveBps = Math.round((postUsdcVal / (portfolio.totalValueUsd || 100_000)) * 10_000);
  const willBreachReserve = postReserveBps < policy.minStablecoinBps;

  const currentMarketPrice = marketPrices?.[selectedAsset];
  const effectiveTrackingErrorBps = simulateDepeg ? 320 : (currentMarketPrice?.trackingErrorBps ?? 18);
  const willExceedTrackingError = effectiveTrackingErrorBps > (policy.maxTrackingErrorBps ?? 250);
  const willBeRejected =
    willExceedExposure || willExceedTradeLimit || willBreachReserve || willExceedTrackingError;

  const riskVerifierPassed = !willExceedExposure && !willExceedTradeLimit;
  const balanceVerifierPassed = !willBreachReserve;
  const policyVerifierPassed = policy.isActive;
  const liquidityVerifierPassed = true;
  const priceIntegrityVerifierPassed = !willExceedTrackingError;
  const portfolioVerifierPassed = true;

  const swarmPreFlightVerdicts = [
    { name: 'RiskVerifier', role: 'Concentration Cap', passed: riskVerifierPassed },
    { name: 'BalanceVerifier', role: 'Reserve Floor', passed: balanceVerifierPassed },
    { name: 'PolicyVerifier', role: 'Authority Check', passed: policyVerifierPassed },
    { name: 'LiquidityVerifier', role: 'Venue Depth', passed: liquidityVerifierPassed },
    { name: 'PriceIntegrityVerifier', role: 'Pyth Oracle Truth', passed: priceIntegrityVerifierPassed },
    { name: 'PortfolioVerifier', role: 'Macro Universe', passed: portfolioVerifierPassed },
  ];
  const swarmPassingCount = swarmPreFlightVerdicts.filter((v) => v.passed).length;

  return (
    <div className="space-y-6">
      {/* 1. AGENT IDENTITY CARD (INSTITUTIONAL HEADER) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-sentinel-border">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black tracking-tight text-white uppercase">
                  SENTINEL ROBO-01
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5 font-mono">
                Strategy: <span className="text-white font-semibold">Balanced Growth</span> · Risk posture: <span className="text-white font-semibold">Moderate</span>
              </p>
            </div>
          </div>

          {/* Quick Authority Callout */}
          <div className="flex items-center gap-2 font-mono text-xs self-start md:self-auto bg-sentinel-surfaceMuted px-3 py-1.5 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle">Authority:</span>
            <span className="text-white font-semibold">
              {formatAddress(agent.wallet.getPublicKeyString(), 4)}
            </span>
            <button
              onClick={copyAuthority}
              className="p-1 hover:text-white text-sentinel-textSubtle transition"
              title="Copy Ed25519 Authority"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={getExplorerAddressUrl(agent.wallet.getPublicKeyString())}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* 4 Status Pillars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 text-xs font-mono">
          <div className="bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block text-[10px]">MANDATE</span>
            <span className="text-white font-semibold mt-0.5 block">Balanced Growth</span>
            <span className="text-[10px] text-sentinel-textMuted">Dynamic Multi-Asset</span>
          </div>

          <div className="bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block text-[10px]">REBALANCE CADENCE</span>
            <span className="text-white font-semibold mt-0.5 block">Monitoring</span>
            <span className="text-[10px] text-sentinel-textMuted">Block-by-block preflight</span>
          </div>

          <div className="bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block text-[10px]">ENFORCEMENT</span>
            <span className="text-emerald-400 font-semibold mt-0.5 block">Bound to Sentinel</span>
            <span className="text-[10px] text-sentinel-textMuted">Zero-bypass PDA ticket</span>
          </div>

          <div className="bg-sentinel-surfaceMuted p-3 rounded-lg border border-sentinel-border">
            <span className="text-sentinel-textSubtle block text-[10px]">EXECUTION VENUE</span>
            <span className="text-blue-400 font-semibold mt-0.5 block truncate">
              {activeVenue === 'METEORA_DBC' ? 'Meteora DBC' : activeVenue === 'PRESTOCKS_SECONDARY' ? 'PreStocks' : 'Simulator'}
            </span>
            <span className="text-[10px] text-sentinel-textMuted">Tokenized SPL DEX</span>
          </div>
        </div>
      </div>

      {/* 2. CURRENT REASONING BOX (CLEAN INSTITUTIONAL STYLING) */}
      <div className="bg-sentinel-surface border border-blue-500/30 rounded-xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-sentinel-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Current Reasoning &amp; Proposed Action
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
            Real-Time Observation
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Section 1: MARKET OBSERVATION */}
          <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-2">
            <span className="text-[10px] font-bold text-sentinel-textSubtle uppercase tracking-wider block font-mono">
              MARKET OBSERVATION
            </span>
            <p className="text-xs text-white leading-relaxed">
              NVDAx relative strength high after earnings release. Portfolio allocation currently 20.0%, within compliant band.
            </p>
            <div className="text-[11px] font-mono text-sentinel-textMuted pt-1 border-t border-sentinel-border/50">
              Pyth confidence: <span className="text-blue-400 font-semibold">±$0.04 (Fresh)</span>
            </div>
          </div>

          {/* Section 2: PROPOSED ACTION */}
          <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-2">
            <span className="text-[10px] font-bold text-sentinel-textSubtle uppercase tracking-wider block font-mono">
              PROPOSED ACTION
            </span>
            <div className="text-sm font-bold text-white font-mono">
              BUY AAPLx <span className="text-blue-400">$2,840</span>
            </div>
            <div className="text-xs font-mono text-sentinel-textMuted space-y-0.5">
              <div>Projected allocation: <span className="text-white font-semibold">24.1%</span></div>
              <div>Policy limit: <span className="text-sentinel-textSubtle font-semibold">25.0%</span></div>
            </div>
          </div>

          {/* Section 3: SENTINEL VERDICT */}
          <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/30 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block font-mono">
                SENTINEL VERDICT
              </span>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-1 font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ APPROVED</span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-1">
                All 4 core invariants hold with positive headroom.
              </p>
            </div>

            {/* REVIEW ACTION BUTTON */}
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Review action</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ACTION REVIEW BOTTOM SHEET / MODAL */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
            onClick={() => setIsReviewOpen(false)}
          />

          {/* Modal Panel (Bottom-sheet on mobile, centered modal on desktop) */}
          <div className="relative w-full max-w-lg bg-sentinel-surface border border-sentinel-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 z-10 space-y-5 animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-3 border-b border-sentinel-border">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Review Autonomous Trade</h3>
              </div>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="p-1 rounded-lg hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Summary */}
            <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-2 text-xs font-mono">
              <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold">
                ORDER SUMMARY
              </div>
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-white font-bold">BUY AAPLx</span>
                <span className="text-blue-400 font-bold">$2,840.00 USD</span>
              </div>
              <div className="flex justify-between text-sentinel-textMuted text-[11px]">
                <span>Target Venue:</span>
                <span className="text-white">Meteora Dynamic Bonding Curve</span>
              </div>
              <div className="flex justify-between text-sentinel-textMuted text-[11px]">
                <span>Execution Guard:</span>
                <span className="text-emerald-400">Deterministic Sentinel PDA Ticket</span>
              </div>
            </div>

            {/* Projected Allocation */}
            <div className="bg-sentinel-surfaceMuted p-4 rounded-xl border border-sentinel-border space-y-2 text-xs font-mono">
              <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold">
                PROJECTED ALLOCATION
              </div>
              <div className="flex justify-between">
                <span className="text-white">AAPLx Weight:</span>
                <span className="text-blue-400 font-bold">20.0% → 24.1% (Cap 25.0%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white">USDC Cash Reserve:</span>
                <span className="text-emerald-400 font-bold">25.0% → 22.3% (Floor 20.0%)</span>
              </div>
            </div>

            {/* 4 Invariant Checklist */}
            <div className="space-y-2 text-xs font-mono">
              <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold block">
                INVARIANT VERIFICATION CHECKLIST
              </span>
              <div className="space-y-1.5 bg-sentinel-surfaceMuted/50 p-3 rounded-xl border border-sentinel-border">
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Exposure limit
                  </span>
                  <span className="text-white font-semibold">24.1% ≤ 25.0%</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Stable reserve
                  </span>
                  <span className="text-white font-semibold">22.3% ≥ 20.0%</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Trade size ceiling
                  </span>
                  <span className="text-white font-semibold">$2,840 ≤ $10,000</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Price slippage
                  </span>
                  <span className="text-white font-semibold">&lt; 0.25% ≤ 1.00%</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-sentinel-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-sentinel-border text-xs font-semibold text-sentinel-textMuted hover:text-white transition cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleApproveReviewedAction}
                disabled={reviewedActionSettled}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                {reviewedActionSettled ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Auto-Executed by Sentinel!</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>Approve with wallet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PHASE 8: AUTONOMOUS DECISION & ADAPTATION HERO CARD */}
      <div className="bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 border border-blue-500/30 rounded-xl overflow-hidden shadow-lg shadow-blue-500/5">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-black tracking-wider text-white uppercase">
                    SENTINEL ROBO
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    ● Autonomous
                  </span>
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
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 transition cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningAdaptation ? 'animate-spin' : ''}`} />
                <span>{isRunningAdaptation ? 'Adapting Proposal...' : 'Run Autonomous Adaptation'}</span>
              </button>
            )}
          </div>

          {/* 10-Stage Stepper */}
          {loopState && (
            <div className="mt-4 grid grid-cols-5 sm:grid-cols-10 gap-1">
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
                    className={`text-center py-1 px-0.5 rounded text-[9px] font-bold font-mono transition-all ${
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

        {/* Current Decision & Immaculate P18/P19 Enforcement Screen */}
        <div className="p-5 sm:p-6 space-y-5">
          <FlagshipEnforcementCard
            latestEvidence={adaptationResult?.step2SettledDecision?.evidenceRecord || null}
            onRunAdaptation={onRunAdaptation}
            isRunningAdaptation={isRunningAdaptation}
          />
        </div>
      </div>

      {/* 4. EXECUTION VENUE SELECTOR & NON-BYPASS LIFECYCLE (PHASE 4 & 10) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Polymorphic Execution Venues
              </h3>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Select targeted liquidity venue. Sentinel strictly enforces pre-flight invariants prior to venue dispatch.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded bg-blue-500/15 text-blue-300 text-xs font-mono font-bold border border-blue-500/30 self-start sm:self-auto">
            Venue: {activeVenue}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Venue 1: Meteora DBC */}
          <button
            type="button"
            onClick={() => handleVenueChange('METEORA_DBC')}
            className={`text-left p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              activeVenue === 'METEORA_DBC'
                ? 'bg-blue-950/20 border-blue-500 shadow-md'
                : 'bg-sentinel-surfaceMuted border-sentinel-border hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold">
                  PUBLIC EQUITIES
                </span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                Meteora Dynamic Bonding Curve
              </h4>
              <p className="text-[11px] text-sentinel-textMuted mt-1">
                Dynamic bonding curve AMM for tokenized stocks (NVDAx, AAPLx, SPYx).
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-sentinel-border/50 text-[10px] font-mono text-sentinel-textSubtle">
              Min Depth: $25k · Max Slip: 1.00%
            </div>
          </button>

          {/* Venue 2: PreStocks Secondary */}
          <button
            type="button"
            onClick={() => handleVenueChange('PRESTOCKS_SECONDARY')}
            className={`text-left p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              activeVenue === 'PRESTOCKS_SECONDARY'
                ? 'bg-purple-950/20 border-purple-500 shadow-md'
                : 'bg-sentinel-surfaceMuted border-sentinel-border hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 font-mono text-[10px] font-bold">
                  PRE-IPO UNICORNS
                </span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                PreStocks Secondary Vault
              </h4>
              <p className="text-[11px] text-sentinel-textMuted mt-1">
                Order matching vault for late-stage private giants (SpaceX, OpenAI, Stripe).
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-sentinel-border/50 text-[10px] font-mono text-sentinel-textSubtle">
              Transfer Check: Active · Max Cap: 20%
            </div>
          </button>

          {/* Venue 3: Demo Simulator */}
          <button
            type="button"
            onClick={() => handleVenueChange('DEMO_SIMULATION')}
            className={`text-left p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
              activeVenue === 'DEMO_SIMULATION'
                ? 'bg-amber-950/20 border-amber-500 shadow-md'
                : 'bg-sentinel-surfaceMuted border-sentinel-border hover:border-slate-600'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                  OFFLINE SIMULATION
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              </div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                Deterministic Local Simulator
              </h4>
              <p className="text-[11px] text-sentinel-textMuted mt-1">
                In-memory execution harness for deterministic testing and air-gapped scenarios.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-sentinel-border/50 text-[10px] font-mono text-sentinel-textSubtle">
              Signatures: sim_tx_* · No network delay
            </div>
          </button>
        </div>
      </div>

      {/* 5. MANUAL TRADE PROPOSER & PRE-FLIGHT VERIFIER ENGINE */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sentinel-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Autonomous Trade Intent Proposer
            </h3>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Simulate arbitrary trade proposals from the agent authority to test real-time invariant enforcement.
            </p>
          </div>
          <span className="text-xs font-mono text-sentinel-textSubtle">
            {swarmPassingCount} / 6 Verifiers Passing
          </span>
        </div>

        <form onSubmit={handleCustomSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Asset Selection */}
            <div>
              <label className="block text-xs font-semibold text-sentinel-textSubtle mb-1">
                TARGET ASSET
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full bg-sentinel-surfaceMuted border border-sentinel-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <optgroup label="Tokenized Public Equities (Meteora DBC)">
                  {availableAssets
                    .filter((a) => !('isPreIpo' in a) && !('isAgentToken' in a))
                    .map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} (${a.priceUsd.toFixed(2)})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Pre-IPO Unicorn Equities (PreStocks)">
                  {availableAssets
                    .filter((a) => 'isPreIpo' in a)
                    .map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} (${a.priceUsd.toFixed(2)}) · Pre-IPO
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
                <span className="absolute left-3 top-2 text-xs text-sentinel-textMuted font-mono">$</span>
                <input
                  type="number"
                  min="100"
                  step="500"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full bg-sentinel-surfaceMuted border border-sentinel-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Pre-Flight SWARM-Lite 6-Verifier Status */}
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-2.5 font-mono ${
              willBeRejected
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] uppercase flex items-center gap-1.5">
                {willBeRejected ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Sentinel Pre-Flight: Will Reject
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Sentinel Pre-Flight: Compliant
                  </>
                )}
              </span>
              <span className="text-[10px] font-bold">
                {swarmPassingCount} / 6 Verifiers Passing
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-[10px]">
              {swarmPreFlightVerdicts.map((v) => (
                <div
                  key={v.name}
                  className={`p-1.5 rounded-md border flex items-center justify-between ${
                    v.passed
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span className="truncate">{v.role}</span>
                  <span className="font-bold">{v.passed ? '✓' : '✕'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Preset Buttons & Submit */}
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
                $15,000 NVDA (Breach)
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
                $5,000 NVDA (Safe)
              </button>
            </div>

            <button
              type="submit"
              disabled={isRunningTrade}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md disabled:opacity-50 transition cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTrade ? 'animate-spin' : ''}`} />
              <span>{isRunningTrade ? 'Evaluating Invariants...' : 'Submit Intent'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
