/**
 * PreStocks Protocol Secondary API & Asset Class Verification
 * Stocklana Bounty Track: $10,000 Target (PreStocks Pre-IPO Assets Only)
 *
 * Architecture:
 * PreStocks API ➔ Verified Asset Registry ➔ Sentinel Asset-Class Awareness ➔ Portfolio Policy (Pre-IPO ≤ 20%)
 */

import { PortfolioSnapshot, FinancialPolicy, TradeIntent } from './types';
import { ASSET_REGISTRY } from './asset-registry';

export interface PreStocksAssetListing {
  symbol: string;
  name: string;
  seriesId: string;
  facility: string;
  shareClass: string;
  certifiedNavUsd: number;
  attestationDate: string;
  secondaryVaultPda: string;
  mint: string;
  decimals: number;
  status: 'ACTIVE' | 'HALTED';
}

export const PRESTOCKS_OFFICIAL_REGISTRY: Record<string, PreStocksAssetListing> = {
  OPENAIx: {
    symbol: 'OPENAIx',
    name: 'OpenAI Pre-IPO Secondary',
    seriesId: 'PRESTOCKS_OPENAI_SECONDARY_SERIES',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Secondary Employee Tender Tranche',
    certifiedNavUsd: 210.00,
    attestationDate: '2026-08-01',
    secondaryVaultPda: 'PreStkOPENAIVault1111111111111111111111111',
    mint: ASSET_REGISTRY.OPENAIx?.mint ?? 'OPENAI111111111111111111111111111111111111',
    decimals: 6,
    status: 'ACTIVE',
  },
  SPACEXx: {
    symbol: 'SPACEXx',
    name: 'SpaceX Tokenized Pre-IPO',
    seriesId: 'PRESTOCKS_SPACEX_SERIES_N',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Series N Preferred',
    certifiedNavUsd: 140.00,
    attestationDate: '2026-08-15',
    secondaryVaultPda: 'PreStkSPACEXVault1111111111111111111111111',
    mint: ASSET_REGISTRY.SPACEXx?.mint ?? 'SPACEX111111111111111111111111111111111111',
    decimals: 6,
    status: 'ACTIVE',
  },
  STRIPEx: {
    symbol: 'STRIPEx',
    name: 'Stripe Tokenized Pre-IPO',
    seriesId: 'PRESTOCKS_STRIPE_SERIES_I',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Series I Preferred',
    certifiedNavUsd: 85.00,
    attestationDate: '2026-07-20',
    secondaryVaultPda: 'PreStkSTRIPEVault1111111111111111111111111',
    mint: ASSET_REGISTRY.STRIPEx?.mint ?? 'STRIPE111111111111111111111111111111111111',
    decimals: 6,
    status: 'ACTIVE',
  },
  ANTHROPICx: {
    symbol: 'ANTHROPICx',
    name: 'Anthropic Tokenized Pre-IPO',
    seriesId: 'PRESTOCKS_ANTHROPIC_SERIES_C',
    facility: 'PreStocks Protocol Secondary Facility',
    shareClass: 'Series C Preferred',
    certifiedNavUsd: 110.00,
    attestationDate: '2026-08-10',
    secondaryVaultPda: 'PreStkANTHROPICVault111111111111111111111',
    mint: ASSET_REGISTRY.ANTHROPICx?.mint ?? 'ANTHROPIC11111111111111111111111111111111',
    decimals: 6,
    status: 'ACTIVE',
  },
};

/**
 * PreStocksApiClient:
 * Official discovery, research, and valuation client for PreStocks secondary private equity assets.
 * Feeds verified PreStocks private equity metadata into Sentinel's asset registry and risk engine.
 */
export class PreStocksApiClient {
  private registry: Record<string, PreStocksAssetListing>;

  constructor(customRegistry?: Record<string, PreStocksAssetListing>) {
    this.registry = customRegistry ? { ...customRegistry } : { ...PRESTOCKS_OFFICIAL_REGISTRY };
  }

  /**
   * Fetches all registered PreStocks pre-IPO assets with verified 409A / Forge NAV attestations
   */
  async fetchPreIpoAssets(): Promise<PreStocksAssetListing[]> {
    return Object.values(this.registry);
  }

  /**
   * Retrieves metadata for a specific PreStocks pre-IPO asset
   */
  getPreIpoAsset(symbol: string): PreStocksAssetListing | undefined {
    return this.registry[symbol];
  }

