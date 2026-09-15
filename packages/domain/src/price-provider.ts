import { ASSET_REGISTRY } from './asset-registry';

export type PriceStatus = 'LIVE' | 'STALE' | 'SIMULATED' | 'UNAVAILABLE';

export interface AssetPrice {
  symbol: string;
  priceUsd: number;
  timestamp: number;
  status: PriceStatus;
  source: string;
}

export interface PriceProvider {
  getPrice(symbol: string): Promise<AssetPrice>;
  getAllPrices(): Promise<Record<string, AssetPrice>>;
}

/**
 * Deterministic benchmark price provider for tokenized stocks.
 * Explicitly marks all prices as SIMULATED to comply with transparency rules.
 */
export class SimulatedBenchmarkPriceProvider implements PriceProvider {
  private customPrices: Record<string, number> = {};

  constructor(customPrices?: Record<string, number>) {
    if (customPrices) {
      this.customPrices = { ...customPrices };
    }
  }

  setPrice(symbol: string, priceUsd: number): void {
    this.customPrices[symbol] = priceUsd;
  }

  async getPrice(symbol: string): Promise<AssetPrice> {
    const meta = ASSET_REGISTRY[symbol];
    const priceUsd = this.customPrices[symbol] ?? meta?.basePriceUsd ?? 100.00;

    return {
      symbol,
      priceUsd,
      timestamp: Date.now(),
      status: 'SIMULATED',
      source: 'Stocklana Simulated Benchmark Oracle',
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
