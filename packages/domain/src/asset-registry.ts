/**
 * Centralized Tokenized Stock Asset Registry
 * Authoritative registry defining supported tokenized equities, indices, stablecoins, and PreStocks pre-IPO assets.
 */

import { Asset, AssetClass } from './types';

export interface TokenizedAssetMetadata extends Asset {
  mintDevnet: string; // Backwards-compatible alias for mint
}

export const ASSET_REGISTRY: Record<string, TokenizedAssetMetadata> = {
  NVDAx: {
    id: 'asset_nvdax',
    symbol: 'NVDAx',
    name: 'NVIDIA Tokenized Stock',
    assetClass: 'TOKENIZED_EQUITY',
    mint: 'NVDA111111111111111111111111111111111111111',
    mintDevnet: 'NVDA111111111111111111111111111111111111111',
    underlyingAsset: 'NVDA',
    issuer: 'NVIDIA Corporation',
    sector: 'SEMICONDUCTORS',
    decimals: 6,
    status: 'ACTIVE',
    isStablecoin: false,
    basePriceUsd: 120.00,
    colorHex: '#10B981', // Emerald
    description: 'Tokenized equity representing NVIDIA Corp on Solana.',
  },
  AAPLx: {
    id: 'asset_aaplx',
    symbol: 'AAPLx',
    name: 'Apple Tokenized Stock',
    assetClass: 'TOKENIZED_EQUITY',
    mint: 'AAPL111111111111111111111111111111111111111',
    mintDevnet: 'AAPL111111111111111111111111111111111111111',
    underlyingAsset: 'AAPL',
    issuer: 'Apple Inc.',
    sector: 'CONSUMER_ELECTRONICS',
    decimals: 6,
    status: 'ACTIVE',
    isStablecoin: false,
    basePriceUsd: 180.00,
    colorHex: '#94A3B8', // Slate / Silver
    description: 'Tokenized equity representing Apple Inc on Solana.',
  },
  SPYx: {
    id: 'asset_spyx',
    symbol: 'SPYx',
    name: 'S&P 500 Tokenized ETF',
    assetClass: 'TOKENIZED_INDEX',
    mint: 'SPYX111111111111111111111111111111111111111',
    mintDevnet: 'SPYX111111111111111111111111111111111111111',
    underlyingAsset: 'SPY',
    issuer: 'State Street Global Advisors',
    sector: 'BROAD_MARKET',
    decimals: 6,
    status: 'ACTIVE',
    isStablecoin: false,
    isIndex: true,
    basePriceUsd: 520.00,
    colorHex: '#3B82F6', // Blue
    description: 'Tokenized broad-market ETF representing S&P 500 on Solana.',
  },
  USDC: {
    id: 'asset_usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    assetClass: 'STABLECOIN',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Official Solana Devnet USDC Mint
    mintDevnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    underlyingAsset: 'USD',
    issuer: 'Circle',
    sector: 'CASH_EQUIVALENT',
    decimals: 6,
    status: 'ACTIVE',
    isStablecoin: true,
    basePriceUsd: 1.00,
    colorHex: '#06B6D4', // Cyan
    description: 'Fully-reserved USD stablecoin reserve currency on Solana.',
  },
  SPACEXx: {
    id: 'asset_spacex',
    symbol: 'SPACEXx',
    name: 'SpaceX Tokenized Pre-IPO',
    assetClass: 'PRE_IPO',
    mint: 'SPACEX111111111111111111111111111111111111',
    mintDevnet: 'SPACEX111111111111111111111111111111111111',
    underlyingAsset: 'SPACEX',
    issuer: 'PreStocks Protocol',
    sector: 'AEROSPACE',
    decimals: 6,
    status: 'PRE_IPO',
    isStablecoin: false,
    basePriceUsd: 140.00,
    colorHex: '#8B5CF6', // Purple
    description: 'Tokenized private equity representing Space Exploration Technologies Corp on Solana via PreStocks.',
  },
  OPENAIx: {
    id: 'asset_openaix',
    symbol: 'OPENAIx',
    name: 'OpenAI Tokenized Pre-IPO',
    assetClass: 'PRE_IPO',
    mint: 'OPENAI111111111111111111111111111111111111',
    mintDevnet: 'OPENAI111111111111111111111111111111111111',
    underlyingAsset: 'OPENAI',
    issuer: 'PreStocks Protocol',
    sector: 'ARTIFICIAL_INTELLIGENCE',
    decimals: 6,
    status: 'PRE_IPO',
    isStablecoin: false,
    basePriceUsd: 210.00,
    colorHex: '#EC4899', // Pink
    description: 'Tokenized private equity representing OpenAI Inc on Solana via PreStocks.',
  },
  STRIPEx: {
    id: 'asset_stripex',
    symbol: 'STRIPEx',
    name: 'Stripe Tokenized Pre-IPO',
    assetClass: 'PRE_IPO',
    mint: 'STRIPE111111111111111111111111111111111111',
    mintDevnet: 'STRIPE111111111111111111111111111111111111',
    underlyingAsset: 'STRIPE',
    issuer: 'PreStocks Protocol',
    sector: 'FINANCIAL_TECHNOLOGY',
    decimals: 6,
    status: 'PRE_IPO',
    isStablecoin: false,
    basePriceUsd: 85.00,
    colorHex: '#6366F1', // Indigo
    description: 'Tokenized private equity representing Stripe Inc on Solana via PreStocks.',
  },
  ROBOx: {
    id: 'asset_robox',
    symbol: 'ROBOx',
    name: 'Sentinel Robo Strategy Token',
    assetClass: 'TOKENIZED_EQUITY',
    mint: 'ROBOx11111111111111111111111111111111111111',
    mintDevnet: 'ROBOx11111111111111111111111111111111111111',
    underlyingAsset: 'ROBO_INDEX',
    issuer: 'ClawPump Launchpad',
    sector: 'AUTONOMOUS_AGENTS',
    decimals: 6,
    status: 'ACTIVE',
    isStablecoin: false,
    basePriceUsd: 1.00,
    colorHex: '#10B981', // Emerald
    description: 'Stock-linked autonomous agent token launched on ClawPump with paired Meteora DBC liquidity.',
  },
};

