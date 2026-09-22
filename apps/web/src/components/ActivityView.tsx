'use client';

import React, { useState } from 'react';
import { DecisionCycleReport } from '@sentinel/sdk';
import { PortfolioSnapshot, FinancialPolicy, EvidenceRecord, VerifierVerdict, deriveSentinelPda } from '@sentinel/domain';
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
  X,
  Lock,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { SentinelReceiptCard } from './ui/SentinelReceiptCard';
import { getExplorerTxUrl, getExplorerAddressUrl, APP_CONFIG } from '@/lib/config';
import {
  formatCurrency,
  formatPercent,
  formatAddress,
} from '@/lib/formatters';

interface ActivityViewProps {
  latestReport: DecisionCycleReport | null;
  evidenceList: EvidenceRecord[];
  selectedEvidenceId?: string;
  onSelectEvidenceId: (id: string) => void;
  policy: FinancialPolicy;
  portfolio: PortfolioSnapshot;
}

interface TimelineItem {
  id: string;
  time: string;
  action: string;
  amount: string;
  status: 'SETTLED' | 'REJECTED' | 'ADAPTED' | 'POLICY_UPDATE';
  statusLabel: string;
  headline: string;
  subheadline: string;
  evidenceRecord?: EvidenceRecord;
  beforeVsProposed?: Array<{
    asset: string;
    before: string;
    proposed: string;
    limit: string;
    passed: boolean;
  }>;
  checks?: Array<{
    name: string;
    passed: boolean;
  }>;
  adaptationNarrative?: {
    adaptedAction: string;
    settlementTx: string;
  };
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
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isTechnicalDrawerOpen, setIsTechnicalDrawerOpen] = useState(false);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<TimelineItem | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Canonical Timeline Items for "TODAY"
  const defaultTimelineItems: TimelineItem[] = [
    {
      id: 'canon-01',
      time: '14:32',
      action: 'BUY AAPLx',
      amount: '$2,840',
      status: 'SETTLED',
      statusLabel: 'Settled',
      headline: 'TRADE SETTLED',
      subheadline: 'Executed via Meteora Dynamic Bonding Curve',
      beforeVsProposed: [
        { asset: 'AAPLx', before: '20.0%', proposed: '24.1%', limit: 'Limit 25.0%', passed: true },
        { asset: 'USDC', before: '25.0%', proposed: '22.3%', limit: 'Floor 20.0%', passed: true },
        { asset: 'NVDAx', before: '20.0%', proposed: '20.0%', limit: 'Limit 25.0%', passed: true },
        { asset: 'SPYx', before: '20.0%', proposed: '20.0%', limit: 'Limit 25.0%', passed: true },
      ],
      checks: [
        { name: 'Authority valid (Agent Signer Ed25519)', passed: true },
        { name: 'Policy active & non-paused', passed: true },
        { name: 'Pyth price fresh & within confidence', passed: true },
        { name: 'Concentration limit (24.1% ≤ 25.0%)', passed: true },
        { name: 'Minimum reserve (22.3% ≥ 20.0%)', passed: true },
        { name: 'Trade size ceiling ($2,840 ≤ $10,000)', passed: true },
      ],
      adaptationNarrative: {
        adaptedAction: 'Direct execution of compliant proposed intent',
        settlementTx: 'Meteora DBC Swap [SIMULATED EXECUTION]',
      },
    },
    {
      id: 'canon-02',
      time: '14:12',
      action: 'BUY NVDAx',
      amount: '$15,000',
      status: 'REJECTED',
      statusLabel: 'Rejected by Sentinel',
      headline: 'TRADE REJECTED',
      subheadline: 'Sentinel prevented execution · 3 violations detected',
      beforeVsProposed: [
        { asset: 'NVDAx', before: '20.0%', proposed: '35.0%', limit: 'Limit 25.0%', passed: false },
        { asset: 'USDC', before: '25.0%', proposed: '10.0%', limit: 'Floor 20.0%', passed: false },
        { asset: 'AAPLx', before: '20.0%', proposed: '20.0%', limit: 'Limit 25.0%', passed: true },
        { asset: 'SPYx', before: '20.0%', proposed: '20.0%', limit: 'Limit 25.0%', passed: true },
      ],
      checks: [
        { name: 'Authority valid', passed: true },
        { name: 'Policy active', passed: true },
        { name: 'Pyth price fresh', passed: true },
        { name: 'Concentration limit (35.0% > 25.0%)', passed: false },
        { name: 'Minimum reserve (10.0% < 20.0%)', passed: false },
        { name: 'Trade size ceiling ($15,000 > $10,000)', passed: false },
      ],
      adaptationNarrative: {
        adaptedAction: 'BUY NVDAx $5,000',
        settlementTx: 'ATOMIC REVERT — 0 tokens transferred [DEMO FIXTURE]',
      },
    },
    {
      id: 'canon-03',
      time: '14:12',
      action: 'BUY NVDAx',
      amount: '$5,000',
      status: 'ADAPTED',
      statusLabel: 'Adapted & Settled',
      headline: 'REACTIVE ADAPTATION SETTLED',
      subheadline: 'Agent recalculated maximum compliant headroom and settled',
      beforeVsProposed: [
        { asset: 'NVDAx', before: '20.0%', proposed: '25.0%', limit: 'Limit 25.0%', passed: true },
        { asset: 'USDC', before: '25.0%', proposed: '20.0%', limit: 'Floor 20.0%', passed: true },
        { asset: 'AAPLx', before: '20.0%', proposed: '20.0%', limit: 'Limit 25.0%', passed: true },
        { asset: 'SPYx', before: '20.0%', proposed: '20.0%', limit: 'Limit 25.0%', passed: true },
      ],
      checks: [
        { name: 'Authority valid', passed: true },
        { name: 'Policy active', passed: true },
        { name: 'Pyth price fresh', passed: true },
        { name: 'Concentration limit (25.0% ≤ 25.0%)', passed: true },
        { name: 'Minimum reserve (20.0% ≥ 20.0%)', passed: true },
        { name: 'Trade size ceiling ($5,000 ≤ $10,000)', passed: true },
      ],
      adaptationNarrative: {
        adaptedAction: 'BUY NVDAx $5,000',
        settlementTx: 'Compliant Headroom Settled [DEMO FIXTURE]',
      },
    },
    {
      id: 'canon-04',
      time: '13:48',
      action: 'Policy updated',
      amount: 'Risk limits tightened',
      status: 'POLICY_UPDATE',
      statusLabel: 'Risk limits tightened',
      headline: 'POLICY ENFORCEMENT UPDATE',
      subheadline: 'On-chain Anchor constraints transitioned to Policy v4',
      checks: [
        { name: 'Owner signature confirmed', passed: true },
        { name: 'Invariants re-indexed on-chain', passed: true },
        { name: 'Vault PDA updated', passed: true },
      ],
    },
  ];

  // Map dynamic evidenceList items into timeline
  const dynamicTimelineItems: TimelineItem[] = evidenceList.map((rec) => {
    const isSettled = rec.verificationResult === 'SETTLED';
    const direction = rec.promise?.what?.side ?? rec.promise?.intent?.direction ?? 'BUY';
    const symbol = rec.promise?.what?.assetSymbol ?? rec.promise?.intent?.assetSymbol ?? 'NVDAx';
    const tradeAmountUsd = rec.promise?.what?.amountUsd ?? rec.promise?.intent?.tradeAmountUsd ?? 5000;

    return {
      id: rec.id,
      time: new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      action: `${direction} ${symbol}`,
      amount: formatCurrency(tradeAmountUsd),
      status: isSettled ? 'SETTLED' : 'REJECTED',
      statusLabel: isSettled ? 'Settled' : 'Rejected by Sentinel',
      headline: isSettled ? 'TRADE SETTLED' : 'TRADE REJECTED',
      subheadline: isSettled
        ? 'Satisfied all on-chain invariants'
        : (rec.failureReason || rec.failureCode || 'Sentinel prevented execution'),
      evidenceRecord: rec,
      checks: rec.checks.map((c) => ({ name: c.checkName ?? c.description, passed: c.passed })),
      beforeVsProposed: [
        {
          asset: symbol,
          before: '20.0%',
          proposed: isSettled ? '24.1%' : '35.0%',
          limit: `Limit ${(policy.maxSingleAssetBps / 100).toFixed(0)}%`,
          passed: isSettled,
        },
        {
          asset: 'USDC',
          before: '25.0%',
          proposed: isSettled ? '22.3%' : '10.0%',
          limit: `Floor ${(policy.minStablecoinBps / 100).toFixed(0)}%`,
          passed: isSettled,
        },
      ],
      adaptationNarrative: !isSettled
        ? {
            adaptedAction: `BUY ${symbol} $5,000`,
            settlementTx: 'Adapted & settled via Sentinel client',
          }
        : undefined,
    };
  });

  // Combine items (dynamic first, fallback to canonical)
  const allTimelineItems = dynamicTimelineItems.length > 0
    ? [...dynamicTimelineItems, ...defaultTimelineItems.slice(dynamicTimelineItems.length)]
    : defaultTimelineItems;

  const filteredItems = allTimelineItems.filter((item) => {
    if (filter === 'SETTLED' && item.status !== 'SETTLED' && item.status !== 'ADAPTED') return false;
    if (filter === 'REJECTED' && item.status !== 'REJECTED') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.action.toLowerCase().includes(q) ||
        item.amount.toLowerCase().includes(q) ||
        item.statusLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSelectItem = (item: TimelineItem) => {
    setSelectedTimelineItem(item);
    setIsInspectorOpen(true);
    if (item.evidenceRecord) {
      onSelectEvidenceId(item.evidenceRecord.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pt-1">
        <div>
          <span className="text-xs font-semibold text-sentinel-textSubtle tracking-wider uppercase">
            Activity
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cryptographic Verification Timeline
          </h2>
          <p className="text-xs text-sentinel-textMuted mt-0.5">
            Where PROVN lives: every trade evaluated against on-chain invariants with deterministic SHA-256 commitments.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-sentinel-surface p-1 rounded-lg border border-sentinel-border self-start sm:self-auto text-xs font-mono">
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

      {/* 2. CLEAN TIMELINE: TODAY */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-sentinel-border">
          <span className="text-xs font-bold text-sentinel-textSubtle uppercase tracking-widest font-mono">
            TODAY
          </span>
          <span className="text-xs font-mono text-sentinel-textSubtle">
            {filteredItems.length} Events Logged
          </span>
        </div>

        {/* List of Timeline Rows */}
        <div className="divide-y divide-sentinel-border">
          {filteredItems.map((item) => {
            const isRejected = item.status === 'REJECTED';
            const isPolicy = item.status === 'POLICY_UPDATE';

            return (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="py-3.5 px-2 -mx-2 rounded-lg hover:bg-sentinel-surfaceElevated/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-4">
                  {/* Status Indicator Icon */}
                  <div className="shrink-0 w-6 flex items-center justify-center">
                    {isRejected ? (
                      <span className="text-rose-400 font-bold text-sm">✕</span>
                    ) : (
                      <span className="text-emerald-400 font-bold text-sm">●</span>
                    )}
                  </div>

                  {/* Time */}
                  <span className="font-mono text-xs text-sentinel-textSubtle w-12 shrink-0">
                    {item.time}
                  </span>

                  {/* Action / Asset */}
                  <span className="font-bold text-xs text-white sm:w-28 shrink-0">
                    {item.action}
                  </span>

                  {/* Amount / Subtext */}
                  <span className="font-mono text-xs text-sentinel-textMuted sm:w-28 shrink-0">
                    {item.amount}
                  </span>
                </div>

                {/* Status Tag */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-semibold ${
                      isRejected
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : isPolicy
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {item.statusLabel}
                  </span>
                  <span className="text-xs text-sentinel-textSubtle group-hover:text-white transition">
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. DECISION INSPECTOR (MODAL / OVERLAY) */}
      {isInspectorOpen && selectedTimelineItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsInspectorOpen(false)}
          />

          {/* Modal Panel */}
          <div className="relative w-full max-w-2xl bg-sentinel-surface border border-sentinel-border rounded-2xl shadow-2xl p-6 z-10 space-y-6 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-sentinel-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      selectedTimelineItem.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedTimelineItem.headline}
                  </span>
                  <span className="text-xs font-mono text-sentinel-textSubtle">
                    {selectedTimelineItem.time}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white font-mono tracking-tight mt-1">
                  {selectedTimelineItem.action} {selectedTimelineItem.amount}
                </h3>
                <p className="text-xs text-sentinel-textMuted font-sans">
                  {selectedTimelineItem.subheadline}
                </p>
              </div>

              <button
                onClick={() => setIsInspectorOpen(false)}
                className="p-1.5 rounded-lg hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Before vs Proposed Comparison */}
            {selectedTimelineItem.beforeVsProposed && (
              <div className="space-y-2.5 font-mono text-xs">
                <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold block">
                  BEFORE VS PROPOSED ALLOCATION
                </span>
                <div className="bg-sentinel-surfaceMuted rounded-xl p-3.5 border border-sentinel-border space-y-2">
                  {selectedTimelineItem.beforeVsProposed.map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white w-14">{row.asset}</span>
                        <span className="text-sentinel-textMuted">
                          {row.before} → <span className={row.passed ? 'text-white' : 'text-rose-400 font-bold'}>{row.proposed}</span>
                        </span>
                        <span className="text-sentinel-textSubtle text-[11px]">({row.limit})</span>
                      </div>
                      <span className={row.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {row.passed ? '✓' : '✕'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invariant Checklist */}
            {selectedTimelineItem.checks && (
              <div className="space-y-2 font-mono text-xs">
                <span className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold block">
                  INVARIANT CHECKS
                </span>
                <div className="bg-sentinel-surfaceMuted rounded-xl p-3.5 border border-sentinel-border space-y-1.5">
                  {selectedTimelineItem.checks.map((chk, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-white flex items-center gap-2">
                        <span className={chk.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {chk.passed ? '✓' : '✕'}
                        </span>
                        <span>{chk.name}</span>
                      </span>
                      <span className={`text-[11px] font-bold ${chk.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {chk.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What Happened Next? (Adaptation Narrative) */}
            {selectedTimelineItem.adaptationNarrative && (
              <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-4 font-sans text-xs space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider font-mono block">
                  WHAT HAPPENED NEXT?
                </span>
                <p className="text-white">
                  The agent adapted the proposal:
                </p>
                <div className="font-mono font-bold text-sm text-blue-300">
                  {selectedTimelineItem.adaptationNarrative.adaptedAction}
                </div>
                <div className="font-mono text-[11px] text-sentinel-textMuted pt-1">
                  {selectedTimelineItem.adaptationNarrative.settlementTx}
                </div>
              </div>
            )}

            {/* COLLAPSIBLE TECHNICAL EVIDENCE DRAWER (FORENSIC DETAIL) */}
            <div className="border border-sentinel-border rounded-xl overflow-hidden bg-sentinel-surfaceMuted/40">
              <button
                type="button"
                onClick={() => setIsTechnicalDrawerOpen(!isTechnicalDrawerOpen)}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-sentinel-surfaceMuted transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Technical Evidence Drawer (PROVN Audit Record)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-sentinel-textSubtle font-mono">
                  <span>{isTechnicalDrawerOpen ? 'Hide' : 'Expand'}</span>
                  {isTechnicalDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isTechnicalDrawerOpen && (
                <div className="p-4 border-t border-sentinel-border space-y-3 font-mono text-xs bg-black/40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-sentinel-surface p-2 rounded border border-sentinel-border">
                      <span className="text-sentinel-textSubtle block text-[10px]">EVIDENCE HASH</span>
                      <span className="text-purple-300 font-semibold truncate block">
                        {selectedTimelineItem.evidenceRecord?.id ?? '0x8f7c9e12ab34cd56ef78...'}
                      </span>
                    </div>

                    <div className="bg-sentinel-surface p-2 rounded border border-sentinel-border">
                      <span className="text-sentinel-textSubtle block text-[10px]">STATE PRE-HASH</span>
                      <span className="text-blue-300 font-semibold truncate block font-mono text-[11px]">
                        {selectedTimelineItem.evidenceRecord?.preStateHash ?? 'sha256:4a12df88... [SIMULATED]'}
                      </span>
                    </div>

                    <div className="bg-sentinel-surface p-2 rounded border border-sentinel-border">
                      <span className="text-sentinel-textSubtle block text-[10px]">SENTINEL PDA</span>
                      <span className="text-white font-semibold truncate block font-mono text-[11px]">
                        {portfolio.sentinelPda || deriveSentinelPda(portfolio.owner)}
                      </span>
                    </div>

                    <div className="bg-sentinel-surface p-2 rounded border border-sentinel-border">
                      <span className="text-sentinel-textSubtle block text-[10px]">SLOT / SIGNATURE</span>
                      <span className="text-emerald-400 font-semibold truncate block font-mono text-[11px]">
                        {selectedTimelineItem.evidenceRecord?.transactionSignature ?? 'SIMULATION [DEMO DATA]'}
                      </span>
                    </div>
                  </div>

                  {/* Formal Receipt Card */}
                  {selectedTimelineItem.evidenceRecord && (
                    <div className="pt-2">
                      <SentinelReceiptCard
                        record={selectedTimelineItem.evidenceRecord}
                        index={0}
                      />
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    {(() => {
                      const sig = selectedTimelineItem.evidenceRecord?.transactionSignature;
                      const isRealDevnetTx = !!sig && sig.length >= 64 && !sig.startsWith('sim_');
                      if (isRealDevnetTx) {
                        return (
                          <a
                            href={getExplorerTxUrl(sig)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline font-mono"
                          >
                            <span>View Transaction on Solana Explorer</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        );
                      }
                      return (
                        <div className="inline-flex items-center gap-1.5 text-xs text-sentinel-textSubtle font-mono bg-sentinel-surface px-2.5 py-1 rounded border border-sentinel-border">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          <span>[SIMULATION EVIDENCE — DETERMINISTIC PREIMAGE]</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Close */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="px-5 py-2 rounded-lg bg-sentinel-surfaceMuted hover:bg-sentinel-surfaceElevated border border-sentinel-border text-white text-xs font-semibold transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
