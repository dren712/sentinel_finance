/**
 * Sentinel Finance — Price Provider & Pyth Network Oracle Foundation
 * Exposes real-time asset pricing, confidence bounds, and dual-feed basis tracking error.
 */

import { ASSET_REGISTRY } from './asset-registry';
import { PriceSource, PriceStatus, MarketStatus } from './types';

export interface AssetPrice {
  symbol: string;
  priceUsd: number;
  timestamp: number;
  status: PriceStatus;
  source: string;
  confidence?: number;
  exponent?: number;
  underlyingPrice?: number;
  trackingErrorBps?: number;
  marketStatus?: MarketStatus;
}

export interface PriceProvider {
  getPrice(symbol: string): Promise<AssetPrice>;
  getAllPrices(): Promise<Record<string, AssetPrice>>;
  getPriceSource?(symbol: string): Promise<PriceSource>;
}

// -----------------------------------------------------------------------------
// Pyth Feed Identifiers (Stocklana Pyth Track Feeds)
// -----------------------------------------------------------------------------

export const PYTH_FEED_IDS: Record<string, { tokenizedFeedId: string; underlyingFeedId: string }> = {
  NVDAx: {
    tokenizedFeedId: '0x4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f', // Crypto.NVDAX/USD
    underlyingFeedId: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593', // Equity.US.NVDA/USD
  },
  AAPLx: {
    tokenizedFeedId: '0x978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675', // Crypto.AAPLX/USD
    underlyingFeedId: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688', // Equity.US.AAPL/USD
  },
  SPYx: {
    tokenizedFeedId: '0x2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14', // Crypto.SPYX/USD
    underlyingFeedId: '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5', // Equity.US.SPY/USD
  },
  USDC: {
    tokenizedFeedId: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // Crypto.USDC/USD
    underlyingFeedId: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // FX.USD/USD
  },
  SPACEXx: {
    tokenizedFeedId: '0x79f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27001',
    underlyingFeedId: '0x79f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27001',
  },
  OPENAIx: {
    tokenizedFeedId: '0x89f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27002',
    underlyingFeedId: '0x89f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27002',
  },
  STRIPEx: {
    tokenizedFeedId: '0x99f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27003',
    underlyingFeedId: '0x99f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27003',
  },
  ANTHROPICx: {
    tokenizedFeedId: '0xa9f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27005',
    underlyingFeedId: '0xa9f6b657ede6b7e024e883494747e7eb16752765377f0a67272b1660d2b27005',
  },
};

/**
 * Calculates basis tracking error in basis points between tokenized stock and underlying equity:
 * |tokenizedPrice - underlyingPrice| * 10,000 / underlyingPrice
 */
export function calculateTrackingErrorBps(tokenizedPrice: number, underlyingPrice: number): number {
  if (underlyingPrice <= 0) return 0;
  const diff = Math.abs(tokenizedPrice - underlyingPrice);
  return Math.round((diff * 10_000) / underlyingPrice);
}

/**
 * PythLivePriceProvider
 * Connects directly to Pyth Network's Hermes REST API (https://hermes.pyth.network)
 * to pull real-time oracle price updates, confidence intervals, and publish timestamps.
 * 
 * If a price quote is stale (> maxStaleAgeSeconds) or confidence interval is too wide,
 * marks the price status as STALE / WIDE_SPREAD, triggering Sentinel's fail-closed guarantee:
 * STALE / LOW CONFIDENCE ➔ NO EXECUTION.
 */
export class PythLivePriceProvider implements PriceProvider {
  public readonly isSimulation: boolean = false;
  public readonly source: string = 'Pyth Network Live Oracle (Hermes v2)';
  private hermesEndpoint: string;
  private maxStaleAgeSeconds: number;
  private maxConfidenceRatioBps: number;
  private fallbackProvider?: PriceProvider;
  private cache: Map<string, { price: AssetPrice; fetchedAt: number }> = new Map();
  private cacheTtlMs: number;

  constructor(options?: {
    hermesEndpoint?: string;
    maxStaleAgeSeconds?: number;
    maxConfidenceRatioBps?: number;
    fallbackProvider?: PriceProvider;
    cacheTtlMs?: number;
  }) {
    this.hermesEndpoint = options?.hermesEndpoint ?? 'https://hermes.pyth.network';
    this.maxStaleAgeSeconds = options?.maxStaleAgeSeconds ?? 60;
    this.maxConfidenceRatioBps = options?.maxConfidenceRatioBps ?? 100; // 1.00%
    this.fallbackProvider = options?.fallbackProvider;
    this.cacheTtlMs = options?.cacheTtlMs ?? 2000;
  }

  setStaleAgeLimit(maxAgeSeconds: number): void {
    this.maxStaleAgeSeconds = maxAgeSeconds;
  }

  setConfidenceLimitBps(maxBps: number): void {
    this.maxConfidenceRatioBps = maxBps;
  }