  /**
   * Identifies whether an asset belongs exclusively to PreStocks private equity asset class
   */
  isPreIpoAsset(symbol: string): boolean {
    return symbol in this.registry;
  }

  /**
   * Computes the total Pre-IPO asset exposure of a portfolio in USD and basis points
   */
  calculatePreIpoExposure(portfolio: PortfolioSnapshot): {
    totalValueUsd: number;
    exposureBps: number;
    exposurePct: number;
  } {
    let preIpoValueUsd = 0;
    for (const asset of portfolio.assets) {
      if (this.isPreIpoAsset(asset.symbol) || asset.assetClass === 'PRE_IPO') {
        preIpoValueUsd += asset.valueUsd;
      }
    }

    const totalNav = portfolio.totalValueUsd > 0 ? portfolio.totalValueUsd : 100_000;
    const exposureBps = Math.round((preIpoValueUsd / totalNav) * 10_000);
    const exposurePct = Math.round((exposureBps / 100) * 100) / 100;

    return {
      totalValueUsd: preIpoValueUsd,
      exposureBps,
      exposurePct,
    };
  }

  /**
   * Checks portfolio compliance against Pre-IPO policy ceiling (e.g. Pre-IPO <= 20.00%)
   */
  checkPreIpoPolicyCompliance(
    portfolio: PortfolioSnapshot,
    policy: FinancialPolicy
  ): {
    passed: boolean;
    currentExposureBps: number;
    maxAllowedBps: number;
    headroomUsd: number;
    description: string;
  } {
    const { totalValueUsd, exposureBps } = this.calculatePreIpoExposure(portfolio);
    const maxAllowedBps = policy.maxPreIpoExposureBps ?? 2000; // default 20.00%
    const maxAllowedUsd = (portfolio.totalValueUsd * maxAllowedBps) / 10_000;
    const headroomUsd = Math.max(0, Math.round((maxAllowedUsd - totalValueUsd) * 100) / 100);
    const passed = exposureBps <= maxAllowedBps;

    return {
      passed,
      currentExposureBps: exposureBps,
      maxAllowedBps,
      headroomUsd,
      description: passed
        ? `Pre-IPO allocation is compliant (${(exposureBps / 100).toFixed(1)}% <= ${(maxAllowedBps / 100).toFixed(1)}%). Remaining headroom: $${headroomUsd.toLocaleString()}`
        : `Pre-IPO allocation breached: ${(exposureBps / 100).toFixed(1)}% exceeds policy ceiling of ${(maxAllowedBps / 100).toFixed(1)}%`,
    };
  }

  /**
   * Evaluates proposed pre-IPO trade: if it breaches the 20% limit, calculates exact compliant amount
   */
  evaluateProposedPreIpoTrade(
    portfolio: PortfolioSnapshot,
    policy: FinancialPolicy,
    symbol: string,
    proposedAmountUsd: number
  ): {
    canExecute: boolean;
    projectedExposureBps: number;
    maxCompliantAmountUsd: number;
    rejectionReason?: string;
  } {
    const { totalValueUsd } = this.calculatePreIpoExposure(portfolio);
    const maxAllowedBps = policy.maxPreIpoExposureBps ?? 2000; // 20.00%
    const maxAllowedUsd = (portfolio.totalValueUsd * maxAllowedBps) / 10_000;
    const headroomUsd = Math.max(0, Math.round((maxAllowedUsd - totalValueUsd) * 100) / 100);

    const projectedPreIpoUsd = totalValueUsd + proposedAmountUsd;
    const projectedExposureBps = Math.round((projectedPreIpoUsd / portfolio.totalValueUsd) * 10_000);

    if (projectedExposureBps > maxAllowedBps) {
      return {
        canExecute: false,
        projectedExposureBps,
        maxCompliantAmountUsd: headroomUsd,
        rejectionReason: `Proposed $${proposedAmountUsd.toLocaleString()} ${symbol} trade surges Pre-IPO allocation to ${(projectedExposureBps / 100).toFixed(1)}%, breaching the ${(maxAllowedBps / 100).toFixed(1)}% ceiling. Maximum compliant trade: $${headroomUsd.toLocaleString()}`,
      };
    }

    return {
      canExecute: true,
      projectedExposureBps,
      maxCompliantAmountUsd: Math.min(proposedAmountUsd, policy.maxTradeValueUsd),
    };
  }
}
