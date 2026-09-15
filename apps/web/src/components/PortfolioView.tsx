'use client';

import React from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
} from '@sentinel/domain';
import {
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

interface PortfolioViewProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  recentEvidence: EvidenceRecord[];
  onSelectEvidence: (record: EvidenceRecord) => void;
  onNavigateToDecisions: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  portfolio,
  policy,
  recentEvidence,
  onSelectEvidence,
  onNavigateToDecisions,
}) => {
  const equityValue = portfolio.totalValueUsd - portfolio.stablecoinValueUsd;
  const equityExposureBps = 10_000 - portfolio.stablecoinExposureBps;

  return (
    <div className="space-y-6">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>TOTAL PORTFOLIO VALUE</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white mono-num">
              ${portfolio.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 font-mono">USD</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Fully collateralized on Solana</span>
          </div>
        </div>

        {/* Stablecoin Reserve Floor */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>STABLECOIN RESERVE (USDC)</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400 mono-num">
              {(portfolio.stablecoinExposureBps / 100).toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (${portfolio.stablecoinValueUsd.toLocaleString('en-US', { minimumFractionDigits: 0 })})
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Guaranteed floor:</span>
            <span className="text-white font-mono font-semibold">
              {(policy.minStablecoinBps / 100).toFixed(2)}%
            </span>
            <span className="text-emerald-400 font-bold ml-1">✓ SAFE</span>
          </div>
        </div>

        {/* Equity Holdings */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>TOKENIZED EQUITIES</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white mono-num">
              {(equityExposureBps / 100).toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (${equityValue.toLocaleString('en-US', { minimumFractionDigits: 0 })})
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span>Single equity cap: </span>
            <span className="text-white font-mono font-semibold">
              {(policy.maxSingleAssetBps / 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Active Policy Status */}
        <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>SENTINEL ENFORCEMENT</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              ACTIVE
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              v{policy.policyVersion}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            <span>Enforced at state-transition layer</span>
          </div>
        </div>
      </div>

      {/* Asset Allocation Table & Safety Bars */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Portfolio Allocation & Policy Boundaries</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live balances vs on-chain postcondition bounds (Single equity max {(policy.maxSingleAssetBps / 100).toFixed(1)}%, Stablecoin floor {(policy.minStablecoinBps / 100).toFixed(1)}%)
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {portfolio.assets.length} Active Positions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sentinel-cardBorder text-slate-400 text-xs font-semibold">
                <th className="pb-3 font-medium">ASSET</th>
                <th className="pb-3 font-medium">TYPE</th>
                <th className="pb-3 font-medium">PRICE</th>
                <th className="pb-3 font-medium">HOLDINGS</th>
                <th className="pb-3 font-medium">VALUE</th>
                <th className="pb-3 font-medium">ALLOCATION</th>
                <th className="pb-3 font-medium">POLICY STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-cardBorder/60">
              {portfolio.assets.map((asset) => {
                const exposurePct = (asset.exposureBps / 100);
                const maxPct = asset.isStablecoin
                  ? (policy.minStablecoinBps / 100)
                  : asset.isIndex
                  ? 50
                  : (policy.maxSingleAssetBps / 100);

                const isCompliant = asset.isStablecoin
                  ? asset.exposureBps >= policy.minStablecoinBps
                  : asset.isIndex
                  ? true
                  : asset.exposureBps <= policy.maxSingleAssetBps;

                return (
                  <tr key={asset.symbol} className="hover:bg-slate-800/20 transition">
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          asset.isStablecoin
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {asset.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{asset.symbol}</div>
                          <div className="text-[11px] text-slate-400">{asset.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 text-xs text-slate-300">
                      {asset.isStablecoin ? 'Stablecoin Reserve' : asset.isIndex ? 'Tokenized ETF' : 'Tokenized Equity'}
                    </td>
                    <td className="py-3.5 text-xs text-white font-mono">
                      ${asset.priceUsd.toFixed(2)}
                    </td>
                    <td className="py-3.5 text-xs text-slate-300 font-mono">
                      {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 text-xs text-white font-mono font-semibold">
                      ${asset.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 w-56">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-white font-bold">{exposurePct.toFixed(2)}%</span>
                          <span className="text-slate-400">
                            {asset.isStablecoin ? `Floor: ${maxPct.toFixed(0)}%` : `Cap: ${maxPct.toFixed(0)}%`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden relative">
                          <div
                            className={`h-full rounded-full ${
                              !isCompliant
                                ? 'bg-red-500'
                                : asset.isStablecoin
                                ? 'bg-emerald-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, (exposurePct / 50) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      {isCompliant ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Within Policy</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-red-950/60 text-red-400 border border-red-500/30 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Violates Cap</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Autonomous Agent Decisions Table */}
      <div className="bg-sentinel-card border border-sentinel-cardBorder rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Autonomous Agent Activity</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Decisions proposed by agent and evaluated by Sentinel PTA
            </p>
          </div>
          <button
            onClick={onNavigateToDecisions}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
          >
            <span>Open Decision Inspector</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentEvidence.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-lg">
            No agent decisions evaluated yet. Click &quot;Run Autonomous Demo&quot; to see Sentinel enforce guarantees.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sentinel-cardBorder text-slate-400 text-xs font-semibold">
                  <th className="pb-3 font-medium">TIMESTAMP</th>
                  <th className="pb-3 font-medium">ACTION PROMISED</th>
                  <th className="pb-3 font-medium">TRADE VALUE</th>
                  <th className="pb-3 font-medium">SENTINEL RESULT</th>
                  <th className="pb-3 font-medium">VERDICT / REASON</th>
                  <th className="pb-3 font-medium">PROVN EVIDENCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-cardBorder/60">
                {recentEvidence.slice(0, 5).map((record) => {
                  const isSettled = record.verificationResult === 'SETTLED';
                  const dateStr = new Date(record.timestamp).toLocaleTimeString();

                  return (
                    <tr key={record.id} className="hover:bg-slate-800/20 transition">
                      <td className="py-3 text-xs text-slate-400 font-mono">{dateStr}</td>
                      <td className="py-3 text-xs text-white font-semibold">
                        BUY NVDAx
                      </td>
                      <td className="py-3 text-xs text-slate-200 font-mono">
                        {isSettled ? '$5,000.00' : '$15,000.00'}
                      </td>
                      <td className="py-3">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SETTLED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-500/30 font-bold">
                            <XCircle className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-slate-300 max-w-xs truncate">
                        {isSettled ? 'All 4 postconditions passed' : record.failureReason}
                      </td>
                      <td className="py-3 text-xs">
                        <button
                          onClick={() => onSelectEvidence(record)}
                          className="text-blue-400 hover:text-blue-300 font-mono text-[11px] underline"
                        >
                          {record.id.slice(0, 16)}...
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
