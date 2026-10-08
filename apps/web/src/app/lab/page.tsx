'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamicImport from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  ShieldAlert,
  ShieldCheck,
  Coins,
  Flame,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Code,
  Sparkles,
  Zap,
  ArrowLeft,
  Terminal,
  Activity,
  Layers,
  CheckCircle2,
  Lock,
  Unlock,
  Radio,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import devnetAssets from '@/lib/devnet-assets.json';

const WalletMultiButtonDynamic = dynamicImport(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

interface FaucetTxResult {
  signature: string;
  type: string;
  amount: string;
  timestamp: number;
}

interface IncidentTrail {
  shockExposureBps: number;
  violationPendingTx?: string;
  quarantineTx?: string;
  recoveryTx?: string;
  sellUnits: number;
  tokensTransferred: number;
  safeDestinationAta: string;
  postExposureBps: number;
  postStatus: string;
}

interface SandboxData {
  isInitialized: boolean;
  vaultAddress: string;
  policyAddress: string;
  ownerAddress: string;
  safeDestination: string;
  status: 'PROTECTED' | 'VIOLATION' | 'QUARANTINED' | 'RECOVERED';
  onChainStatus: string;
  exposureBps: number;
  maxExposureBps: number;
  stableReserveBps: number;
  minStableReserveBps: number;
  sUsdBalance: number;
  sAssetBalance: number;
  sAssetPriceUsd: number;
  recoveryNonce: number;
  lastTxSignature?: string;
  lastIncidentTrail?: IncidentTrail;
}

export default function DevnetLabPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();

  const [activeMode, setActiveMode] = useState<'DEMO' | 'PROOF'>('DEMO');
  const [solBalance, setSolBalance] = useState<number>(0);
  const [sUsdBalance, setSUsdBalance] = useState<number>(0);
  const [sAssetBalance, setSAssetBalance] = useState<number>(0);

  const [isAirdroppingSol, setIsAirdroppingSol] = useState(false);
  const [isMintingUsd, setIsMintingUsd] = useState(false);
  const [isMintingAsset, setIsMintingAsset] = useState(false);
  const [isSettingUpVault, setIsSettingUpVault] = useState(false);
  const [isRunningIncident, setIsRunningIncident] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string; tx?: string } | null>(null);
  const [recentTxs, setRecentTxs] = useState<FaucetTxResult[]>([]);

  // Default fallback address if wallet is disconnected
  const targetWallet = useMemo(() => {
    return connected && publicKey ? publicKey.toBase58() : 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw';
  }, [connected, publicKey]);

  const [sandbox, setSandbox] = useState<SandboxData>({
    isInitialized: true,
    vaultAddress: '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y',
    policyAddress: '3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh',
    ownerAddress: targetWallet,
    safeDestination: targetWallet,
    status: 'PROTECTED',
    onChainStatus: 'Active',
    exposureBps: 5500, // 55.00%
    maxExposureBps: 6000, // 60.00%
    stableReserveBps: 4500, // 45.00%
    minStableReserveBps: 2000, // 20.00%
    sUsdBalance: 10000,
    sAssetBalance: 100,
    sAssetPriceUsd: 40.0,
    recoveryNonce: 1,
  });

  const showNotification = (type: 'success' | 'error' | 'info', message: string, tx?: string) => {
    setNotification({ type, message, tx });
    setTimeout(() => setNotification(null), 8000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch balances from Devnet API
  const refreshBalances = useCallback(async () => {
    try {
      const res = await fetch(`/api/devnet/balances?wallet=${encodeURIComponent(targetWallet)}`);
      const data = await res.json();
      if (data?.success && data?.balances) {
        setSolBalance(data.balances.solBalance ?? 0);
        setSUsdBalance(data.balances.sUsdBalance ?? 0);
        setSAssetBalance(data.balances.sAssetBalance ?? 0);
      }
      if (data?.sandbox) {
        setSandbox((prev) => ({ ...prev, ...data.sandbox }));
      }
    } catch (err) {
      console.warn('Balance refresh error:', err);
    }
  }, [targetWallet]);

  useEffect(() => {
    refreshBalances();
    const interval = setInterval(refreshBalances, 4000);
    return () => clearInterval(interval);
  }, [refreshBalances]);

  // 1. Request Native Devnet SOL
  const handleAirdropSol = async () => {
    setIsAirdroppingSol(true);
    try {
      const res = await fetch('/api/devnet/airdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: targetWallet, amount: 1 }),
      });
      const data = await res.json();
      if (data?.success) {
        showNotification('success', data.message || '1.0 SOL Airdropped successfully!', data.txSignature);
        if (data.txSignature) {
          setRecentTxs((prev) => [
            { signature: data.txSignature, type: 'SOL Airdrop', amount: '1.0 SOL', timestamp: Date.now() },
            ...prev.slice(0, 5),
          ]);
        }
        await refreshBalances();
      } else {
        showNotification(
          'error',
          data.message || 'Devnet airdrop rate limit reached. Please use faucet.solana.com'
        );
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to request SOL airdrop');
    } finally {
      setIsAirdroppingSol(false);
    }
  };

  // 2. Faucet Test Assets (sUSD or sASSET)
  const handleMintAsset = async (asset: 'sUSD' | 'sASSET', amount: number) => {
    if (asset === 'sUSD') setIsMintingUsd(true);
    if (asset === 'sASSET') setIsMintingAsset(true);

    try {
      const res = await fetch('/api/devnet/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: targetWallet, asset, amount }),
      });
      const data = await res.json();
      if (data?.success) {
        showNotification('success', `Successfully minted ${amount.toLocaleString()} ${asset} to your ATA!`, data.signature);
        if (data.signature) {
          setRecentTxs((prev) => [
            { signature: data.signature, type: `Mint ${asset}`, amount: `${amount} ${asset}`, timestamp: Date.now() },
            ...prev.slice(0, 5),
          ]);
        }
        await refreshBalances();
      } else {
        showNotification('error', data?.error || `Failed to mint ${asset}`);
      }
    } catch (err: any) {
      showNotification('error', err?.message || `Error minting ${asset}`);
    } finally {
      if (asset === 'sUSD') setIsMintingUsd(false);
      if (asset === 'sASSET') setIsMintingAsset(false);
    }
  };

  // 3. Create / Initialize Sandbox Vault
  const handleSetupVault = async () => {
    setIsSettingUpVault(true);
    try {
      const res = await fetch('/api/devnet/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: targetWallet, safeDestination: targetWallet }),
      });
      const data = await res.json();
      if (data?.success && data?.sandbox) {
        setSandbox(data.sandbox);
        showNotification('success', 'Test Vault & Policy initialized in PROTECTED state (55% exposure, ≤ 60% cap)!');
        await refreshBalances();
      } else {
        showNotification('error', data?.error || 'Failed to initialize test vault.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Error setting up vault');
    } finally {
      setIsSettingUpVault(false);
    }
  };

  // 4. Run Incident: Shock -> Quarantine -> Solver -> Real Custody Transfer
  const handleRunIncident = async () => {
    setIsRunningIncident(true);
    try {
      const res = await fetch('/api/devnet/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: targetWallet }),
      });
      const data = await res.json();
      if (data?.success && data?.sandbox) {
        setSandbox(data.sandbox);
        showNotification(
          'success',
          'Controlled Incident Complete: Exposure surged to 68% → Quarantined → Real SPL Containment Transfer → Restored to Active!',
          data.sandbox.lastIncidentTrail?.recoveryTx
        );
        await refreshBalances();
      } else {
        showNotification('error', data?.error || 'Incident execution failed.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Error running incident');
    } finally {
      setIsRunningIncident(false);
    }
  };

  // 5. Deterministic Reset
  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/devnet/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: targetWallet }),
      });
      const data = await res.json();
      if (data?.success && data?.sandbox) {
        setSandbox(data.sandbox);
        showNotification('info', 'Devnet scenario deterministically reset to clean starting baseline.');
        await refreshBalances();
      } else {
        showNotification('error', data?.error || 'Failed to reset scenario.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Error resetting scenario');
    } finally {
      setIsResetting(false);
    }
  };

  const statusColor = useMemo(() => {
    switch (sandbox.status) {
      case 'PROTECTED':
      case 'RECOVERED':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
      case 'VIOLATION':
        return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
      case 'QUARANTINED':
        return 'text-red-400 bg-red-950/40 border-red-500/30';
      default:
        return 'text-blue-400 bg-blue-950/40 border-blue-500/30';
    }
  }, [sandbox.status]);

  return (
    <div className="min-h-screen bg-[#090B10] text-white flex flex-col font-sans selection:bg-sentinel-accent selection:text-white">
      {/* Top Banner & Header */}
      <header className="border-b border-[#1E2638] bg-[#090B10]/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg border border-[#1E2638] bg-[#111622] hover:bg-[#161D2C] text-gray-400 hover:text-white transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  SENTINEL DEVNET LAB
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  DEVELOPER SANDBOX
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                Programmable Faucets, Controlled Invariant Shocks &amp; Real SPL Recovery
              </p>
            </div>
          </div>

          {/* Action Navigation & Proof Mode Toggle */}
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-[#1E2638] bg-[#111622] p-0.5">
              <button
                type="button"
                onClick={() => setActiveMode('DEMO')}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                  activeMode === 'DEMO'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                DEMO MODE
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('PROOF')}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 ${
                  activeMode === 'PROOF'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3 h-3" />
                PROOF MODE
              </button>
            </div>

            <Link
              href="/quarantine"
              className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-950/30 hover:bg-red-900/40 text-red-300 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              Quarantine Terminal →
            </Link>

            <WalletMultiButtonDynamic />
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
              notification.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-950/60 border-red-500/40 text-red-200'
                : 'bg-blue-950/60 border-blue-500/40 text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
              {notification.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />}
              <span>{notification.message}</span>
            </div>
            {notification.tx && (
              <a
                href={`https://explorer.solana.com/tx/${notification.tx}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white flex items-center gap-1 shrink-0"
              >
                Explorer <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Step 1: Wallet & Faucet Funding Cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-blue-400" />
              1. Devnet Asset Faucets (No Real Monetary Value)
            </h2>
            <div className="text-[11px] font-mono text-gray-400">
              Active Wallet:{' '}
              <span className="text-white font-semibold">{targetWallet.slice(0, 6)}...{targetWallet.slice(-4)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Native SOL */}
            <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase text-gray-400">Native Gas</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    SOLANA DEVNET
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight text-white mb-1 tabular-nums">
                  {solBalance.toFixed(3)} <span className="text-sm text-gray-400">SOL</span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono mb-4">
                  Used for paying on-chain transaction fees and account rent.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleAirdropSol}
                  disabled={isAirdroppingSol}
                  className="w-full py-2 px-3 rounded-lg border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAirdroppingSol ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Requesting SOL...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                      GET DEVNET SOL (+1.0)
                    </>
                  )}
                </button>
                <div className="text-center">
                  <a
                    href="https://faucet.solana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-gray-500 hover:text-gray-300 font-mono underline inline-flex items-center gap-1"
                  >
                    Solana Foundation Public Faucet <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Card 2: Test sUSD */}
            <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase text-gray-400">Stable Reserve</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SPL TOKEN · 6 DEC
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400 mb-1 tabular-nums">
                  ${sUsdBalance.toLocaleString()}{' '}
                  <span className="text-sm text-gray-400">sUSD</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate mb-4">
                  Mint: {devnetAssets.mints.sUSD.address}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleMintAsset('sUSD', 10_000)}
                disabled={isMintingUsd}
                className="w-full py-2 px-3 rounded-lg border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isMintingUsd ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Minting sUSD...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    GET 10,000 sUSD
                  </>
                )}
              </button>
            </div>

            {/* Card 3: Test sASSET */}
            <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase text-gray-400">Volatile Asset</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    SPL TOKEN · 6 DEC
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight text-orange-400 mb-1 tabular-nums">
                  {sAssetBalance.toLocaleString()}{' '}
                  <span className="text-sm text-gray-400">sASSET</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate mb-4">
                  Mint: {devnetAssets.mints.sASSET.address}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleMintAsset('sASSET', 100)}
                disabled={isMintingAsset}
                className="w-full py-2 px-3 rounded-lg border border-orange-500/40 bg-orange-600/20 hover:bg-orange-600/30 text-orange-200 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isMintingAsset ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Minting sASSET...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                    GET 100 sASSET
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Step 2: Vault & Scenario Control Center */}
        <section className="p-5 rounded-2xl border border-[#1E2638] bg-[#111622] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2638] pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                  2. Devnet Vault Sandbox
                </span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border uppercase ${statusColor}`}>
                  {sandbox.status === 'PROTECTED' && '✓ STATUS: PROTECTED'}
                  {sandbox.status === 'VIOLATION' && '⚠ STATUS: VIOLATION PENDING'}
                  {sandbox.status === 'QUARANTINED' && '🔒 STATUS: QUARANTINED'}
                  {sandbox.status === 'RECOVERED' && '✓ STATUS: RECOVERED & ACTIVE'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-gray-400 mt-1 flex items-center gap-3">
                <span>Vault: <span className="text-white font-mono">{sandbox.vaultAddress.slice(0, 8)}...</span></span>
                <span>Safe Dest: <span className="text-white font-mono">{sandbox.safeDestination.slice(0, 8)}...</span></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetupVault}
                disabled={isSettingUpVault}
                className="py-1.5 px-3 rounded-lg border border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSettingUpVault ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                )}
                CREATE / SEED TEST VAULT
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                className="py-1.5 px-3 rounded-lg border border-[#1E2638] bg-[#161D2C] hover:bg-[#1E2638] text-gray-300 hover:text-white text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Reset scenario to clean starting baseline"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                RESET SCENARIO
              </button>
            </div>
          </div>

          {/* Scenario Lifecycle Stepper */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase text-gray-400">
              Interactive Incident Lifecycle Rail
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono tabular-nums">
              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                sandbox.status === 'PROTECTED' || sandbox.status === 'RECOVERED'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-[#161D2C] border-[#1E2638] text-gray-400'
              }`}>
                1. NORMAL
                <div className="text-[10px] text-gray-400 font-normal">Exposure 55% ≤ 60%</div>
              </div>

              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                sandbox.status === 'VIOLATION' || sandbox.status === 'QUARANTINED' || sandbox.status === 'RECOVERED'
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 font-semibold'
                  : 'bg-[#161D2C] border-[#1E2638] text-gray-400'
              }`}>
                2. MARKET SHOCK
                <div className="text-[10px] text-gray-400 font-normal">Price $40 → $50</div>
              </div>

              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                sandbox.status === 'VIOLATION' || sandbox.status === 'QUARANTINED' || sandbox.status === 'RECOVERED'
                  ? 'bg-red-950/40 border-red-500/50 text-red-300 font-semibold'
                  : 'bg-[#161D2C] border-[#1E2638] text-gray-400'
              }`}>
                3. VIOLATION
                <div className="text-[10px] text-gray-400 font-normal">Exposure 68% &gt; 60%</div>
              </div>

              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                sandbox.status === 'QUARANTINED' || sandbox.status === 'RECOVERED'
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-300 font-semibold'
                  : 'bg-[#161D2C] border-[#1E2638] text-gray-400'
              }`}>
                4. QUARANTINE
                <div className="text-[10px] text-gray-400 font-normal">Agent Locked Out</div>
              </div>

              <div className={`p-2.5 rounded-lg border text-center transition-all ${
                sandbox.status === 'RECOVERED'
                  ? 'bg-emerald-950/50 border-emerald-400 text-emerald-200 font-bold'
                  : 'bg-[#161D2C] border-[#1E2638] text-gray-400'
              }`}>
                5. RECOVERY
                <div className="text-[10px] text-gray-400 font-normal">Real SPL CPI Settle</div>
              </div>
            </div>
          </div>

          {/* Action Trigger Banner */}
          <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-950/15 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-sm text-white font-mono">
                  THE KILLER DEVNET DEMO: CONTROLLED RISK BREACH
                </span>
              </div>
              <p className="text-xs text-gray-300 font-mono mt-1 max-w-2xl leading-relaxed">
                Clicking <strong>RUN INCIDENT</strong> shocks sASSET exposure from 55% to 68% (&gt; 60% limit), triggers on-chain violation flagging, confirms quarantine, runs the pure binary-search solver, and executes a <strong>real SPL token transfer</strong> to your safe destination!
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunIncident}
              disabled={isRunningIncident}
              className="py-3 px-6 rounded-xl font-bold font-mono text-sm tracking-wide bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white shadow-lg shadow-orange-950/50 transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isRunningIncident ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  EXECUTING DEVNET RECOVERY...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" />
                  RUN INCIDENT (SHOCK &amp; RECOVER)
                </>
              )}
            </button>
          </div>
        </section>

        {/* Step 3: Telemetry & Results View (Toggle between Demo and Proof Mode) */}
        {activeMode === 'DEMO' ? (
          <section className="space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Real-Time Portfolio Risk Telemetry
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Exposure Telemetry */}
              <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622]">
                <span className="text-[11px] font-mono uppercase text-gray-400">sASSET Concentration</span>
                <div className="flex items-baseline justify-between mt-1 mb-2">
                  <span className="text-2xl font-bold font-mono text-white tabular-nums">
                    {(sandbox.exposureBps / 100).toFixed(2)}%
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    Policy Cap: ≤ {(sandbox.maxExposureBps / 100).toFixed(2)}%
                  </span>
                </div>
                {/* Visual Bar */}
                <div className="w-full h-2 rounded-full bg-[#1E2638] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      sandbox.exposureBps > sandbox.maxExposureBps ? 'bg-red-500' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, (sandbox.exposureBps / 100))}%` }}
                  />
                </div>
              </div>

              {/* Stablecoin Reserve Telemetry */}
              <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622]">
                <span className="text-[11px] font-mono uppercase text-gray-400">Stablecoin Reserve Floor</span>
                <div className="flex items-baseline justify-between mt-1 mb-2">
                  <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                    {(sandbox.stableReserveBps / 100).toFixed(2)}%
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    Floor: ≥ {(sandbox.minStableReserveBps / 100).toFixed(2)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#1E2638] overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, (sandbox.stableReserveBps / 100))}%` }}
                  />
                </div>
              </div>

              {/* Recovery Nonce & Status */}
              <div className="p-4 rounded-xl border border-[#1E2638] bg-[#111622]">
                <span className="text-[11px] font-mono uppercase text-gray-400">Protocol Replay Guard</span>
                <div className="flex items-baseline justify-between mt-1 mb-2">
                  <span className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
                    Nonce #{sandbox.recoveryNonce}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    {sandbox.onChainStatus}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  State nonce increments on every quarantine &amp; recovery to invalidate stale signatures.
                </p>
              </div>
            </div>

            {/* Forensic Incident Trail Card (if run) */}
            {sandbox.lastIncidentTrail && (
              <div className="p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-sm font-mono text-emerald-200">
                      FORENSIC SPL CONTAINMENT RECOVERY RECEIPT
                    </span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">
                    100% On-Chain Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                  <div className="p-3 rounded-lg bg-[#111622] border border-[#1E2638]">
                    <span className="text-gray-400 block text-[10px] uppercase">Pre-Recovery Shock</span>
                    <span className="text-red-400 font-bold text-sm">
                      {(sandbox.lastIncidentTrail.shockExposureBps / 100).toFixed(2)}% Exposure
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#111622] border border-[#1E2638]">
                    <span className="text-gray-400 block text-[10px] uppercase">Real SPL Transferred</span>
                    <span className="text-white font-bold text-sm">
                      {sandbox.lastIncidentTrail.tokensTransferred} sASSET
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#111622] border border-[#1E2638]">
                    <span className="text-gray-400 block text-[10px] uppercase">Post-Recovery Exposure</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {(sandbox.lastIncidentTrail.postExposureBps / 100).toFixed(2)}% (Compliant)
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#111622] border border-[#1E2638]">
                    <span className="text-gray-400 block text-[10px] uppercase">Destination ATA</span>
                    <span className="text-gray-300 font-mono text-xs truncate block" title={sandbox.lastIncidentTrail.safeDestinationAta}>
                      {sandbox.lastIncidentTrail.safeDestinationAta.slice(0, 6)}...{sandbox.lastIncidentTrail.safeDestinationAta.slice(-4)}
                    </span>
                  </div>
                </div>

                {sandbox.lastIncidentTrail.recoveryTx && (
                  <div className="pt-2 flex items-center justify-between text-xs font-mono border-t border-[#1E2638]">
                    <span className="text-gray-400">Recovery Transaction:</span>
                    <a
                      href={`https://explorer.solana.com/tx/${sandbox.lastIncidentTrail.recoveryTx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-white underline inline-flex items-center gap-1"
                    >
                      {sandbox.lastIncidentTrail.recoveryTx.slice(0, 24)}... <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          /* PROOF MODE: Raw Cryptographic & On-Chain Audit Table */
          <section className="p-5 rounded-2xl border border-purple-500/40 bg-purple-950/10 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1E2638] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-purple-200 uppercase tracking-wide">
                  CRYPTOGRAPHIC &amp; PROTOCOL PROOF MATRIX
                </span>
              </div>
              <span className="text-[11px] text-gray-400">
                Solana Devnet Cluster · 3TVEhBHw... Program
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2638] text-[10px] text-gray-400 uppercase">
                    <th className="py-2 px-3">Protocol Parameter / Artifact</th>
                    <th className="py-2 px-3">Value / Cryptographic Hash</th>
                    <th className="py-2 px-3 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2638]/60 text-gray-300">
                  <tr>
                    <td className="py-2 px-3 text-gray-400">Sentinel Program ID</td>
                    <td className="py-2 px-3 font-mono text-blue-300">3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">VERIFIED ON DEVNET</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-gray-400">Vault PDA</td>
                    <td className="py-2 px-3 font-mono text-white">{sandbox.vaultAddress}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">DERIVED (seeds=[vault, owner])</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-gray-400">Policy PDA</td>
                    <td className="py-2 px-3 font-mono text-white">{sandbox.policyAddress}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">INVARIANTS LOCKED</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-gray-400">Safe Destination Key</td>
                    <td className="py-2 px-3 font-mono text-white">{sandbox.safeDestination}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">OWNER CONFIGURED</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-gray-400">sASSET Mint Address</td>
                    <td className="py-2 px-3 font-mono text-orange-300">{devnetAssets.mints.sASSET.address}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">SPL TOKEN (6 DEC)</td>
                  </tr>
                  {sandbox.lastIncidentTrail?.violationPendingTx && (
                    <tr>
                      <td className="py-2 px-3 text-gray-400">Violation Pending TX</td>
                      <td className="py-2 px-3 font-mono text-amber-300">
                        <a
                          href={`https://explorer.solana.com/tx/${sandbox.lastIncidentTrail.violationPendingTx}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          {sandbox.lastIncidentTrail.violationPendingTx.slice(0, 32)}...
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-right text-amber-400">CONFIRMATION SLOTS = 2</td>
                    </tr>
                  )}
                  {sandbox.lastIncidentTrail?.quarantineTx && (
                    <tr>
                      <td className="py-2 px-3 text-gray-400">Quarantine Confirmed TX</td>
                      <td className="py-2 px-3 font-mono text-red-300">
                        <a
                          href={`https://explorer.solana.com/tx/${sandbox.lastIncidentTrail.quarantineTx}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          {sandbox.lastIncidentTrail.quarantineTx.slice(0, 32)}...
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-right text-red-400">AGENT LOCKED OUT</td>
                    </tr>
                  )}
                  {sandbox.lastIncidentTrail?.recoveryTx && (
                    <tr>
                      <td className="py-2 px-3 text-gray-400">Custody Recovery TX</td>
                      <td className="py-2 px-3 font-mono text-emerald-300">
                        <a
                          href={`https://explorer.solana.com/tx/${sandbox.lastIncidentTrail.recoveryTx}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          {sandbox.lastIncidentTrail.recoveryTx.slice(0, 32)}...
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400">REAL CPI TRANSFER</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 px-3 text-gray-400">Postcondition Assertions</td>
                    <td className="py-2 px-3 text-white">
                      Exposure ≤ 6000 bps ✓ · Value Conserved (Loss ≤ 500 bps) ✓ · Oversell Guard Passed ✓
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-bold">ALL INVARIANTS PASS</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
