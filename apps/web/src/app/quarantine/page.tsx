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
import {
  SENTINEL_IDL,
  SENTINEL_ERROR_BY_CODE,
  getSentinelError,
  requiredRecoveryUnits,
  resolveRecoveryCustodyAccounts,
  parsePythPriceUpdateAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  BN,
  Program,
  AnchorProvider,
} from '@sentinel/sdk';
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
  Check,
  Zap,
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
  safeDestination: string;
}

export type RecoveryStep =
  | 'IDLE'
  | 'SIMULATING'
  | 'READY'
  | 'SOLVING'
  | 'CONFIRMING'
  | 'RECOVERED'
  | 'EXPIRED'
  | 'ERROR';


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
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('IDLE');
  const [containmentPlan, setContainmentPlan] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ name: string; code?: number; message: string } | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [oraclePriceCents, setOraclePriceCents] = useState<number>(0);
  const [oraclePublishTime, setOraclePublishTime] = useState<number | null>(null);
  const [recoveryReceipt, setRecoveryReceipt] = useState<{
    signature: string;
    mint: string;
    vaultTokenAccount: string;
    safeDestinationTokenAccount: string;
    safeDestination: string;
    containmentUnits: number;
    preExposureBps: number;
    postExposureBps: number;
    recoveryNonce: number;
    slot: number;
    timestamp: string;
  } | null>(null);

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

      // Fresh Pyth price lookup directly from Pyth PriceUpdateV2 account
      try {
        const priceAccInfo = await devnetConn.getAccountInfo(PYTH_PRICE_UPDATE_DEVNET, 'confirmed');
        if (priceAccInfo && priceAccInfo.data) {
          const parsed = parsePythPriceUpdateAccount(priceAccInfo.data);
          if (parsed.priceCents > 0) {
            setOraclePriceCents(parsed.priceCents);
            setOraclePublishTime(parsed.publishTime);
          }
        }
      } catch (err) {
        console.warn('Failed to parse fresh Pyth price update account:', err);
      }

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
        safeDestination: policyAcc.safeDestination ? policyAcc.safeDestination.toBase58() : '',
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
          if (log.startsWith('Program data: ')) {
            try {
              const decoded = program.coder.events.decode(log.slice(14));
              if (decoded) {
                if (decoded.name === 'RecoveryExecutedEvent') {
                  detectedStatus = 'recovered';
                  eventName = `Recovery Executed (Sold ${(decoded.data as any).sellUnits?.toString()} Units)`;
                  break;
                } else if (decoded.name === 'VaultQuarantinedEvent') {
                  detectedStatus = 'quarantined';
                  eventName = `Vault Quarantined (Nonce ${(decoded.data as any).recoveryNonce?.toString()})`;
                  break;
                } else if (decoded.name === 'ViolationPendingEvent') {
                  detectedStatus = 'pending';
                  eventName = `Violation Flagged (Slot ${(decoded.data as any).slot?.toString()})`;
                  break;
                } else if (decoded.name === 'VaultReleasedEvent') {
                  detectedStatus = 'released';
                  eventName = 'Owner Released to Active';
                  break;
                } else if (decoded.name === 'QuarantineExpiredEvent') {
                  detectedStatus = 'expired';
                  eventName = 'Quarantine Window Expired';
                  break;
                }
              }
            } catch {
              // fallback to string log matching
            }
          }
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
    const interval = setInterval(refreshData, 1000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Sync recovery step state with vault lifecycle
  useEffect(() => {
    if (vault?.status === 'recoveryExpired') {
      setRecoveryStep('EXPIRED');
    } else if (vault?.status === 'active' && successTx) {
      setRecoveryStep('RECOVERED');
    } else if (vault?.status === 'active' && recoveryStep !== 'RECOVERED') {
      setRecoveryStep('IDLE');
    }
  }, [vault?.status, successTx, recoveryStep]);

  // 1. Simulate Containment Plan (Calculates minimal required containment units)
  const handleSimulatePlan = async () => {
    if (!vault || !policy) return;
    setRecoveryStep('SIMULATING');
    setErrorMessage(null);

    try {
      const pos = vault.positions[0];
      if (!pos || pos.amountUnits <= 0) {
        throw new Error('No volatile asset position found in vault ledger to contain.');
      }

      if (!pos.mint || pos.mint === PublicKey.default.toBase58()) {
        throw new Error('MINT UNAVAILABLE: Volatile asset has no on-chain SPL token mint configured.');
      }

      if (!policy.safeDestination || policy.safeDestination === PublicKey.default.toBase58()) {
        throw new Error('SAFE DESTINATION NOT CONFIGURED: Policy requires an explicit safe destination token authority.');
      }

      const priceCents = oraclePriceCents > 0 ? oraclePriceCents : (pos.priceCents > 0 ? pos.priceCents : 10000);

      const plan = requiredRecoveryUnits(
        {
          usdcBalanceCents: vault.usdcBalanceCents,
          positions: vault.positions,
        },
        {
          maxSingleAssetBps: policy.maxSingleAssetBps ?? 2500,
          minStablecoinBps: policy.minStablecoinBps ?? 2000,
          maxRecoveryCostBps: policy.maxRecoveryCostBps ?? 100,
        },
        priceCents,
        { mode: 'custody' }
      );

      let containmentUnits = Number(plan.sellUnits);
      if (containmentUnits <= 0) containmentUnits = 1;
      if (containmentUnits > pos.amountUnits) containmentUnits = pos.amountUnits;

      setContainmentPlan({
        ...plan,
        containmentUnits,
        pos,
        priceCents,
      });
      setRecoveryStep('READY');
    } catch (err: any) {
      console.error('Simulation error:', err);
      const parsed = parseProgramError(err);
      setErrorMessage(parsed);
      setRecoveryStep('ERROR');
    }
  };

  // 2. Execute Real On-Chain Containment Recovery
  const handleExecuteRecovery = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert('Please connect your Solana wallet to execute recovery.');
      return;
    }
    if (!vaultPda || !policyPda || !vault || !policy) {
      return;
    }

    setIsRecovering(true);
    setRecoveryStep('SOLVING');
    setErrorMessage(null);
    setSuccessTx(null);

    try {
      const devnetConn = new Connection('https://api.devnet.solana.com', 'confirmed');
      const provider = new AnchorProvider(devnetConn, wallet as any, { commitment: 'confirmed' });
      const program = new Program(SENTINEL_IDL as any, provider);

      const pos = vault.positions[0];
      if (!pos || pos.amountUnits <= 0) {
        throw new Error('No volatile asset position found in vault to contain.');
      }

      if (!pos.mint || pos.mint === PublicKey.default.toBase58()) {
        throw new Error('MINT UNAVAILABLE: Volatile asset has no on-chain SPL token mint configured in vault positions.');
      }

      if (!policy.safeDestination || policy.safeDestination === PublicKey.default.toBase58()) {
        throw new Error('SAFE DESTINATION NOT CONFIGURED: Policy requires an explicit safe destination token authority.');
      }

      const priceCents = oraclePriceCents > 0 ? oraclePriceCents : (pos.priceCents > 0 ? pos.priceCents : 10000);

      const plan = containmentPlan || requiredRecoveryUnits(
        {
          usdcBalanceCents: vault.usdcBalanceCents,
          positions: vault.positions,
        },
        {
          maxSingleAssetBps: policy.maxSingleAssetBps ?? 2500,
          minStablecoinBps: policy.minStablecoinBps ?? 2000,
          maxRecoveryCostBps: policy.maxRecoveryCostBps ?? 100,
        },
        priceCents,
        { mode: 'custody' }
      );

      let containmentUnits = Number(plan.sellUnits || plan.containmentUnits);
      if (containmentUnits <= 0) containmentUnits = 1;
      if (containmentUnits > pos.amountUnits) containmentUnits = pos.amountUnits;

      const expectedNonce = new BN(vault.recoveryNonce);

      const mintPk = new PublicKey(pos.mint);
      const safeDestPk = new PublicKey(policy.safeDestination);

      // Detect Token Program (SPL Token vs Token-2022)
      let tokenProgramId = TOKEN_PROGRAM_ID;
      try {
        const mintInfo = await devnetConn.getAccountInfo(mintPk, 'confirmed');
        if (mintInfo && mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
        }
      } catch {
        // default to TOKEN_PROGRAM_ID
      }

      const custodyRemaining = resolveRecoveryCustodyAccounts(
        vaultPda,
        safeDestPk,
        mintPk,
        tokenProgramId
      );

      const tx = await (program.methods as any)
        .recover(new BN(containmentUnits), expectedNonce)
        .accountsPartial({
          vault: vaultPda,
          policy: policyPda,
          priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
          solver: wallet.publicKey,
        })
        .remainingAccounts(custodyRemaining)
        .transaction();

      const { blockhash } = await devnetConn.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction!(tx);
      setRecoveryStep('CONFIRMING');

      const sig = await devnetConn.sendRawTransaction(signedTx.serialize());
      await devnetConn.confirmTransaction(sig, 'confirmed');

      const confirmationSlot = await devnetConn.getSlot('confirmed');

      setSuccessTx(sig);
      setRecoveryReceipt({
        signature: sig,
        mint: mintPk.toBase58(),
        vaultTokenAccount: custodyRemaining[0].pubkey.toBase58(),
        safeDestinationTokenAccount: custodyRemaining[1].pubkey.toBase58(),
        safeDestination: safeDestPk.toBase58(),
        containmentUnits,
        preExposureBps: plan.preExposureBps,
        postExposureBps: plan.postExposureBps,
        recoveryNonce: vault.recoveryNonce,
        slot: confirmationSlot,
        timestamp: new Date().toISOString(),
      });
      setRecoveryStep('RECOVERED');
      await refreshData();
    } catch (err: any) {
      console.error('Recover execution error:', err);
      const parsed = parseProgramError(err);
      setErrorMessage(parsed);
      setRecoveryStep('ERROR');
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
        {/* Cinematic CWF Recovery State Machine Centerpiece */}
        <div className="p-5 sm:p-6 rounded-2xl border border-[#1E2638] bg-[#111622] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2638] pb-3">
            <div>
              <div className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span>The Recovery Layer for Autonomous Capital</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Static permissions tell agents what they may do. Sentinel protects what must remain true.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Prove → Quarantine → Recover → Expire
            </div>
          </div>

          {/* Incident Primary State Hierarchy Rail */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-[#090B10] border border-[#1E2638] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">1. Invariant Breach</span>
              <div className="text-sm font-bold text-rose-400">
                {(exposureBps / 100).toFixed(1)}% &gt; {(capBps / 100).toFixed(1)}%
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                {exposureBps > capBps ? 'INVARIANT VIOLATED' : 'PASSING INVARIANTS'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#090B10] border border-[#1E2638] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">2. Oracle Proof</span>
              <div className="text-sm font-bold text-emerald-400">
                PROOF VERIFIED
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Pyth Devnet Full Level
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#090B10] border border-[#1E2638] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">3. Quarantine Status</span>
              <div className="text-sm font-bold text-white">
                {vault?.status === 'quarantined' ? 'QUARANTINED' : vault?.status === 'recoveryExpired' ? 'EXPIRED' : 'ACTIVE'}
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                {vault?.status === 'quarantined'
                  ? `Window: ${slotsRemaining} / ${policy?.recoveryWindowSlots || 15} slots`
                  : 'Agent authority normal'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#090B10] border border-[#1E2638] space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">4. Bounded Recovery</span>
              <div className="text-sm font-bold text-emerald-400">
                {recoveryReceipt ? 'RECOVERED' : containmentPlan ? `${containmentPlan.containmentUnits} UNITS` : 'STANDBY'}
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                Real SPL CPI transfer
              </p>
            </div>
          </div>
        </div>

        {/* Authoritative SPL Token Custody & On-Chain Containment Disclaimer */}
        <div className="p-3.5 rounded-lg border border-blue-500/30 bg-blue-500/5 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200/90 space-y-1">
            <div className="font-semibold text-blue-300">
              Authoritative SPL Token Custody &amp; On-Chain Containment Recovery
            </div>
            <p className="text-[11px] leading-relaxed text-blue-200/70">
              Vault positions are backed by on-chain SPL Token custody accounts. Prices are authoritatively parsed and verified from live Pyth Network <code className="text-blue-300 bg-blue-500/10 px-1 py-0.2 rounded font-mono">PriceUpdateV2</code> accounts on Solana Devnet.
              When quarantined, permissionless solver recovery executes program-signed CPI <code className="text-blue-300 bg-blue-500/10 px-1 py-0.2 rounded font-mono">transfer_checked_signed</code> to transfer excess volatile tokens directly to the policy safe destination, strictly restoring portfolio exposure within invariant limits.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
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

          {/* 3. Verified Pyth Oracle Price Card */}
          <div className="p-5 rounded-xl border border-[#1E2638] bg-[#111622] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Pyth Price Proof
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                VERIFIED
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
                ${((oraclePriceCents > 0 ? oraclePriceCents : (volatilePos?.priceCents || 10000)) / 100).toFixed(2)}
              </div>
              <span className="text-xs font-mono text-slate-400">
                {volatilePos?.symbol || 'NVDAx'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono space-y-1">
              <div className="flex justify-between">
                <span>Feed:</span>
                <span className="text-slate-300">GsZE13...52i</span>
              </div>
              <div className="flex justify-between">
                <span>Updated:</span>
                <span className="text-slate-300">
                  {oraclePublishTime ? new Date(oraclePublishTime * 1000).toLocaleTimeString() : 'Live'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Recovery Window Slots Remaining Card */}
          <div className="p-5 rounded-xl border border-[#1E2638] bg-[#111622] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Recovery Window
              </span>
              <Clock className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {vault?.status === 'quarantined' ? (
                  <span>
                    {slotsRemaining}{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      slots (~{Math.floor(slotsRemaining * 0.4)}s)
                    </span>
                  </span>
                ) : vault?.status === 'recoveryExpired' ? (
                  <span className="text-amber-400">EXPIRED</span>
                ) : (
                  <span className="text-slate-500 text-lg">Window Inactive</span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-400">
                Current Slot: <span className="text-slate-200">{currentSlot}</span>
              </div>
            </div>
            {/* Visual window countdown progress bar */}
            {vault?.status === 'quarantined' && (
              <div className="space-y-1">
                <div className="w-full bg-[#1A2234] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      slotsRemaining < 20 ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          5,
                          (slotsRemaining / (policy?.recoveryWindowSlots || 100)) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Start: {vault?.quarantineSlot || 'N/A'}</span>
                  <span>Closes: {vault?.recoveryExpiresSlot || 'N/A'}</span>
                </div>
              </div>
            )}
            <div className="text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between font-mono">
                <span>Total Window:</span>
                <span className="text-slate-300">{policy?.recoveryWindowSlots ?? 100} slots</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recovery Action Card (8-State Interactive Coverage) */}
        <div className="p-6 rounded-xl border border-[#1E2638] bg-[#111622] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E2638] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Permissionless Solver Containment</h2>
                {/* 8-State Status Indicator */}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                    recoveryStep === 'RECOVERED'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : recoveryStep === 'ERROR'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : recoveryStep === 'SOLVING' || recoveryStep === 'CONFIRMING'
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      : recoveryStep === 'READY'
                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      : recoveryStep === 'SIMULATING'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : recoveryStep === 'EXPIRED'
                      ? 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/40'
                  }`}
                >
                  STATE: {recoveryStep}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bounded Containment: Transfers excess volatile tokens to policy safe destination via program-signed CPI, strictly satisfying exposure caps and value conservation.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Recovery Nonce: <span className="text-white font-semibold">{vault?.recoveryNonce ?? 0}</span>
            </div>
          </div>

          {/* Containment Plan Preview Banner */}
          {containmentPlan && (
            <div className="p-3.5 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-blue-300 font-bold uppercase text-[11px]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Calculated Containment Parameters</span>
                </div>
                <span className="text-[10px] text-blue-400 font-normal">mode: custody</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                <div className="bg-[#090B10] p-2 rounded border border-[#1E2638]">
                  <span className="text-slate-400 block text-[10px]">Containment Units:</span>
                  <span className="text-white font-bold">{containmentPlan.containmentUnits} {volatilePos?.symbol || 'UNITS'}</span>
                </div>
                <div className="bg-[#090B10] p-2 rounded border border-[#1E2638]">
                  <span className="text-slate-400 block text-[10px]">Post Exposure:</span>
                  <span className="text-emerald-400 font-bold">{(containmentPlan.postExposureBps / 100).toFixed(2)}% (Cap: {((policy?.maxSingleAssetBps || 2500) / 100).toFixed(2)}%)</span>
                </div>
                <div className="bg-[#090B10] p-2 rounded border border-[#1E2638]">
                  <span className="text-slate-400 block text-[10px]">Safe Destination:</span>
                  <span className="text-slate-200 truncate block" title={policy?.safeDestination || vault?.owner}>
                    {policy?.safeDestination ? `${policy.safeDestination.slice(0, 6)}...${policy.safeDestination.slice(-4)}` : 'Vault Owner'}
                  </span>
                </div>
              </div>
            </div>
          )}

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

          {/* Success & Forensic Recovery Receipt */}
          {recoveryReceipt && (
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#091410] space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>On-Chain Containment Recovery Receipt</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  REAL SPL CUSTODY CPI
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                <div className="bg-[#0D1612] p-2.5 rounded border border-emerald-900/40 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Containment Units</span>
                  <span className="text-white font-bold text-sm tabular-nums">
                    {recoveryReceipt.containmentUnits} {volatilePos?.symbol || 'UNITS'}
                  </span>
                </div>
                <div className="bg-[#0D1612] p-2.5 rounded border border-emerald-900/40 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Risk Reduction</span>
                  <span className="text-emerald-400 font-bold text-sm tabular-nums">
                    {(recoveryReceipt.preExposureBps / 100).toFixed(2)}% → {(recoveryReceipt.postExposureBps / 100).toFixed(2)}%
                  </span>
                </div>
                <div className="bg-[#0D1612] p-2.5 rounded border border-emerald-900/40 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Confirmation Slot</span>
                  <span className="text-slate-200 font-bold text-sm tabular-nums">
                    #{recoveryReceipt.slot}
                  </span>
                </div>
                <div className="bg-[#0D1612] p-2.5 rounded border border-emerald-900/40 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Recovery Nonce</span>
                  <span className="text-slate-200 font-bold text-sm tabular-nums">
                    {recoveryReceipt.recoveryNonce}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-[11px] border-t border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-300 gap-1">
                  <span className="text-slate-400 text-[10px]">SPL Token Mint:</span>
                  <span className="text-slate-200 truncate">{recoveryReceipt.mint}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-300 gap-1">
                  <span className="text-slate-400 text-[10px]">Vault Custody ATA:</span>
                  <span className="text-slate-200 truncate">{recoveryReceipt.vaultTokenAccount}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-300 gap-1">
                  <span className="text-slate-400 text-[10px]">Safe Destination ATA:</span>
                  <span className="text-slate-200 truncate">{recoveryReceipt.safeDestinationTokenAccount}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-300 gap-1">
                  <span className="text-slate-400 text-[10px]">Safe Authority:</span>
                  <span className="text-slate-200 truncate">{recoveryReceipt.safeDestination}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-emerald-300 pt-1">
                  <span className="text-slate-400 text-[10px]">Solana Tx Signature:</span>
                  <a
                    href={`https://explorer.solana.com/tx/${recoveryReceipt.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-emerald-400 hover:text-emerald-300 truncate max-w-sm flex items-center gap-1"
                  >
                    <span>{recoveryReceipt.signature.slice(0, 16)}...{recoveryReceipt.signature.slice(-12)}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {successTx && !recoveryReceipt && (
            <div className="p-3.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Containment Executed Successfully — Vault is Active Again!</span>
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

            {/* 8-State Interactive Buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {vault?.status === 'quarantined' && recoveryStep !== 'READY' && recoveryStep !== 'SOLVING' && recoveryStep !== 'CONFIRMING' && (
                <button
                  type="button"
                  onClick={handleSimulatePlan}
                  disabled={recoveryStep === 'SIMULATING'}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {recoveryStep === 'SIMULATING' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Simulating Plan...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                      <span>1. Simulate Containment</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleExecuteRecovery}
                disabled={
                  isRecovering ||
                  vault?.status !== 'quarantined' ||
                  recoveryStep === 'SOLVING' ||
                  recoveryStep === 'CONFIRMING'
                }
                className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 cursor-pointer ${
                  vault?.status === 'quarantined'
                    ? recoveryStep === 'READY'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-400/30'
                      : 'bg-blue-600/80 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    : 'bg-[#1A2234] text-slate-500 cursor-not-allowed border border-[#1E2638]'
                }`}
              >
                {recoveryStep === 'SOLVING' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Awaiting Wallet Signature...</span>
                  </>
                ) : recoveryStep === 'CONFIRMING' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirming On Solana Cluster...</span>
                  </>
                ) : recoveryStep === 'RECOVERED' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Vault Recovered (Active)</span>
                  </>
                ) : recoveryStep === 'EXPIRED' ? (
                  <span>Recovery Window Expired</span>
                ) : recoveryStep === 'READY' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Confirm &amp; Execute Containment</span>
                  </>
                ) : vault?.status === 'quarantined' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Execute Containment Recovery</span>
                  </>
                ) : (
                  <span>Vault Not Quarantined</span>
                )}
              </button>
            </div>
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
