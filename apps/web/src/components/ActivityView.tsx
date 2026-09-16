'use client';

import React, { useState } from 'react';
import { DecisionCycleReport } from '@sentinel/sdk';
import { PortfolioSnapshot, FinancialPolicy, EvidenceRecord } from '@sentinel/domain';
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
} from 'lucide-react';
import { Badge } from './ui/Badge';
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
                      <div className="text-[11px] text-sentinel-textMuted">
                        Swarm Consensus: {record.swarmSummary?.consensus ? `${record.swarmSummary.passedCount}/${record.swarmSummary.totalCount}` : 'FAIL'}
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