export function getAssetMetadata(symbol: string): TokenizedAssetMetadata | undefined {
  return ASSET_REGISTRY[symbol];
}

export function getAssetById(id: string): TokenizedAssetMetadata | undefined {
  return Object.values(ASSET_REGISTRY).find((a) => a.id === id);
}

export function getAssetByMint(mint: string): TokenizedAssetMetadata | undefined {
  return Object.values(ASSET_REGISTRY).find((a) => a.mint === mint);
}

export function getAssetsByClass(assetClass: AssetClass): TokenizedAssetMetadata[] {
  return Object.values(ASSET_REGISTRY).filter((a) => a.assetClass === assetClass);
}

export function getAllSupportedAssets(): TokenizedAssetMetadata[] {
  return Object.values(ASSET_REGISTRY);
}

// -----------------------------------------------------------------------------
// Phase 11: PreStocks Asset Universe Taxonomy
// -----------------------------------------------------------------------------

export type AssetUniverseCategory = 'PUBLIC_EQUITIES' | 'PRE_IPO' | 'STABLE';

export interface AssetUniverseGroup {
  category: AssetUniverseCategory;
  displayName: string;
  description: string;
  defaultMaxExposureBps: number;
  assets: TokenizedAssetMetadata[];
}

/**
 * Returns the tripartite Asset Universe: Public Equities, PreStocks Pre-IPO, and Stablecoin
 */
export function getAssetUniverse(): Record<AssetUniverseCategory, AssetUniverseGroup> {
  return {
    PUBLIC_EQUITIES: {
      category: 'PUBLIC_EQUITIES',
      displayName: 'Public Equities',
      description: 'Tokenized US equities and market indices with dual-feed Pyth valuation',
      defaultMaxExposureBps: 7000, // ≤ 70%
      assets: [ASSET_REGISTRY.AAPLx, ASSET_REGISTRY.NVDAx, ASSET_REGISTRY.SPYx],
    },
    PRE_IPO: {
      category: 'PRE_IPO',
      displayName: 'Pre-IPO (PreStocks)',
      description: 'Tokenized private equity for late-stage technology unicorns on Solana via PreStocks',
      defaultMaxExposureBps: 2000, // ≤ 20%
      assets: [ASSET_REGISTRY.SPACEXx, ASSET_REGISTRY.OPENAIx, ASSET_REGISTRY.STRIPEx],
    },
    STABLE: {
      category: 'STABLE',
      displayName: 'Stablecoin Reserve',
      description: 'Collateralized USD cash reserve protecting liquidity and solvency',
      defaultMaxExposureBps: 10000, // Floor: min 10% (1000 bps)
      assets: [ASSET_REGISTRY.USDC],
    },
  };
}

/**
 * Categorizes an asset symbol into its macro asset universe category
 */
export function getAssetCategory(symbol: string): AssetUniverseCategory {
  const meta = ASSET_REGISTRY[symbol];
  if (!meta) {
    if (symbol === 'USDC') return 'STABLE';
    if (symbol.includes('SPACEX') || symbol.includes('OPENAI') || symbol.includes('STRIPE')) {
      return 'PRE_IPO';
    }
    return 'PUBLIC_EQUITIES';
  }
  if (meta.isStablecoin || meta.assetClass === 'STABLECOIN') return 'STABLE';
  if (meta.assetClass === 'PRE_IPO') return 'PRE_IPO';
  return 'PUBLIC_EQUITIES';
}
