'use client';

import React, { useState } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  PortfolioAsset,
} from '@sentinel/domain';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Lock,
  DollarSign,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Stat } from './ui/Stat';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { FinancialChart } from './ui/FinancialChart';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';
import { getExplorerAddressUrl } from '@/lib/config';

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
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);

  const equityValue = portfolio.totalValueUsd - portfolio.stablecoinValueUsd;
  const equityExposureBps = 10_000 - portfolio.stablecoinExposureBps;
  const isReserveHealthy = portfolio.stablecoinExposureBps >= policy.minStablecoinBps;

  return (
    <div className="space-y-6">
      {/* 1. Stat Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <Stat
          label="PORTFOLIO NAV"
          value={formatCurrency(portfolio.totalValueUsd)}
          subtext="Fully collateralized on Solana Devnet"
          delta="+1.42%"
          deltaPositive={true}
          icon={DollarSign}
        />

        {/* Stablecoin Reserve Floor */}
        <Stat
          label="USDC RESERVE FLOOR"
          value={formatPercent(portfolio.stablecoinExposureBps / 100)}
          subtext={`Guaranteed floor: ${(policy.minStablecoinBps / 100).toFixed(1)}%`}
          delta={isReserveHealthy ? 'SAFE' : 'BREACH'}
          deltaPositive={isReserveHealthy}
          icon={Lock}
          iconColor="text-emerald-400"
        />

        {/* Tokenized Equities */}
        <Stat
          label="TOKENIZED EQUITIES"
          value={formatCurrency(equityValue)}
          subtext={`Cap: ${(policy.maxSingleAssetBps / 100).toFixed(1)}% per stock`}
          delta={formatPercent(equityExposureBps / 100)}
          deltaPositive={true}
          icon={TrendingUp}
          iconColor="text-indigo-400"
        />

        {/* Active Policy Status */}
        <Stat
          label="POLICY ENFORCEMENT"
          value={`v${policy.policyVersion}`}
          subtext="On-chain Anchor constraints"
          delta="ACTIVE"
          deltaPositive={true}
          icon={ShieldCheck}
          iconColor="text-blue-400"
        />
      </div>

      {/* 2. TradingView Lightweight Financial Chart */}
      <FinancialChart currentValueUsd={portfolio.totalValueUsd} />

      {/* 3. Asset Allocation Distribution Bar */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-sentinel-text">Portfolio Allocation Distribution</span>
          <span className="text-sentinel-textMuted font-mono">100.00% Total NAV</span>
        </div>

        {/* Visual Allocation Strip */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-sentinel-surfaceMuted">
          {portfolio.assets.map((asset, idx) => {
            const widthPct = (asset.exposureBps / 100);
            const colors = [
              'bg-blue-500',
              'bg-emerald-500',
              'bg-purple-500',
              'bg-indigo-500',
              'bg-amber-500',
            ];
            return (
              <div
                key={asset.symbol}
                className={`${colors[idx % colors.length]} hover:opacity-80 transition cursor-pointer`}
                style={{ width: `${widthPct}%` }}
                title={`${asset.symbol}: ${widthPct.toFixed(2)}%`}
                onClick={() => setSelectedAssetSymbol(asset.symbol)}
              />
            );
          })}
        </div>

        {/* Legend Chips */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          {portfolio.assets.map((asset, idx) => {
            const colors = [
              'bg-blue-500',
              'bg-emerald-500',
              'bg-purple-500',
              'bg-indigo-500',
              'bg-amber-500',
            ];
            return (
              <button
                key={asset.symbol}
                onClick={() => setSelectedAssetSymbol(asset.symbol === selectedAssetSymbol ? null : asset.symbol)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition ${
                  selectedAssetSymbol === asset.symbol
                    ? 'bg-sentinel-surfaceElevated border border-blue-500/40 text-white'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                <span className="font-semibold">{asset.symbol}</span>
                <span className="font-mono text-sentinel-textSubtle">
                  {(asset.exposureBps / 100).toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Asset Holdings Table & Policy Boundaries */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-sentinel-border">
          <div>
            <h3 className="text-base font-bold text-sentinel-text">Holdings & Policy Compliance</h3>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Machine-verified against single equity ceiling (≤ {(policy.maxSingleAssetBps / 100).toFixed(1)}%) and stablecoin floor (≥ {(policy.minStablecoinBps / 100).toFixed(1)}%).
            </p>
          </div>
          <span className="text-xs font-mono text-sentinel-textSubtle self-start sm:self-auto">
            {portfolio.assets.length} Active Positions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sentinel-border text-sentinel-textSubtle text-xs font-semibold">
                <th className="pb-3 font-medium">ASSET</th>
                <th className="pb-3 font-medium">PRICE</th>
                <th className="pb-3 font-medium">HOLDINGS</th>
                <th className="pb-3 font-medium">VALUE</th>
                <th className="pb-3 font-medium">ALLOCATION</th>
                <th className="pb-3 font-medium">POLICY STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-border">
              {portfolio.assets.map((asset) => {
                const exposurePct = asset.exposureBps / 100;
                const isCompliant = asset.isStablecoin
                  ? asset.exposureBps >= policy.minStablecoinBps
                  : asset.isIndex
                  ? true
                  : asset.exposureBps <= policy.maxSingleAssetBps;

                const isSelected = selectedAssetSymbol === asset.symbol;

                return (
                  <React.Fragment key={asset.symbol}>
                    <tr
                      onClick={() => setSelectedAssetSymbol(isSelected ? null : asset.symbol)}
                      className={`hover:bg-sentinel-surfaceElevated/60 transition cursor-pointer ${
                        isSelected ? 'bg-sentinel-surfaceElevated/80' : ''
                      }`}
                    >
                      {/* Asset & Name */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              asset.isStablecoin
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {asset.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{asset.symbol}</span>
                              {asset.isStablecoin && (
                                <Badge variant="success" size="sm">
                                  RESERVE
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-sentinel-textMuted">{asset.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 font-mono text-white tabular-nums">
                        {formatCurrency(asset.priceUsd)}
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 font-mono text-sentinel-textMuted tabular-nums">
                        {asset.amount.toLocaleString('en-US', {
                          minimumFractionDigits: asset.isStablecoin ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Value */}
                      <td className="py-3.5 font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(asset.valueUsd)}
                      </td>

                      {/* Allocation */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white tabular-nums font-semibold w-12">
                            {formatPercent(exposurePct)}
                          </span>
                          <div className="w-16 sm:w-24 bg-sentinel-surfaceMuted h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isCompliant ? 'bg-blue-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, exposurePct * 2)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Policy Status */}
                      <td className="py-3.5">
                        {isCompliant ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold font-mono">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {asset.isStablecoin
                                ? `≥ ${(policy.minStablecoinBps / 100).toFixed(1)}%`
                                : `≤ ${(policy.maxSingleAssetBps / 100).toFixed(1)}%`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold font-mono">
                            <XCircle className="w-4 h-4" />
                            <span>BREACH</span>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Asset Detail */}
                    {isSelected && (
                      <tr className="bg-sentinel-surfaceElevated/40">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border">
                            <div>
                              <span className="text-sentinel-textSubtle block">SOLANA TOKEN MINT</span>
                              <a
                                href={getExplorerAddressUrl(asset.mint)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <span>{formatAddress(asset.mint, 8)}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">POLICY CEILING</span>
                              <span className="text-white mt-0.5 block">
                                {asset.isStablecoin
                                  ? `Minimum Floor: ${(policy.minStablecoinBps / 100).toFixed(2)}%`
                                  : `Maximum Cap: ${(policy.maxSingleAssetBps / 100).toFixed(2)}%`}
                              </span>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">MAX TRADE CAPACITY</span>
                              <span className="text-white mt-0.5 block font-semibold">
                                {asset.isStablecoin
                                  ? 'N/A (Liquid Reserve)'
                                  : formatCurrency(
                                      Math.max(
                                        0,
                                        portfolio.totalValueUsd * (policy.maxSingleAssetBps / 10000) -
                                          asset.valueUsd
                                      )
                                    )}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
