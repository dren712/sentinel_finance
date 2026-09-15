'use client';

import React from 'react';
import { DecisionCycleReport } from '@sentinel/sdk';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Hash,
  ExternalLink,
} from 'lucide-react';

interface DecisionsViewProps {
  latestReport: DecisionCycleReport | null;
  onSelectEvidenceId: (id: string) => void;
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({
  latestReport,
  onSelectEvidenceId,
}) => {
  if (!latestReport) {
    return (
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
          <Cpu className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No Active Decision Inspected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Click &quot;Run Autonomous Demo&quot; in the header or propose a trade from the Agent tab to see Sentinel evaluate postconditions in real time.
        </p>
      </div>
    );
  }

  const { intent, evaluation, promise, evidenceRecord, resultingPortfolio, status } = latestReport;
  const isSettled = status === 'SETTLED';

  // Affected assets
  const targetAsset = evaluation.postState.assets.find(a => a.symbol === intent.assetSymbol);
  const usdcAsset = evaluation.postState.assets.find(a => a.isStablecoin || a.symbol === 'USDC');

  return (
    <div className="space-y-6">
      {/* Top Banner: Decision Summary & Verdict */}
      <div className={`border rounded-xl p-6 ${
        isSettled
          ? 'bg-emerald-950/20 border-emerald-500/40'
          : 'bg-red-950/20 border-red-500/40'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isSettled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}>
              {isSettled ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400 uppercase">PTA State Transition Decision:</span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
                  isSettled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {isSettled ? 'POSTCONDITIONS SATISFIED • SETTLED' : 'POSTCONDITION VIOLATION • TRANSACTION ABORTED'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {intent.direction} {intent.assetSymbol} — ${intent.tradeAmountUsd.toLocaleString()} USD
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">EVIDENCE COMMITMENT:</span>
            <button
              onClick={() => onSelectEvidenceId(evidenceRecord.id)}
              className="text-xs font-mono text-blue-400 hover:text-blue-300 underline flex items-center gap-1 mt-0.5 ml-auto"
            >
              <span>{evidenceRecord.id.slice(0, 18)}...</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Reason Banner if rejected */}
        {!isSettled && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-200">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-300 block">REJECTION REASON CODE: {evidenceRecord.failureCode}</span>
              <span className="mt-0.5 block">{evidenceRecord.failureReason}</span>
              <span className="text-slate-300 text-[11px] block mt-1">
                State transition was aborted before execution. The portfolio balances remain completely untouched.
              </span>
            </div>
          </div>
        )}

        {isSettled && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-300 block">STATE TRANSITION SETTLED SAFELY</span>
              <span className="mt-0.5 block">
                All 4 postconditions verified on-chain. Transaction executed with signature {evidenceRecord.transactionSignature.slice(0, 24)}...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Visual PTA State Machine Pipeline */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          PTA (Postcondition-Transaction-Acceptance) Lifecycle
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Step 1: Created */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 relative">
            <div className="text-[10px] text-slate-500 font-mono">STEP 1</div>
            <div className="font-bold text-xs text-white mt-1">INTENT CREATED</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Agent proposes thesis</div>
            <div className="mt-2 text-emerald-400 text-xs flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </div>
          </div>

          {/* Step 2: Promised */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 relative">
            <div className="text-[10px] text-slate-500 font-mono">STEP 2</div>
            <div className="font-bold text-xs text-white mt-1">PROMISE ANCHORED</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Conditions locked</div>
            <div className="mt-2 text-emerald-400 text-xs flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </div>
          </div>

          {/* Step 3: Validating */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 relative">
            <div className="text-[10px] text-slate-500 font-mono">STEP 3</div>
            <div className="font-bold text-xs text-white mt-1">POSTCONDITION CHECK</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Integer math checks</div>
            <div className="mt-2 text-emerald-400 text-xs flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </div>
          </div>

          {/* Step 4: Outcome */}
          <div className={`rounded-lg p-3 border relative ${
            isSettled
              ? 'bg-emerald-950/40 border-emerald-500/40'
              : 'bg-red-950/40 border-red-500/40'
          }`}>
            <div className="text-[10px] font-mono text-slate-400">STEP 4 (FINAL)</div>
            <div className={`font-bold text-xs mt-1 ${isSettled ? 'text-emerald-400' : 'text-red-400'}`}>
              {isSettled ? 'SETTLED' : 'ABORTED / REJECTED'}
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              {isSettled ? 'State Committed' : 'State Preserved'}
            </div>
            <div className={`mt-2 text-xs flex items-center gap-1 font-bold ${
              isSettled ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {isSettled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>{isSettled ? 'Committed' : 'Rejected'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Transition Inspector: Pre-State vs Post-State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pre-Trade Snapshot */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-sentinel-cardBorder pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pre-Trade State Snapshot</h4>
              <span className="text-[11px] text-slate-500">Portfolio value before trade intent</span>
            </div>
            <span className="font-mono text-xs text-white font-bold">$100,000.00</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 px-2 rounded bg-slate-900/60">
              <span className="text-slate-400">{intent.assetSymbol} Exposure:</span>
              <span className="font-mono text-white font-semibold">20.00% ($20,000.00)</span>
            </div>
            <div className="flex justify-between py-1.5 px-2 rounded bg-slate-900/60">
              <span className="text-slate-400">USDC Reserve:</span>
              <span className="font-mono text-emerald-400 font-semibold">25.00% ($25,000.00)</span>
            </div>
            <div className="flex justify-between py-1.5 px-2 rounded bg-slate-900/60">
              <span className="text-slate-400">AAPLx Holdings:</span>
              <span className="font-mono text-white font-semibold">25.00% ($25,000.00)</span>
            </div>
            <div className="flex justify-between py-1.5 px-2 rounded bg-slate-900/60">
              <span className="text-slate-400">SPYx Index ETF:</span>
              <span className="font-mono text-white font-semibold">30.00% ($30,000.00)</span>
            </div>
          </div>
        </div>

        {/* Expected Post-Trade Snapshot */}
        <div className={`border rounded-xl p-5 space-y-3 ${
          isSettled ? 'bg-sentinel-card border-sentinel-cardBorder' : 'bg-red-950/10 border-red-900/40'
        }`}>
          <div className="flex items-center justify-between border-b border-sentinel-cardBorder pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hypothetical Post-Trade State</h4>
              <span className="text-[11px] text-slate-500">Resulting state evaluated against policy</span>
            </div>
            <span className="font-mono text-xs text-white font-bold">
              ${evaluation.postState.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className={`flex justify-between py-1.5 px-2 rounded ${
              (targetAsset?.exposureBps ?? 0) > promise.expectedConstraints.maxSingleAssetBps
                ? 'bg-red-950/60 border border-red-800 text-red-200'
                : 'bg-slate-900/60 text-white'
            }`}>
              <span className="text-slate-300 flex items-center gap-1.5">
                <span>{intent.assetSymbol} Exposure:</span>
                {(targetAsset?.exposureBps ?? 0) > promise.expectedConstraints.maxSingleAssetBps && (
                  <span className="text-[10px] font-bold text-red-400">❌ BREACH</span>
                )}
              </span>
              <span className="font-mono font-bold">
                {((targetAsset?.exposureBps ?? 0) / 100).toFixed(2)}% (${targetAsset?.valueUsd.toLocaleString()})
              </span>
            </div>

            <div className={`flex justify-between py-1.5 px-2 rounded ${
              evaluation.postState.stablecoinExposureBps < promise.expectedConstraints.minStablecoinBps
                ? 'bg-red-950/60 border border-red-800 text-red-200'
                : 'bg-slate-900/60 text-white'
            }`}>
              <span className="text-slate-300 flex items-center gap-1.5">
                <span>USDC Reserve:</span>
                {evaluation.postState.stablecoinExposureBps < promise.expectedConstraints.minStablecoinBps && (
                  <span className="text-[10px] font-bold text-red-400">❌ BREACH</span>
                )}
              </span>
              <span className="font-mono font-bold">
                {(evaluation.postState.stablecoinExposureBps / 100).toFixed(2)}% (${evaluation.postState.stablecoinValueUsd.toLocaleString()})
              </span>
            </div>

            <div className="flex justify-between py-1.5 px-2 rounded bg-slate-900/60">
              <span className="text-slate-400">AAPLx Holdings:</span>
              <span className="font-mono text-white font-semibold">25.00% ($25,000.00)</span>
            </div>
            <div className="flex justify-between py-1.5 px-2 rounded bg-slate-900/60">
              <span className="text-slate-400">SPYx Index ETF:</span>
              <span className="font-mono text-white font-semibold">30.00% ($30,000.00)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Guarantees Invariants Check Table */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-3">
          On-Chain Postcondition Verification Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sentinel-cardBorder text-slate-400 font-semibold">
                <th className="pb-3 font-medium">GUARANTEE INVARIANT</th>
                <th className="pb-3 font-medium">POLICY REQUIREMENT</th>
                <th className="pb-3 font-medium">RESULTING VALUE</th>
                <th className="pb-3 font-medium">STATUS</th>
                <th className="pb-3 font-medium">EXPLANATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-cardBorder/60">
              {evaluation.checks.map((check) => (
                <tr key={check.checkName} className="hover:bg-slate-800/20">
                  <td className="py-3 font-bold text-white">
                    {check.checkName === 'MAX_SINGLE_ASSET' && 'Max Single Equity Exposure'}
                    {check.checkName === 'MIN_STABLECOIN' && 'Minimum Stablecoin Reserve'}
                    {check.checkName === 'MAX_TRADE_SIZE' && 'Maximum Trade Size'}
                    {check.checkName === 'SLIPPAGE' && 'Maximum Slippage'}
                  </td>
                  <td className="py-3 font-mono text-slate-300">
                    {check.checkName === 'MAX_SINGLE_ASSET' && `<=${(check.expectedBpsOrValue / 100).toFixed(2)}%`}
                    {check.checkName === 'MIN_STABLECOIN' && `>=${(check.expectedBpsOrValue / 100).toFixed(2)}%`}
                    {check.checkName === 'MAX_TRADE_SIZE' && `<=$${check.expectedBpsOrValue.toLocaleString()}`}
                    {check.checkName === 'SLIPPAGE' && `<=${(check.expectedBpsOrValue / 100).toFixed(2)}%`}
                  </td>
                  <td className="py-3 font-mono font-bold">
                    <span className={check.passed ? 'text-white' : 'text-red-400'}>
                      {check.checkName === 'MAX_SINGLE_ASSET' && `${(check.actualBpsOrValue / 100).toFixed(2)}%`}
                      {check.checkName === 'MIN_STABLECOIN' && `${(check.actualBpsOrValue / 100).toFixed(2)}%`}
                      {check.checkName === 'MAX_TRADE_SIZE' && `$${check.actualBpsOrValue.toLocaleString()}`}
                      {check.checkName === 'SLIPPAGE' && `${(check.actualBpsOrValue / 100).toFixed(2)}%`}
                    </span>
                  </td>
                  <td className="py-3">
                    {check.passed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> PASS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-500/30 font-bold">
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-slate-300 max-w-sm">
                    {check.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SWARM-Lite 3-Module Breakdown */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span>SWARM-Lite Independent Verifier Modules</span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                {evidenceRecord.swarmSummary.passedCount}/{evidenceRecord.swarmSummary.totalCount} Passed
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Three independent invariant verifiers evaluate the proposed state transition concurrently
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {evidenceRecord.swarmSummary.verdicts.map((v) => (
            <div key={v.name} className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{v.name}</span>
                {v.passed ? (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> PASS
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/30">
                    <XCircle className="w-3 h-3" /> FAIL
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 line-clamp-3">{v.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
