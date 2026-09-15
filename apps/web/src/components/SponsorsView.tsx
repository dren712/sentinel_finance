'use client';

import React, { useState } from 'react';
import { AutonomousRoboAgent, MeteoraDBCMarketQualityVerifier } from '@sentinel/sdk';
import {
  Sparkles,
  Bot,
  Activity,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';

interface SponsorsViewProps {
  agent: AutonomousRoboAgent;
}

export const SponsorsView: React.FC<SponsorsViewProps> = ({ agent }) => {
  const verifier = new MeteoraDBCMarketQualityVerifier(25_000, 200);

  // Meteora Interactive Form State
  const [dbcLiquidity, setDbcLiquidity] = useState('50000');
  const [dbcPrice, setDbcPrice] = useState('120.50');
  const [dbcRefPrice, setDbcRefPrice] = useState('120.00');

  const meteoraResult = verifier.verifyMarketQuality({
    poolAddress: 'Meteora_DBC_NVDAx_11111111111111111111111111',
    assetSymbol: 'NVDAx',
    liquidityDepthUsd: parseFloat(dbcLiquidity) || 0,
    currentPriceUsd: parseFloat(dbcPrice) || 0,
    referencePriceUsd: parseFloat(dbcRefPrice) || 0,
    isGraduated: false,
  });

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Stocklana Sponsor Integrations</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                Meteora DBC & ClawPump
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Modular extensions connecting Sentinel financial postcondition guarantees to Meteora Dynamic Bonding Curves and ClawPump autonomous agent identities.
            </p>
          </div>
        </div>
      </div>

      {/* Meteora DBC Track Card */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-sentinel-cardBorder pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Meteora DBC Market-Quality Verifier</h3>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                  DBC TRACK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Enforces bounded price deviation and liquidity depth thresholds before executing autonomous equity trades on Meteora Dynamic Bonding Curves.
              </p>
            </div>
          </div>

          <a
            href="https://docs.meteora.ag"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
          >
            <span>Meteora Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Interactive DBC Verifier Sandbox */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">DBC LIQUIDITY DEPTH (USD)</label>
            <input
              type="number"
              value={dbcLiquidity}
              onChange={(e) => setDbcLiquidity(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Minimum required: $25,000</span>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">DBC CURVE PRICE (USD)</label>
            <input
              type="number"
              value={dbcPrice}
              onChange={(e) => setDbcPrice(e.target.value)}
              step="0.01"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Current curve quote</span>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">REFERENCE INDEX PRICE (USD)</label>
            <input
              type="number"
              value={dbcRefPrice}
              onChange={(e) => setDbcRefPrice(e.target.value)}
              step="0.01"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Max deviation cap: 2.00% (200 bps)</span>
          </div>
        </div>

        {/* Verification Result Box */}
        <div className={`p-4 rounded-lg border ${
          meteoraResult.passed
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/30 border-red-500/40 text-red-300'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-1.5">
              {meteoraResult.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span>METEORA DBC STATUS: {meteoraResult.passed ? 'MARKET QUALITY SATISFIED (EXECUTION PERMITTED)' : 'EXECUTION BLOCKED (MARKET QUALITY FAILURE)'}</span>
            </div>
            <span className="font-mono">Deviation: {(meteoraResult.actualDeviationBps / 100).toFixed(2)}%</span>
          </div>
          <p className="text-xs text-slate-300 mt-1.5">{meteoraResult.details}</p>
        </div>
      </div>

      {/* ClawPump Track Card */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-sentinel-cardBorder pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">ClawPump Autonomous Agent Wallet Identity</h3>
                <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-300 text-[10px] font-mono border border-orange-500/30">
                  STOCKNIZED AGENTS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Empowers autonomous agents with their own Solana wallets while guaranteeing they cannot execute outside the user&apos;s Sentinel financial promises.
              </p>
            </div>
          </div>

          <a
            href="https://clawpump.tech/docs"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium"
          >
            <span>ClawPump Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[11px]">CLAWPUMP AGENT ID:</span>
            <span className="text-white font-bold">{agent.agentId}</span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[11px]">DELEGATED AGENT WALLET:</span>
            <span className="text-orange-400 break-all">{agent.wallet.getPublicKeyString()}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
          <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Trust Boundary Architecture:</span>
            <p className="mt-0.5 text-slate-400 text-[11px]">
              ClawPump manages the autonomous execution identity. Sentinel enforces the financial boundary. The agent is free to strategize, generate trade intents, and interact with Solana DeFi, but every transaction must pass through Sentinel&apos;s on-chain postcondition verification before settling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
