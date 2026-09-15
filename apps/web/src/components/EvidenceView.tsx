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
  Code,
} from 'lucide-react';

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
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<Record<string, boolean>>({});

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const toggleJson = (id: string) => {
    setShowRawJson(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (evidenceList.length === 0) {
    return (
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
          <FileCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No PROVN Evidence Records Yet</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Every decision proposed by an autonomous agent produces an immutable cryptographic evidence record linking pre-state, post-state, policy version, and verification outcomes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">PROVN Cryptographic Evidence Explorer</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                {evidenceList.length} Anchored Records
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditable provenance layer linking autonomous agent trade promises to state commitments and transaction signatures.
            </p>
          </div>
        </div>
      </div>

      {/* Evidence Records List */}
      <div className="space-y-4">
        {evidenceList.map((record) => {
          const isSelected = selectedEvidenceId === record.id;
          const isSettled = record.verificationResult === 'SETTLED';
          const isJsonOpen = !!showRawJson[record.id];

          return (
            <div
              key={record.id}
              className={`border rounded-xl transition-all overflow-hidden ${
                isSelected
                  ? 'border-blue-500/80 bg-sentinel-card/90 shadow-lg shadow-blue-500/10'
                  : 'border-sentinel-cardBorder bg-sentinel-card/60 hover:border-slate-700'
              }`}
            >
              {/* Card Header Bar */}
              <div
                onClick={() => onSelectEvidenceId(record.id)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/30"
              >
                <div className="flex items-center gap-3">
                  <button className="text-slate-400">
                    {isSelected ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex items-center gap-2">
                    {isSettled ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> SETTLED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-500/30 font-bold">
                        <XCircle className="w-3.5 h-3.5" /> REJECTED
                      </span>
                    )}
                    <span className="font-mono text-xs text-white font-semibold">
                      {record.id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <span>Policy v{record.policyVersion}</span>
                  <span>•</span>
                  <span>{new Date(record.timestamp).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span className={record.isSimulation ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {record.isSimulation ? 'SIMULATION' : 'LIVE ON-CHAIN'}
                  </span>
                </div>
              </div>

              {/* Expanded Record Details */}
              {isSelected && (
                <div className="p-5 pt-0 border-t border-sentinel-cardBorder space-y-4 text-xs">
                  {/* Verdict & Failure Code */}
                  {!isSettled && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-200">
                      <span className="font-bold text-red-400">FAILURE CODE: {record.failureCode}</span>
                      <p className="mt-1 text-slate-300">{record.failureReason}</p>
                    </div>
                  )}

                  {/* Cryptographic Hashes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Pre-State Hash */}
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold">PRE-STATE SHA-256 COMMITMENT:</span>
                        <button
                          onClick={() => copyToClipboard(record.preStateHash, 'pre')}
                          className="hover:text-white"
                          title="Copy Hash"
                        >
                          {copiedHash === 'pre' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="font-mono text-slate-300 break-all select-all text-[11px]">
                        {record.preStateHash}
                      </div>
                    </div>

                    {/* Post-State Hash */}
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold">POST-STATE SHA-256 COMMITMENT:</span>
                        <button
                          onClick={() => copyToClipboard(record.postStateHash, 'post')}
                          className="hover:text-white"
                          title="Copy Hash"
                        >
                          {copiedHash === 'post' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="font-mono text-slate-300 break-all select-all text-[11px]">
                        {record.postStateHash}
                      </div>
                    </div>

                    {/* Intent Hash */}
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold">TRADE INTENT SHA-256 HASH:</span>
                        <button
                          onClick={() => copyToClipboard(record.intentHash, 'intent')}
                          className="hover:text-white"
                          title="Copy Hash"
                        >
                          {copiedHash === 'intent' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="font-mono text-slate-300 break-all select-all text-[11px]">
                        {record.intentHash}
                      </div>
                    </div>

                    {/* Policy Hash */}
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-bold">POLICY SHA-256 HASH (v{record.policyVersion}):</span>
                        <button
                          onClick={() => copyToClipboard(record.policyHash, 'policy')}
                          className="hover:text-white"
                          title="Copy Hash"
                        >
                          {copiedHash === 'policy' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="font-mono text-slate-300 break-all select-all text-[11px]">
                        {record.policyHash}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Signature Reference */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 font-bold block">TRANSACTION SIGNATURE / EXPLORER LINK:</span>
                      <span className="font-mono text-blue-400 text-xs break-all">
                        {record.transactionSignature}
                      </span>
                    </div>
                    {record.isSimulation ? (
                      <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono border border-amber-500/30 whitespace-nowrap">
                        SIMULATED
                      </span>
                    ) : (
                      <a
                        href={`https://explorer.solana.com/tx/${record.transactionSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 font-medium whitespace-nowrap"
                      >
                        <span>View Solana Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Toggle Raw JSON */}
                  <div>
                    <button
                      onClick={() => toggleJson(record.id)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-mono py-1"
                    >
                      <Code className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isJsonOpen ? 'Hide Raw PROVN Payload' : 'View Canonical JSON Record'}</span>
                    </button>

                    {isJsonOpen && (
                      <pre className="mt-2 p-3 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                        {JSON.stringify(record, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
