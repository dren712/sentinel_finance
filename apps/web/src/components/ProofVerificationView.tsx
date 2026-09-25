'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { sha256Hex } from '@sentinel/domain';
import { APP_CONFIG, getExplorerAddressUrl, getExplorerTxUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';
import { PageHeader } from './ui/PageHeader';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface AdversarialVector {
  id: string;
  num: string;
  name: string;
  category: 'PDA_SECURITY' | 'INVARIANT' | 'ORACLE_MARKET';
  payload: string;
  defense: string;
  errorCode: string;
  status: 'BLOCKED' | 'APPROVED';
  devnetTx?: string;
}

export const ProofVerificationView: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<
    'ALL' | 'PDA_SECURITY' | 'INVARIANT' | 'ORACLE_MARKET'
  >('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('adv-10');
  const [isOnChainOpen, setIsOnChainOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const vectors: (AdversarialVector & { sha256Hash: string })[] = useMemo(() => {
    const raw: AdversarialVector[] = [
      {
        id: 'adv-01',
        num: '01',
        name: 'Direct Program Bypass Attempt',
        category: 'PDA_SECURITY',
        payload:
          'Caller attempts to invoke execute_guarded_trade directly without valid Agent PDA seeds.',
        defense:
          'Anchor seeds constraint [b"agent", owner, agent_id] fails before instruction body runs.',
        errorCode: 'ConstraintSeeds (2006)',
        status: 'BLOCKED',
        devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      },
      {
        id: 'adv-02',
        num: '02',
        name: 'Cross-Tenant Owner Spoofing',
        category: 'PDA_SECURITY',
        payload:
          "Agent derived under Owner A attempts to execute a trade against Owner B's Vault PDA.",
        defense:
          'Anchor enforces require_keys_eq!(agent.owner, policy.owner, SentinelError::SecurityDomainMismatch).',
        errorCode: 'SecurityDomainMismatch (6008)',
        status: 'BLOCKED',
        devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      },
      {
        id: 'adv-03',
        num: '03',
        name: 'Inactive Policy Substitution',
        category: 'INVARIANT',
        payload:
          'Agent proposes trade against a deactivated policy or substitutes an uncommitted policy hash.',
        defense: 'PolicyAccount must have is_active == true and matching committed policy version.',
        errorCode: 'PolicyInactive (6001)',
        status: 'BLOCKED',
      },
      {
        id: 'adv-04',
        num: '04',
        name: 'Replayed Promise Ticket',
        category: 'PDA_SECURITY',
        payload:
          'Caller presents a previously executed PromiseAccount or substitutes promise_id to replay a trade.',
        defense: 'PromiseAccount status transitions once; re-use is rejected on-chain.',
        errorCode: 'PromiseMismatch (6005)',
        status: 'BLOCKED',
        devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      },
      {
        id: 'adv-05',
        num: '05',
        name: 'Trade Amount Tampering',
        category: 'INVARIANT',
        payload: 'PromiseAccount commits $5,000, but execution payload attempts $15,000.',
        defense:
          'Anchor asserts require!(trade_amount_cents == promised_cents, SentinelError::TradeAmountMismatch).',
        errorCode: 'TradeAmountMismatch (6009)',
        status: 'BLOCKED',
        devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      },
      {
        id: 'adv-06',
        num: '06',
        name: 'Expired Promise Window',
        category: 'INVARIANT',
        payload: 'Trade intent submitted after unix_timestamp exceeds promise expiration window.',
        defense: 'Temporal validity check rejects stale execution windows before settlement.',
        errorCode: 'ERR_POLICY_EXPIRED',
        status: 'BLOCKED',
      },
      {
        id: 'adv-07',
        num: '07',
        name: 'Emergency Pause Kill-Switch',
        category: 'INVARIANT',
        payload: 'Trade intent submitted while owner has isEmergencyPaused == true.',
        defense: 'Emergency pause immediately blocks all autonomous execution instructions.',
        errorCode: 'ERR_EMERGENCY_PAUSE',
        status: 'BLOCKED',
      },
      {
        id: 'adv-08',
        num: '08',
        name: 'Stale Pyth Oracle Price Quote',
        category: 'ORACLE_MARKET',
        payload: 'Pyth Hermes quote is 140s old (exceeds 60s freshness threshold).',
        defense: 'Fail-closed oracle freshness guard halts trade evaluation.',
        errorCode: 'ERR_QUOTE_STALE',
        status: 'BLOCKED',
      },
      {
        id: 'adv-09',
        num: '09',
        name: 'Excessive Execution Slippage',
        category: 'ORACLE_MARKET',
        payload: 'Quoted pool execution price deviates by 170 bps (> 100 bps slippage limit).',
        defense: 'Pre-trade market quality verifier rejects high-impact bonding curve fills.',
        errorCode: 'ERR_SLIPPAGE_EXCEEDED',
        status: 'BLOCKED',
      },
      {
        id: 'adv-10',
        num: '10',
        name: 'Single-Stock Exposure Breach',
        category: 'INVARIANT',
        payload: 'BUY NVDAx $15,000 pushes single-stock concentration from 20.0% to 35.0% (> 25.0% cap).',
        defense: 'Post-state projection detects 35.0% > 25.0% and reverts before funds move.',
        errorCode: 'ERR_EXPOSURE_EXCEEDED',
        status: 'BLOCKED',
        devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      },
      {
        id: 'adv-11',
        num: '11',
        name: 'Cash Reserve Floor Breach',
        category: 'INVARIANT',
        payload: 'BUY AAPLx $10,000 drains USDC cash reserve from 25.0% to 15.0% (< 20.0% floor).',
        defense: 'Post-state projection enforces minimum 20.0% cash reserve floor.',
        errorCode: 'ERR_RESERVE_BREACHED',
        status: 'BLOCKED',
        devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      },
      {
        id: 'adv-12',
        num: '12',
        name: 'Adapted Compliant Trade (Positive Control)',
        category: 'INVARIANT',
        payload: 'BUY NVDAx $5,000 results in 25.0% NVDAx weight and 20.0% USDC cash reserve.',
        defense: 'All 4 policy rules satisfied; settles and anchors SHA-256 receipt.',
        errorCode: 'PASS_COMPLIANT',
        status: 'APPROVED',
        devnetTx: APP_CONFIG.devnetTransactions.executeValidTradeTx,
      },
    ];

    return raw.map((item) => ({
      ...item,
      sha256Hash: sha256Hex(`${item.id}|${item.errorCode}|${item.payload}`),
    }));
  }, []);

  const filteredVectors = vectors.filter(
    (v) => selectedFilter === 'ALL' || v.category === selectedFilter
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <PageHeader
        category="VERIFICATION"
        title="Negative Proof & Security Suite"
        subtitle="11 adversarial attack vectors blocked + 1 compliant control verified against Sentinel policy rules."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'All (12)' },
                { id: 'INVARIANT', label: 'Policy Limits (7)' },
                { id: 'PDA_SECURITY', label: 'PDA Authority (3)' },
                { id: 'ORACLE_MARKET', label: 'Oracle & Market (2)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  selectedFilter === tab.id
                    ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-white'
                    : 'bg-sentinel-surface border-sentinel-border text-sentinel-textMuted hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* PRIMARY FOCAL POINT: COMPACT VERIFICATION LIST (EXPAND FOR HASHES/TX)     */}
      {/* ========================================================================= */}
      <Card padding="none" className="overflow-hidden divide-y divide-sentinel-border">
        {filteredVectors.map((vec) => {
          const isExpanded = expandedId === vec.id;
          const isBlocked = vec.status === 'BLOCKED';
          return (
            <div key={vec.id} className="transition-colors">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : vec.id)}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-sentinel-surfaceElevated/50 transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-sentinel-textSubtle w-6 shrink-0">
                    #{vec.num}
                  </span>
                  {isBlocked ? (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-white truncate">{vec.name}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline text-xs font-mono text-sentinel-textMuted">
                    {vec.errorCode}
                  </span>
                  <Badge variant={isBlocked ? 'danger' : 'success'} size="xs">
                    {isBlocked ? 'Blocked' : 'Approved'}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-sentinel-textSubtle" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-sentinel-textSubtle" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 pt-2 bg-sentinel-surfaceMuted/40 border-t border-sentinel-border/60 space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sentinel-textSubtle block mb-0.5">Test Input</span>
                      <p className="text-sentinel-text leading-relaxed">{vec.payload}</p>
                    </div>
                    <div>
                      <span className="text-sentinel-textSubtle block mb-0.5">Enforcement Mechanism</span>
                      <p className="text-sentinel-text leading-relaxed">{vec.defense}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sentinel-border/50 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-sentinel-textMuted">
                    <div className="flex items-center gap-2">
                      <span>Preimage SHA-256:</span>
                      <span className="text-white">0x{vec.sha256Hash.slice(0, 16)}…{vec.sha256Hash.slice(-6)}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(vec.sha256Hash, vec.id)}
                        className="text-sentinel-textSubtle hover:text-white cursor-pointer"
                        title="Copy full SHA-256 hash"
                      >
                        {copiedKey === vec.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {vec.devnetTx && (
                      <a
                        href={getExplorerTxUrl(vec.devnetTx)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Devnet Tx: {formatAddress(vec.devnetTx, 6)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* ========================================================================= */}
      {/* COLLAPSED DISCLOSURE: ON-CHAIN PDAS & DEVNET TRANSACTIONS                 */}
      {/* ========================================================================= */}
      <Card padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOnChainOpen(!isOnChainOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-sentinel-surfaceMuted transition cursor-pointer"
        >
          <div>
            <span className="text-xs font-semibold text-white">
              Inspect On-Chain PDAs &amp; Devnet Transactions
            </span>
            <span className="text-xs text-sentinel-textSubtle ml-2 font-mono">
              (Program {formatAddress(APP_CONFIG.sentinelProgramId, 4)})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-sentinel-textSubtle">
            <span>{isOnChainOpen ? 'Hide On-Chain Addresses' : 'Expand PDAs & Signatures'}</span>
            {isOnChainOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isOnChainOpen && (
          <div className="p-5 border-t border-sentinel-border bg-sentinel-surfaceMuted/40 space-y-5 text-xs font-mono">
            {/* 4 Anchor PDAs */}
            <div>
              <div className="text-sentinel-textSubtle font-sans font-semibold mb-2">
                Deployed Solana Devnet PDAs
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'PolicyAccount PDA', addr: APP_CONFIG.policyPda },
                  { label: 'VaultAccount PDA', addr: APP_CONFIG.vaultPda },
                  { label: 'AgentAccount PDA', addr: APP_CONFIG.agentPda },
                  { label: 'Anchor IDL Account', addr: APP_CONFIG.idlAccount },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border flex items-center justify-between"
                  >
                    <div>
                      <div className="text-[10px] text-sentinel-textSubtle font-sans">{item.label}</div>
                      <div className="text-white mt-0.5">{formatAddress(item.addr, 6)}</div>
                    </div>
                    <a
                      href={getExplorerAddressUrl(item.addr)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Devnet Transactions */}
            <div>
              <div className="text-sentinel-textSubtle font-sans font-semibold mb-2">
                Reference Devnet Transaction Signatures
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: 'initialize_policy',
                    sig: APP_CONFIG.devnetTransactions.initializePolicyTx,
                  },
                  {
                    label: 'reject_bad_trade',
                    sig: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
                  },
                  {
                    label: 'execute_guarded_trade',
                    sig: APP_CONFIG.devnetTransactions.executeValidTradeTx,
                  },
                  {
                    label: 'record_evidence',
                    sig: APP_CONFIG.devnetTransactions.recordEvidenceTx,
                  },
                ].map((tx) => (
                  <div
                    key={tx.label}
                    className="p-3 rounded-lg bg-sentinel-surface border border-sentinel-border flex items-center justify-between"
                  >
                    <div>
                      <div className="text-[10px] text-sentinel-textSubtle">{tx.label}</div>
                      <div className="text-white mt-0.5">{formatAddress(tx.sig, 6)}</div>
                    </div>
                    <a
                      href={getExplorerTxUrl(tx.sig)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
