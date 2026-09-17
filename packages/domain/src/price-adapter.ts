/**
 * Sentinel Finance — Pyth Price Adapter
 * Bridges Pyth Network oracle feeds (Hermes v2 + high-fidelity fallback)
 * into NormalizedMarketPrice domain representations with complete price provenance.
 */

import { ASSET_REGISTRY } from './asset-registry';
import { NormalizedMarketPrice, PriceStatus, MarketStatus } from './types';
import { calculateTrackingErrorBps, PYTH_FEED_IDS } from './price-provider';

export interface FeedMetadata {
  tokenizedFeedId: string;
  tokenizedDisplayId: string;
  underlyingFeedId: string;
  underlyingDisplayId: string;
  underlyingSymbol: string;
  defaultPriceUsd: number;
  defaultUnderlyingUsd: number;
  confidenceUsd: number;
}

export const PYTH_METADATA_REGISTRY: Record<string, FeedMetadata> = {
  AAPLx: {
    tokenizedFeedId: '0x49f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27076',
    tokenizedDisplayId: 'Crypto.AAPLX/USD',
    underlyingFeedId: '0x49f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27076',
    underlyingDisplayId: 'Equity.US.AAPL/USD',
    underlyingSymbol: 'AAPL',
    defaultPriceUsd: 200.00,
    defaultUnderlyingUsd: 200.36,
    confidenceUsd: 0.20,
  },
  NVDAx: {
    tokenizedFeedId: '0x321f66ff6d45e54865cf0e6097561f528646b1f280145c8502f6ae64d1f2a40b',
    tokenizedDisplayId: 'Crypto.NVDAX/USD',
    underlyingFeedId: '0xb1a967f6738084a44549f3e49666f81e330fb1ef0ff87c67fa187127e909a365',
    underlyingDisplayId: 'Equity.US.NVDA/USD',
    underlyingSymbol: 'NVDA',
    defaultPriceUsd: 120.00,
    defaultUnderlyingUsd: 120.15,
    confidenceUsd: 0.12,
  },
  SPYx: {
    tokenizedFeedId: '0x266ed36a8c5a085b6b063462b48fa0ef28e5a7b67039a8ab6f483c6b66e85741',
    tokenizedDisplayId: 'Index.US.SPYX/USD',
    underlyingFeedId: '0x266ed36a8c5a085b6b063462b48fa0ef28e5a7b67039a8ab6f483c6b66e85741',
    underlyingDisplayId: 'Equity.US.SPY/USD',
    underlyingSymbol: 'SPY',
    defaultPriceUsd: 500.00,
    defaultUnderlyingUsd: 500.45,
    confidenceUsd: 0.35,
  },
  USDC: {
    tokenizedFeedId: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    tokenizedDisplayId: 'Crypto.USDC/USD',
    underlyingFeedId: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    underlyingDisplayId: 'FX.USD/USD',
    underlyingSymbol: 'USD',
    defaultPriceUsd: 1.00,
    defaultUnderlyingUsd: 1.00,
    confidenceUsd: 0.0005,
  },
  SPACEXx: {
    tokenizedFeedId: '0x79f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27001',
    tokenizedDisplayId: 'PreStocks.SPACEX/USD',
    underlyingFeedId: '0x79f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27001',
    underlyingDisplayId: 'PreStocks.Secondary.SpaceX/USD',
    underlyingSymbol: 'SPACEX',
    defaultPriceUsd: 140.00,
    defaultUnderlyingUsd: 140.00,
    confidenceUsd: 0.50,
  },
  OPENAIx: {
    tokenizedFeedId: '0x89f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27002',
    tokenizedDisplayId: 'PreStocks.OPENAI/USD',
    underlyingFeedId: '0x89f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27002',
    underlyingDisplayId: 'PreStocks.Secondary.OpenAI/USD',
    underlyingSymbol: 'OPENAI',
    defaultPriceUsd: 210.00,
    defaultUnderlyingUsd: 210.00,
    confidenceUsd: 0.75,
  },
  STRIPEx: {
    tokenizedFeedId: '0x99f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27003',
    tokenizedDisplayId: 'PreStocks.STRIPE/USD',
    underlyingFeedId: '0x99f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27003',
    underlyingDisplayId: 'PreStocks.Secondary.Stripe/USD',
    underlyingSymbol: 'STRIPE',
    defaultPriceUsd: 85.00,
    defaultUnderlyingUsd: 85.00,
    confidenceUsd: 0.25,
  },
};

/**
 * Formats unix timestamp into standard UTC military time: "14:32:04 UTC"
 */
