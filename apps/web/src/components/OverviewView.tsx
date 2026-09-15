'use client';

import React from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
} from '@sentinel/domain';
import { DecisionCycleReport, AutonomousRoboAgent } from '@sentinel/sdk';
import {
  TrendingUp,
  ShieldCheck,
  Bot,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Play,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { Stat } from './ui/Stat';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { formatCurrency, formatPercent, formatAddress, formatSignature, formatTimeAgo } from '@/lib/formatters';
import { getExplorerTxUrl } from '@/lib/config';

interface OverviewViewProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  agent: AutonomousRoboAgent;
  latestReport: DecisionCycleReport | null;
  recentEvidence: EvidenceRecord[];
  onNavigateToDecisions: () => void;
  onNavigateToEvidence: () => void;
  onNavigateToGuarantees: () => void;
  onNavigateToPortfolio: () => void;
  onNavigateToAgent: () => void;
  onRunDemo: () => void;
  isRunningDemo: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  portfolio,
  policy,
  agent,
  latestReport,
  recentEvidence,
  onNavigateToDecisions,
  onNavigateToEvidence,
  onNavigateToGuarantees,
  onNavigateToPortfolio,
  onNavigateToAgent,
  onRunDemo,
  isRunningDemo,
}) => {
  const equityValue = portfolio.totalValueUsd - portfolio.stablecoinValueUsd;
  const equityExposureBps = 10_000 - portfolio.stablecoinExposureBps;
  const isHealthy = portfolio.stablecoinExposureBps >= policy.minStablecoinBps;

  // Most exposed asset
  const sortedAssets = [...portfolio.assets]
    .filter(a => !a.isStablecoin && a.symbol !== 'USDC')
    .sort((a, b) => b.exposureBps - a.exposureBps);
  const highestExposureAsset = sortedAssets[0];

  return (
    <div className="space-y-6">
      {/* 1. Core Financial Stat Metrics (First Viewport) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Portfolio Value */}
        <Stat
          label="PORTFOLIO VALUE"
          value={formatCurrency(portfolio.totalValueUsd)}
          subtext="Net Asset Value (NAV)"
          delta="+1.42%"
          deltaPositive={true}
          icon={TrendingUp}
        />

        {/* Metric 2: Stablecoin Reserve Floor */}
        <Stat
          label="USDC RESERVE FLOOR"
          value={formatPercent(portfolio.stablecoinExposureBps / 100)}
          subtext={`Min guaranteed: ${(policy.minStablecoinBps / 100).toFixed(1)}%`}
          delta={isHealthy ? 'SAFE' : 'BREACH'}
          deltaPositive={isHealthy}
          icon={Lock}
          iconColor="text-emerald-400"
        />

        {/* Metric 3: Tokenized Equities */}
        <Stat
          label="TOKENIZED EQUITIES"
          value={formatCurrency(equityValue)}
          subtext={`${(equityExposureBps / 100).toFixed(1)}% portfolio allocation`}
          delta={`${sortedAssets.length} Assets`}
          deltaPositive={true}
          icon={Layers}
          iconColor="text-indigo-400"
        />

        {/* Metric 4: Invariant Protection Status */}
        <Stat
          label="ENFORCEMENT ENGINE"
          value="ACTIVE"
          subtext="Solana Anchor Postconditions"
          delta="4 Invariants"
          deltaPositive={true}
          icon={ShieldCheck}
          iconColor="text-blue-400"
        />
      </div>

      {/* 2. Hero Split: Agent Operations vs Financial Guarantees */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Autonomous Agent Operational Status */}
        <div className="lg:col-span-2 bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sentinel-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-sentinel-accent">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-sentinel-text">{agent.name}</h3>
                  <Badge variant="success" dot={true}>
                    AUTONOMOUS ACTIVE
                  </Badge>
                </div>
                <p className="text-xs text-sentinel-textMuted mt-0.5">
                  Authority: <span className="font-mono text-white">{formatAddress(agent.wallet.getPublicKeyString(), 6)}</span> (ClawPump Protocol)
                </p>
              </div>
            </div>

            <button
              onClick={onNavigateToAgent}
              className="text-xs font-semibold text-sentinel-accent hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Manage Agent</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current Objective & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border space-y-1.5">
              <div className="text-[11px] text-sentinel-textSubtle uppercase font-semibold">
                Current Objective
              </div>
              <div className="text-sm font-semibold text-sentinel-text">
                Maximize equity momentum while maintaining 20% USDC safety reserve.
              </div>
              <div className="text-xs text-sentinel-textMuted">
                Active Strategy: <span className="text-white font-mono">Momentum Growth</span>
              </div>
            </div>

            <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border space-y-1.5">
              <div className="text-[11px] text-sentinel-textSubtle uppercase font-semibold">
                Latest Decision Outcome
              </div>
              {latestReport ? (
                <div>
                  <div className="flex items-center gap-1.5">
                    {latestReport.status === 'SETTLED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-sm font-bold text-white">
                      {latestReport.intent.direction} {latestReport.intent.assetSymbol} ({formatCurrency(latestReport.intent.tradeAmountUsd)})
                    </span>
                  </div>
                  <div className="text-xs mt-1">
                    <span className={`font-mono font-semibold ${latestReport.status === 'SETTLED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {latestReport.status === 'SETTLED' ? 'Settled Safely on Devnet' : `Aborted: ${latestReport.evidenceRecord.failureCode}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-sentinel-textMuted">
                  No trade executed yet. Run the autonomous demo to see Sentinel in action.
                </div>
              )}
            </div>
          </div>

          {/* Top Asset Exposure Bar */}
          {highestExposureAsset && (
            <div className="pt-2">
              <ProgressBar
                currentBps={highestExposureAsset.exposureBps}
                limitBps={policy.maxSingleAssetBps}
                type="max"
                label={`Highest Asset Exposure: ${highestExposureAsset.symbol} (${formatCurrency(highestExposureAsset.valueUsd)})`}
              />
            </div>
          )}
        </div>

        {/* Right 1 Col: User Financial Guarantees (The Sentinel Invariants) */}
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-sentinel-border">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-sentinel-text">Financial Guarantees</h3>
            </div>
            <button
              onClick={onNavigateToGuarantees}
              className="text-xs text-sentinel-accent hover:underline flex items-center gap-1"
            >
              <span>Edit</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <p className="text-xs text-sentinel-textMuted">
            The agent cannot settle any transaction that breaches these user-defined boundaries:
          </p>

          <div className="space-y-3">
            {/* Guarantee 1 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-xs">
              <div>
                <div className="font-semibold text-white">Single Asset Exposure</div>
                <div className="text-[11px] text-sentinel-textSubtle">Max capital in one token</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-white">≤ {(policy.maxSingleAssetBps / 100).toFixed(1)}%</div>
                <span className="text-[10px] text-emerald-400 font-semibold">✓ ENFORCED</span>
              </div>
            </div>

            {/* Guarantee 2 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-xs">
              <div>
                <div className="font-semibold text-white">Stablecoin Reserve</div>
                <div className="text-[11px] text-sentinel-textSubtle">Guaranteed liquid floor</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-white">≥ {(policy.minStablecoinBps / 100).toFixed(1)}%</div>
                <span className="text-[10px] text-emerald-400 font-semibold">✓ ENFORCED</span>
              </div>
            </div>

            {/* Guarantee 3 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-xs">
              <div>
                <div className="font-semibold text-white">Maximum Trade Sizing</div>
                <div className="text-[11px] text-sentinel-textSubtle">Per-decision order limit</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-white">≤ {formatCurrency(policy.maxTradeValueUsd, { maximumFractionDigits: 0 })}</div>
                <span className="text-[10px] text-emerald-400 font-semibold">✓ ENFORCED</span>
              </div>
            </div>

            {/* Guarantee 4 */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border text-xs">
              <div>
                <div className="font-semibold text-white">Maximum Slippage</div>
                <div className="text-[11px] text-sentinel-textSubtle">Execution tolerance</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-white">≤ {(policy.maxSlippageBps / 100).toFixed(2)}%</div>
                <span className="text-[10px] text-emerald-400 font-semibold">✓ ENFORCED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recent Decisions Activity Feed & Scripted Demo Launcher */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sentinel-border">
          <div>
            <h3 className="text-base font-bold text-sentinel-text">Recent Autonomous Decisions</h3>
            <p className="text-xs text-sentinel-textMuted">
              Immutable state transition records verified against on-chain policy constraints.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRunDemo}
              disabled={isRunningDemo}
              className="px-3.5 py-1.5 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>{isRunningDemo ? 'Running...' : 'Run Hackathon Demo'}</span>
            </button>
            <button
              onClick={onNavigateToDecisions}
              className="text-xs text-sentinel-textMuted hover:text-white flex items-center gap-1"
            >
              <span>View Inspector</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentEvidence.length === 0 ? (
          <div className="text-center py-8 bg-sentinel-surfaceMuted/40 rounded-xl border border-dashed border-sentinel-border">
            <Activity className="w-8 h-8 text-sentinel-textSubtle mx-auto mb-2" />
            <div className="text-sm font-semibold text-sentinel-text">No Decisions Recorded Yet</div>
            <p className="text-xs text-sentinel-textMuted max-w-sm mx-auto mt-1">
              Click &quot;Run Hackathon Demo&quot; to witness an autonomous non-compliant trade get rejected and auto-adapted.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sentinel-border">
            {recentEvidence.slice(0, 5).map((rec) => {
              const isSettled = rec.verificationResult === 'SETTLED';
              return (
                <div
                  key={rec.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sentinel-surfaceElevated/50 px-2 rounded-lg transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSettled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {isSettled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white font-mono">
                          Record: {formatAddress(rec.id, 6)}
                        </span>
                        <Badge variant={isSettled ? 'success' : 'danger'} size="sm">
                          {isSettled ? 'SETTLED' : 'ABORTED'}
                        </Badge>
                      </div>
                      <p className="text-xs text-sentinel-textMuted mt-0.5">
                        {isSettled
                          ? `All 4 invariants verified on Solana Devnet (Policy v${rec.policyVersion})`
                          : `Violated: ${rec.failureReason || rec.failureCode}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
                    <span className="text-sentinel-textSubtle">
                      {formatTimeAgo(rec.timestamp)}
                    </span>
                    {rec.transactionSignature && (
                      <a
                        href={getExplorerTxUrl(rec.transactionSignature)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1"
                        title="View on Solana Explorer"
                      >
                        <span>{formatSignature(rec.transactionSignature)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
