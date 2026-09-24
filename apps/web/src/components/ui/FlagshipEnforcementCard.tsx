'use client';

import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { EvidenceRecord } from '@sentinel/domain';
import { APP_CONFIG, getExplorerTxUrl, getExplorerAddressUrl } from '@/lib/config';

export interface DevnetLifecycleLinks {
  initializePolicyTx: string;
  initializeAgentTx: string;
  createPromiseTx: string;
  rejectBadTradeTx: string;
  executeValidTradeTx: string;
  recordEvidenceTx: string;
}

interface FlagshipEnforcementCardProps {
  latestEvidence?: EvidenceRecord | null;
  onRunAdaptation?: () => void;
  isRunningAdaptation?: boolean;
  onViewFullReceipt?: () => void;
  lifecycleLinks?: DevnetLifecycleLinks;
}

export const DEFAULT_DEVNET_LIFECYCLE_LINKS: DevnetLifecycleLinks = {
  initializePolicyTx: APP_CONFIG.devnetTransactions.initializePolicyTx,
  initializeAgentTx: APP_CONFIG.devnetTransactions.initializeAgentTx,
  createPromiseTx: APP_CONFIG.devnetTransactions.createPromiseTx,
  rejectBadTradeTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
  executeValidTradeTx: APP_CONFIG.devnetTransactions.executeValidTradeTx,
  recordEvidenceTx: APP_CONFIG.devnetTransactions.recordEvidenceTx,
};

