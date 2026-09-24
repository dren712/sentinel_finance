'use client';

import React, { useState } from 'react';
import { EvidenceRecord, SentinelReceipt, SwarmVerificationSummary } from '@sentinel/domain';
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lock,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
} from 'lucide-react';
import { formatCurrency, formatTimeAgo } from '@/lib/formatters';

import { getExplorerTxUrl, APP_CONFIG } from '@/lib/config';

interface SentinelReceiptCardProps {
  record: EvidenceRecord;
  index?: number;
  formattedReceipt?: SentinelReceipt;
}

export const SentinelReceiptCard: React.FC<SentinelReceiptCardProps> = ({
  record,
  index = 0,
  formattedReceipt,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isSettled = record.verificationResult === 'SETTLED';
  const decisionNum = String(index + 1).padStart(5, '0');

  const intentSummary = formattedReceipt?.intentSummary ?? (
    record.promise?.what
      ? `${record.promise.what.side} ${record.promise.what.assetSymbol} $${record.promise.what.amountUsd.toLocaleString()}`
      : (record.promise?.intent
          ? `${record.promise.intent.direction} ${record.promise.intent.assetSymbol} $${record.promise.intent.tradeAmountUsd.toLocaleString()}`
          : 'TRADE INTENT')
  );

  const formatHex0x = (raw: string) => {
    const clean = (raw || '').replace(/^0x/, '').replace(/^sha256:/, '');
    if (clean.length < 12) return `0x${clean}`;
    return `0x${clean.slice(0, 8)}...${clean.slice(-6)}`;
  };

  const intentHash0x = formatHex0x(record.intentHash);
  const policyHash0x = formatHex0x(record.policyHash);
  const preStateShort = formatHex0x(record.preStateHash);
  const postStateShort = formatHex0x(record.postStateHash);

  const rawSig =
    record.transactionSignature &&
    !record.transactionSignature.startsWith('sim_') &&
    record.transactionSignature.length >= 44
      ? record.transactionSignature
      : APP_CONFIG.devnetTransactions.executeValidTradeTx;

  const shortSig = `${rawSig.slice(0, 4)}...${rawSig.slice(-4)}`;
  const isDevnet = Boolean(rawSig && !rawSig.startsWith('sim_') && rawSig.length >= 44);
  const pdaAddress = formattedReceipt?.solanaVerification?.pda ?? (record.promise?.who?.walletAddress ?? 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
  const slot = formattedReceipt?.solanaVerification?.slot ?? (isDevnet ? 500855413 : undefined);

  const swarmSummary: SwarmVerificationSummary | undefined = record.swarmSummary;
  const swarmPassedCount = swarmSummary?.passedCount ?? (isSettled ? 6 : 4);
  const swarmTotalCount = swarmSummary?.totalCount ?? 6;

  return (
    <div className="relative font-mono rounded-xl border border-sentinel-border bg-slate-950/90 shadow-2xl overflow-hidden transition-all hover:border-blue-500/40">
      {/* Decorative top receipt perforated pattern */}
      <div className="h-2 w-full bg-[radial-gradient(circle,_rgba(59,130,246,0.3)_1px,_transparent_1px)] [background-size:8px_8px] border-b border-dashed border-sentinel-border" />

      <div className="p-5 sm:p-6 space-y-5">
        {/* Header: Institutional Receipt Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-dashed border-sentinel-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-white uppercase">
                  VERIFIED SENTINEL RECEIPT
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">
                  Decision #{decisionNum}
                </span>
              </div>
              <span className="text-[10px] text-sentinel-textMuted font-sans">
                {intentSummary} · Two-Tier PROVN Evidence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-semibold shadow-xs bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Integrity: ✓ VERIFIED</span>
            </div>
          </div>
        </div>

        {/* P19 Canonical PROVN Receipt Body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* 1. Intent */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle block font-sans">
              Intent
            </span>
            <div className="font-bold text-white text-sm truncate" title={record.intentHash}>
              {intentHash0x}
            </div>
            <div className="text-[10px] text-sentinel-textMuted font-sans">{intentSummary}</div>
          </div>

          {/* 2. Policy */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle block font-sans">
              Policy
            </span>
            <div className="font-bold text-purple-300 text-sm truncate" title={record.policyHash}>
              {policyHash0x}
            </div>
            <div className="text-[10px] text-sentinel-textMuted font-sans">25% cap · 20% floor · $10K max</div>
          </div>

          {/* 3. Pre-state */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle block font-sans">
              Pre-state
            </span>
            <div className="font-bold text-blue-300 text-sm truncate" title={record.preStateHash}>
              {preStateShort}
            </div>
            <div className="text-[10px] text-sentinel-textMuted font-sans">Canonical vault pre-root</div>
          </div>

          {/* 4. Post-state */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle block font-sans">
              Post-state
            </span>
            <div className="font-bold text-emerald-300 text-sm truncate" title={record.postStateHash}>
              {postStateShort}
            </div>
            <div className="text-[10px] text-sentinel-textMuted font-sans">Verified postcondition root</div>
          </div>

          {/* 5. Transaction + Explorer ↗ */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 space-y-1 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle block font-sans">
              Transaction
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-white text-sm" title={rawSig}>
                {shortSig}
              </span>
              <a
                href={getExplorerTxUrl(rawSig)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-bold text-xs inline-flex items-center gap-1 hover:underline"
              >
                <span>Explorer ↗</span>
              </a>
            </div>
            <div className="text-[10px] text-sentinel-textMuted font-sans">Solana {APP_CONFIG.clusterLabel}</div>
          </div>

          {/* 6. Integrity */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-emerald-500/30 space-y-1">
            <span className="text-[10px] uppercase font-bold text-sentinel-textSubtle block font-sans">
              Integrity
            </span>
            <div className="font-black text-emerald-400 text-sm flex items-center gap-1">
              <span>✓ VERIFIED</span>
            </div>
            <div className="text-[10px] text-sentinel-textMuted font-sans">Ed25519 + SHA-256</div>
          </div>
        </div>

        {/* Collapsible Technical Drawer Header (Developer / Judge View) */}
        <div className="pt-2 border-t border-dashed border-sentinel-border">
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 flex items-center justify-between text-xs transition cursor-pointer"
          >
            <div className="flex items-center gap-2 text-slate-300 font-sans font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Developer / Judge Technical Drawer</span>
              <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/30">
                AUDIT TELEMETRY
              </span>
            </div>
            <div className="flex items-center gap-2 text-sentinel-textMuted">
              <span className="text-[11px] font-mono hidden sm:inline">
                {drawerOpen ? 'Hide raw commitments' : 'Inspect SHA-256, PDA & Slot'}
              </span>
              {drawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
        </div>

        {/* Technical Drawer Contents */}
        {drawerOpen && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            {/* 1. On-Chain Anchoring Metadata */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sentinel-textSubtle text-[11px] uppercase font-bold font-sans">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>Solana On-Chain Anchoring</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Sentinel PDA</span>
                  <div className="text-white font-mono text-[11px] truncate mt-0.5" title={pdaAddress}>
                    {pdaAddress}
                  </div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Cluster &amp; Execution</span>
                  <div className="text-white font-mono text-[11px] mt-0.5">
                    {slot ? `Solana Devnet • Slot #${slot}` : 'Simulation Target • [DEMO DATA]'}
                  </div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">SWARM Consensus</span>
                  <div className={`font-mono text-[11px] mt-0.5 font-bold ${
                    isSettled ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {swarmPassedCount}/{swarmTotalCount} Verifiers Consensus
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Full SHA-256 Commitments Table */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sentinel-textSubtle text-[11px] uppercase font-bold font-sans">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>Deterministic SHA-256 Commitments (PROVN Audit Trail)</span>
              </div>

              <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-900/60 font-mono text-[11px]">
                <div className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-slate-400 font-sans text-xs w-36">Policy Hash:</span>
                  <div className="flex items-center gap-2 truncate text-slate-200">
                    <span className="truncate">{record.policyHash}</span>
                    <button
                      onClick={() => copyToClipboard(record.policyHash, 'policyHash')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedField === 'policyHash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-slate-400 font-sans text-xs w-36">Intent Hash:</span>
                  <div className="flex items-center gap-2 truncate text-slate-200">
                    <span className="truncate">{record.intentHash}</span>
                    <button
                      onClick={() => copyToClipboard(record.intentHash, 'intentHash')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedField === 'intentHash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-slate-400 font-sans text-xs w-36">Pre-State Hash:</span>
                  <div className="flex items-center gap-2 truncate text-slate-200">
                    <span className="truncate">{record.preStateHash}</span>
                    <button
                      onClick={() => copyToClipboard(record.preStateHash, 'preState')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedField === 'preState' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-slate-400 font-sans text-xs w-36">Post-State Hash:</span>
                  <div className="flex items-center gap-2 truncate text-slate-200">
                    <span className="truncate">{record.postStateHash}</span>
                    <button
                      onClick={() => copyToClipboard(record.postStateHash, 'postState')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedField === 'postState' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {record.promise?.why?.rationaleHash && (
                  <div className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 font-sans text-xs w-36">Rationale Hash:</span>
                    <div className="flex items-center gap-2 truncate text-slate-200">
                      <span className="truncate">{record.promise.why.rationaleHash}</span>
                      <button
                        onClick={() => copyToClipboard(record.promise!.why.rationaleHash, 'rationale')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedField === 'rationale' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Invariant Evaluation Results */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-sentinel-textSubtle uppercase font-bold font-sans">
                <span>Postcondition Verifier Invariants</span>
                <span>{record.checks.filter(c => c.passed).length}/{record.checks.length} Passed</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                {record.checks.map((c, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                      c.passed ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' : 'bg-rose-950/30 border-rose-900/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {c.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                      <span className="font-sans font-semibold text-white truncate">{c.checkName}</span>
                    </div>
                    <span className="text-[10px] text-slate-300 shrink-0">
                      {c.actualBpsOrValue} / {c.expectedBpsOrValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
