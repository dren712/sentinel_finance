'use client';

import React, { useState } from 'react';
import { FinancialPolicy } from '@sentinel/domain';
import {
  ShieldCheck,
  Sliders,
  Save,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';

interface GuaranteesViewProps {
  policy: FinancialPolicy;
  onUpdatePolicy: (updated: Partial<FinancialPolicy>) => void;
}

export const GuaranteesView: React.FC<GuaranteesViewProps> = ({
  policy,
  onUpdatePolicy,
}) => {
  const [maxSingleAssetPct, setMaxSingleAssetPct] = useState(policy.maxSingleAssetBps / 100);
  const [minStablecoinPct, setMinStablecoinPct] = useState(policy.minStablecoinBps / 100);
  const [maxTradeValue, setMaxTradeValue] = useState(policy.maxTradeValueUsd);
  const [maxSlippagePct, setMaxSlippagePct] = useState(policy.maxSlippageBps / 100);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onUpdatePolicy({
      maxSingleAssetBps: Math.round(maxSingleAssetPct * 100),
      minStablecoinBps: Math.round(minStablecoinPct * 100),
      maxTradeValueUsd: maxTradeValue,
      maxSlippageBps: Math.round(maxSlippagePct * 100),
      policyVersion: policy.policyVersion + 1,
      updatedAt: Date.now(),
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Active Financial Policy Guarantees</h2>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">
                Policy v{policy.policyVersion}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              These machine-checkable postconditions are enforced authoritatively by the Sentinel Solana program. Any state transition proposed by an autonomous agent that violates these constraints is aborted atomically before settlement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Policy Updated!' : 'Update Guarantees'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Interactive Constraint Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invariant A: Max Single Asset Exposure */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Single-Asset Exposure</h3>
                <span className="text-[11px] text-slate-400">Postcondition: post_trade_asset / portfolio &lt;= cap</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white mono-num">{maxSingleAssetPct.toFixed(1)}%</div>
              <div className="text-[11px] text-blue-400 font-mono">
                {Math.round(maxSingleAssetPct * 100)} bps
              </div>
            </div>
          </div>

          <input
            type="range"
            min="10"
            max="50"
            step="1"
            value={maxSingleAssetPct}
            onChange={(e) => setMaxSingleAssetPct(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>10.0% (Strict)</span>
            <span>25.0% (Default)</span>
            <span>50.0% (Aggressive)</span>
          </div>
        </div>

        {/* Invariant B: Minimum Stablecoin Reserve */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                B
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Minimum Stablecoin Reserve (USDC)</h3>
                <span className="text-[11px] text-slate-400">Postcondition: post_trade_stable / portfolio &gt;= floor</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-400 mono-num">{minStablecoinPct.toFixed(1)}%</div>
              <div className="text-[11px] text-emerald-400 font-mono">
                {Math.round(minStablecoinPct * 100)} bps
              </div>
            </div>
          </div>

          <input
            type="range"
            min="5"
            max="40"
            step="1"
            value={minStablecoinPct}
            onChange={(e) => setMinStablecoinPct(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>5.0% (Low Reserve)</span>
            <span>20.0% (Default)</span>
            <span>40.0% (Defensive)</span>
          </div>
        </div>

        {/* Invariant C: Maximum Single Trade Size */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                C
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Single Trade Size</h3>
                <span className="text-[11px] text-slate-400">Postcondition: trade_value &lt;= max_trade_value</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-amber-400 mono-num">
                ${maxTradeValue.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">USD Ceiling</div>
            </div>
          </div>

          <input
            type="range"
            min="1000"
            max="30000"
            step="1000"
            value={maxTradeValue}
            onChange={(e) => setMaxTradeValue(parseInt(e.target.value))}
            className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>$1,000</span>
            <span>$10,000 (Default)</span>
            <span>$30,000</span>
          </div>
        </div>

        {/* Invariant D: Maximum Tolerated Slippage */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                D
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Execution Slippage</h3>
                <span className="text-[11px] text-slate-400">Postcondition: |actual - reference| / reference &lt;= slippage</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-indigo-400 mono-num">{maxSlippagePct.toFixed(2)}%</div>
              <div className="text-[11px] text-indigo-400 font-mono">
                {Math.round(maxSlippagePct * 100)} bps
              </div>
            </div>
          </div>

          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={maxSlippagePct}
            onChange={(e) => setMaxSlippagePct(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>0.20% (Tight)</span>
            <span>1.00% (Default)</span>
            <span>3.00% (Wide)</span>
          </div>
        </div>
      </div>

      {/* On-Chain Program Details Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>ON-CHAIN ANCHOR SPECIFICATION & CONSTANTS</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 block">PROGRAM ID:</span>
            <span className="text-blue-300 break-all select-all">
              3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">PDA DERIVATION:</span>
            <span className="text-slate-300">
              [b&quot;policy&quot;, owner.pubkey()]
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">ARITHMETIC ENGINE:</span>
            <span className="text-emerald-400">
              Deterministic Fixed-Point Integer (BPS)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
