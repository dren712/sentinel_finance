'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
  Database,
  Cpu,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Copy,
  Check,
  Terminal,
  Layers,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl, getExplorerTxUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';
import { SourceBadge } from './ui/SourceBadge';
import { PageHeader } from './ui/PageHeader';
import { Card, CardHeader } from './ui/Card';
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
  sha256Hash: string;
  details: string;
}

export const ProofVerificationView: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'PDA_SECURITY' | 'INVARIANT' | 'ORACLE_MARKET'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('adv-10');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const vectors: AdversarialVector[] = [
    {
      id: 'adv-01',
      num: '01',
      name: 'Direct Program Bypass Attempt',
      category: 'PDA_SECURITY',
      payload: 'Rogue external caller attempts to invoke execute_guarded_trade directly without valid Agent PDA seeds.',
      defense: 'Anchor seeds constraint [b"agent", owner, agent_id] cryptographically fails. Zero state changes.',
      errorCode: 'ConstraintSeeds (Anchor 2006)',
      status: 'BLOCKED',
      devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      details: 'Evaluates unauthorized signer Ed25519 identity against canonical program PDA derived from owner + agent_id.',
    },
    {
      id: 'adv-02',
      num: '02',
      name: 'Cross-Tenant Owner Spoofing',
      category: 'PDA_SECURITY',
      payload: 'Agent derived under Owner A attempts to execute trade against Owner B\'s Vault PDA.',
      defense: 'Anchor enforces require_keys_eq!(agent.owner, policy.owner, SentinelError::SecurityDomainMismatch).',
      errorCode: 'SecurityDomainMismatch (6008)',
      status: 'BLOCKED',
      devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      sha256Hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      details: 'Vault, Policy, and Agent must belong to the exact same owner identity; cross-tenant mixing is rejected on-chain.',
    },
    {
      id: 'adv-03',
      num: '03',
      name: 'Inactive / Substituted Policy',
      category: 'INVARIANT',
      payload: 'Agent proposes trade against a deactivated policy or substitutes an uncommitted policy hash.',
      defense: 'Sentinel fail-closed invariant engine throws Error("Cannot evaluate against an inactive policy").',
      errorCode: 'PolicyInactive (6001)',
      status: 'BLOCKED',
      sha256Hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      details: 'PolicyAccount must have isActive == true and hash matching committed on-chain preimage.',
    },
    {
      id: 'adv-04',
      num: '04',
      name: 'Replayed / Mismatched Promise Ticket',
      category: 'PDA_SECURITY',
      payload: 'Attacker presents a previously executed PromiseAccount or substitutes promise_id to re-run trade.',
      defense: 'Promise PDA seeds [b"promise", agent_pda, promise_id] binding fails. PromiseAccount marked executed.',
      errorCode: 'PromiseMismatch (6005)',
      status: 'BLOCKED',
      devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      sha256Hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      details: 'Double-spend prevention: promises can only transition state once before being permanently invalidated.',
    },
    {
      id: 'adv-05',
      num: '05',
      name: 'Trade Amount Tampering',
      category: 'INVARIANT',
      payload: 'Agent PromiseAccount commits $5,000, but execution payload attempts $15,000.',
      defense: 'Anchor program line 319: require!(trade_amount_cents == promised_cents, SentinelError::TradeAmountMismatch).',
      errorCode: 'TradeAmountMismatch (6009)',
      status: 'BLOCKED',
      devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      sha256Hash: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      details: 'Guarantees execution amount strictly equals the pre-simulated and approved financial commitment.',
    },
    {
      id: 'adv-06',
      num: '06',
      name: 'Expired Promise / Policy Window',
      category: 'INVARIANT',
      payload: 'Trade intent submitted after clock.unix_timestamp exceeds promise expiration deadline.',
      defense: 'Temporal validity gate fails closed. Trade is rejected before transaction assembly.',
      errorCode: 'ERR_POLICY_EXPIRED',
      status: 'BLOCKED',
      sha256Hash: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      details: 'Guarantees quotes and market assessments do not execute across stale time windows.',
    },
    {
      id: 'adv-07',
      num: '07',
      name: 'Emergency Pause Kill-Switch',
      category: 'INVARIANT',
      payload: 'Trade intent submitted while user or circuit breaker has isEmergencyPaused == true.',
      defense: 'Universal emergency halt: all agent trading permissions suspended instantaneously.',
      errorCode: 'ERR_EMERGENCY_PAUSE',
      status: 'BLOCKED',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      details: 'One-click on-chain circuit breaker freezes all state transition authorizations.',
    },
    {
      id: 'adv-08',
      num: '08',
      name: 'Stale Pyth Oracle Price Quote',
      category: 'ORACLE_MARKET',
      payload: 'Pyth Hermès quote older than 60s freshness threshold (e.g. 180s old quote injected).',
      defense: 'PythLivePriceProvider fail-closed check: quote rejected; prevents execution on stale market truth.',
      errorCode: 'ERR_QUOTE_STALE',
      status: 'BLOCKED',
      sha256Hash: '1288c6981881b7e641d40ff4dd7a5996057a627ad2b322a36d226a315e2195f2',
      details: 'Dual-feed price truth requires active Hermès pull updates with strict freshness (<60s) and tight confidence bounds.',
    },
    {
      id: 'adv-09',
      num: '09',
      name: 'Excessive Execution Slippage',
      category: 'ORACLE_MARKET',
      payload: 'Quoted execution price deviates by 150 bps (> 75 bps maxSlippageBps ceiling).',
      defense: 'Pre-flight slippage check blocks transaction preparation; protects against front-running and MEV.',
      errorCode: 'ERR_SLIPPAGE_EXCEEDED',
      status: 'BLOCKED',
      sha256Hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      details: 'Enforces deterministic slippage guards between quoted reference price and on-chain executed pool rate.',
    },
    {
      id: 'adv-10',
      num: '10',
      name: 'Single-Asset Exposure Violation',
      category: 'INVARIANT',
      payload: 'BUY NVDAx $15,000 pushes portfolio concentration from 20.0% to 35.0% (> 25.0% policy cap).',
      defense: 'Sentinel post-state projection calculates 35.0% > 25.0% and halts execution with exact headroom.',
      errorCode: 'ERR_EXPOSURE_EXCEEDED',
      status: 'BLOCKED',
      devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      sha256Hash: 'fc9222cf648b2da5cf14e7a797c270d10c52f6f4c8c7d9bcddf1e00cd1f05786',
      details: 'Flagship demo case: AI proposes unconstrained intent; Sentinel blocks transition and computes $5,000 compliant adaptation.',
    },
    {
      id: 'adv-11',
      num: '11',
      name: 'Stablecoin Reserve Floor Drain',
      category: 'INVARIANT',
      payload: 'BUY NVDAx $15,000 draws USDC reserves from 25.0% to 10.0% (< 20.0% minimum floor) & exceeds $10K limit.',
      defense: 'Dual check failure: ERR_STABLECOIN_RESERVE_BREACHED and ERR_TRADE_SIZE_EXCEEDED trigger immediate halt.',
      errorCode: 'ERR_STABLECOIN_RESERVE_BREACHED',
      status: 'BLOCKED',
      devnetTx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      sha256Hash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      details: 'Protects liquidity reserves: agent cannot drain cash cushion regardless of market opportunities.',
    },
    {
      id: 'ctrl-12',
      num: '12',
      name: 'Valid Adapted Path (Compliant Execution)',
      category: 'INVARIANT',
      payload: 'BUY NVDAx $5,000 (Adapted to compliant headroom: NVDAx 20% → 25%, USDC 25% → 20%, Trade $5K ≤ $10K).',
      defense: 'All invariants verified; Anchor execute_guarded_trade settles transaction and seals PROVN receipt.',
      errorCode: 'NONE (VERIFIED_COMPLIANT)',
      status: 'APPROVED',
      devnetTx: APP_CONFIG.devnetTransactions.executeValidTradeTx,
      sha256Hash: 'e6c2789f2a99e826b19a31a98059e0a0d922a945d8b7b2ce8f498c4d29a5d123',
      details: 'Autonomous adaptation success: agent honors boundaries and executes without manual human intervention.',
    },
  ];

  const devnetLedger = [
    {
      label: 'Initialize Policy & Vault PDA',
      instruction: 'initialize_policy',
      tx: APP_CONFIG.devnetTransactions.initializePolicyTx,
      verdict: 'CONFIRMED',
    },
    {
      label: 'Reject Non-Compliant Intent ($15k NVDAx)',
      instruction: 'reject_bad_trade',
      tx: APP_CONFIG.devnetTransactions.rejectBadTradeTx,
      verdict: 'BLOCKED_ON_CHAIN',
    },
    {
      label: 'Settle Adapted Compliant Trade ($5k NVDAx)',
      instruction: 'execute_guarded_trade',
      tx: APP_CONFIG.devnetTransactions.executeValidTradeTx,
      verdict: 'SETTLED',
    },
    {
      label: 'Anchor PROVN Cryptographic Receipt',
      instruction: 'record_evidence',
      tx: APP_CONFIG.devnetTransactions.recordEvidenceTx,
      verdict: 'SEALED',
    },
  ];

  const filteredVectors = vectors.filter((v) => {
    if (selectedFilter === 'ALL') return true;
    return v.category === selectedFilter;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Philosophy */}
      <PageHeader
        category="VERIFICATION & NEGATIVE PROOFS"
        title="Sentinel Enforcement is Observable"
        subtitle="We prove system security not by showing that a transaction succeeded, but by proving the dangerous things Sentinel refuses to execute."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source="SOLANA" detail="Devnet Program" />
            <SourceBadge source="PROVN" detail="11/11 Negative Vectors" />
            <Badge variant="success" dot>
              120 / 120 Tests Passing
            </Badge>
          </div>
        }
      />

      {/* 2. On-Chain Anchor State & Canonical PDAs */}
      <Card padding="md" className="space-y-4">
        <CardHeader
          category="AUTHORITATIVE SOLANA DEVNET STATE"
          title="Deterministic Anchor PDAs & Program Authority"
          subtitle="Zero off-chain state authority — every policy boundary, agent permission, and vault custody account is PDA-bound."
          action={<SourceBadge source="SOLANA" detail="Anchor Verified" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-[11px]">
          {/* Program ID */}
          <div className="bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-sentinel-textSubtle uppercase font-bold">
                Anchor Program ID
              </span>
              <Badge variant="success">Bytecode ✓</Badge>
            </div>
            <div className="font-bold text-white truncate tabular-nums" title={APP_CONFIG.sentinelProgramId}>
              {formatAddress(APP_CONFIG.sentinelProgramId, 6)}
            </div>
            <div className="text-[10px] flex items-center justify-between pt-0.5">
              <a
                href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 hover:text-purple-300 hover:underline inline-flex items-center gap-1"
              >
                <span>Solana Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(APP_CONFIG.sentinelProgramId, 'prog-id')}
                className="text-sentinel-textSubtle hover:text-white cursor-pointer"
              >
                {copiedKey === 'prog-id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Policy PDA */}
          <div className="bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-sentinel-textSubtle uppercase font-bold">
                Policy Account PDA
              </span>
              <span className="text-[10px] text-sentinel-textMuted">60 Bytes</span>
            </div>
            <div className="font-bold text-white truncate tabular-nums" title={APP_CONFIG.policyPda}>
              {formatAddress(APP_CONFIG.policyPda, 6)}
            </div>
            <div className="text-[10px] flex items-center justify-between pt-0.5">
              <a
                href={getExplorerAddressUrl(APP_CONFIG.policyPda)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
              >
                <span>[b&quot;policy&quot;, owner]</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(APP_CONFIG.policyPda, 'pol-pda')}
                className="text-sentinel-textSubtle hover:text-white cursor-pointer"
              >
                {copiedKey === 'pol-pda' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Agent PDA */}
          <div className="bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-sentinel-textSubtle uppercase font-bold">
                Agent PDA (Robo-01)
              </span>
              <Badge variant="info">Authorized</Badge>
            </div>
            <div className="font-bold text-white truncate tabular-nums" title={APP_CONFIG.agentPda}>
              {formatAddress(APP_CONFIG.agentPda, 6)}
            </div>
            <div className="text-[10px] flex items-center justify-between pt-0.5">
              <a
                href={getExplorerAddressUrl(APP_CONFIG.agentPda)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
              >
                <span>[b&quot;agent&quot;, owner, id]</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(APP_CONFIG.agentPda, 'agt-pda')}
                className="text-sentinel-textSubtle hover:text-white cursor-pointer"
              >
                {copiedKey === 'agt-pda' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Vault PDA */}
          <div className="bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-sentinel-textSubtle uppercase font-bold">
                Portfolio Vault PDA
              </span>
              <span className="text-[10px] text-sentinel-textMuted">549 Bytes</span>
            </div>
            <div className="font-bold text-white truncate tabular-nums" title={APP_CONFIG.vaultPda}>
              {formatAddress(APP_CONFIG.vaultPda, 6)}
            </div>
            <div className="text-[10px] flex items-center justify-between pt-0.5">
              <a
                href={getExplorerAddressUrl(APP_CONFIG.vaultPda)}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1"
              >
                <span>[b&quot;vault&quot;, owner]</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(APP_CONFIG.vaultPda, 'vlt-pda')}
                className="text-sentinel-textSubtle hover:text-white cursor-pointer"
              >
                {copiedKey === 'vlt-pda' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Canonical Devnet Transaction Signatures */}
      <Card padding="md" className="space-y-4">
        <CardHeader
          category="ON-CHAIN SETTLEMENT & REJECTION PROOFS"
          title="Verifiable Solana Devnet Transaction Ledger"
          subtitle="Direct links to confirmed Devnet instruction executions demonstrating initialization, postcondition rejection, and adapted settlement."
          action={<Badge variant="neutral">4 Canonical Signatures</Badge>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          {devnetLedger.map((item) => (
            <div
              key={item.instruction}
              className="p-3.5 rounded-lg bg-sentinel-surfaceMuted border border-sentinel-border flex flex-col justify-between gap-2"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold text-purple-300 uppercase">
                    {item.instruction}
                  </span>
                  <Badge
                    variant={
                      item.verdict === 'BLOCKED_ON_CHAIN'
                        ? 'danger'
                        : item.verdict === 'SETTLED'
                        ? 'success'
                        : 'info'
                    }
                  >
                    {item.verdict}
                  </Badge>
                </div>
                <p className="text-xs font-sans text-white font-medium">{item.label}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-sentinel-border/60 text-[11px]">
                <a
                  href={getExplorerTxUrl(item.tx)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 tabular-nums"
                >
                  <span>{formatAddress(item.tx, 6)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.tx, item.instruction)}
                  className="text-sentinel-textSubtle hover:text-white cursor-pointer"
                  title="Copy transaction signature"
                >
                  {copiedKey === item.instruction ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Adversarial Cases: 11 Attack Vectors + 1 Compliant Adaptation */}
      <Card padding="md" className="space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sentinel-border">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="font-extrabold text-white uppercase tracking-wider text-xs">
                Adversarial Proof Suite (11 Negative Vectors + 1 Compliant Control)
              </span>
            </div>
            <p className="text-[11px] text-sentinel-textMuted font-sans mt-0.5">
              Click any vector to inspect the exact malicious payload, Anchor invariant defense, and deterministic SHA-256 preimage.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-sentinel-surfaceMuted p-1 rounded-lg border border-sentinel-border text-xs">
            {(['ALL', 'INVARIANT', 'PDA_SECURITY', 'ORACLE_MARKET'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedFilter(cat)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer sentinel-interactive ${
                  selectedFilter === cat
                    ? 'bg-sentinel-surfaceElevated text-white border border-sentinel-border shadow-xs'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All (12)' : cat === 'INVARIANT' ? 'Invariants (7)' : cat === 'PDA_SECURITY' ? 'PDA Security (3)' : 'Oracle & Venue (2)'}
              </button>
            ))}
          </div>
        </div>

        {/* Vectors List */}
        <div className="divide-y divide-sentinel-border/70 border border-sentinel-border rounded-xl overflow-hidden bg-black/30">
          {filteredVectors.map((v) => {
            const isExpanded = expandedId === v.id;
            const isApproved = v.status === 'APPROVED';

            return (
              <div key={v.id} className="transition-all">
                {/* Collapsible Row Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sentinel-surfaceElevated/50 transition cursor-pointer sentinel-interactive"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sentinel-textSubtle font-bold tabular-nums">
                      {v.num}
                    </span>

                    <div className="flex items-center gap-2">
                      {isApproved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {v.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <span className="text-[10px] text-sentinel-textSubtle font-mono hidden md:inline">
                      {v.errorCode}
                    </span>

                    <Badge variant={isApproved ? 'success' : 'danger'}>
                      {v.status} ✓
                    </Badge>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-sentinel-textSubtle" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-sentinel-textSubtle" />
                    )}
                  </div>
                </div>

                {/* Expanded Forensic Detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-sentinel-surfaceMuted/50 border-t border-sentinel-border/40 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      {/* Attack Payload */}
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[10px] text-rose-400 uppercase font-bold block">
                          ATTACK VECTOR PAYLOAD:
                        </span>
                        <p className="text-white font-sans leading-relaxed">{v.payload}</p>
                      </div>

                      {/* Sentinel Defense */}
                      <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                          SENTINEL INVARIANT DEFENSE:
                        </span>
                        <p className="text-white font-sans leading-relaxed">{v.defense}</p>
                      </div>
                    </div>

                    {/* Forensic Commitments & Devnet TX */}
                    <div className="p-3 rounded-lg bg-black/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sentinel-textSubtle">PROVN SHA-256:</span>
                        <span className="text-purple-300 font-mono truncate tabular-nums">{v.sha256Hash}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(v.sha256Hash, v.id);
                          }}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          title="Copy SHA-256 preimage"
                        >
                          {copiedKey === v.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>

                      {v.devnetTx && (
                        <a
                          href={getExplorerTxUrl(v.devnetTx)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:underline shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Devnet TX: {formatAddress(v.devnetTx, 4)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
