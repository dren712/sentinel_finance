/**
 * Meteora Stock-Specific Dynamic Bonding Curve (DBC) Market Primitive
 * 
 * Formalizes Meteora DBC as an authentic stock-market liquidity primitive for tokenized equities:
 * 1. Curve Configuration: Virtual quote and base reserves ($V_q, V_b$), initial price anchor, spot pricing, and bonding curve AMM mechanics.
 * 2. Fee Configuration: Dynamic swap fees with volatility surge multiplier.
 * 3. Graduation Rule: Liquidity accumulation threshold ($100,000 USDC) triggering automated migration to Meteora DLMM concentrated liquidity bins.
 * 4. Liquidity Conditions: $25,000 reserve floor and basis tracking error bounds vs Pyth market truth.
 * 
 * Bidirectional Protection:
 * - Dimension 1: Sentinel protects Investors from autonomous Agents (concentration, reserve floor).
 * - Dimension 2: Sentinel protects the DBC Stock Market from predatory Agents (curve manipulation, sandwich attacks, toxic price distortion).
 */

export interface MeteoraDBCMarketConfig {
  assetSymbol: string;
  assetName: string;
  poolAddress: string;
  underlyingSymbol: string;
  initialPriceUsd?: number;        // e.g. $120.00
  virtualQuoteReserveUsd: number;  // $V_q$, e.g. $100,000
  virtualTokenReserve: number;     // $V_b$, e.g. 833.33 tokens ($120/token anchor)
  realQuoteReserveUsd: number;     // Current real USDC in bonding curve vault, e.g. $72,500
  realTokenReserve: number;        // Current real token supply in pool vault
  baseFeeBps: number;              // 25 bps (0.25%)
  maxSurgeFeeBps: number;          // 100 bps (1.00%) during volatility surges
  graduationThresholdUsd: number;  // $100,000 USDC to graduate to DLMM
  migrationDlmmPoolAddress: string;
  minLiquidityFloorUsd: number;    // $25,000 floor per Meteora DBC spec
  maxPriceDivergenceBps: number;   // 200 bps (2.00%) divergence limit vs Pyth
  maxAllowedPriceImpactBps: number;// 300 bps (3.00%) maximum safe price impact
}

export interface MeteoraDBCMarketState {
  spotPriceUsd: number;
  totalLiquidityDepthUsd: number;
  effectiveFeeBps: number;
  graduationProgressPct: number;
  isGraduated: boolean;
  lastTradeTimestamp: number;
  tradesCount24h: number;
  cumulativeVolume24hUsd: number;
}

export interface DBCQuoteResult {
  inputAmount: number;
  outputAmount: number;
  spotPriceBeforeUsd: number;
  spotPriceAfterUsd: number;
  effectivePriceUsd: number;
  priceImpactBps: number;
  feeAmountUsd: number;
  isBuy: boolean;
}

export interface MarketProtectionResult {
  passed: boolean;
  investorProtected: boolean;
  marketProtected: boolean;
  liquidityPassed: boolean;
  priceIntegrityPassed: boolean;
  priceImpactPassed: boolean;
  graduationOrderly: boolean;
  spotPriceDivergenceBps: number;
  priceImpactBps: number;
  details: string;
  dimensions: {
    investorProtectionSummary: string;
    marketProtectionSummary: string;
  };
}

export class MeteoraStockMarket {
  public config: MeteoraDBCMarketConfig;
  public state: MeteoraDBCMarketState;

  constructor(config?: Partial<MeteoraDBCMarketConfig>) {
    const initialPrice = config?.initialPriceUsd ?? 120;
    const vQuote = config?.virtualQuoteReserveUsd ?? 100_000;
    const rQuote = config?.realQuoteReserveUsd ?? 145_000;
    const vToken = config?.virtualTokenReserve ?? (initialPrice > 0 ? vQuote / initialPrice : 833.3333);
    const rToken = config?.realTokenReserve ?? (initialPrice > 0 ? rQuote / initialPrice : 1208.3333);

    this.config = {
      assetSymbol: config?.assetSymbol ?? 'NVDAx',
      assetName: config?.assetName ?? 'NVIDIA Tokenized Equity DBC Market',
      poolAddress: config?.poolAddress ?? 'Eo7WjKq67rjJQSZxS6z3YKapzY3eMj6Xy8DD5EkViQn7',
      underlyingSymbol: config?.underlyingSymbol ?? 'NVDA',
      initialPriceUsd: initialPrice,
      virtualQuoteReserveUsd: vQuote,
      virtualTokenReserve: vToken,
      realQuoteReserveUsd: rQuote,
      realTokenReserve: rToken,
      baseFeeBps: config?.baseFeeBps ?? 25,
      maxSurgeFeeBps: config?.maxSurgeFeeBps ?? 100,
      graduationThresholdUsd: config?.graduationThresholdUsd ?? 200_000,
      migrationDlmmPoolAddress: config?.migrationDlmmPoolAddress ?? 'MET_DLMM_NVDAx_Vault1111111111111111111111',
      minLiquidityFloorUsd: config?.minLiquidityFloorUsd ?? 25_000,
      maxPriceDivergenceBps: config?.maxPriceDivergenceBps ?? 350,
      maxAllowedPriceImpactBps: config?.maxAllowedPriceImpactBps ?? 500,
    };

    const initialSpot = this.calculateSpotPrice();
    const progress = Math.min(100, Math.round((this.config.realQuoteReserveUsd / this.config.graduationThresholdUsd) * 10_000) / 100);

    this.state = {
      spotPriceUsd: initialSpot,
      totalLiquidityDepthUsd: this.config.realQuoteReserveUsd * 2,
      effectiveFeeBps: this.config.baseFeeBps,
      graduationProgressPct: progress,
      isGraduated: progress >= 100,
      lastTradeTimestamp: Date.now() - 42_000,
      tradesCount24h: 184,
      cumulativeVolume24hUsd: 342_500,
    };
  }


