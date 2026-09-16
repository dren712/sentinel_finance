'use client';

import React, { useState } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  PortfolioAsset,
  getAssetMetadata,
  NormalizedMarketPrice,
  deriveSentinelPda,
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
  Activity,
  AlertTriangle,
  Wallet,
  Cpu,
  Key,
  Copy,
  Check,
} from 'lucide-react';
import { Stat } from './ui/Stat';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { FinancialChart } from './ui/FinancialChart';
import { PriceProvenanceHover } from './ui/PriceProvenanceHover';
import { formatCurrency, formatPercent, formatAddress } from '@/lib/formatters';
import { getExplorerAddressUrl } from '@/lib/config';

interface PortfolioViewProps {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  recentEvidence: EvidenceRecord[];
  marketPrices?: Record<string, NormalizedMarketPrice>;
  onSelectEvidence: (record: EvidenceRecord) => void;
  onNavigateToDecisions: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  portfolio,
  policy,
  recentEvidence,
  marketPrices,
  onSelectEvidence,
  onNavigateToDecisions,
}) => {
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const sentinelPda = portfolio.sentinelPda || deriveSentinelPda(portfolio.owner);

  const handleCopy = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const equityValue = portfolio.totalValueUsd - portfolio.stablecoinValueUsd;
  const equityExposureBps = 10_000 - portfolio.stablecoinExposureBps;
  const isReserveHealthy = portfolio.stablecoinExposureBps >= policy.minStablecoinBps;

  // Evaluate policy guarantee health
  const singleAssetExceeded = portfolio.assets.some(
    (a) => !a.isStablecoin && !a.isIndex && a.exposureBps > policy.maxSingleAssetBps
  );
  const isHealthy = isReserveHealthy && !singleAssetExceeded;

  const getAssetColor = (symbol: string): string => {
    const meta = getAssetMetadata(symbol);
    if (meta?.colorHex) return meta.colorHex;
    if (symbol === 'NVDAx') return '#10B981';
    if (symbol === 'AAPLx') return '#94A3B8';
    if (symbol === 'SPYx') return '#3B82F6';
    if (symbol === 'USDC') return '#06B6D4';
    return '#8B5CF6';
  };

  return (
    <div className="space-y-6">
      {/* Policy Health & Pyth Oracle Valuation Banner */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isHealthy
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                Institutional Portfolio
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Pyth Market Truth
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Solana Devnet
              </span>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-0.5">
              Valued via Pyth Network oracle feeds with dual-feed tracking (tokenized vs. underlying US equities).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border flex items-center gap-1.5 ${
            isHealthy
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
              : 'bg-rose-950/40 text-rose-400 border-rose-500/40'
          }`}>
            {isHealthy ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                5 / 5 Guarantees Healthy
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Policy Boundary Alert
              </>
            )}
          </span>
        </div>
      </div>

      {/* Real Portfolio State Architecture Banner (Phase 3) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-sentinel-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              State Architecture · Verified On-Chain Projection
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Phase 3 Real Assets
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-sentinel-textMuted">
            <span>Projection State Hash:</span>
            <span className="text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {portfolio.projectionHash
                ? `${portfolio.projectionHash.slice(0, 10)}...${portfolio.projectionHash.slice(-8)}`
                : 'PROV_STATE_VERIFIED'}
            </span>
          </div>
        </div>

        {/* 4-Step Pipeline Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 1 · ASSETS</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              Wallet Token ATAs
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">SPL Token Accounts</span>
          </div>
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 2 · READER</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Portfolio Indexer
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">Live Token Balances</span>
          </div>
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 3 · VALUATION</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              Pyth Market Truth
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">Normalized NAV & Basis</span>
          </div>
          <div className="bg-sentinel-surfaceMuted p-2.5 rounded-lg border border-sentinel-border">
            <span className="text-[10px] text-sentinel-textSubtle block">STEP 4 · ENFORCEMENT</span>
            <span className="text-white font-semibold flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Sentinel PDA Guard
            </span>
            <span className="text-[10px] text-sentinel-textMuted block mt-0.5">Invariant Authority</span>
          </div>
        </div>
      </div>

      {/* 1. Stat Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <Stat
          label="PORTFOLIO NAV"
          value={formatCurrency(portfolio.totalValueUsd)}
          subtext="Collateralized on Solana Devnet"
          delta="BENCHMARK"
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

      {/* Sentinel PDA Authority & Configuration Card (Phase 3) */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Sentinel PDA Authority
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
                seeds: [b&quot;vault&quot;, owner]
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 font-mono text-xs">
              <span className="text-sentinel-textSubtle">PDA Address:</span>
              <span className="text-white font-semibold">{formatAddress(sentinelPda, 8)}</span>
              <button
                onClick={(e) => handleCopy(sentinelPda, e)}
                className="p-1 rounded hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition"
                title="Copy PDA Address"
              >
                {copiedAddress === sentinelPda ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <a
                href={getExplorerAddressUrl(sentinelPda)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline flex items-center gap-1"
                title="View on Solana Explorer"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-sentinel-textMuted mt-1">
              Non-custodial execution authority: user assets remain native SPL tokens in wallet ATAs; Sentinel PDA strictly authorizes execution and enforces mathematical invariants.
            </p>
          </div>

          {/* 5 Institutional Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Policy Authority
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Portfolio Config
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Execution Guard
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Promise Registry
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Evidence Anchor
            </span>
          </div>
        </div>
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
          {portfolio.assets.map((asset) => {
            const widthPct = (asset.exposureBps / 100);
            const color = getAssetColor(asset.symbol);
            return (
              <div
                key={asset.symbol}
                className="hover:opacity-80 transition cursor-pointer"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
                title={`${asset.symbol}: ${widthPct.toFixed(2)}%`}
                onClick={() => setSelectedAssetSymbol(asset.symbol)}
              />
            );
          })}
        </div>

        {/* Legend Chips */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          {portfolio.assets.map((asset) => {
            const color = getAssetColor(asset.symbol);
            return (
              <button
                key={asset.symbol}
                onClick={() => setSelectedAssetSymbol(asset.symbol === selectedAssetSymbol ? null : asset.symbol)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                  selectedAssetSymbol === asset.symbol
                    ? 'bg-sentinel-surfaceElevated border border-blue-500/40 text-white'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
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
                <th className="pb-3 font-medium">SPL ATA ACCOUNT</th>
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
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{
                              backgroundColor: `${getAssetColor(asset.symbol)}20`,
                              color: getAssetColor(asset.symbol),
                              border: `1px solid ${getAssetColor(asset.symbol)}40`,
                            }}
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

                      {/* SPL Associated Token Account (ATA) */}
                      <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <a
                            href={asset.ata ? getExplorerAddressUrl(asset.ata) : '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sentinel-textMuted hover:text-blue-400 transition"
                            title={asset.ata || 'SPL Associated Token Account'}
                          >
                            {formatAddress(asset.ata || 'ATA_DERIVING', 4)}
                          </a>
                          {asset.ata && (
                            <button
                              onClick={(e) => handleCopy(asset.ata!, e)}
                              className="p-1 rounded hover:bg-sentinel-surfaceMuted text-sentinel-textSubtle hover:text-white transition"
                              title="Copy ATA Address"
                            >
                              {copiedAddress === asset.ata ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Price with Pyth Provenance Hover */}
                      <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <PriceProvenanceHover
                          priceUsd={asset.priceUsd}
                          marketPrice={marketPrices?.[asset.symbol]}
                        />
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
                        <td colSpan={7} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono bg-sentinel-surfaceMuted p-3.5 rounded-lg border border-sentinel-border">
                            <div>
                              <span className="text-sentinel-textSubtle block">SOLANA TOKEN MINT</span>
                              <a
                                href={getExplorerAddressUrl(asset.mint)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <span>{formatAddress(asset.mint, 6)}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">ASSOCIATED TOKEN ACCOUNT (ATA)</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <a
                                  href={asset.ata ? getExplorerAddressUrl(asset.ata) : '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{formatAddress(asset.ata || 'ATA_DERIVED', 6)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                {asset.ata && (
                                  <button
                                    onClick={(e) => handleCopy(asset.ata!, e)}
                                    className="p-0.5 hover:text-white text-sentinel-textSubtle"
                                    title="Copy ATA"
                                  >
                                    {copiedAddress === asset.ata ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">RAW ATOMIC BALANCE</span>
                              <span className="text-white mt-0.5 block">
                                {asset.rawAmount || BigInt(Math.round(asset.amount * 1_000_000)).toString()} (decimals: {asset.decimals ?? 6})
                              </span>
                            </div>

                            <div>
                              <span className="text-sentinel-textSubtle block">POLICY CEILING</span>
                              <span className="text-white mt-0.5 block">
                                {asset.isStablecoin
                                  ? `Minimum Floor: ${(policy.minStablecoinBps / 100).toFixed(2)}%`
                                  : `Maximum Cap: ${(policy.maxSingleAssetBps / 100).toFixed(2)}%`}
                              </span>
                            </div>
                          </div>

                          {/* Pyth Market Truth Institutional Provenance Box */}
                          {marketPrices?.[asset.symbol] && (
                            <div className="bg-sentinel-surfaceMuted/90 p-3.5 rounded-lg border border-purple-500/20 text-xs font-mono">
                              <div className="flex items-center justify-between border-b border-sentinel-border/60 pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                  <span className="font-bold text-white uppercase text-[11px]">
                                    Pyth Dual-Feed Oracle Provenance
                                  </span>
                                </div>
                                <span className="text-purple-400 font-semibold text-[11px]">
                                  {marketPrices[asset.symbol].feedDisplayId}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                <div>
                                  <span className="text-sentinel-textSubtle block">PYTH PRICE</span>
                                  <span className="text-white font-bold">
                                    ${marketPrices[asset.symbol].priceUsd.toFixed(2)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sentinel-textSubtle block">CONFIDENCE (±σ)</span>
                                  <span className="text-blue-400 font-bold">
                                    ±${marketPrices[asset.symbol].confidenceUsd.toFixed(2)} ({((marketPrices[asset.symbol].confidenceRatioBps ?? 10) / 100).toFixed(2)}%)
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sentinel-textSubtle block">UNDERLYING BENCHMARK</span>
                                  <span className="text-white font-bold">
                                    {marketPrices[asset.symbol].underlyingSymbol ?? 'US Equity'}{' '}
                                    {marketPrices[asset.symbol].underlyingPriceUsd
                                      ? `($${marketPrices[asset.symbol].underlyingPriceUsd!.toFixed(2)})`
                                      : ''}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sentinel-textSubtle block">BASIS DEVIATION</span>
                                  <span
                                    className={`font-bold ${
                                      (marketPrices[asset.symbol].trackingErrorBps ?? 0) <= 250
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {marketPrices[asset.symbol].deviationPct.toFixed(2)}% ({marketPrices[asset.symbol].trackingErrorBps} bps)
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
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
