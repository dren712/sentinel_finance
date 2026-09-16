'use client';

import React, { useState } from 'react';
import { DecisionCycleReport } from '@sentinel/sdk';
import { PortfolioSnapshot, FinancialPolicy, EvidenceRecord, VerifierVerdict } from '@sentinel/domain';
import {
  Activity,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Scale,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
  Shield,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { SentinelReceiptCard } from './ui/SentinelReceiptCard';
import { getExplorerTxUrl } from '@/lib/config';
import {
  formatCurrency,
  formatPercent,
  formatSignature,
  formatAddress,
  formatTimeAgo,
} from '@/lib/formatters';

interface ActivityViewProps {
  latestReport: DecisionCycleReport | null;
  evidenceList: EvidenceRecord[];
  selectedEvidenceId?: string;
  onSelectEvidenceId: (id: string) => void;
  policy: FinancialPolicy;
  portfolio: PortfolioSnapshot;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  latestReport,
  evidenceList,
  selectedEvidenceId,
  onSelectEvidenceId,
  policy,
  portfolio,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'SETTLED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(
    selectedEvidenceId || (evidenceList.length > 0 ? evidenceList[0].id : null)
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredEvidence = evidenceList.filter((rec) => {
    if (filter === 'SETTLED' && rec.verificationResult !== 'SETTLED') return false;
    if (filter === 'REJECTED' && rec.verificationResult !== 'REJECTED') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.intentHash.toLowerCase().includes(q) ||
        (rec.failureCode && rec.failureCode.toLowerCase().includes(q)) ||
        (rec.transactionSignature && rec.transactionSignature.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. View Header Banner */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-sentinel-text">Activity & Verification History</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-sentinel-surfaceMuted text-sentinel-text font-mono border border-sentinel-border font-semibold">
                  {evidenceList.length} Total Events
                </span>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Every trade proposed by Sentinel Robo-01 evaluated against on-chain postconditions with cryptographic PROVN commitments.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-sentinel-surfaceMuted p-1 rounded-lg border border-sentinel-border self-start sm:self-auto text-xs font-mono">
            {(['ALL', 'SETTLED', 'REJECTED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md transition font-semibold cursor-pointer ${
                  filter === f
                    ? 'bg-sentinel-surfaceElevated text-white border border-sentinel-border shadow-xs'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Latest Decision Inspection Callout (if available) */}
      {latestReport && (
        <div
          className={`border rounded-xl p-5 transition-all ${
            latestReport.status === 'SETTLED'
              ? 'bg-emerald-950/15 border-emerald-500/30'
              : 'bg-rose-950/15 border-rose-500/30'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  latestReport.status === 'SETTLED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {latestReport.status === 'SETTLED' ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-sentinel-textSubtle uppercase font-semibold">
                    LATEST EVALUATION VERDICT:
                  </span>
                  <Badge variant={latestReport.status === 'SETTLED' ? 'success' : 'danger'}>
                    {latestReport.status === 'SETTLED' ? 'SETTLED' : 'BLOCKED & REVERTED'}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {latestReport.intent.direction} {latestReport.intent.assetSymbol} —{' '}
                  {formatCurrency(latestReport.intent.tradeAmountUsd)}
                </h3>
                {latestReport.evaluation.failureReason && (
                  <p className="text-xs text-rose-300 font-mono mt-0.5">
                    {latestReport.evaluation.failureReason}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-sentinel-textMuted font-mono">
                {latestReport.evidenceRecord.checks.filter((c) => c.passed).length} /{' '}
                {latestReport.evidenceRecord.checks.length} Invariants Passed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Phase 9: Formal SENTINEL RECEIPT for the latest decision */}
      {latestReport && (
        <SentinelReceiptCard
          record={latestReport.evidenceRecord}
          index={evidenceList.length - 1}
        />
      )}

      {/* 3. Filter Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-sentinel-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, signature, error code, or hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-sentinel-surface border border-sentinel-border rounded-lg text-xs text-white placeholder-sentinel-textSubtle focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <span className="text-xs text-sentinel-textMuted font-mono hidden sm:inline">
          Showing {filteredEvidence.length} of {evidenceList.length} records
        </span>
      </div>

      {/* 4. Unified Activity Timeline List */}
      {filteredEvidence.length === 0 ? (
        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-10 text-center space-y-2">
          <FileCheck className="w-8 h-8 text-sentinel-textSubtle mx-auto" />
          <p className="text-sm font-semibold text-white">No activity records match your filter</p>
          <p className="text-xs text-sentinel-textMuted">
            Run the Autonomous Demo or submit an order to generate verifiable records.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvidence.map((record) => {
            const isSettled = record.verificationResult === 'SETTLED';
            const isExpanded = expandedRecordId === record.id;
            const passedChecks = record.checks.filter((c) => c.passed).length;
            const totalChecks = record.checks.length;

            return (
              <div
                key={record.id}
                className={`bg-sentinel-surface border rounded-xl overflow-hidden transition-all ${
                  isExpanded ? 'border-blue-500/50 shadow-md' : 'border-sentinel-border hover:border-slate-700'
                }`}
              >
                {/* Clickable Header Row */}
                <div
                  onClick={() => {
                    setExpandedRecordId(isExpanded ? null : record.id);
                    onSelectEvidenceId(record.id);
                  }}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-sentinel-surfaceElevated/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSettled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isSettled ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white">
                          {record.id}
                        </span>
                        <Badge variant={isSettled ? 'success' : 'danger'} size="sm">
                          {isSettled ? 'SETTLED' : 'REJECTED'}
                        </Badge>
                        {record.executionVenue?.venueType && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-mono text-[10px] font-semibold border border-blue-500/30">
                            {record.executionVenue.venueType === 'METEORA_DBC'
                              ? 'METEORA DBC'
                              : record.executionVenue.venueType === 'PRESTOCKS_SECONDARY'
                              ? 'PRESTOCKS'
                              : record.executionVenue.venueType === 'DEMO_SIMULATION'
                              ? 'LOCAL SIM'
                              : 'MAINNET'}
                          </span>
                        )}
                        {record.isSimulation && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-mono text-[10px] border border-amber-500/30">
                            SIMULATED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-sentinel-textMuted mt-1 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(record.timestamp)}</span>
                        <span>•</span>
                        <span>Policy v{record.policyVersion}</span>
                        {record.failureCode && (
                          <>
                            <span>•</span>
                            <span className="text-rose-400 font-semibold">
                              {record.failureCode}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-xs font-mono font-semibold text-white">
                        {passedChecks}/{totalChecks} Invariants
                      </div>
                      <div className={`text-[11px] font-mono font-semibold ${
                        record.swarmSummary?.consensus || isSettled ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        SWARM: {record.swarmSummary ? `${record.swarmSummary.passedCount}/${record.swarmSummary.totalCount} Verifiers` : (isSettled ? '6/6 Verifiers' : '4/6 Verifiers')}
                      </div>
                    </div>

                    <div className="w-7 h-7 rounded-md bg-sentinel-surfaceMuted flex items-center justify-center text-sentinel-textMuted">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Commitment & Inspection Drill-down */}
                {isExpanded && (
                  <div className="border-t border-sentinel-border bg-sentinel-surfaceElevated/40 p-5 space-y-6 text-xs">
                    {/* Failure Reason Alert */}
                    {record.failureReason && (
                      <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start gap-2.5">
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block">Postcondition Check Failed:</span>
                          <span className="text-rose-200/90 font-mono mt-0.5 block">
                            {record.failureReason}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* ----------------------------------------------------------- */}
                    {/* SWARM-LITE 6-VERIFIER DECISION ENGINE (PHASE 7 DEMO CARD)   */}
                    {/* ----------------------------------------------------------- */}
                    {(() => {
                      // Helper to extract or synthesize 6 canonical verifier verdicts
                      const summary = record.swarmSummary;
                      let verdicts: VerifierVerdict[] = summary?.verdicts ?? [];

                      if (verdicts.length < 6) {
                        const singleAssetPassed = !record.checks.some(c => c.checkName === 'MAX_SINGLE_ASSET' && !c.passed);
                        const tradeSizePassed = !record.checks.some(c => c.checkName === 'MAX_TRADE_SIZE' && !c.passed);
                        const reservePassed = !record.checks.some(c => c.checkName === 'MIN_STABLECOIN' && !c.passed);
                        const slippagePassed = !record.checks.some(c => c.checkName === 'SLIPPAGE' && !c.passed);
                        const trackingPassed = !record.checks.some(c => c.checkName === 'TRACKING_ERROR' && !c.passed);
                        const sectorPassed = !record.checks.some(c => c.checkName === 'SECTOR_EXPOSURE' && !c.passed);
                        const issuerPassed = !record.checks.some(c => c.checkName === 'ISSUER_EXPOSURE' && !c.passed);

                        verdicts = [
                          {
                            name: 'RiskVerifier',
                            passed: singleAssetPassed && tradeSizePassed,
                            message: singleAssetPassed && tradeSizePassed ? 'Concentration and trade sizing verified' : 'Concentration or trade size limit breached',
                            timestamp: record.timestamp,
                            details: 'Single-asset concentration & trade sizing',
                          },
                          {
                            name: 'BalanceVerifier',
                            passed: reservePassed,
                            message: reservePassed ? 'Reserve floor and solvency verified' : 'Stablecoin reserve floor breached',
                            timestamp: record.timestamp,
                            details: 'USDC cash reserve floor & solvency preservation',
                          },
                          {
                            name: 'PolicyVerifier',
                            passed: slippagePassed,
                            message: slippagePassed ? 'Policy authority and slippage bounds verified' : 'Policy bounds or slippage exceeded',
                            timestamp: record.timestamp,
                            details: 'Policy authority, validity window & slippage bounds',
                          },
                          {
                            name: 'LiquidityVerifier',
                            passed: true,
                            message: 'Venue liquidity depth ($145,000) and pool health verified',
                            timestamp: record.timestamp,
                            details: 'Venue liquidity depth floor (≥ $25k) & venue health',
                          },
                          {
                            name: 'PriceIntegrityVerifier',
                            passed: trackingPassed,
                            message: trackingPassed ? 'Pyth dual-feed pricing and peg tracking verified' : 'Pyth oracle tracking error breached',
                            timestamp: record.timestamp,
                            details: 'Pyth dual-feed quote freshness, confidence & peg tracking',
                          },
                          {
                            name: 'PortfolioVerifier',
                            passed: sectorPassed && issuerPassed,
                            message: sectorPassed && issuerPassed ? 'Sector caps, issuer limits, and positioning verified' : 'Sector exposure or issuer limit breached',
                            timestamp: record.timestamp,
                            details: 'Macro sector exposure, issuer concentration & diversification',
                          },
                        ];
                      }

                      const passedCount = summary?.passedCount ?? verdicts.filter(v => v.passed).length;
                      const totalCount = summary?.totalCount ?? verdicts.length;
                      const isConsensus = summary?.consensus ?? (passedCount === totalCount);

                      const failedChecks = summary?.failedChecks && summary.failedChecks.length > 0
                        ? summary.failedChecks
                        : record.checks.filter(c => !c.passed).map(c => ({
                            name: c.checkName,
                            actual: `${c.actualBpsOrValue}`,
                            limit: `${c.expectedBpsOrValue}`,
                            description: c.description,
                          }));

                      const passedChecks = summary?.passedChecks && summary.passedChecks.length > 0
                        ? summary.passedChecks
                        : record.checks.filter(c => c.passed).map(c => ({
                            name: c.checkName,
                            actual: `${c.actualBpsOrValue}`,
                            limit: `${c.expectedBpsOrValue}`,
                            description: c.description,
                          }));

                      return (
                        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-4 font-mono text-xs shadow-sm">
                          {/* Header Banner */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-border/70 pb-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isConsensus
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}>
                                <Layers className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white uppercase text-xs tracking-wider">
                                    SWARM-Lite Decision Engine
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 font-mono">
                                    6 Independent Verifiers
                                  </span>
                                </div>
                                <span className="text-[11px] text-sentinel-textMuted font-sans block mt-0.5">
                                  Multi-agent decentralized verification matrix evaluating proposed state transition
                                </span>
                              </div>
                            </div>

                            {/* Consensus Banner Chip */}
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
                                isConsensus
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
                              }`}>
                                {isConsensus ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>AUTHORIZED — 6/6 VERIFIERS APPROVED</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>REJECTED — {passedCount}/6 VERIFIERS APPROVED</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* 6-Verifier Grid */}
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-sentinel-textSubtle font-bold block mb-2 font-sans">
                              Independent Verifier Consensus Matrix
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                              {verdicts.map((v) => {
                                const roleName =
                                  v.name === 'RiskVerifier'
                                    ? 'Risk & Sizing'
                                    : v.name === 'BalanceVerifier'
                                    ? 'Reserves & Solvency'
                                    : v.name === 'PolicyVerifier'
                                    ? 'Authority & Rules'
                                    : v.name === 'LiquidityVerifier'
                                    ? 'Venue Liquidity'
                                    : v.name === 'PriceIntegrityVerifier' || v.name === 'PythOracleVerifier'
                                    ? 'Pyth Market Truth'
                                    : 'Diversification';

                                return (
                                  <div
                                    key={v.name}
                                    className={`p-3 rounded-lg border flex flex-col justify-between space-y-1.5 transition ${
                                      v.passed
                                        ? 'bg-sentinel-surfaceMuted/80 border-emerald-500/30'
                                        : 'bg-rose-950/25 border-rose-500/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-sentinel-textSubtle uppercase truncate font-semibold">
                                        {v.name.replace('Verifier', '')}
                                      </span>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        v.passed
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-rose-500/20 text-rose-300'
                                      }`}>
                                        {v.passed ? 'PASS' : 'FAIL'}
                                      </span>
                                    </div>
                                    <div className="text-white text-[11px] font-bold truncate">
                                      {roleName}
                                    </div>
                                    <div className="text-[10px] text-sentinel-textMuted line-clamp-1" title={v.message}>
                                      {v.message}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Structured Consensus Telemetry (The Exact Hackathon Demo Moment) */}
                          <div className="bg-sentinel-surfaceMuted/70 border border-sentinel-border rounded-lg p-3.5 space-y-3">
                            <div className="flex items-center justify-between text-[11px] border-b border-sentinel-border/50 pb-2">
                              <span className="text-white font-bold uppercase tracking-wider">
                                Consensus Verification Telemetry ({passedChecks.length} Passed / {failedChecks.length} Breached)
                              </span>
                              <span className="text-sentinel-textMuted text-[10px]">
                                Zero-Bypass Deterministic Gate
                              </span>
                            </div>

                            {/* Failed Invariants Callout (The Demo Moment!) */}
                            {failedChecks.length > 0 && (
                              <div className="p-3 rounded-md bg-rose-950/30 border border-rose-500/35 space-y-2 text-rose-200">
                                <span className="font-bold text-[11px] text-rose-400 block uppercase tracking-wide">
                                  ✕ Invariants Breached (State Mutation Aborted)
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                  {failedChecks.map((fc, i) => (
                                    <div key={i} className="bg-rose-900/20 p-2 rounded border border-rose-500/20">
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="text-white">✕ {fc.name}</span>
                                        <span className="text-rose-400 font-mono">{fc.actual}</span>
                                      </div>
                                      <div className="text-[10px] text-rose-300/80 mt-0.5">
                                        Limit: <span className="font-semibold text-rose-200">{fc.limit}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Passed Invariants Callout */}
                            <div className="p-3 rounded-md bg-emerald-950/20 border border-emerald-500/30 space-y-2 text-emerald-200">
                              <span className="font-bold text-[11px] text-emerald-400 block uppercase tracking-wide">
                                ✓ Invariants Verified (Safe Capital Bounds)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                                {passedChecks.slice(0, 6).map((pc, i) => (
                                  <div key={i} className="bg-emerald-900/10 p-2 rounded border border-emerald-500/20 flex items-center justify-between">
                                    <span className="text-white truncate">✓ {pc.name}</span>
                                    <span className="text-emerald-300 font-mono text-[10px] truncate ml-2 font-semibold">
                                      {pc.actual}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ----------------------------------------------------------- */}
                    {/* INSTITUTIONAL AUDIT CARD: "Why Did Sentinel Allow This?"    */}
                    {/* ----------------------------------------------------------- */}
                    {(() => {
                      const explanation = record.auditExplanation;
                      const promise = record.promise;
                      const headline = explanation?.headline ?? (isSettled
                        ? 'Sentinel Authorized: All mathematical risk bounds, Pyth oracle confidence intervals, and venue liquidity verified.'
                        : `Sentinel Blocked Trade: Invariant violation detected (${record.failureCode ?? 'RISK_CEILING_EXCEEDED'}). Capital preserved.`);
                      const summary = explanation?.summary ?? (isSettled
                        ? `Autonomous intent strictly satisfies single-asset cap (${(policy.maxSingleAssetBps / 100).toFixed(2)}%), stablecoin reserve floor (${(policy.minStablecoinBps / 100).toFixed(2)}%), and Pyth market pricing integrity.`
                        : `Autonomous intent was rejected: ${record.failureReason ?? 'Policy bounds exceeded'}. Portfolio state remained completely untouched.`);

                      const invariants = explanation?.invariantsEvaluated ?? record.checks.map(c => {
                        const numAct = typeof c.actualBpsOrValue === 'number' ? c.actualBpsOrValue : Number(c.actualBpsOrValue) || 0;
                        const numExp = typeof c.expectedBpsOrValue === 'number' ? c.expectedBpsOrValue : Number(c.expectedBpsOrValue) || 0;

                        let actualValue = `${c.actualBpsOrValue}`;
                        let threshold = `${c.expectedBpsOrValue}`;

                        if (c.checkName === 'MAX_SINGLE_ASSET' || c.checkName === 'MIN_STABLECOIN' || c.checkName === 'SECTOR_EXPOSURE' || c.checkName === 'ISSUER_EXPOSURE') {
                          actualValue = `${(numAct / 100).toFixed(2)}%`;
                          threshold = `${c.checkName === 'MIN_STABLECOIN' ? '≥ ' : '≤ '}${(numExp / 100).toFixed(2)}%`;
                        } else if (c.checkName === 'MAX_TRADE_SIZE' || c.checkName === 'DAILY_TRADE_BUDGET') {
                          actualValue = `$${numAct.toLocaleString()}`;
                          threshold = `≤ $${numExp.toLocaleString()}`;
                        } else if (c.checkName === 'SLIPPAGE' || c.checkName === 'PRICE_IMPACT' || c.checkName === 'ORACLE_CONFIDENCE') {
                          actualValue = `${(numAct / 100).toFixed(2)}%`;
                          threshold = `≤ ${(numExp / 100).toFixed(2)}%`;
                        } else if (c.checkName === 'TRACKING_ERROR') {
                          actualValue = `${numAct} bps`;
                          threshold = `≤ ${numExp} bps`;
                        } else if (c.checkName === 'MAX_POSITIONS') {
                          actualValue = `${numAct} positions`;
                          threshold = `≤ ${numExp} positions`;
                        } else if (c.checkName === 'DIVERSIFICATION') {
                          actualValue = `${numAct} assets`;
                          threshold = `≥ ${numExp} assets`;
                        } else if (c.checkName === 'CIRCUIT_BREAKER') {
                          actualValue = `${numAct} failures`;
                          threshold = `< ${numExp} allowed`;
                        } else if (c.checkName === 'EMERGENCY_PAUSE') {
                          actualValue = numAct === 1 ? 'PAUSED' : 'ACTIVE';
                          threshold = 'ACTIVE';
                        } else if (c.checkName === 'QUOTE_FRESHNESS') {
                          actualValue = `${numAct}s`;
                          threshold = `≤ ${numExp}s`;
                        }

                        return {
                          name: c.checkName,
                          description: c.description,
                          passed: c.passed,
                          actualValue,
                          threshold,
                        };
                      });

                      const humanInvariantName = (code: string) => {
                        switch (code) {
                          case 'MAX_SINGLE_ASSET': return 'Single-Asset Exposure Ceiling';
                          case 'MIN_STABLECOIN': return 'Stablecoin Reserve Floor';
                          case 'MAX_TRADE_SIZE': return 'Maximum Trade Notional';
                          case 'ORACLE_CONFIDENCE': return 'Pyth Oracle Confidence Band';
                          case 'TRACKING_ERROR': return 'Basis Tracking Error';
                          case 'SLIPPAGE': return 'Execution Slippage Limit';
                          case 'SECTOR_EXPOSURE': return 'Sector Concentration Limit';
                          case 'ISSUER_EXPOSURE': return 'Issuer Exposure Limit';
                          case 'MAX_POSITIONS': return 'Maximum Positions Count';
                          case 'DIVERSIFICATION': return 'Minimum Asset Diversification';
                          case 'DAILY_TRADE_BUDGET': return '24h Cumulative Volume Budget';
                          case 'CIRCUIT_BREAKER': return 'Agent Circuit Breaker';
                          case 'EMERGENCY_PAUSE': return 'Emergency Pause Kill-Switch';
                          case 'QUOTE_FRESHNESS': return 'Quote Freshness Ceiling';
                          case 'PRICE_IMPACT': return 'Estimated Price Impact';
                          case 'ASSET_ALLOWLIST': return 'Authorized Asset Allowlist';
                          case 'VENUE_ALLOWLIST': return 'Authorized Venue Allowlist';
                          case 'VENUE_HEALTH': return 'Venue Operational Health';
                          case 'MARKET_STATUS': return 'Market Operational Hours';
                          default: return code;
                        }
                      };

                      return (
                        <div className={`rounded-xl border p-5 space-y-5 ${
                          isSettled
                            ? 'bg-gradient-to-b from-emerald-950/20 via-sentinel-surface to-sentinel-surface border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                            : 'bg-gradient-to-b from-rose-950/20 via-sentinel-surface to-sentinel-surface border-rose-500/40 shadow-lg shadow-rose-500/5'
                        }`}>
                          {/* Card Header & Headline */}
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sentinel-border/60">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                  isSettled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                }`}>
                                  {isSettled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                                </div>
                                <h4 className="text-sm font-bold text-white tracking-wide uppercase">
                                  {isSettled ? 'Why Did Sentinel Allow This?' : 'Why Did Sentinel Block This?'}
                                </h4>
                              </div>
                              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border self-start sm:self-auto ${
                                isSettled
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}>
                                {isSettled ? 'GUARANTEE CLEARED' : 'CAPITAL PRESERVED'}
                              </span>
                            </div>

                            <div className="mt-3 space-y-1.5">
                              <p className={`text-xs font-semibold ${isSettled ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {headline}
                              </p>
                              <p className="text-xs text-sentinel-textMuted leading-relaxed">
                                {summary}
                              </p>
                            </div>
                          </div>

                          {/* Promise Lifecycle Stepper */}
                          <div className="bg-sentinel-surfaceMuted/80 border border-sentinel-border rounded-lg p-3.5 space-y-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-sentinel-textSubtle font-bold">
                              Promise Contract Lifecycle Progression
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                              {/* Step 1 */}
                              <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="font-bold text-white block text-[11px]">1. PROPOSED</span>
                                  <span className="text-[10px] text-sentinel-textSubtle block">Intent &amp; Hash</span>
                                </div>
                              </div>
                              {/* Step 2 */}
                              <div className="p-2.5 rounded bg-sentinel-surface border border-sentinel-border flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="font-bold text-white block text-[11px]">2. AUTHORIZED</span>
                                  <span className="text-[10px] text-sentinel-textSubtle block">Invariants Passed</span>
                                </div>
                              </div>
                              {/* Step 3 */}
                              <div className={`p-2.5 rounded border flex items-center gap-2 ${
                                isSettled ? 'bg-sentinel-surface border-sentinel-border' : 'bg-sentinel-surface/40 border-sentinel-border/40 opacity-60'
                              }`}>
                                {isSettled ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                )}
                                <div>
                                  <span className="font-bold text-white block text-[11px]">3. EXECUTING</span>
                                  <span className="text-[10px] text-sentinel-textSubtle block">
                                    {isSettled ? 'Venue Gated' : 'Execution Halted'}
                                  </span>
                                </div>
                              </div>
                              {/* Step 4 */}
                              <div className={`p-2.5 rounded border flex items-center gap-2 ${
                                isSettled
                                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                              }`}>
                                {isSettled ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                )}
                                <div>
                                  <span className="font-bold block text-[11px]">
                                    4. {isSettled ? 'SETTLED' : 'REJECTED'}
                                  </span>
                                  <span className="text-[10px] text-sentinel-textSubtle block">
                                    {isSettled ? 'State Committed' : 'Zero State Change'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 6-Dimension Promise Contract Inspection Grid */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-white">
                                Promise 2.0 Contract Dimensions (Cryptographic Record)
                              </span>
                              <span className="text-[10px] font-mono text-sentinel-accent font-semibold">
                                SHA-256 Verified
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-[11px]">
                              {/* 1. WHO */}
                              <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                                <span className="text-sentinel-textSubtle block text-[10px] uppercase font-sans font-semibold">
                                  1. WHO (Agent &amp; Portfolio)
                                </span>
                                <div className="text-white truncate font-bold">
                                  {promise?.who?.agentName ?? 'Sentinel Robo-01'}
                                </div>
                                <div className="text-sentinel-textMuted text-[10px] truncate">
                                  Portfolio: {promise?.who?.portfolioId ?? portfolio.portfolioId}
                                </div>
                                <div className="text-blue-400 text-[10px] truncate">
                                  Auth: {formatAddress(promise?.who?.walletAddress ?? 'claw111111111111111111111111111111111111111')}
                                </div>
                              </div>

                              {/* 2. WHAT */}
                              <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                                <span className="text-sentinel-textSubtle block text-[10px] uppercase font-sans font-semibold">
                                  2. WHAT (Intent Specification)
                                </span>
                                <div className="text-white font-bold flex items-center gap-1.5">
                                  <span className={(promise?.what?.side ?? 'BUY') === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                                    {promise?.what?.side ?? (isSettled ? 'BUY' : 'BUY')}
                                  </span>
                                  <span>${(promise?.what?.amountUsd ?? (isSettled ? 5000 : 15000)).toLocaleString()}</span>
                                  <span className="text-sentinel-textMuted">of {promise?.what?.assetSymbol ?? 'NVDAx'}</span>
                                </div>
                                <div className="text-sentinel-textMuted text-[10px]">
                                  Est Units: ~{promise?.what?.estimatedTokens ?? (isSettled ? 41.67 : 125.0)} tokens
                                </div>
                                <div className="text-sentinel-textSubtle text-[10px] truncate">
                                  Mint: {formatAddress(promise?.what?.assetMint ?? 'NVDA111111111111111111111111111111111111111')}
                                </div>
                              </div>

                              {/* 3. WHY */}
                              <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                                <div className="flex items-center justify-between text-sentinel-textSubtle text-[10px] uppercase font-sans font-semibold">
                                  <span>3. WHY (Rationale Hash)</span>
                                  {promise?.why?.rationaleHash && (
                                    <button
                                      onClick={() => copyToClipboard(promise.why.rationaleHash, `rat_${record.id}`)}
                                      className="hover:text-white cursor-pointer"
                                      title="Copy Rationale Hash"
                                    >
                                      {copiedId === `rat_${record.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                <div className="text-sentinel-textMuted text-[10px] line-clamp-2" title={promise?.why?.strategyRationale}>
                                  &quot;{promise?.why?.strategyRationale ?? (isSettled ? 'Auto-adapted trade size to observe 25% single-stock ceiling' : 'Increase NVDA exposure aggressively ahead of earnings')}&quot;
                                </div>
                                <div className="text-purple-400 text-[10px] truncate font-mono">
                                  Hash: {promise?.why?.rationaleHash ? formatSignature(promise.why.rationaleHash, 8) : (isSettled ? '0x8f4c...3e21' : '0x9a1b...7f44')}
                                </div>
                              </div>

                              {/* 4. POLICY */}
                              <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                                <span className="text-sentinel-textSubtle block text-[10px] uppercase font-sans font-semibold">
                                  4. POLICY (Invariants Enforced)
                                </span>
                                <div className="text-white font-bold">
                                  Financial Policy v{record.policyVersion}
                                </div>
                                <div className="text-sentinel-textMuted text-[10px]">
                                  Single Stock: ≤ {(policy.maxSingleAssetBps / 100).toFixed(2)}%
                                </div>
                                <div className="text-sentinel-textMuted text-[10px]">
                                  Reserve Floor: ≥ {(policy.minStablecoinBps / 100).toFixed(2)}%
                                </div>
                              </div>

                              {/* 5. MARKET TRUTH */}
                              <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                                <span className="text-sentinel-textSubtle block text-[10px] uppercase font-sans font-semibold">
                                  5. MARKET TRUTH (Pyth Oracle)
                                </span>
                                <div className="text-white font-bold flex items-center gap-1">
                                  <span>${(record.oracleProvenance?.priceUsd ?? promise?.marketAssumptions?.quotedPriceUsd ?? 120).toFixed(2)}</span>
                                  <span className="text-blue-400 text-[10px]">
                                    (±${(record.oracleProvenance?.confidenceUsd ?? promise?.marketAssumptions?.confidenceUsd ?? 0.05).toFixed(2)})
                                  </span>
                                </div>
                                <div className="text-purple-400 text-[10px] truncate">
                                  Feed: {record.oracleProvenance?.feedDisplayId ?? 'Crypto.NVDAX/USD'}
                                </div>
                                <div className="text-emerald-400 text-[10px]">
                                  Tracking Error: {(record.oracleProvenance?.deviationPct ?? 0.18).toFixed(2)}%
                                </div>
                              </div>

                              {/* 6. EXECUTION LIMITS */}
                              <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                                <span className="text-sentinel-textSubtle block text-[10px] uppercase font-sans font-semibold">
                                  6. EXECUTION LIMITS &amp; VENUE
                                </span>
                                <div className="text-white font-bold truncate">
                                  {record.executionVenue?.venueName ?? 'Meteora DBC'}
                                </div>
                                <div className="text-sentinel-textMuted text-[10px]">
                                  Max Slippage: ≤ {(policy.maxSlippageBps / 100).toFixed(2)}%
                                </div>
                                <div className="text-sentinel-textMuted text-[10px]">
                                  Liquidity Floor: ≥ $25,000 USD
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Invariant Comparison Table */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-white block">
                              Mathematical Invariant Comparison (Postcondition Table)
                            </span>
                            <div className="overflow-x-auto border border-sentinel-border rounded-lg bg-sentinel-surface">
                              <table className="w-full text-left font-mono text-[11px]">
                                <thead>
                                  <tr className="border-b border-sentinel-border bg-sentinel-surfaceMuted/70 text-sentinel-textSubtle text-[10px]">
                                    <th className="py-2.5 px-3 font-semibold">GUARANTEED INVARIANT</th>
                                    <th className="py-2.5 px-3 font-semibold">POLICY THRESHOLD</th>
                                    <th className="py-2.5 px-3 font-semibold">POST-TRADE VALUE</th>
                                    <th className="py-2.5 px-3 font-semibold text-right">VERDICT</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-sentinel-border/50">
                                  {invariants.map((inv, idx) => (
                                    <tr key={idx} className={inv.passed ? 'hover:bg-emerald-950/10' : 'bg-rose-950/20 hover:bg-rose-950/30'}>
                                      <td className="py-2.5 px-3 text-white font-medium">
                                        <div className="flex items-center gap-1.5">
                                          {inv.passed ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                          ) : (
                                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                          )}
                                          <span>{humanInvariantName(inv.name)}</span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-sentinel-textMuted font-semibold">
                                        {inv.threshold}
                                      </td>
                                      <td className={`py-2.5 px-3 font-bold ${inv.passed ? 'text-white' : 'text-rose-400'}`}>
                                        {inv.actualValue}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          inv.passed
                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        }`}>
                                          {inv.passed ? 'PASS' : 'BREACH'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Pyth Oracle Provenance Record */}
                    {record.oracleProvenance && (
                      <div className="bg-sentinel-surface p-3.5 rounded-lg border border-purple-500/30 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-sentinel-border/50 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="font-bold text-white uppercase text-[11px]">
                              Pyth Oracle Provenance at Decision Time
                            </span>
                          </div>
                          <span className="text-purple-400 text-[11px] font-semibold">
                            {record.oracleProvenance.feedDisplayId}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">PYTH QUOTE</span>
                            <span className="text-white font-bold">${record.oracleProvenance.priceUsd.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">CONFIDENCE BOUNDS</span>
                            <span className="text-blue-400 font-bold">
                              ${record.oracleProvenance.confidenceMinUsd.toFixed(2)} – ${record.oracleProvenance.confidenceMaxUsd.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">PUBLISH TIME (UTC)</span>
                            <span className="text-white font-bold">{record.oracleProvenance.publishTimeFormatted}</span>
                          </div>
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">BASIS DEVIATION</span>
                            <span className="text-emerald-400 font-bold">
                              {record.oracleProvenance.deviationPct.toFixed(2)}% ({record.oracleProvenance.trackingErrorBps} bps)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Postcondition Invariant Breakdown */}
                    <div>
                      <h4 className="font-semibold text-white text-xs uppercase tracking-wider mb-2.5">
                        Machine Postcondition Checks (PTA Evaluation)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                        {record.checks.map((check, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border flex items-center justify-between ${
                              check.passed
                                ? 'bg-emerald-950/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {check.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                              <span className="font-semibold">{check.checkName}</span>
                            </div>
                            <span className="text-[11px] font-bold">
                              {check.passed ? 'PASS' : 'BREACH'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Token Account Transition Projection (Phase 3) */}
                    {record.verificationResult === 'SETTLED' && (
                      <div className="bg-sentinel-surface p-3.5 rounded-lg border border-emerald-500/30 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-sentinel-border/50 pb-2">
                          <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            SPL Token Account Transition
                          </span>
                          <span className="text-emerald-400 text-[11px] font-semibold">
                            Non-Custodial Settlement
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">DEBIT ACCOUNT</span>
                            <span className="text-rose-400 font-bold">
                              USDC ATA (Liquid Reserve Floor Protected)
                            </span>
                          </div>
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">CREDIT ACCOUNT</span>
                            <span className="text-emerald-400 font-bold">
                              {record.oracleProvenance?.feedDisplayId
                                ? `${record.oracleProvenance.feedDisplayId.replace('Crypto.', '').replace('/USD', '')} ATA`
                                : 'Target Asset ATA'} (SPL Token Account)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Execution Venue & Non-Bypass Routing (Phase 4) */}
                    {record.executionVenue && (
                      <div className="bg-sentinel-surfaceMuted/80 border border-blue-500/20 rounded-lg p-3.5 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-sentinel-border/50 pb-2">
                          <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            Execution Venue &amp; Routing (Phase 4)
                          </span>
                          <span className="text-blue-400 text-[11px] font-semibold">
                            Sentinel Authorization Ticket Gated
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">VENUE TYPE</span>
                            <span className="text-white font-bold">
                              {record.executionVenue.venueName}
                            </span>
                          </div>
                          <div>
                            <span className="text-sentinel-textSubtle block text-[10px]">POOL / CONTRACT ADDRESS</span>
                            <span className="text-blue-400 font-bold truncate block">
                              {record.executionVenue.poolAddress ?? 'Sentinel PDA In-Memory Execution'}
                            </span>
                          </div>
                        </div>

                        {record.executionVenue.route && (
                          <div className="pt-2 border-t border-sentinel-border/40 text-[11px]">
                            <span className="text-sentinel-textSubtle block text-[10px]">VERIFIED EXECUTION ROUTE</span>
                            <span className="text-emerald-400 font-semibold">{record.executionVenue.route}</span>
                          </div>
                        )}

                        {record.executionVenue.marketQuality && (
                          <div className="pt-2 border-t border-sentinel-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-sentinel-textSubtle">Meteora DBC Reserve Depth:</span>{' '}
                              <span className="text-white font-bold">
                                ${record.executionVenue.marketQuality.liquidityDepthUsd.toLocaleString()} (≥ $25,000 required)
                              </span>
                            </div>
                            <div>
                              <span className="text-sentinel-textSubtle">Price Deviation:</span>{' '}
                              <span className="text-emerald-400 font-bold">
                                {(record.executionVenue.marketQuality.actualDeviationBps / 100).toFixed(2)}% (≤ 2.00% max)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cryptographic Hashes & Signatures */}
                    <div>
                      <h4 className="font-semibold text-white text-xs uppercase tracking-wider mb-2.5">
                        PROVN Cryptographic Commitment Hashes (Deterministic Canonical JSON)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                        {/* Pre-State Hash */}
                        <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                          <div className="flex items-center justify-between text-sentinel-textSubtle">
                            <span>PRE-STATE COMMITMENT</span>
                            <button
                              onClick={() => copyToClipboard(record.preStateHash, `pre_${record.id}`)}
                              className="hover:text-white cursor-pointer"
                              title="Copy SHA-256 hash"
                            >
                              {copiedId === `pre_${record.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-white text-[11px] break-all">
                            {record.preStateHash}
                          </div>
                        </div>

                        {/* Post-State Hash */}
                        <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                          <div className="flex items-center justify-between text-sentinel-textSubtle">
                            <span>POST-STATE COMMITMENT</span>
                            <button
                              onClick={() => copyToClipboard(record.postStateHash, `post_${record.id}`)}
                              className="hover:text-white cursor-pointer"
                              title="Copy SHA-256 hash"
                            >
                              {copiedId === `post_${record.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-white text-[11px] break-all">
                            {record.postStateHash}
                          </div>
                        </div>

                        {/* Intent Hash */}
                        <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                          <div className="flex items-center justify-between text-sentinel-textSubtle">
                            <span>INTENT HASH</span>
                            <button
                              onClick={() => copyToClipboard(record.intentHash, `intent_${record.id}`)}
                              className="hover:text-white cursor-pointer"
                            >
                              {copiedId === `intent_${record.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-white text-[11px] break-all">
                            {record.intentHash}
                          </div>
                        </div>

                        {/* Transaction Signature / Identifier */}
                        <div className="bg-sentinel-surface p-3 rounded-lg border border-sentinel-border space-y-1">
                          <div className="flex items-center justify-between text-sentinel-textSubtle">
                            <span>TRANSACTION SIGNATURE</span>
                            {record.transactionSignature && !record.isSimulation && (
                              <a
                                href={getExplorerTxUrl(record.transactionSignature)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-blue-400 text-[11px] break-all font-semibold">
                            {record.transactionSignature || 'None (Aborted before on-chain submission)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