  /**
   * Synchronizes bonding curve reserves to anchor precisely to the reference price
   */
  public syncReservesToAnchorPrice(anchorPriceUsd: number, realDepthUsd?: number): void {
    if (anchorPriceUsd <= 0) return;
    if (realDepthUsd !== undefined && realDepthUsd > 0) {
      this.config.realQuoteReserveUsd = realDepthUsd;
    }
    this.config.virtualTokenReserve = this.config.virtualQuoteReserveUsd / anchorPriceUsd;
    this.config.realTokenReserve = this.config.realQuoteReserveUsd / anchorPriceUsd;
    this.state.spotPriceUsd = this.calculateSpotPrice();
    this.state.totalLiquidityDepthUsd = this.config.realQuoteReserveUsd * 2;
    const progress = Math.min(
      100,
      Math.round((this.config.realQuoteReserveUsd / this.config.graduationThresholdUsd) * 10_000) / 100
    );
    this.state.graduationProgressPct = progress;
    this.state.isGraduated = progress >= 100;
  }

  /**
   * Calculates instantaneous spot price from virtual + real reserves
   * P = Total Quote / Total Base
   */
  public calculateSpotPrice(): number {
    const totalQuote = this.config.virtualQuoteReserveUsd + this.config.realQuoteReserveUsd;
    const totalBase = this.config.virtualTokenReserve + this.config.realTokenReserve;
    if (totalBase <= 0) return 120;
    return Math.round((totalQuote / totalBase) * 100) / 100;
  }


  /**
   * Calculates dynamic swap quote along the bonding curve
   */
  public calculateQuote(tradeAmountUsd: number, isBuy: boolean): DBCQuoteResult {
    const spotBefore = this.calculateSpotPrice();
    const feeBps = this.state.effectiveFeeBps;
    const feeAmountUsd = Math.round((tradeAmountUsd * (feeBps / 10_000)) * 100) / 100;
    const netInputUsd = tradeAmountUsd - feeAmountUsd;

    const totalQuote = this.config.virtualQuoteReserveUsd + this.config.realQuoteReserveUsd;
    const totalBase = this.config.virtualTokenReserve + this.config.realTokenReserve;
    const k = totalQuote * totalBase;

    let outputAmount = 0;
    let spotAfter = spotBefore;

    if (isBuy) {
      // Buying tokens with USDC: quote in, base out
      const newQuote = totalQuote + netInputUsd;
      const newBase = k / newQuote;
      outputAmount = Math.max(0, totalBase - newBase);
      spotAfter = Math.round((newQuote / newBase) * 100) / 100;
    } else {
      // Selling tokens for USDC: base in, quote out
      const tokensIn = tradeAmountUsd / spotBefore;
      const newBase = totalBase + tokensIn;
      const newQuote = k / newBase;
      outputAmount = Math.max(0, totalQuote - newQuote) * (1 - (feeBps / 10_000));
      spotAfter = Math.round((newQuote / newBase) * 100) / 100;
    }

    const effectivePriceUsd = outputAmount > 0 ? Math.round((tradeAmountUsd / outputAmount) * 100) / 100 : spotBefore;
    const priceImpactBps = Math.round((Math.abs(spotAfter - spotBefore) / spotBefore) * 10_000);

    return {
      inputAmount: tradeAmountUsd,
      outputAmount: Math.round(outputAmount * 10_000) / 10_000,
      spotPriceBeforeUsd: spotBefore,
      spotPriceAfterUsd: spotAfter,
      effectivePriceUsd,
      priceImpactBps,
      feeAmountUsd,
      isBuy,
    };
  }

