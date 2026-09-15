'use client';

import React, { useState } from 'react';
import { EvidenceRecord } from '@sentinel/domain';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  Search,
  Scale,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { getExplorerTxUrl } from '@/lib/config';
import { formatSignature, formatAddress, formatTimeAgo, formatCurrency } from '@/lib/formatters';

interface EvidenceViewProps {
  evidenceList: EvidenceRecord[];
  selectedEvidenceId?: string;
  onSelectEvidenceId: (id: string) => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  evidenceList,
  selectedEvidenceId,
  onSelectEvidenceId,
}) => {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'SETTLED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(
    selectedEvidenceId || null
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const filteredList = evidenceList.filter((rec) => {
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

  if (evidenceList.length === 0) {
    return (
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 text-sentinel-accent border border-blue-500/30 flex items-center justify-center mx-auto">
          <FileCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-sentinel-text">No PROVN Evidence Records Yet</h3>
        <p className="text-xs text-sentinel-textMuted max-w-md mx-auto">
          Every decision proposed by the autonomous agent produces an immutable cryptographic evidence record linking pre-state, post-state, policy version, and verification outcomes on Solana.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-sentinel-text">PROVN Cryptographic Evidence Explorer</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-sentinel-surfaceMuted text-sentinel-text font-mono border border-sentinel-border font-semibold">
                  {evidenceList.length} Anchored Records
                </span>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Deterministic SHA-256 state commitments with RFC-8785 canonical JSON serialization.
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-sentinel-surfaceMuted p-1 rounded-lg border border-sentinel-border self-start sm:self-auto text-xs font-mono">
            {(['ALL', 'SETTLED', 'REJECTED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-sentinel-accent text-white font-semibold shadow-sm'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-sentinel-textSubtle absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Evidence ID, Intent Hash, Failure Code, or Signature..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sentinel-surfaceMuted border border-sentinel-border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-sentinel-textSubtle focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* 2. Records List */}
      <div className="space-y-4">
        {filteredList.map((record) => {
          const isSettled = record.verificationResult === 'SETTLED';
          const isExpanded = (expandedRecordId || selectedEvidenceId) === record.id;

          return (
            <div
              key={record.id}
              className={`bg-sentinel-surface border rounded-xl overflow-hidden transition-all ${
                isExpanded ? 'border-blue-500/60 shadow-lg shadow-blue-500/5' : 'border-sentinel-border hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div
                onClick={() => {
                  setExpandedRecordId(isExpanded ? null : record.id);
                  onSelectEvidenceId(record.id);
                }}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-sentinel-surfaceElevated/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSettled
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isSettled ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-mono">
                        Record: {formatAddress(record.id, 8)}
                      </span>
                      <span className="text-xs text-sentinel-textSubtle font-mono">
                        (Policy v{record.policyVersion})
                      </span>
                      <Badge variant={isSettled ? 'success' : 'danger'} size="sm">
                        {isSettled ? 'SETTLED' : 'ABORTED'}
                      </Badge>
                    </div>
                    <div className="text-xs text-sentinel-textMuted mt-0.5 font-mono">
                      {isSettled
                        ? 'All invariant guarantees verified. Mutated on Solana Devnet.'
                        : `Violated: ${record.failureReason || record.failureCode}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono self-end sm:self-auto">
                  <span className="text-sentinel-textSubtle">{formatTimeAgo(record.timestamp)}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-sentinel-textMuted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-sentinel-textMuted" />
                  )}
                </div>
              </div>

              {/* Expandable Technical Detail Body */}
              {isExpanded && (
                <div className="p-5 border-t border-sentinel-border bg-sentinel-surfaceMuted/60 space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Pre-State Hash */}
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-1">
                      <div className="flex items-center justify-between text-sentinel-textSubtle">
                        <span>PRE-STATE COMMITMENT (SHA-256)</span>
                        <button
                          onClick={() => copyToClipboard(record.preStateHash, `pre-${record.id}`)}
                          className="hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLabel === `pre-${record.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="text-white text-[11px] break-all">{record.preStateHash}</div>
                    </div>

                    {/* Post-State Hash */}
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-1">
                      <div className="flex items-center justify-between text-sentinel-textSubtle">
                        <span>POST-STATE COMMITMENT (SHA-256)</span>
                        <button
                          onClick={() => copyToClipboard(record.postStateHash, `post-${record.id}`)}
                          className="hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLabel === `post-${record.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="text-white text-[11px] break-all">{record.postStateHash}</div>
                    </div>

                    {/* Intent Hash */}
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-1">
                      <div className="flex items-center justify-between text-sentinel-textSubtle">
                        <span>INTENT COMMITMENT (RFC-8785 SHA-256)</span>
                        <button
                          onClick={() => copyToClipboard(record.intentHash, `intent-${record.id}`)}
                          className="hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLabel === `intent-${record.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="text-white text-[11px] break-all">{record.intentHash}</div>
                    </div>

                    {/* Policy Hash */}
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-1">
                      <div className="flex items-center justify-between text-sentinel-textSubtle">
                        <span>POLICY COMMITMENT (SHA-256)</span>
                        <button
                          onClick={() => copyToClipboard(record.policyHash, `policy-${record.id}`)}
                          className="hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLabel === `policy-${record.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="text-white text-[11px] break-all">{record.policyHash}</div>
                    </div>
                  </div>

                  {/* Transaction Signature */}
                  {record.transactionSignature && (
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-1">
                      <div className="flex items-center justify-between text-sentinel-textSubtle">
                        <span>SOLANA DEVNET TRANSACTION</span>
                        <a
                          href={getExplorerTxUrl(record.transactionSignature)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>View on Solana Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="text-white text-[11px] break-all">{record.transactionSignature}</div>
                    </div>
                  )}

                  {/* Checks Details */}
                  {record.checks && record.checks.length > 0 && (
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-2">
                      <span className="text-sentinel-textSubtle block">EVALUATED INVARIANTS</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {record.checks.map((c) => (
                          <div
                            key={c.checkName}
                            className="p-2.5 rounded bg-sentinel-surfaceMuted border border-sentinel-border flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <span className="text-white font-semibold block">{c.description}</span>
                              <span className="text-sentinel-textSubtle text-[10px]">
                                Threshold: {c.expectedBpsOrValue} • Actual: {c.actualBpsOrValue}
                              </span>
                            </div>
                            <Badge variant={c.passed ? 'success' : 'danger'} size="sm">
                              {c.passed ? 'PASS' : 'FAIL'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Swarm Verifiers */}
                  {record.swarmSummary && record.swarmSummary.verdicts && (
                    <div className="bg-sentinel-surface p-3.5 rounded-lg border border-sentinel-border space-y-2">
                      <span className="text-sentinel-textSubtle block">LOCAL SWARM-LITE VERIFIER PARTICIPANTS</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {record.swarmSummary.verdicts.map((v) => (
                          <div
                            key={v.name}
                            className="p-2 rounded bg-sentinel-surfaceMuted border border-sentinel-border flex items-center justify-between"
                          >
                            <span className="text-white">{v.name}</span>
                            <Badge variant={v.passed ? 'success' : 'danger'} size="sm">
                              {v.passed ? 'PASS' : 'FAIL'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