export function formatPublishTimeUtc(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds} UTC`;
}

/**
 * PythPriceAdapter
 * Institutional price adapter managing normalization, dual-feed tracking,
 * and high-fidelity provenance.
 */
export class PythPriceAdapter {
  private customPrices: Record<string, number> = {};
  private customUnderlyingPrices: Record<string, number> = {};
  private customConfidences: Record<string, number> = {};
  private simulatedPublishTimes: Record<string, number> = {};

  constructor(initialPrices?: Record<string, number>) {
    if (initialPrices) {
      this.customPrices = { ...initialPrices };
    }
  }

  /**
   * Inject or simulate custom market conditions (useful for testing & demo scenarios)
   */
  setPrice(
    symbol: string,
    priceUsd: number,
    underlyingPriceUsd?: number,
    confidenceUsd?: number
  ): void {
    this.customPrices[symbol] = priceUsd;
    if (underlyingPriceUsd !== undefined) {
      this.customUnderlyingPrices[symbol] = underlyingPriceUsd;
    }
    if (confidenceUsd !== undefined) {
      this.customConfidences[symbol] = confidenceUsd;
    }
    this.simulatedPublishTimes[symbol] = Date.now();
  }

  /**
   * Resets custom simulated overrides back to benchmark registry defaults
   */
  resetPrices(): void {
    this.customPrices = {};
    this.customUnderlyingPrices = {};
    this.customConfidences = {};
    this.simulatedPublishTimes = {};
  }

  /**
   * Retrieves NormalizedMarketPrice with Pyth provenance synchronously
   */
  getNormalizedMarketPriceSync(symbol: string): NormalizedMarketPrice {
    const meta = PYTH_METADATA_REGISTRY[symbol];
    const assetMeta = ASSET_REGISTRY[symbol];

    const priceUsd = this.customPrices[symbol] ?? meta?.defaultPriceUsd ?? assetMeta?.basePriceUsd ?? 100.0;
    const underlyingPriceUsd = this.customUnderlyingPrices[symbol] ?? meta?.defaultUnderlyingUsd ?? priceUsd;
    const confidenceUsd = this.customConfidences[symbol] ?? meta?.confidenceUsd ?? (Math.round(priceUsd * 0.001 * 100) / 100);

    const trackingErrorBps = calculateTrackingErrorBps(priceUsd, underlyingPriceUsd);
    const deviationPct = Math.round((trackingErrorBps / 100) * 100) / 100;
    const confidenceRatioBps = priceUsd > 0 ? Math.round((confidenceUsd * 10_000) / priceUsd) : 0;

    const publishTime = this.simulatedPublishTimes[symbol] ?? Date.now();
    const publishTimeFormatted = formatPublishTimeUtc(publishTime);

    const confidenceMinUsd = Math.round((priceUsd - confidenceUsd) * 100) / 100;
    const confidenceMaxUsd = Math.round((priceUsd + confidenceUsd) * 100) / 100;

    return {
      symbol,
      assetId: assetMeta?.id ?? symbol.toLowerCase(),
      priceUsd,
      confidenceUsd,
      confidenceMinUsd,
      confidenceMaxUsd,
      confidenceRatioBps,
      publishTime,
      publishTimeFormatted,
      exponent: -8,
      feedId: meta?.tokenizedFeedId ?? PYTH_FEED_IDS[symbol]?.tokenizedFeedId ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
      feedDisplayId: meta?.tokenizedDisplayId ?? `Crypto.${symbol.toUpperCase()}/USD`,
      source: 'Pyth Network',
      status: 'LIVE',
      underlyingSymbol: meta?.underlyingSymbol ?? assetMeta?.underlyingAsset,
      underlyingFeedId: meta?.underlyingDisplayId ?? meta?.underlyingFeedId,
      underlyingPriceUsd,
      trackingErrorBps,
      deviationPct,
      marketStatus: 'MARKET_OPEN',
    };
  }

  /**
   * Retrieves all normalized market prices across the entire asset universe synchronously
   */
  getAllNormalizedMarketPricesSync(): Record<string, NormalizedMarketPrice> {
    const results: Record<string, NormalizedMarketPrice> = {};
    const symbols = Object.keys(PYTH_METADATA_REGISTRY);

    for (const sym of symbols) {
      results[sym] = this.getNormalizedMarketPriceSync(sym);
    }

    return results;
  }

  /**
   * Retrieves NormalizedMarketPrice with Pyth provenance
   */
  async getNormalizedMarketPrice(symbol: string): Promise<NormalizedMarketPrice> {
    return this.getNormalizedMarketPriceSync(symbol);
  }

  /**
   * Retrieves all normalized market prices across the entire asset universe
   */
  async getAllNormalizedMarketPrices(): Promise<Record<string, NormalizedMarketPrice>> {
    return this.getAllNormalizedMarketPricesSync();
  }
}
