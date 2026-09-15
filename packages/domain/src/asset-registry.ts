/**
 * Centralized Tokenized Stock Asset Registry
 * Authoritative registry defining supported tokenized equities and stablecoins on Solana.
 */

export interface TokenizedAssetMetadata {
  symbol: string;
  name: string;
  mintDevnet: string;
  decimals: number;
  assetClass: 'EQUITY' | 'INDEX' | 'STABLECOIN';
  isStablecoin: boolean;
  isIndex?: boolean;
  basePriceUsd: number;
  colorHex: string;
  description: string;
}

export const ASSET_REGISTRY: Record<string, TokenizedAssetMetadata> = {
  NVDAx: {
    symbol: 'NVDAx',
    name: 'NVIDIA Tokenized Stock',
    mintDevnet: 'NVDA111111111111111111111111111111111111111',
    decimals: 6,
    assetClass: 'EQUITY',
    isStablecoin: false,
    basePriceUsd: 120.00,
    colorHex: '#10B981', // Emerald
    description: 'Tokenized equity representing NVIDIA Corp on Solana.',
  },
  AAPLx: {
    symbol: 'AAPLx',
    name: 'Apple Tokenized Stock',
    mintDevnet: 'AAPL111111111111111111111111111111111111111',
    decimals: 6,
    assetClass: 'EQUITY',
    isStablecoin: false,
    basePriceUsd: 180.00,
    colorHex: '#94A3B8', // Slate / Silver
    description: 'Tokenized equity representing Apple Inc on Solana.',
  },
  SPYx: {
    symbol: 'SPYx',
    name: 'S&P 500 Tokenized ETF',
    mintDevnet: 'SPYX111111111111111111111111111111111111111',
    decimals: 6,
    assetClass: 'INDEX',
    isStablecoin: false,
    isIndex: true,
    basePriceUsd: 520.00,
    colorHex: '#3B82F6', // Blue
    description: 'Tokenized broad-market ETF representing S&P 500 on Solana.',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    mintDevnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Official Solana Devnet USDC Mint
    decimals: 6,
    assetClass: 'STABLECOIN',
    isStablecoin: true,
    basePriceUsd: 1.00,
    colorHex: '#06B6D4', // Cyan
    description: 'Fully-reserved USD stablecoin reserve currency on Solana.',
  },
};

export function getAssetMetadata(symbol: string): TokenizedAssetMetadata | undefined {
  return ASSET_REGISTRY[symbol];
}

export function getAllSupportedAssets(): TokenizedAssetMetadata[] {
  return Object.values(ASSET_REGISTRY);
}
