'use client';

import React from 'react';
import { CheckCircle2, XCircle, Loader2, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react';
import { getExplorerTxUrl } from '@/lib/config';
import { formatCurrency, formatSignature } from '@/lib/formatters';

export type TxLifecycleStep =
  | 'idle'
  | 'preparing'
  | 'awaiting_signature'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'rejected'
  | 'failed';

export interface TxDetails {
  action: 'BUY' | 'SELL';
  assetSymbol: string;
  amountUsd: number;
  policyGuarantee: string;
  expectedResult: string;
  signature?: string;
  errorMessage?: string;
  isSimulated?: boolean;
}

interface TransactionModalProps {
  isOpen: boolean;
  step: TxLifecycleStep;
  details: TxDetails | null;
  onClose: () => void;
  onConfirm?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  step,
  details,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !details) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-sentinel-surface border border-sentinel-borderStrong rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-sentinel-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-sentinel-accent border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-sentinel-text">
              {step === 'awaiting_signature' ? 'Approve Sentinel Transaction' : 'Transaction Status'}
            </h3>
          </div>
          {details.isSimulated && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              SIMULATED
            </span>
          )}
        </div>

        {/* State Machine Progression Strip */}
        <div className="px-5 py-2.5 bg-sentinel-surfaceMuted border-b border-sentinel-border overflow-x-auto">
          <div className="flex items-center justify-between min-w-[280px] text-[10px] font-mono tracking-wider">
            {[
              { id: 'preparing', label: 'PREPARING' },
              { id: 'awaiting_signature', label: 'WALLET' },
              { id: 'submitting', label: 'SUBMITTED' },
              { id: 'confirming', label: 'CONFIRMING' },
              { id: 'confirmed', label: 'VERIFIED' },
            ].map((s, idx, arr) => {
              const orderMap: Record<string, number> = {
                idle: -1,
                preparing: 0,
                awaiting_signature: 1,
                submitting: 2,
                confirming: 3,
                confirmed: 4,
                rejected: 1,
                failed: 2,
              };
              const currentOrder = orderMap[step] ?? 0;
              const isCurrent = step === s.id;
              const isPast = currentOrder > idx;
              const isFailed = (step === 'rejected' || step === 'failed') && idx === currentOrder;

              return (
                <React.Fragment key={s.id}>
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isFailed
                          ? 'bg-sentinel-danger'
                          : isCurrent
                          ? 'bg-sentinel-accent animate-pulse'
                          : isPast
                          ? 'bg-sentinel-success'
                          : 'bg-sentinel-borderStrong'
                      }`}
                    />
                    <span
                      className={`font-bold ${
                        isFailed
                          ? 'text-sentinel-danger'
                          : isCurrent
                          ? 'text-sentinel-accent'
                          : isPast
                          ? 'text-sentinel-success'
                          : 'text-sentinel-textSubtle'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <span className="text-sentinel-borderStrong">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Action intent breakdown */}
          <div className="bg-sentinel-surfaceMuted border border-sentinel-border rounded-xl p-4 space-y-3">
            <div className="text-xs text-sentinel-textSubtle uppercase tracking-wider font-semibold">
              Intent Verification
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-sentinel-textMuted">Action</span>
              <span className="font-bold text-sentinel-text">
                {details.action} {details.assetSymbol}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-sentinel-textMuted">Amount</span>
              <span className="font-mono font-bold text-sentinel-text tabular-nums">
                {formatCurrency(details.amountUsd)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-sentinel-border">
              <span className="text-sentinel-textMuted">Policy Constraint</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {details.policyGuarantee}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-sentinel-textMuted">Expected Result</span>
              <span className="text-xs font-mono text-blue-400 font-semibold">
                {details.expectedResult}
              </span>
            </div>
          </div>

          {/* Current Lifecycle State */}
          <div className="text-center py-2">
            {step === 'awaiting_signature' && (
              <div className="space-y-2">
                <p className="text-xs text-sentinel-textMuted">
                  Please review the invariant guarantees above and approve with your Solana wallet.
                </p>
              </div>
            )}

            {(step === 'submitting' || step === 'confirming') && (
              <div className="space-y-3">
                <Loader2 className="w-8 h-8 text-sentinel-accent animate-spin mx-auto" />
                <p className="text-xs font-medium text-sentinel-text">
                  {step === 'submitting' ? 'Submitting to Solana Devnet...' : 'Awaiting confirmation on Solana...'}
                </p>
              </div>
            )}

            {step === 'confirmed' && (
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-emerald-400">Transaction Settled Safely</div>
                {details.signature && (
                  <div className="text-xs font-mono text-sentinel-textMuted">
                    Signature:{' '}
                    {details.signature.length >= 64 && !details.signature.startsWith('sim_') ? (
                      <a
                        href={getExplorerTxUrl(details.signature)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        {formatSignature(details.signature)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-amber-400 font-semibold">
                        {details.signature} [SIMULATION]
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {(step === 'rejected' || step === 'failed') && (
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                  <XCircle className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-rose-400">
                  {step === 'rejected' ? 'Sentinel Policy Violation — Aborted' : 'Transaction Failed'}
                </div>
                {details.errorMessage && (
                  <p className="text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40 font-mono">
                    {details.errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-sentinel-border bg-sentinel-surfaceMuted/50 flex items-center justify-end gap-3">
          {step === 'awaiting_signature' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-sentinel-textMuted hover:text-white sentinel-interactive sentinel-focus transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-sentinel-accent hover:bg-sentinel-accentHover text-white shadow-lg shadow-blue-500/20 sentinel-interactive sentinel-focus transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Confirm & Sign</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-sentinel-surfaceElevated hover:bg-sentinel-borderStrong text-white border border-sentinel-border sentinel-interactive sentinel-focus transition cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
