'use client';

import React, { useState } from 'react';
import { DecisionCycleReport } from '@sentinel/sdk';
import { PortfolioSnapshot, FinancialPolicy } from '@sentinel/domain';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { getExplorerTxUrl } from '@/lib/config';
import { formatCurrency, formatSignature, formatAddress } from '@/lib/formatters';

interface DecisionsViewProps {
  latestReport: DecisionCycleReport | null;
  policy: FinancialPolicy;
  portfolio: PortfolioSnapshot;
  onSelectEvidenceId: (id: string) => void;
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({
  latestReport,
  policy,
  portfolio,
  onSelectEvidenceId,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!latestReport) {
    return (
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 text-sentinel-accent border border-blue-500/30 flex items-center justify-center mx-auto">
          <Cpu className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-sentinel-text">No Active Decision Inspected</h3>
        <p className="text-xs text-sentinel-textMuted max-w-md mx-auto">
          Click &quot;Run Autonomous Demo&quot; in the header or submit a custom trade from the Autonomous Agent tab to observe Sentinel evaluate postconditions in real time.
        </p>
      </div>
    );
  }

  const { intent, evaluation, evidenceRecord, status } = latestReport;
  const isSettled = status === 'SETTLED';

  // Affected assets
  const targetAsset = evaluation.postState.assets.find(a => a.symbol === intent.assetSymbol);

  // Pre vs Post calculations using current portfolio and evaluated post-state
  const preAsset = portfolio.assets.find(a => a.symbol === intent.assetSymbol);
  const preAssetExposurePct = (preAsset ? preAsset.exposureBps : 0) / 100;
  const postAssetExposurePct = (targetAsset ? targetAsset.exposureBps : 0) / 100;
  const maxAllowedAssetPct = policy.maxSingleAssetBps / 100;

  const preReservePct = portfolio.stablecoinExposureBps / 100;
  const postReservePct = evaluation.postState.stablecoinExposureBps / 100;
  const minRequiredReservePct = policy.minStablecoinBps / 100;

  return (
    <div className="space-y-6">
      {/* 1. Decision Status Banner */}
      <div
        className={`border rounded-xl p-6 transition-all ${
          isSettled
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : 'bg-rose-950/20 border-rose-500/40'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isSettled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              {isSettled ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-sentinel-textSubtle uppercase font-semibold">
                  PTA State Transition Verdict:
                </span>
                <Badge variant={isSettled ? 'success' : 'danger'}>
                  {isSettled ? 'POSTCONDITIONS SATISFIED • SETTLED' : 'POSTCONDITION VIOLATED • TRANSACTION ABORTED'}
                </Badge>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {intent.direction} {intent.assetSymbol} — {formatCurrency(intent.tradeAmountUsd)}
              </h2>
            </div>
          </div>

          <div className="text-right self-start md:self-auto">
            <span className="text-xs text-sentinel-textSubtle block font-mono">PROVN EVIDENCE COMMITMENT</span>
            <button
              onClick={() => onSelectEvidenceId(evidenceRecord.id)}
              className="text-xs font-mono text-blue-400 hover:text-blue-300 underline flex items-center gap-1 mt-0.5 ml-auto"
            >
              <span>{formatAddress(evidenceRecord.id, 8)}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Rejection Details Callout */}
        {!isSettled && (
          <div className="mt-4 p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 space-y-1">
            <div className="flex items-center gap-2 font-bold font-mono text-rose-300">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>REJECTION CODE: {evidenceRecord.failureCode}</span>
            </div>
            <p className="pl-6 text-rose-200/90">{evidenceRecord.failureReason}</p>
            <div className="pl-6 text-[11px] text-slate-400 mt-1">
              The transaction reverted atomically on Solana Devnet. The user&apos;s portfolio balances and stablecoin reserves were left completely untouched.
            </div>
          </div>
        )}

        {/* Settlement Callout */}
        {isSettled && (
          <div className="mt-4 p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-200 space-y-1">
            <div className="flex items-center gap-2 font-bold font-mono text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>TRANSACTION SETTLED ON SOLANA DEVNET</span>
            </div>
            <div className="pl-6 text-[11px] text-emerald-300/80">
              Postconditions evaluated in u128 math. Resulting exposure and reserve balances strictly satisfy policy guarantees.
            </div>
          </div>
        )}
      </div>

      {/* 2. Visual Before/After State Transition Comparison (Core "Wow" Section) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-5">
        <div className="border-b border-sentinel-border pb-3">
          <h3 className="text-base font-bold text-sentinel-text">Pre-Trade vs Post-Trade State Transition</h3>
          <p className="text-xs text-sentinel-textMuted mt-0.5">
            Demonstrates how Sentinel evaluates proposed portfolio mutations against mathematical invariants before committing state.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transition 1: Target Asset Exposure */}
          <div className="bg-sentinel-surfaceMuted p-5 rounded-xl border border-sentinel-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sentinel-textSubtle uppercase">
                1. Single-Asset Exposure ({intent.assetSymbol})
              </span>
              <span className="text-xs font-mono font-bold text-white">
                Ceiling: ≤ {maxAllowedAssetPct.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between py-2 text-sm">
              <div className="text-center">
                <span className="text-[11px] text-sentinel-textSubtle block">PRE-TRADE</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                  {preAssetExposurePct.toFixed(1)}%
                </span>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="w-5 h-5 text-sentinel-accent" />
                <span className="text-[10px] text-sentinel-textMuted font-mono">Transition</span>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-sentinel-textSubtle block">PROPOSED POST-TRADE</span>
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${
                    postAssetExposurePct <= maxAllowedAssetPct ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {postAssetExposurePct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Verdict */}
            <div
              className={`p-2.5 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between ${
                postAssetExposurePct <= maxAllowedAssetPct
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              <span>{postAssetExposurePct <= maxAllowedAssetPct ? '✓ WITHIN EXPOSURE CEILING' : '✗ BREACHES 25.0% CEILING'}</span>
              <span>{postAssetExposurePct <= maxAllowedAssetPct ? 'PASS' : 'FAIL'}</span>
            </div>
          </div>

          {/* Transition 2: USDC Stablecoin Reserve Floor */}
          <div className="bg-sentinel-surfaceMuted p-5 rounded-xl border border-sentinel-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sentinel-textSubtle uppercase">
                2. Stablecoin Liquid Reserve (USDC)
              </span>
              <span className="text-xs font-mono font-bold text-white">
                Floor: ≥ {minRequiredReservePct.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center justify-between py-2 text-sm">
              <div className="text-center">
                <span className="text-[11px] text-sentinel-textSubtle block">PRE-TRADE</span>
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                  {preReservePct.toFixed(1)}%
                </span>
              </div>

              <div className="flex flex-col items-center">
                <ArrowRight className="w-5 h-5 text-sentinel-accent" />
                <span className="text-[10px] text-sentinel-textMuted font-mono">Transition</span>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-sentinel-textSubtle block">PROPOSED POST-TRADE</span>
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${
                    postReservePct >= minRequiredReservePct ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {postReservePct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Verdict */}
            <div
              className={`p-2.5 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between ${
                postReservePct >= minRequiredReservePct
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              <span>{postReservePct >= minRequiredReservePct ? '✓ ABOVE RESERVE FLOOR' : '✗ DROPS BELOW 20.0% FLOOR'}</span>
              <span>{postReservePct >= minRequiredReservePct ? 'PASS' : 'FAIL'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Invariant Evaluation Checklist */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-sentinel-text">Detailed Invariant Evaluation Results</h3>

        <div className="divide-y divide-sentinel-border">
          {evaluation.checks.map((check) => {
            const checkTitle = {
              MAX_SINGLE_ASSET: 'Single-Asset Exposure Limit',
              MIN_STABLECOIN: 'Minimum Stablecoin Reserve Floor',
              MAX_TRADE_SIZE: 'Maximum Trade Size Limit',
              SLIPPAGE: 'Execution Slippage Tolerance',
            }[check.checkName] || check.checkName;

            const thresholdDisplay =
              check.checkName === 'MAX_TRADE_SIZE'
                ? formatCurrency(check.expectedBpsOrValue, { maximumFractionDigits: 0 })
                : `${(check.expectedBpsOrValue / 100).toFixed(2)}%`;

            const actualDisplay =
              check.checkName === 'MAX_TRADE_SIZE'
                ? formatCurrency(check.actualBpsOrValue, { maximumFractionDigits: 0 })
                : `${(check.actualBpsOrValue / 100).toFixed(2)}%`;

            return (
              <div key={check.checkName} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  {check.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold text-white">{checkTitle}</div>
                    <div className="text-[11px] text-sentinel-textMuted">{check.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-right">
                  <div className="hidden sm:block text-sentinel-textSubtle">
                    Threshold: {thresholdDisplay} (Actual: {actualDisplay})
                  </div>
                  <Badge variant={check.passed ? 'success' : 'danger'} size="sm">
                    {check.passed ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical Details Toggle */}
        <div className="pt-2 border-t border-sentinel-border">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <span>{showTechnicalDetails ? 'Hide Cryptographic Hashes' : 'Show Cryptographic Hashes'}</span>
            {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTechnicalDetails && (
            <div className="mt-3 p-4 bg-sentinel-surfaceMuted rounded-lg border border-sentinel-border font-mono text-xs space-y-2">
              <div>
                <span className="text-sentinel-textSubtle block">PRE-STATE COMMITMENT (SHA-256)</span>
                <span className="text-white break-all">{evidenceRecord.preStateHash}</span>
              </div>
              <div>
                <span className="text-sentinel-textSubtle block">POST-STATE COMMITMENT (SHA-256)</span>
                <span className="text-white break-all">{evidenceRecord.postStateHash}</span>
              </div>
              <div>
                <span className="text-sentinel-textSubtle block">POLICY HASH</span>
                <span className="text-white break-all">{evidenceRecord.policyHash}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
