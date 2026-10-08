'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamicImport from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  Connection,
} from '@solana/web3.js';
import { BN, Program, AnchorProvider } from '@coral-xyz/anchor';
import { SENTINEL_IDL, SENTINEL_ERROR_BY_CODE, getSentinelError, requiredRecoveryUnits } from '@sentinel/sdk';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
} from 'lucide-react';

const WalletMultiButtonDynamic = dynamicImport(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
const PYTH_PRICE_UPDATE_DEVNET = new PublicKey('GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i');
const DEFAULT_VAULT_OWNER = 'HJJo1z2MWcCPAwLF1qL22UiXczJ8UQg46WECDVCuMRVC';

interface VaultPosition {
  symbol: string;
  amountUnits: number;
  priceCents: number;
  isIndex: boolean;
  mint: string;
}

interface VaultData {
  address: string;
  owner: string;
  policy: string;
  status: 'active' | 'quarantined' | 'recoveryExpired' | 'pending';
  rawStatus: any;
  usdcBalanceCents: number;
  totalValueCents: number;
  positions: VaultPosition[];
  pendingViolationSlot: number;
  quarantineSlot: number;
  recoveryExpiresSlot: number;
  recoveryNonce: number;
  lastRecoverySlot: number;
  lastRecoverySolver: string;
}

interface PolicyData {
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  confirmSlots: number;
  recoveryWindowSlots: number;
  maxRecoveryCostBps: number;
  maxBountyBps: number;
}

interface TimelineItem {
  signature: string;
  slot: number;
  event: string;
  status: 'pending' | 'quarantined' | 'recovered' | 'released' | 'expired' | 'synced' | 'initialized';
  timestamp?: string;
  blockTime?: number | null;
}

function parseProgramError(err: any): { code?: number; name: string; message: string } {
  const errString = err?.message || String(err);

  // Check Anchor custom program error hex (0x178e -> 6030, etc.)
  const hexMatch = errString.match(/custom program error:\s*(0x[0-9a-fA-F]+)/);
  if (hexMatch) {
    const code = parseInt(hexMatch[1], 16);
    const errInfo = SENTINEL_ERROR_BY_CODE[code];
    if (errInfo) {
      return {
        code,
        name: errInfo.name,
        message: errInfo.msg,
      };
    }
  }

  // Check decimal code match (Error Code: 6030 or Error Number: 6030)
  const decMatch = errString.match(/Error (?:Code|Number):\s*([0-9]+)/);
  if (decMatch) {
    const code = parseInt(decMatch[1], 10);
    const errInfo = SENTINEL_ERROR_BY_CODE[code];
    if (errInfo) {
      return {
        code,
        name: errInfo.name,
        message: errInfo.msg,
      };
    }
  }

  // Check Anchor error name string
  const nameMatch = errString.match(/Error Code:\s*(\w+)/);
  if (nameMatch) {
    const errInfo = getSentinelError(nameMatch[1]);
    if (errInfo) {
      return {
        code: errInfo.code,
        name: errInfo.name,
        message: errInfo.msg,
      };
    }
  }

  // Check simulation logs
  if (err?.logs && Array.isArray(err.logs)) {
    for (const log of err.logs) {
      for (const info of Object.values(SENTINEL_ERROR_BY_CODE)) {
        if (log.includes(info.name) || log.includes(`Error Code: ${info.name}`)) {
          return {
            code: info.code,
            name: info.name,
            message: info.msg,
          };
        }
      }
    }
  }

  // Check known string names in errString
  for (const info of Object.values(SENTINEL_ERROR_BY_CODE)) {
    if (errString.includes(info.name)) {
      return {
        code: info.code,
        name: info.name,
        message: info.msg,
      };
    }
  }

  return {
    name: 'TransactionFailed',
    message: errString.length > 180 ? `${errString.slice(0, 180)}...` : errString,
  };
}

export default function QuarantinePage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [ownerInput, setOwnerInput] = useState<string>(DEFAULT_VAULT_OWNER);
  const [activeOwner, setActiveOwner] = useState<string>(DEFAULT_VAULT_OWNER);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number>(0);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<{ name: string; code?: number; message: string } | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  // Derive PDAs
  const { vaultPda, policyPda } = useMemo(() => {
    try {
      const ownerPk = new PublicKey(activeOwner);
      const [vPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), ownerPk.toBuffer()], PROGRAM_ID);
      const [pPda] = PublicKey.findProgramAddressSync([Buffer.from('policy'), ownerPk.toBuffer()], PROGRAM_ID);
      return { vaultPda: vPda, policyPda: pPda };
    } catch {
      return { vaultPda: null, policyPda: null };
    }
  }, [activeOwner]);

  // Load authoritative on-chain data
  const refreshData = useCallback(async () => {
    if (!vaultPda || !policyPda) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Connect to Devnet
      const devnetConn = new Connection('https://api.devnet.solana.com', 'confirmed');
      const slot = await devnetConn.getSlot('confirmed');
      setCurrentSlot(slot);

      const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async (t: any) => t,
        signAllTransactions: async (t: any) => t,
      };
      const provider = new AnchorProvider(devnetConn, dummyWallet as any, { commitment: 'confirmed' });
      const program = new Program(SENTINEL_IDL as any, provider);

      // 1. Fetch Vault
      const vaultAcc = await (program.account as any).portfolioVault.fetch(vaultPda);
      const statusObj = vaultAcc.status;
      let statusKey: 'active' | 'quarantined' | 'recoveryExpired' | 'pending' = 'active';
      if (typeof statusObj === 'string') {
        statusKey = statusObj as any;
      } else if (statusObj.quarantined) {
        statusKey = 'quarantined';
      } else if (statusObj.recoveryExpired) {
        statusKey = 'recoveryExpired';
      } else if (statusObj.active) {
        statusKey = 'active';
      }

      if (statusKey === 'active' && vaultAcc.pendingViolationSlot?.toNumber() > 0) {
        statusKey = 'pending';
      }

      const positions: VaultPosition[] = (vaultAcc.positions || []).map((p: any) => {
        let sym = 'ASSET';
        try {
          sym = Buffer.from(p.symbol).toString('utf8').replace(/\0/g, '').trim() || 'ASSET';
        } catch {}
        return {
          symbol: sym,
          amountUnits: p.amountUnits ? p.amountUnits.toNumber() : 0,
          priceCents: p.priceCents ? p.priceCents.toNumber() : 0,
          isIndex: Boolean(p.isIndex),
          mint: p.mint ? p.mint.toBase58() : '',
        };
      });

      setVault({
        address: vaultPda.toBase58(),
        owner: vaultAcc.owner.toBase58(),
        policy: vaultAcc.policy.toBase58(),
        status: statusKey,
        rawStatus: statusObj,
        usdcBalanceCents: vaultAcc.usdcBalanceCents.toNumber(),
        totalValueCents: vaultAcc.totalValueCents.toNumber(),
        positions,
        pendingViolationSlot: vaultAcc.pendingViolationSlot ? vaultAcc.pendingViolationSlot.toNumber() : 0,
        quarantineSlot: vaultAcc.quarantineSlot ? vaultAcc.quarantineSlot.toNumber() : 0,
        recoveryExpiresSlot: vaultAcc.recoveryExpiresSlot ? vaultAcc.recoveryExpiresSlot.toNumber() : 0,
        recoveryNonce: vaultAcc.recoveryNonce ? vaultAcc.recoveryNonce.toNumber() : 0,
        lastRecoverySlot: vaultAcc.lastRecoverySlot ? vaultAcc.lastRecoverySlot.toNumber() : 0,
        lastRecoverySolver: vaultAcc.lastRecoverySolver ? vaultAcc.lastRecoverySolver.toBase58() : '',
      });

      // 2. Fetch Policy
      const policyAcc = await (program.account as any).policyAccount.fetch(policyPda);
      setPolicy({
        maxSingleAssetBps: policyAcc.maxSingleAssetBps,
        minStablecoinBps: policyAcc.minStablecoinBps,
        confirmSlots: policyAcc.confirmSlots.toNumber(),
        recoveryWindowSlots: policyAcc.recoveryWindowSlots.toNumber(),
        maxRecoveryCostBps: policyAcc.maxRecoveryCostBps,
        maxBountyBps: policyAcc.maxBountyBps,
      });

      // 3. Fetch Transaction History / Timeline for Vault
      const signatures = await devnetConn.getSignaturesForAddress(vaultPda, { limit: 10 });
      const timelineItems: TimelineItem[] = [];

      for (const sigInfo of signatures) {
        let detectedStatus: TimelineItem['status'] = 'synced';
        let eventName = 'Vault Updated';

        if (sigInfo.err) {
          continue;
        }

        // Fetch transaction details to determine instruction type
        const tx = await devnetConn.getTransaction(sigInfo.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        const logs = tx?.meta?.logMessages || [];
        for (const log of logs) {
          if (log.includes('Instruction: Recover')) {
            detectedStatus = 'recovered';
            eventName = 'Recovery Executed (Active)';
            break;
          } else if (log.includes('Instruction: FlagViolation')) {
            if (logs.some((l) => l.includes('QuarantineExecutedEvent') || l.includes('Quarantined'))) {
              detectedStatus = 'quarantined';
              eventName = 'Violation Confirmed (Quarantined)';
            } else {
              detectedStatus = 'pending';
              eventName = 'Violation Flagged (Pending)';
            }
            break;
          } else if (log.includes('Instruction: OwnerRelease')) {
            detectedStatus = 'released';
            eventName = 'Owner Released (Active)';
            break;
          } else if (log.includes('Instruction: ExpireQuarantine')) {
            detectedStatus = 'expired';
            eventName = 'Quarantine Window Expired';
            break;
          } else if (log.includes('Instruction: SyncVault')) {
            detectedStatus = 'synced';
            eventName = 'Owner Ledger Sync (sync_vault)';
            break;
          } else if (log.includes('Instruction: InitializeVault')) {
            detectedStatus = 'initialized';
            eventName = 'Vault Initialized';
            break;
          }
        }

        timelineItems.push({
          signature: sigInfo.signature,
          slot: sigInfo.slot,
          event: eventName,
          status: detectedStatus,
          blockTime: sigInfo.blockTime,
        });
      }

      setTimeline(timelineItems);
    } catch (err: any) {
      console.error('Failed to load on-chain quarantine state:', err);
      setErrorMessage({
        name: 'FetchFailed',
        message: err.message || 'Failed to fetch on-chain account data',
      });
    } finally {
      setIsLoading(false);
    }
  }, [vaultPda, policyPda]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Execute Recover
  const handleRecover = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert('Please connect your Solana wallet to execute recovery.');
      return;
    }
    if (!vaultPda || !policyPda || !vault) {
      return;
    }

    setIsRecovering(true);
    setErrorMessage(null);
    setSuccessTx(null);

    try {
      const devnetConn = new Connection('https://api.devnet.solana.com', 'confirmed');
      const provider = new AnchorProvider(devnetConn, wallet as any, { commitment: 'confirmed' });
      const program = new Program(SENTINEL_IDL as any, provider);

      // Determine optimal sell units using pure solver recovery engine:
      const pos = vault.positions[0];
      if (!pos || pos.amountUnits <= 0) {
        throw new Error('No volatile asset position found in vault ledger to recover.');
      }

      const priceCents = pos.priceCents > 0 ? pos.priceCents : 10000;
      const plan = requiredRecoveryUnits(
        {
          usdcBalanceCents: vault.usdcBalanceCents,
          positions: vault.positions,
        },
        {
          maxSingleAssetBps: policy?.maxSingleAssetBps ?? 2500,
          minStablecoinBps: policy?.minStablecoinBps ?? 2000,
          maxRecoveryCostBps: policy?.maxRecoveryCostBps ?? 100,
        },
        priceCents,
        { mode: 'simulated' }
      );

      let sellUnits = Number(plan.sellUnits);
      if (sellUnits <= 0) sellUnits = 1;
      if (sellUnits > pos.amountUnits) sellUnits = pos.amountUnits;

      const expectedNonce = new BN(vault.recoveryNonce);

      const tx = await (program.methods as any)
        .recover(new BN(sellUnits), expectedNonce)
        .accountsPartial({
          vault: vaultPda,
          policy: policyPda,
          priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
          solver: wallet.publicKey,
        })
        .transaction();

      const { blockhash } = await devnetConn.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction!(tx);
      const sig = await devnetConn.sendRawTransaction(signedTx.serialize());
      await devnetConn.confirmTransaction(sig, 'confirmed');

      setSuccessTx(sig);
      await refreshData();
    } catch (err: any) {
      console.error('Recover execution error:', err);
      const parsed = parseProgramError(err);
      setErrorMessage(parsed);
    } finally {
      setIsRecovering(false);
    }
  };

  // Compute metrics
  const volatilePos = vault?.positions[0];
  const volatileValueCents = volatilePos ? volatilePos.amountUnits * volatilePos.priceCents : 0;
  const currentTotalCents = (vault?.usdcBalanceCents || 0) + volatileValueCents;
  const exposureBps = currentTotalCents > 0 ? Math.round((volatileValueCents * 10000) / currentTotalCents) : 0;
  const capBps = policy?.maxSingleAssetBps || 2500;
  const stableRatioBps = currentTotalCents > 0 ? Math.round(((vault?.usdcBalanceCents || 0) * 10000) / currentTotalCents) : 0;
  const stableFloorBps = policy?.minStablecoinBps || 2000;

  const slotsRemaining =
    vault?.status === 'quarantined' && vault.recoveryExpiresSlot > currentSlot
      ? vault.recoveryExpiresSlot - currentSlot
      : 0;

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-[#1E2638] bg-[#0D111A]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </Link>
          <div className="h-4 w-px bg-[#1E2638]" />
          <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>Sentinel Quarantine Engine</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Devnet
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="p-1.5 rounded border border-[#1E2638] bg-[#111622] hover:bg-[#161D2C] text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Refresh on-chain state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <WalletMultiButtonDynamic />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Honest Trust Boundary / Settlement Disclaimer */}
        <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 space-y-1">
            <div className="font-semibold text-amber-300">
              Ledger-based vault. Simulated settlement.
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/70">
              Vault asset balances are owner-synced ledger values recorded via <code className="text-amber-300 bg-amber-500/10 px-1 py-0.2 rounded font-mono">sync_vault</code>, not live SPL token accounts.
              Prices are authoritatively parsed and verified from live Pyth Network price accounts on Solana Devnet.
              Solver recovery settlement is simulated at the verified Pyth oracle price minus a 30 bps venue fee. Bounty awards are simulated and not disbursed on-chain.
            </p>
          </div>
        </div>

        {/* Vault Target Controller */}
        <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Vault Owner Account
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                placeholder="Enter Vault Owner Public Key"
                className="w-full sm:w-96 px-3 py-1.5 text-xs font-mono bg-[#090B10] border border-[#1E2638] rounded text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setActiveOwner(ownerInput.trim())}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                Inspect
              </button>
            </div>
          </div>

          <div className="text-right sm:text-right space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Vault PDA
            </span>
            <div className="text-xs font-mono text-slate-300 truncate max-w-xs">
              {vaultPda ? (
                <a
                  href={`https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline flex items-center gap-1 justify-end"
                >
                  <span>{vaultPda.toBase58().slice(0, 12)}...{vaultPda.toBase58().slice(-8)}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              ) : (
                'Invalid Owner'
              )}
            </div>
          </div>
        </div>

        {/* Core Vault Status Hero Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Vault Status Badge Card */}
          <div className="p-5 rounded-xl border border-[#1E2638] bg-[#111622] space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Vault Lifecycle Status
            </span>
            <div>
              {vault?.status === 'active' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ACTIVE</span>
                </div>
              )}
              {vault?.status === 'quarantined' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  <span>QUARANTINED</span>
                </div>
              )}
              {vault?.status === 'recoveryExpired' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>RECOVERY EXPIRED</span>
                </div>
              )}
              {vault?.status === 'pending' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>PENDING CONFIRMATION</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {vault?.status === 'quarantined'
                ? 'Autonomous agent authority is locked out. Open for permissionless solver reduce-only recovery.'
                : vault?.status === 'active'
                ? 'Normal agent trading is authorized within policy invariants.'
                : 'Recovery window has expired. Requires owner intervention or settlement.'}
            </p>
          </div>

          {/* 2. Exposure vs Cap Card */}
          <div className="p-5 rounded-xl border border-[#1E2638] bg-[#111622] space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Single-Asset Exposure vs Cap
            </span>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {(exposureBps / 100).toFixed(2)}%
              </div>
              <div className="text-xs font-mono text-slate-400">
                Cap: <span className="text-slate-200">{(capBps / 100).toFixed(2)}%</span>
              </div>
            </div>
            {/* Exposure progress bar */}
            <div className="w-full bg-[#1A2234] rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  exposureBps > capBps ? 'bg-rose-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (exposureBps / capBps) * 100)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between font-mono">
              <span>Stablecoin Reserve:</span>
              <span className={stableRatioBps < stableFloorBps ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                {(stableRatioBps / 100).toFixed(2)}% (Floor: {(stableFloorBps / 100).toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* 3. Recovery Window Slots Remaining Card */}
          <div className="p-5 rounded-xl border border-[#1E2638] bg-[#111622] space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Recovery Window Slots Remaining
            </span>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {vault?.status === 'quarantined' ? (
                  <span>{slotsRemaining} <span className="text-xs text-slate-400 font-normal">slots</span></span>
                ) : vault?.status === 'recoveryExpired' ? (
                  <span className="text-amber-400">0</span>
                ) : (
                  <span className="text-slate-500 text-lg">Window Inactive</span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-400">
                Current Slot: <span className="text-slate-200">{currentSlot}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between font-mono">
                <span>Quarantine Slot:</span>
                <span className="text-slate-300">{vault?.quarantineSlot || 'N/A'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>Expires Slot:</span>
                <span className="text-slate-300">{vault?.recoveryExpiresSlot || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recovery Action Card */}
        <div className="p-6 rounded-xl border border-[#1E2638] bg-[#111622] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2638] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Permissionless Solver Recovery</h2>
              <p className="text-xs text-slate-400">
                Reduce-only rebalancing: Sells volatile position into USDC to satisfy policy exposure cap and oversell guard.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Recovery Nonce: <span className="text-white font-semibold">{vault?.recoveryNonce ?? 0}</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 space-y-1">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Program Error: {errorMessage.name} {errorMessage.code ? `(${errorMessage.code})` : ''}</span>
              </div>
              <p className="text-[11px] text-rose-200/80 leading-relaxed pl-6">
                {errorMessage.message}
              </p>
            </div>
          )}

          {/* Success Banner */}
          {successTx && (
            <div className="p-3.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Recovery Executed Successfully — Vault is Active Again!</span>
              </div>
              <div className="text-[11px] text-emerald-200/80 pl-6 flex items-center gap-1 font-mono">
                <span>Tx Signature:</span>
                <a
                  href={`https://explorer.solana.com/tx/${successTx}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-white truncate max-w-sm"
                >
                  {successTx}
                </a>
                <ExternalLink className="w-3 h-3 text-emerald-400" />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400 space-y-1">
              <div>
                Connected Solver Wallet:{' '}
                <span className="font-mono text-slate-200">
                  {wallet.publicKey ? `${wallet.publicKey.toBase58().slice(0, 8)}...${wallet.publicKey.toBase58().slice(-6)}` : 'Not connected'}
                </span>
              </div>
              <div>
                Asset Holdings:{' '}
                <span className="font-mono text-slate-200">
                  {volatilePos ? `${volatilePos.amountUnits} ${volatilePos.symbol}` : '0 units'}
                </span>
                {' '}| USDC Balance:{' '}
                <span className="font-mono text-slate-200">
                  ${((vault?.usdcBalanceCents || 0) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleRecover}
              disabled={isRecovering || vault?.status !== 'quarantined'}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 ${
                vault?.status === 'quarantined'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-[#1A2234] text-slate-500 cursor-not-allowed border border-[#1E2638]'
              }`}
            >
              {isRecovering ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Broadcasting Recover Transaction...</span>
                </>
              ) : vault?.status === 'quarantined' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Execute Reduce-Only Recovery</span>
                </>
              ) : (
                <span>Vault Not Quarantined</span>
              )}
            </button>
          </div>
        </div>

        {/* Program Event & Transaction Timeline */}
        <div className="p-6 rounded-xl border border-[#1E2638] bg-[#111622] space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E2638] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Quarantine & Recovery Lifecycle Timeline</h2>
              <p className="text-xs text-slate-400">
                Authoritative on-chain event stream parsed directly from program transactions and account logs.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1A2234] text-slate-400 border border-[#1E2638]">
              {timeline.length} transactions recorded
            </span>
          </div>

          {timeline.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No transactions recorded for this vault yet.
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item, idx) => (
                <div
                  key={item.signature}
                  className="p-3.5 rounded-lg border border-[#1E2638] bg-[#0D111A] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-500 w-4">
                      #{timeline.length - idx}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {item.event}
                        </span>
                        {item.status === 'recovered' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            RECOVERED
                          </span>
                        )}
                        {item.status === 'quarantined' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            QUARANTINED
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            PENDING
                          </span>
                        )}
                        {item.status === 'synced' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            LEDGER SYNC
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Slot: {item.slot}
                        {item.blockTime && ` • ${new Date(item.blockTime * 1000).toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <a
                      href={`https://explorer.solana.com/tx/${item.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline"
                    >
                      <span>{item.signature.slice(0, 8)}...{item.signature.slice(-6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