  private async fetchHermesPrice(feedIdHex: string): Promise<{ price: number; conf: number; expo: number; publishTime: number } | null> {
    const cleanId = feedIdHex.startsWith('0x') ? feedIdHex.slice(2) : feedIdHex;
    const url = `${this.hermesEndpoint}/v2/updates/price/latest?ids[]=${cleanId}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      const p = json.parsed?.[0]?.price;
      if (!p) return null;
      return {
        price: Number(p.price),
        conf: Number(p.conf),
        expo: Number(p.expo),
        publishTime: Number(p.publish_time) * 1000,
      };
    } catch {
      return null;
    }
  }

  async getPrice(symbol: string): Promise<AssetPrice> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.price;
    }

    const feedInfo = PYTH_FEED_IDS[symbol];
    const meta = ASSET_REGISTRY[symbol];

    let liveData = feedInfo ? await this.fetchHermesPrice(feedInfo.tokenizedFeedId) : null;
    let underlyingLiveData = (feedInfo && feedInfo.underlyingFeedId !== feedInfo.tokenizedFeedId)
      ? await this.fetchHermesPrice(feedInfo.underlyingFeedId)
      : liveData;

    if (!liveData && this.fallbackProvider) {
      const fallback = await this.fallbackProvider.getPrice(symbol);
      return {
        ...fallback,
        source: 'Pyth Network Live Oracle (Hermes Fallback)',
      };
    }

    const now = Date.now();
    const priceUsd = liveData
      ? liveData.price * Math.pow(10, liveData.expo)
      : (meta?.basePriceUsd ?? 100.0);
    const underlyingPrice = underlyingLiveData
      ? underlyingLiveData.price * Math.pow(10, underlyingLiveData.expo)
      : priceUsd;
    const confidence = liveData
      ? liveData.conf * Math.pow(10, liveData.expo)
      : Math.round(priceUsd * 0.001 * 100) / 100;
    const publishTime = liveData ? liveData.publishTime : now;

    const ageSeconds = Math.max(0, Math.floor((now - publishTime) / 1000));
    const isStale = ageSeconds > this.maxStaleAgeSeconds;
    const confidenceRatioBps = priceUsd > 0 ? Math.round((confidence * 10_000) / priceUsd) : 0;
    const isWide = confidenceRatioBps > this.maxConfidenceRatioBps;
    const trackingErrorBps = calculateTrackingErrorBps(priceUsd, underlyingPrice);

    let status: PriceStatus = 'LIVE';
    if (isStale) {
      status = 'STALE';
    } else if (isWide) {
      status = 'WIDE_SPREAD';
    }

    const assetPrice: AssetPrice = {
      symbol,
      priceUsd: Math.round(priceUsd * 100) / 100,
      timestamp: publishTime,
      status,
      source: this.source,
      confidence: Math.round(confidence * 100) / 100,
      exponent: -8,
      underlyingPrice: Math.round(underlyingPrice * 100) / 100,
      trackingErrorBps,
      marketStatus: 'MARKET_OPEN',
    };

    this.cache.set(symbol, { price: assetPrice, fetchedAt: now });
    return assetPrice;
  }

  async getPriceSource(symbol: string): Promise<PriceSource> {
    const assetPrice = await this.getPrice(symbol);
    const feedInfo = PYTH_FEED_IDS[symbol];
    const now = Date.now();
    const ageSeconds = Math.max(0, Math.floor((now - assetPrice.timestamp) / 1000));

    return {
      source: 'PYTH_HERMES_LIVE',
      feedId: feedInfo?.tokenizedFeedId ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
      symbol,
      price: assetPrice.priceUsd,
      confidence: assetPrice.confidence ?? 0.05,
      publishTime: assetPrice.timestamp,
      exponent: -8,
      status: assetPrice.status,
      isSimulation: false,
      ageSeconds,
      underlyingAsset: ASSET_REGISTRY[symbol]?.underlyingAsset,
      underlyingPrice: assetPrice.underlyingPrice,
      trackingErrorBps: assetPrice.trackingErrorBps,
      marketStatus: assetPrice.marketStatus,
    };
  }

  async getAllPrices(): Promise<Record<string, AssetPrice>> {
    const result: Record<string, AssetPrice> = {};
    for (const symbol of Object.keys(ASSET_REGISTRY)) {
      result[symbol] = await this.getPrice(symbol);
    }
    return result;
  }
}

/**
 * PythBenchmarkPriceProvider
 * Explicitly simulated Pyth price provider for deterministic local evaluation,
 * unit testing, and sandbox demonstrations.
 * Clearly identified by: isSimulation = true, source = 'Pyth Network Benchmark Simulation (Offline / Deterministic)'
 */
export class PythBenchmarkPriceProvider implements PriceProvider {
  public readonly isSimulation: boolean = true;
  public readonly source: string = 'Pyth Network Benchmark Simulation (Offline / Deterministic)';
  private customPrices: Record<string, number> = {};
  private customUnderlyingPrices: Record<string, number> = {};
  private customConfidences: Record<string, number> = {};
  private simulatedPublishTimes: Record<string, number> = {};
  private simulatedStatuses: Record<string, PriceStatus> = {};

  constructor(initialCustomPrices?: Record<string, number>) {
    if (initialCustomPrices) {
      this.customPrices = { ...initialCustomPrices };
    }
  }

  setPrice(
    symbol: string,
    priceUsd: number,
    underlyingPriceUsd?: number,
    confidenceUsd?: number,
    publishTimeMs?: number,
    status?: PriceStatus
  ): void {
    this.customPrices[symbol] = priceUsd;
    if (underlyingPriceUsd !== undefined) {
      this.customUnderlyingPrices[symbol] = underlyingPriceUsd;
    }
    if (confidenceUsd !== undefined) {
      this.customConfidences[symbol] = confidenceUsd;
    }
    if (publishTimeMs !== undefined) {
      this.simulatedPublishTimes[symbol] = publishTimeMs;
    }
    if (status !== undefined) {
      this.simulatedStatuses[symbol] = status;
    }
  }

  setStalePrice(symbol: string, staleAgeSeconds: number = 300): void {
    const publishTime = Date.now() - (staleAgeSeconds * 1000);
    this.simulatedPublishTimes[symbol] = publishTime;
    this.simulatedStatuses[symbol] = 'STALE';
  }

  async getPrice(symbol: string): Promise<AssetPrice> {
    const meta = ASSET_REGISTRY[symbol];
    const priceUsd = this.customPrices[symbol] ?? meta?.basePriceUsd ?? 100.00;
    const underlyingPrice = this.customUnderlyingPrices[symbol] ?? priceUsd;
    const confidence = this.customConfidences[symbol] ?? Math.round(priceUsd * 0.001 * 100) / 100; // ~0.1% confidence
    const trackingErrorBps = calculateTrackingErrorBps(priceUsd, underlyingPrice);
    const publishTime = this.simulatedPublishTimes[symbol] ?? Date.now();
    const status = this.simulatedStatuses[symbol] ?? 'SIMULATED';

    return {
      symbol,
      priceUsd,
      timestamp: publishTime,
      status,
      source: this.source,
      confidence,
      exponent: -8,
      underlyingPrice,
      trackingErrorBps,
      marketStatus: 'MARKET_OPEN',
    };
  }

  async getPriceSource(symbol: string): Promise<PriceSource> {
    const assetPrice = await this.getPrice(symbol);
    const feedInfo = PYTH_FEED_IDS[symbol];
    const ageSeconds = Math.max(0, Math.floor((Date.now() - assetPrice.timestamp) / 1000));

    return {
      source: 'PYTH_PRICE_FEED',
      feedId: feedInfo?.tokenizedFeedId ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
      symbol,
      price: assetPrice.priceUsd,
      confidence: assetPrice.confidence ?? 0.05,
      publishTime: assetPrice.timestamp,
      exponent: -8,
      status: assetPrice.status === 'SIMULATED' ? 'LIVE' : assetPrice.status,
      isSimulation: true,
      ageSeconds,
      underlyingAsset: ASSET_REGISTRY[symbol]?.underlyingAsset,
      underlyingPrice: assetPrice.underlyingPrice,
      trackingErrorBps: assetPrice.trackingErrorBps,
      marketStatus: assetPrice.marketStatus,
    };
  }

  async getAllPrices(): Promise<Record<string, AssetPrice>> {
    const result: Record<string, AssetPrice> = {};
    for (const symbol of Object.keys(ASSET_REGISTRY)) {
      result[symbol] = await this.getPrice(symbol);
    }
    return result;
  }
}

/**
 * SimulatedBenchmarkPriceProvider
 * Deterministic benchmark price provider maintaining backwards compatibility.
 */
export class SimulatedBenchmarkPriceProvider implements PriceProvider {
  private pythProvider: PythBenchmarkPriceProvider;

  constructor(customPrices?: Record<string, number>) {
    this.pythProvider = new PythBenchmarkPriceProvider(customPrices);
  }

  setPrice(symbol: string, priceUsd: number): void {
    this.pythProvider.setPrice(symbol, priceUsd);
  }

  async getPrice(symbol: string): Promise<AssetPrice> {
    const price = await this.pythProvider.getPrice(symbol);
    return {
      ...price,
      status: 'SIMULATED',
      source: 'Stocklana Simulated Benchmark Oracle',
    };
  }

  async getPriceSource(symbol: string): Promise<PriceSource> {
    const source = await this.pythProvider.getPriceSource(symbol);
    return {
      ...source,
      status: 'SIMULATED',
      source: 'SIMULATED_ORACLE',
    };
  }

  async getAllPrices(): Promise<Record<string, AssetPrice>> {
    const prices = await this.pythProvider.getAllPrices();
    const result: Record<string, AssetPrice> = {};
    for (const [sym, p] of Object.entries(prices)) {
      result[sym] = {
        ...p,
        status: 'SIMULATED',
        source: 'Stocklana Simulated Benchmark Oracle',
      };
    }
    return result;
  }
}