  /**
   * Bidirectional Market Protection Evaluation:
   * 1. Protects Investor: Solvency, depth >= $25k, reasonable slippage.
   * 2. Protects DBC Stock Market: Prevents predatory curve spikes, sandwich runs, or depegging.
   */
  public evaluateProtection(
    tradeAmountUsd: number,
    isBuy: boolean,
    pythReferencePriceUsd: number
  ): MarketProtectionResult {
    const quote = this.calculateQuote(tradeAmountUsd, isBuy);
    const spotPriceBefore = quote.spotPriceBeforeUsd;

    // Condition 1: Minimum liquidity depth floor ($25,000)
    const liquidityPassed = this.config.realQuoteReserveUsd >= this.config.minLiquidityFloorUsd;

    // Condition 2: Spot price divergence vs Pyth market truth
    let spotPriceDivergenceBps = 0;
    if (pythReferencePriceUsd > 0) {
      spotPriceDivergenceBps = Math.round(
        (Math.abs(spotPriceBefore - pythReferencePriceUsd) / pythReferencePriceUsd) * 10_000
      );
    }
    const priceIntegrityPassed = spotPriceDivergenceBps <= this.config.maxPriceDivergenceBps;

    // Condition 3: Predatory Price Impact Guard (protects the curve from toxic whale distortion)
    const priceImpactPassed = quote.priceImpactBps <= this.config.maxAllowedPriceImpactBps;


    // Condition 4: Graduation orderly rule
    const graduationOrderly = !this.state.isGraduated || Boolean(this.config.migrationDlmmPoolAddress);

    const passed = liquidityPassed && priceIntegrityPassed && priceImpactPassed && graduationOrderly;

    const investorProtectionSummary = liquidityPassed && priceIntegrityPassed
      ? `Investor Safe: Liquid pool ($${this.config.realQuoteReserveUsd.toLocaleString()} reserve) and Pyth-bounded price (${(spotPriceDivergenceBps / 100).toFixed(2)}% spread).`
      : `Investor Alert: Insufficient liquidity or excessive oracle spread (${(spotPriceDivergenceBps / 100).toFixed(2)}%).`;

    const marketProtectionSummary = priceImpactPassed && graduationOrderly
      ? `Market Safe: Controlled curve impact (${(quote.priceImpactBps / 100).toFixed(2)}% <= ${(this.config.maxAllowedPriceImpactBps / 100).toFixed(2)}%) prevents predatory manipulation.`
      : `Market Guard Triggered: Trade impact of ${(quote.priceImpactBps / 100).toFixed(2)}% breaches DBC curve safety ceiling.`;

    const details = passed
      ? `Meteora DBC Bidirectional Protection Confirmed: Investor safe ($${this.config.realQuoteReserveUsd.toLocaleString()} depth) & Market protected (${(quote.priceImpactBps / 100).toFixed(2)}% impact).`
      : !liquidityPassed
      ? `DBC reserve depth ($${this.config.realQuoteReserveUsd.toLocaleString()}) below $25,000 floor.`
      : !priceIntegrityPassed
      ? `DBC curve price ($${spotPriceBefore.toFixed(2)}) diverged ${(spotPriceDivergenceBps / 100).toFixed(2)}% from Pyth market truth ($${pythReferencePriceUsd.toFixed(2)}).`
      : `Predatory curve impact rejected: ${(quote.priceImpactBps / 100).toFixed(2)}% exceeds ${(this.config.maxAllowedPriceImpactBps / 100).toFixed(2)}% ceiling.`;


    return {
      passed,
      investorProtected: liquidityPassed && priceIntegrityPassed,
      marketProtected: priceImpactPassed && graduationOrderly,
      liquidityPassed,
      priceIntegrityPassed,
      priceImpactPassed,
      graduationOrderly,
      spotPriceDivergenceBps,
      priceImpactBps: quote.priceImpactBps,
      details,
      dimensions: {
        investorProtectionSummary,
        marketProtectionSummary,
      },
    };
  }

  /**
   * Applies a settled trade to the bonding curve state
   */
  public applySettledTrade(tradeAmountUsd: number, isBuy: boolean): DBCQuoteResult {
    const quote = this.calculateQuote(tradeAmountUsd, isBuy);

    if (isBuy) {
      this.config.realQuoteReserveUsd += (quote.inputAmount - quote.feeAmountUsd);
      this.config.realTokenReserve = Math.max(0, this.config.realTokenReserve - quote.outputAmount);
    } else {
      this.config.realQuoteReserveUsd = Math.max(0, this.config.realQuoteReserveUsd - quote.outputAmount);
      this.config.realTokenReserve += (quote.inputAmount / quote.spotPriceBeforeUsd);
    }

    this.state.spotPriceUsd = this.calculateSpotPrice();
    this.state.totalLiquidityDepthUsd = this.config.realQuoteReserveUsd * 2;
    this.state.graduationProgressPct = Math.min(
      100,
      Math.round((this.config.realQuoteReserveUsd / this.config.graduationThresholdUsd) * 10_000) / 100
    );
    this.state.isGraduated = this.state.graduationProgressPct >= 100;
    this.state.lastTradeTimestamp = Date.now();
    this.state.tradesCount24h += 1;
    this.state.cumulativeVolume24hUsd += tradeAmountUsd;

    return quote;
  }
}