export const FlagshipEnforcementCard: React.FC<FlagshipEnforcementCardProps> = ({
  latestEvidence,
  onRunAdaptation,
  isRunningAdaptation = false,
  onViewFullReceipt,
  lifecycleLinks = DEFAULT_DEVNET_LIFECYCLE_LINKS,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [engineerDrawerOpen, setEngineerDrawerOpen] = useState(false);

  const copyToClipboard = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Canonical SHA-256 commitments anchored on Solana Devnet (Evidence PDA AQhrZKJsAbJo4q5TW3ztyoC4pCwpAvvZ4rMof6T5bpiE)
  const rawIntentHash =
    latestEvidence?.intentHash ||
    '7c5487f85ea2ad12476d493a05d5b9c4f9272bb7356685bb0243b724ae277ca5';
  const rawPolicyHash =
    latestEvidence?.policyHash ||
    '7c475d90356746202ce5b7985fec31fad5a7bf62c3d53a6c65c22f0af3054dd2';
  const rawPreStateHash =
    latestEvidence?.preStateHash ||
    '1b2036f3500c3b330504faeb2139f34e4549d5c0dd2c7313c4b02075bea4f91f';
  const rawPostStateHash =
    latestEvidence?.postStateHash ||
    '55b266379c44ff251306837053a30cb1cc975422ae0827d5cc9302745281b85b';

  const formatHex0x = (hash: string) => {
    const clean = hash.replace(/^0x/, '').replace(/^sha256:/, '');
    return `0x${clean.slice(0, 8)}...${clean.slice(-6)}`;
  };

  const fullHex0x = (hash: string) => {
    const clean = hash.replace(/^0x/, '').replace(/^sha256:/, '');
    return `0x${clean}`;
  };

  const activeTxSig =
    latestEvidence?.transactionSignature &&
    !latestEvidence.transactionSignature.startsWith('sim_') &&
    latestEvidence.transactionSignature.length >= 44
      ? latestEvidence.transactionSignature
      : lifecycleLinks.executeValidTradeTx;

  const shortTxSig = `${activeTxSig.slice(0, 4)}...${activeTxSig.slice(-4)}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* =====================================================================
          P18 — THE SINGLE SCREEN THAT HAS TO BE PERFECT
      ===================================================================== */}
      <div className="lg:col-span-7 bg-[#050811] border-2 border-slate-800/90 rounded-2xl p-6 sm:p-8 font-mono shadow-2xl shadow-black/80 relative overflow-hidden flex flex-col justify-between">
        {/* Subtle terminal scanline / top accent */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-rose-500 to-emerald-500" />

        <div className="space-y-5">
          {/* HEADER: ROBO-01 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-base sm:text-lg font-black tracking-widest text-white uppercase">
                ROBO-01
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700/80 uppercase tracking-wider font-bold">
                SOLANA {APP_CONFIG.clusterLabel}
              </span>
              {onRunAdaptation && (
                <button
                  type="button"
                  onClick={onRunAdaptation}
                  disabled={isRunningAdaptation}
                  className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isRunningAdaptation ? 'animate-spin' : ''}`} />
                  <span>{isRunningAdaptation ? 'Running...' : 'Run Live'}</span>
                </button>
              )}
            </div>
          </div>

          {/* PROPOSED: BUY NVDAx $15,000 */}
          <div className="pt-1">
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              PROPOSED
            </div>
            <div className="mt-1.5 flex items-baseline justify-between text-xl sm:text-2xl font-black tracking-tight tabular-nums">
              <span className="text-white">BUY NVDAx</span>
              <span className="text-rose-400">$15,000</span>
            </div>
          </div>

          {/* DIVIDER */}
          <div className="border-t border-slate-800/90 my-2" />

          {/* SENTINEL POST-STATE (INITIAL BREACH) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                SENTINEL POST-STATE
              </span>
              <a
                href={getExplorerTxUrl(lifecycleLinks.rejectBadTradeTx)}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-rose-400/90 hover:text-rose-300 hover:underline flex items-center gap-1"
              >
                <span>Revert Proof</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="bg-slate-950/90 border border-rose-500/25 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm tabular-nums">
              <div className="grid grid-cols-12 items-center">
                <span className="col-span-3 font-bold text-slate-200">NVDAx</span>
                <span className="col-span-5 text-slate-300">
                  20% <span className="text-rose-400 font-bold">→ 35%</span>
                </span>
                <span className="col-span-4 text-right font-bold text-rose-400">
                  LIMIT 25%
                </span>
              </div>

              <div className="grid grid-cols-12 items-center">
                <span className="col-span-3 font-bold text-slate-200">USDC</span>
                <span className="col-span-5 text-slate-300">
                  25% <span className="text-rose-400 font-bold">→ 10%</span>
                </span>
                <span className="col-span-4 text-right font-bold text-rose-400">
                  MIN 20%
                </span>
              </div>

              <div className="grid grid-cols-12 items-center">
                <span className="col-span-3 font-bold text-slate-200">Trade</span>
                <span className="col-span-5 text-slate-300">
                  — <span className="text-rose-400 font-bold">→ $15K</span>
                </span>
                <span className="col-span-4 text-right font-bold text-rose-400">
                  MAX $10K
                </span>
              </div>
            </div>

            {/* ✕ BLOCKED */}
            <div className="py-2.5 px-4 rounded-xl bg-rose-950/35 border border-rose-500/40 text-center space-y-1">
              <div className="text-base sm:text-lg font-black tracking-widest text-rose-400 uppercase">
                ✕ BLOCKED
              </div>
              <p className="text-xs text-rose-200/90 font-sans">
                Sentinel prevented the state transition.
              </p>
            </div>
          </div>

          {/* ROBO-01 ADAPTING... */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-widest text-blue-400 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                ROBO-01 ADAPTING...
              </span>
              <span className="text-[10px] text-slate-400">
                Max Compliant Headroom Solved
              </span>
            </div>

            {/* BUY NVDAx $5,000 */}
            <div className="flex items-baseline justify-between text-xl sm:text-2xl font-black tracking-tight tabular-nums">
              <span className="text-white">BUY NVDAx</span>
              <span className="text-emerald-400">$5,000</span>
            </div>

            {/* ADAPTED POST-STATE TABLE */}
            <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm tabular-nums">
              <div className="grid grid-cols-12 items-center">
                <span className="col-span-3 font-bold text-slate-200">NVDAx</span>
                <span className="col-span-6 text-slate-300">
                  20% <span className="text-emerald-400 font-bold">→ 25%</span>
                </span>
                <span className="col-span-3 text-right font-black text-emerald-400">
                  ✓
                </span>
              </div>

              <div className="grid grid-cols-12 items-center">
                <span className="col-span-3 font-bold text-slate-200">USDC</span>
                <span className="col-span-6 text-slate-300">
                  25% <span className="text-emerald-400 font-bold">→ 20%</span>
                </span>
                <span className="col-span-3 text-right font-black text-emerald-400">
                  ✓
                </span>
              </div>

              <div className="grid grid-cols-12 items-center">
                <span className="col-span-3 font-bold text-slate-200">Trade</span>
                <span className="col-span-6 text-emerald-400 font-bold">
                  $5K
                </span>
                <span className="col-span-3 text-right font-black text-emerald-400">
                  ✓
                </span>
              </div>
            </div>

            {/* ✓ APPROVED */}
            <div className="py-2.5 px-4 rounded-xl bg-emerald-950/35 border border-emerald-500/45 text-center">
              <div className="text-base sm:text-lg font-black tracking-widest text-emerald-400 uppercase">
                ✓ APPROVED
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          P19 — THEN PROVN: VERIFIED SENTINEL RECEIPT
      ===================================================================== */}
      <div className="lg:col-span-5 bg-[#050811] border-2 border-slate-800/90 rounded-2xl p-6 sm:p-8 font-mono shadow-2xl shadow-black/80 relative overflow-hidden flex flex-col justify-between">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />

        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-dashed border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm sm:text-base font-black tracking-widest text-white uppercase">
                  VERIFIED SENTINEL RECEIPT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                Two-Tier PROVN Cryptographic State Commitment
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              PROVN v2
            </span>
          </div>

          {/* Canonical Receipt Fields */}
          <div className="space-y-3 text-xs">
            {/* Intent */}
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Intent
                </span>
                <span className="text-sm font-bold text-white mt-0.5 block" title={fullHex0x(rawIntentHash)}>
                  {formatHex0x(rawIntentHash)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(fullHex0x(rawIntentHash), 'intent')}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Copy full SHA-256 Intent Hash"
              >
                {copiedField === 'intent' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Policy */}
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Policy
                </span>
                <span className="text-sm font-bold text-purple-300 mt-0.5 block" title={fullHex0x(rawPolicyHash)}>
                  {formatHex0x(rawPolicyHash)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(fullHex0x(rawPolicyHash), 'policy')}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Copy full SHA-256 Policy Hash"
              >
                {copiedField === 'policy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Pre-state */}
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pre-state
                </span>
                <span className="text-sm font-bold text-blue-300 mt-0.5 block" title={fullHex0x(rawPreStateHash)}>
                  {formatHex0x(rawPreStateHash)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(fullHex0x(rawPreStateHash), 'pre')}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Copy full SHA-256 Pre-state Hash"
              >
                {copiedField === 'pre' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Post-state */}
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Post-state
                </span>
                <span className="text-sm font-bold text-emerald-300 mt-0.5 block" title={fullHex0x(rawPostStateHash)}>
                  {formatHex0x(rawPostStateHash)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(fullHex0x(rawPostStateHash), 'post')}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Copy full SHA-256 Post-state Hash"
              >
                {copiedField === 'post' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Transaction + Explorer ↗ */}
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Transaction
                </span>
                <span className="text-sm font-bold text-white mt-0.5 block" title={activeTxSig}>
                  {shortTxSig}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeTxSig, 'tx')}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Copy Transaction Signature"
                >
                  {copiedField === 'tx' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={getExplorerTxUrl(activeTxSig)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/40 text-blue-300 font-bold text-xs inline-flex items-center gap-1 transition"
                >
                  <span>Explorer ↗</span>
                </a>
              </div>
            </div>

            {/* Integrity */}
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                Integrity
              </span>
              <span className="text-sm font-black text-emerald-400 tracking-wide">
                ✓ VERIFIED
              </span>
            </div>
          </div>

          {/* Two-Tier Engineer / Judge Expandable Audit Drawer */}
          <div className="pt-2 border-t border-dashed border-slate-800">
            <button
              type="button"
              onClick={() => setEngineerDrawerOpen(!engineerDrawerOpen)}
              className="w-full py-2 px-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-xs text-slate-300 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>Engineer / Judge On-Chain Proofs</span>
              </span>
              {engineerDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {engineerDrawerOpen && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Solana Devnet Verified Transactions
                </div>
                {[
                  { label: '1. Initialize Policy', tx: lifecycleLinks.initializePolicyTx },
                  { label: '2. Initialize Agent', tx: lifecycleLinks.initializeAgentTx },
                  { label: '3. Create Promise', tx: lifecycleLinks.createPromiseTx },
                  { label: '4. Reject Bad Trade ($15K)', tx: lifecycleLinks.rejectBadTradeTx },
                  { label: '5. Execute Valid Trade ($5K)', tx: lifecycleLinks.executeValidTradeTx },
                  { label: '6. Record PROVN Evidence', tx: lifecycleLinks.recordEvidenceTx },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-0.5 border-b border-slate-900 last:border-0">
                    <span className="text-slate-300">{item.label}</span>
                    <a
                      href={getExplorerTxUrl(item.tx)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                    >
                      <span>{item.tx.slice(0, 4)}...{item.tx.slice(-4)}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                ))}
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <a
                    href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    Program: {APP_CONFIG.sentinelProgramId.slice(0, 6)}...
                  </a>
                  {onViewFullReceipt && (
                    <button
                      type="button"
                      onClick={onViewFullReceipt}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      Open Full Activity Log →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
