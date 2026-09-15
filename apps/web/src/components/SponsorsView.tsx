'use client';

import React, { useState } from 'react';
import { AutonomousRoboAgent, MeteoraDBCMarketQualityVerifier, ClawPumpAgentWallet } from '@sentinel/sdk';
import {
  Sparkles,
  Bot,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Key,
  Lock,
  Layers,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { formatCurrency, formatAddress } from '@/lib/formatters';

interface SponsorsViewProps {
  agent: AutonomousRoboAgent;
}

export const SponsorsView: React.FC<SponsorsViewProps> = ({ agent }) => {
  const verifier = new MeteoraDBCMarketQualityVerifier(25_000, 200);

  // Meteora Interactive Form State
  const [dbcLiquidity, setDbcLiquidity] = useState('50000');
  const [dbcPrice, setDbcPrice] = useState('120.50');
  const [dbcRefPrice, setDbcRefPrice] = useState('120.00');

  // ClawPump Ed25519 Live Signing Test State
  const [testAmount, setTestAmount] = useState('5000');
  const [signedIntentResult, setSignedIntentResult] = useState<{
    signatureBase64: string;
    verified: boolean;
    tamperedVerified?: boolean;
  } | null>(null);

  const meteoraResult = verifier.verifyMarketQuality({
    poolAddress: 'Meteora_DBC_NVDAx_11111111111111111111111111',
    assetSymbol: 'NVDAx',
    liquidityDepthUsd: parseFloat(dbcLiquidity) || 0,
    currentPriceUsd: parseFloat(dbcPrice) || 0,
    referencePriceUsd: parseFloat(dbcRefPrice) || 0,
    isGraduated: false,
  });

  const handleTestEd25519Sign = () => {
    const intent = agent.proposeIntent({
      assetSymbol: 'NVDAx',
      assetMint: 'NVDA111111111111111111111111111111111111111',
      direction: 'BUY',
      tradeAmountUsd: parseFloat(testAmount) || 5000,
      referencePriceUsd: 120,
      strategyRationale: 'Cryptographic Ed25519 Intent Verification Test',
    });

    const signed = agent.wallet.signIntent(intent);
    const verified = ClawPumpAgentWallet.verifySignature(signed);

    // Tampered copy to test tamper-resistance
    const tamperedSigned = {
      ...signed,
      intent: { ...signed.intent, tradeAmountUsd: signed.intent.tradeAmountUsd + 10000 },
    };
    const tamperedVerified = ClawPumpAgentWallet.verifySignature(tamperedSigned);

    setSignedIntentResult({
      signatureBase64: signed.signatureBase64,
      verified,
      tamperedVerified,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner with Technical Honesty */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-sentinel-text">Stocklana Sponsor Integrations</h2>
              <Badge variant="simulated">
                VERIFIER MODULES & TEST HARNESS
              </Badge>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Modular extensions connecting Sentinel financial postcondition guarantees to Meteora Dynamic Bonding Curves and ClawPump autonomous agent identities.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Meteora DBC Track Card */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-sentinel-text">Meteora DBC Market-Quality Verifier Module</h3>
                <Badge variant="neutral" size="sm">
                  DBC TRACK
                </Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Preflights liquidity depth and price deviation against reference price feeds before an autonomous agent commits capital on a Dynamic Bonding Curve.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-sentinel-textSubtle">Status:</span>
            <Badge variant="success" size="sm" dot={true}>
              Active Verifier
            </Badge>
          </div>
        </div>

        {/* Interactive Verification Form */}
        <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border space-y-4">
          <div className="text-xs font-semibold text-sentinel-textSubtle uppercase">
            Test Meteora DBC Market Quality Invariant
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-sentinel-textSubtle mb-1 font-sans font-semibold">
                LIQUIDITY DEPTH (USD)
              </label>
              <input
                type="number"
                value={dbcLiquidity}
                onChange={(e) => setDbcLiquidity(e.target.value)}
                className="w-full bg-sentinel-surface border border-sentinel-border rounded-md px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-sentinel-textSubtle mt-1 block font-sans">
                Min required: $25,000
              </span>
            </div>

            <div>
              <label className="block text-sentinel-textSubtle mb-1 font-sans font-semibold">
                DBC CURRENT PRICE ($)
              </label>
              <input
                type="number"
                step="0.1"
                value={dbcPrice}
                onChange={(e) => setDbcPrice(e.target.value)}
                className="w-full bg-sentinel-surface border border-sentinel-border rounded-md px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sentinel-textSubtle mb-1 font-sans font-semibold">
                ORACLE REFERENCE PRICE ($)
              </label>
              <input
                type="number"
                step="0.1"
                value={dbcRefPrice}
                onChange={(e) => setDbcRefPrice(e.target.value)}
                className="w-full bg-sentinel-surface border border-sentinel-border rounded-md px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-sentinel-textSubtle mt-1 block font-sans">
                Max deviation: 2.00% (200 bps)
              </span>
            </div>
          </div>

          {/* Real-time Verification Output */}
          <div
            className={`p-3.5 rounded-lg border text-xs font-mono space-y-1.5 ${
              meteoraResult.passed
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold font-sans">
              {meteoraResult.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                METEORA DBC STATUS:{' '}
                {meteoraResult.passed ? 'MARKET QUALITY VERIFIED (ELIGIBLE)' : 'REJECTED (INELIGIBLE)'}
              </span>
            </div>
            <div className="text-[11px] space-y-0.5 pl-6">
              <div>
                • Depth Check: {formatCurrency(parseFloat(dbcLiquidity) || 0)} (Threshold: $25,000) →{' '}
                {meteoraResult.liquidityPassed ? 'PASS' : 'FAIL'}
              </div>
              <div>
                • Price Deviation: {(meteoraResult.actualDeviationBps / 100).toFixed(2)}% (Max allowed: 2.00%) →{' '}
                {meteoraResult.priceDeviationPassed ? 'PASS' : 'FAIL'}
              </div>
              <div className="text-sentinel-textSubtle pt-1">
                • Verifier Detail: {meteoraResult.details}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ClawPump Track Card */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-sentinel-text">ClawPump Autonomous Agent Wallet Protocol</h3>
                <Badge variant="neutral" size="sm">
                  CLAWPUMP TRACK
                </Badge>
              </div>
              <p className="text-xs text-sentinel-textMuted mt-0.5">
                Autonomous wallet authority bounded by Sentinel policy constraints with TweetNaCl Ed25519 detached signatures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-sentinel-textSubtle">Authority:</span>
            <span className="text-white font-semibold">
              {formatAddress(agent.wallet.getPublicKeyString(), 6)}
            </span>
          </div>
        </div>

        {/* Live Cryptographic Signature Test Harness */}
        <div className="bg-sentinel-surfaceMuted p-4 rounded-lg border border-sentinel-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sentinel-textSubtle uppercase">
              Live Ed25519 Intent Signing & Verification Test
            </span>
            <Badge variant="success" size="sm">
              TweetNaCl Real Ed25519
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-sentinel-textSubtle mb-1">
                TEST INTENT AMOUNT (USD)
              </label>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="w-full bg-sentinel-surface border border-sentinel-border rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleTestEd25519Sign}
              className="px-4 py-2 rounded-lg bg-sentinel-accent hover:bg-sentinel-accentHover text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
            >
              Sign & Verify with Ed25519
            </button>
          </div>

          {signedIntentResult && (
            <div className="p-3.5 bg-sentinel-surface rounded-lg border border-sentinel-border font-mono text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sentinel-textSubtle">ED25519 DETACHED SIGNATURE (BASE64)</span>
                <Badge variant={signedIntentResult.verified ? 'success' : 'danger'} size="sm">
                  {signedIntentResult.verified ? 'SIGNATURE VALID' : 'INVALID SIGNATURE'}
                </Badge>
              </div>

              <div className="text-white text-[11px] break-all bg-sentinel-surfaceMuted p-2.5 rounded border border-sentinel-border">
                {signedIntentResult.signatureBase64}
              </div>

              <div className="pt-2 border-t border-sentinel-border flex items-center justify-between text-[11px]">
                <span className="text-sentinel-textSubtle font-sans">
                  Tamper Detection Check (+ $10,000 modified payload):
                </span>
                <span
                  className={`font-semibold ${
                    signedIntentResult.tamperedVerified === false ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {signedIntentResult.tamperedVerified === false
                    ? '✓ REJECTED TAMPERED PAYLOAD'
                    : 'FAILED TAMPER CHECK'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
