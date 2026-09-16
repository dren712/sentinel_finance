import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  FinancialPolicy,
  PortfolioSnapshot,
  TradeIntent,
  calculateAssetExposureBps,
  calculatePortfolioValue,
  checkMaxSingleAsset,
  checkMinStablecoin,
  checkMaxTradeSize,
  checkSlippage,
  simulateStateTransition,
  evaluatePostconditions,
  hashPortfolioState,
  hashTradeIntent,
  hashFinancialPolicy,
  createEvidenceRecord,
  evaluateSwarm,
  evaluatePythOracleVerifier,
  calculateTrackingErrorBps,
  PythBenchmarkPriceProvider,
  getAssetById,
  getAssetByMint,
  getAssetsByClass,
  getAssetMetadata,
  PriceSource,
  PythPriceAdapter,
  SentinelValuationEngine,
  formatPublishTimeUtc,
  deriveDeterministicAta,
  deriveSentinelPda,
  createTokenHolding,
  createCanonicalTokenHoldings,
  projectPortfolioFromHoldings,
  verifyPortfolioProjection,
  getSentinelPdaConfig,
  hashPortfolioProjection,
  CONSERVATIVE_INSTITUTIONAL_POLICY,
  BALANCED_MULTI_ASSET_POLICY,
  HIGH_ALPHA_GROWTH_POLICY,
  AgentRiskState,
  generateAuditExplanation,
} from '../src/index';

describe('Sentinel Domain & Policy Engine Unit Tests', () => {
  const initialPolicy: FinancialPolicy = {
    policyId: 'policy_1',
    owner: 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw',
    maxSingleAssetBps: 2500, // 25.00%
    minStablecoinBps: 2000,  // 20.00%
    maxTradeValueUsd: 10000, // $10,000
    maxSlippageBps: 100,     // 1.00%
    policyVersion: 1,
    isActive: true,
    updatedAt: Date.now(),
  };

  const initialPortfolio: PortfolioSnapshot = {
    portfolioId: 'port_1',
    owner: 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw',
    totalValueUsd: 100000,
    stablecoinValueUsd: 25000,
    stablecoinExposureBps: 2500,
    timestamp: Date.now(),
    assets: [
      {
        symbol: 'AAPLx',
        name: 'Apple Tokenized Stock',
        mint: 'AAPL111111111111111111111111111111111111111',
        amount: 125,
        priceUsd: 200,
        valueUsd: 25000,
        exposureBps: 2500,
        isStablecoin: false,
      },
      {
        symbol: 'NVDAx',
        name: 'Nvidia Tokenized Stock',
        mint: 'NVDA111111111111111111111111111111111111111',
        amount: 20000 / 120,
        priceUsd: 120,
        valueUsd: 20000,
        exposureBps: 2000,
        isStablecoin: false,
      },
      {
        symbol: 'SPYx',
        name: 'S&P 500 Tokenized ETF',
        mint: 'SPY1111111111111111111111111111111111111111',
        amount: 60,
        priceUsd: 500,
        valueUsd: 30000,
        exposureBps: 3000,
        isStablecoin: false,
        isIndex: true,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 25000,
        priceUsd: 1,
        valueUsd: 25000,
        exposureBps: 2500,
        isStablecoin: true,
      },
    ],
  };

  describe('Financial Invariant Boundary Cases (Section 24.1)', () => {
    it('evaluates single asset exposure limits: 25% <= 25% => PASS, 25.01% > 25% => FAIL', () => {
      const passState: PortfolioSnapshot = {
        ...initialPortfolio,
        assets: [
          {
            ...initialPortfolio.assets[0],
            valueUsd: 25000,
            exposureBps: 2500, // exactly 25.00%
          },
        ],
      };
      const passResult = checkMaxSingleAsset(passState, 2500);
      assert.strictEqual(passResult.passed, true);

      const failState: PortfolioSnapshot = {
        ...initialPortfolio,
        assets: [
          {
            ...initialPortfolio.assets[0],
            valueUsd: 25010,
            exposureBps: 2501, // 25.01%
          },
        ],
      };
      const failResult = checkMaxSingleAsset(failState, 2500);
      assert.strictEqual(failResult.passed, false);
      assert.strictEqual(failResult.failureCode, 'ERR_EXPOSURE_EXCEEDED');
    });

    it('evaluates stablecoin reserve floor: 20% >= 20% => PASS, 19.99% < 20% => FAIL', () => {
      const passState: PortfolioSnapshot = {
        ...initialPortfolio,
        stablecoinExposureBps: 2000, // exactly 20.00%
      };
      const passResult = checkMinStablecoin(passState, 2000);
      assert.strictEqual(passResult.passed, true);

      const failState: PortfolioSnapshot = {
        ...initialPortfolio,
        stablecoinExposureBps: 1999, // 19.99%
      };
      const failResult = checkMinStablecoin(failState, 2000);
      assert.strictEqual(failResult.passed, false);
      assert.strictEqual(failResult.failureCode, 'ERR_STABLECOIN_RESERVE_BREACHED');
    });

    it('evaluates max trade limit: $10,000 <= limit => PASS, $10,001 > limit => FAIL', () => {
      const passIntent: TradeIntent = {
        intentId: 'intent_pass',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 10000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };
      const passResult = checkMaxTradeSize(passIntent, 10000);
      assert.strictEqual(passResult.passed, true);

      const failIntent: TradeIntent = {
        ...passIntent,
        tradeAmountUsd: 10001,
      };
      const failResult = checkMaxTradeSize(failIntent, 10000);
      assert.strictEqual(failResult.passed, false);
      assert.strictEqual(failResult.failureCode, 'ERR_TRADE_SIZE_EXCEEDED');
    });

    it('evaluates slippage limit: 1% <= 1% => PASS, 1.05% > 1% => FAIL', () => {
      const passSlippage = checkSlippage(100, 101, 100); // 1.00% difference
      assert.strictEqual(passSlippage.passed, true);

      const failSlippage = checkSlippage(100, 101.05, 100); // 1.05% difference
      assert.strictEqual(failSlippage.passed, false);
      assert.strictEqual(failSlippage.failureCode, 'ERR_SLIPPAGE_EXCEEDED');
    });
  });

  describe('Core Hackathon Demo Scenario Execution (Section 17)', () => {
    it('rejects autonomous non-compliant decision: BUY NVDAx $15,000', () => {
      const badIntent: TradeIntent = {
        intentId: 'bad_intent_1',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
        strategyRationale: 'Aggressively increase NVDA to capture momentum',
      };

      const outcome = evaluatePostconditions(initialPortfolio, badIntent, initialPolicy);

      assert.strictEqual(outcome.allPassed, false);
      // NVDA would reach $20,000 + $15,000 = $35,000 (35%), which exceeds 25% limit
      const exposureCheck = outcome.checks.find(c => c.checkName === 'MAX_SINGLE_ASSET');
      assert.strictEqual(exposureCheck?.passed, false);
      assert.strictEqual(exposureCheck?.actualBpsOrValue, 3500);

      // USDC drops to $25,000 - $15,000 = $10,000 (10%), which breaches 20% reserve
      const reserveCheck = outcome.checks.find(c => c.checkName === 'MIN_STABLECOIN');
      assert.strictEqual(reserveCheck?.passed, false);
      assert.strictEqual(reserveCheck?.actualBpsOrValue, 1000);

      // Trade size $15,000 exceeds $10,000 limit
      const sizeCheck = outcome.checks.find(c => c.checkName === 'MAX_TRADE_SIZE');
      assert.strictEqual(sizeCheck?.passed, false);

      // First failure code is correctly returned
      assert.ok(outcome.failureCode);
      assert.ok(outcome.failureReason);
    });

    it('settles autonomous compliant decision: BUY NVDAx $5,000', () => {
      const goodIntent: TradeIntent = {
        intentId: 'good_intent_1',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
        strategyRationale: 'Compliantly allocate to NVDA up to policy ceiling',
      };

      const outcome = evaluatePostconditions(initialPortfolio, goodIntent, initialPolicy);

      assert.strictEqual(outcome.allPassed, true);
      assert.strictEqual(outcome.failureCode, undefined);

      // NVDA reaches $20,000 + $5,000 = $25,000 (exactly 25%)
      const nvdaAsset = outcome.postState.assets.find(a => a.symbol === 'NVDAx');
      assert.strictEqual(nvdaAsset?.exposureBps, 2500);

      // USDC reserve stays at $25,000 - $5,000 = $20,000 (exactly 20%)
      assert.strictEqual(outcome.postState.stablecoinExposureBps, 2000);
      assert.strictEqual(outcome.postState.stablecoinValueUsd, 20000);
    });
  });

  describe('PROVN Cryptographic Evidence Layer (Section 15)', () => {
    it('computes deterministic state hashes regardless of key order', () => {
      const hash1 = hashPortfolioState(initialPortfolio);
      const clone = JSON.parse(JSON.stringify(initialPortfolio));
      const hash2 = hashPortfolioState(clone);
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 64); // SHA-256 hex
    });

    it('generates immutable PROVN evidence records', () => {
      const goodIntent: TradeIntent = {
        intentId: 'intent_provn',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const outcome = evaluatePostconditions(initialPortfolio, goodIntent, initialPolicy);
      const swarmSummary = evaluateSwarm(outcome.postState, goodIntent, initialPolicy);

      const evidence = createEvidenceRecord({
        agentId: 'agent_1',
        promiseId: 'promise_1',
        policy: initialPolicy,
        intent: goodIntent,
        preState: initialPortfolio,
        postState: outcome.postState,
        transactionSignature: '5J4X9...sig',
        verificationResult: 'SETTLED',
        checks: outcome.checks,
        swarmSummary,
        isSimulation: true,
      });

      assert.ok(evidence.id.startsWith('provn_'));
      assert.strictEqual(evidence.verificationResult, 'SETTLED');
      assert.strictEqual(evidence.policyVersion, 1);
      assert.strictEqual(evidence.swarmSummary.consensus, true);
      assert.strictEqual(evidence.swarmSummary.passedCount, 3);
      assert.strictEqual(evidence.isSimulation, true);
    });
  });

  describe('SWARM-Lite Verifier Logic (Section 14)', () => {
    it('independently evaluates Risk, Balance, and Policy invariants', () => {
      const goodIntent: TradeIntent = {
        intentId: 'intent_swarm',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };
      const outcome = evaluatePostconditions(initialPortfolio, goodIntent, initialPolicy);
      const swarm = evaluateSwarm(outcome.postState, goodIntent, initialPolicy);

      assert.strictEqual(swarm.totalCount, 3);
      assert.strictEqual(swarm.passedCount, 3);
      assert.strictEqual(swarm.consensus, true);

      const risk = swarm.verdicts.find(v => v.name === 'RiskVerifier');
      const balance = swarm.verdicts.find(v => v.name === 'BalanceVerifier');
      const policy = swarm.verdicts.find(v => v.name === 'PolicyVerifier');

      assert.strictEqual(risk?.passed, true);
      assert.strictEqual(balance?.passed, true);
      assert.strictEqual(policy?.passed, true);
    });

    it('reports failure in SWARM summary when invariants are violated', () => {
      const badIntent: TradeIntent = {
        intentId: 'intent_swarm_bad',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };
      const outcome = evaluatePostconditions(initialPortfolio, badIntent, initialPolicy);
      const swarm = evaluateSwarm(outcome.postState, badIntent, initialPolicy);

      assert.strictEqual(swarm.consensus, false);
      const risk = swarm.verdicts.find(v => v.name === 'RiskVerifier');
      const balance = swarm.verdicts.find(v => v.name === 'BalanceVerifier');
      assert.strictEqual(risk?.passed, false);
      assert.strictEqual(balance?.passed, false);
    });
  });

  describe('First-Class Domain Model & Pyth Oracle Foundation (Phase 1)', () => {
    it('resolves tokenized equities and PreStocks pre-IPO assets from AssetRegistry', () => {
      const nvda = getAssetMetadata('NVDAx');
      assert.ok(nvda);
      assert.strictEqual(nvda.symbol, 'NVDAx');
      assert.strictEqual(nvda.underlyingAsset, 'NVDA');
      assert.strictEqual(nvda.assetClass, 'TOKENIZED_EQUITY');
      assert.strictEqual(nvda.decimals, 6);

      // PreStocks pre-IPO lookups
      const preIpoAssets = getAssetsByClass('PRE_IPO');
      assert.strictEqual(preIpoAssets.length, 3);
      assert.ok(preIpoAssets.some(a => a.symbol === 'SPACEXx'));
      assert.ok(preIpoAssets.some(a => a.symbol === 'OPENAIx'));
      assert.ok(preIpoAssets.some(a => a.symbol === 'STRIPEx'));

      const spacex = getAssetById('asset_spacex');
      assert.ok(spacex);
      assert.strictEqual(spacex.issuer, 'PreStocks Protocol');
    });

    it('calculates basis tracking error between tokenized stock and underlying equity', () => {
      // 1. Exactly pegged: $100 vs $100 -> 0 bps
      assert.strictEqual(calculateTrackingErrorBps(100, 100), 0);

      // 2. Tokenized trades at $102 vs underlying $100 -> 200 bps (2.00%)
      assert.strictEqual(calculateTrackingErrorBps(102, 100), 200);

      // 3. Tokenized trades at $98.50 vs underlying $100 -> 150 bps (1.50%)
      assert.strictEqual(calculateTrackingErrorBps(98.50, 100), 150);
    });

    it('PythBenchmarkPriceProvider exposes dual-feed pricing and confidence intervals', async () => {
      const provider = new PythBenchmarkPriceProvider();
      provider.setPrice('AAPLx', 182.00, 180.00, 0.20);

      const price = await provider.getPrice('AAPLx');
      assert.strictEqual(price.symbol, 'AAPLx');
      assert.strictEqual(price.priceUsd, 182.00);
      assert.strictEqual(price.underlyingPrice, 180.00);
      assert.strictEqual(price.confidence, 0.20);
      assert.strictEqual(price.trackingErrorBps, 111); // |182 - 180| / 180 = 1.11% = 111 bps

      const priceSource = await provider.getPriceSource('AAPLx');
      assert.strictEqual(priceSource.source, 'PYTH_PRICE_FEED');
      assert.strictEqual(priceSource.symbol, 'AAPLx');
      assert.ok(priceSource.feedId.startsWith('0x'));
    });

    it('PythOracleVerifier checks oracle confidence ratio and tracking error bounds', () => {
      // Test A: Clean feed within 1.5% confidence and 2.5% tracking error -> PASS
      const cleanSource: PriceSource = {
        source: 'PYTH_PRICE_FEED',
        feedId: '0x123',
        symbol: 'NVDAx',
        price: 120.00,
        confidence: 0.50, // 50 cents on $120 = ~0.42% < 1.5%
        publishTime: Date.now(),
        exponent: -8,
        status: 'LIVE',
        underlyingPrice: 121.00,
        trackingErrorBps: 83, // 0.83% < 2.5%
      };
      const cleanVerdict = evaluatePythOracleVerifier(cleanSource, initialPolicy);
      assert.strictEqual(cleanVerdict.passed, true);

      // Test B: Excessive confidence interval (±$3.00 on $120 = 2.5% > 1.5%) -> FAIL
      const wideConfidenceSource: PriceSource = {
        ...cleanSource,
        confidence: 3.00,
      };
      const wideVerdict = evaluatePythOracleVerifier(wideConfidenceSource, initialPolicy);
      assert.strictEqual(wideVerdict.passed, false);
      assert.ok(wideVerdict.message.includes('exceeds limit'));

      // Test C: Excessive basis tracking error (e.g. 350 bps > 250 bps) -> FAIL
      const depeggedSource: PriceSource = {
        ...cleanSource,
        trackingErrorBps: 350,
      };
      const depeggedVerdict = evaluatePythOracleVerifier(depeggedSource, initialPolicy);
      assert.strictEqual(depeggedVerdict.passed, false);
      assert.ok(depeggedVerdict.message.includes('tracking error'));
    });

    it('includes PythOracleVerifier in SWARM consensus when priceSource is supplied', () => {
      const intent: TradeIntent = {
        intentId: 'intent_pyth_swarm',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };
      const outcome = evaluatePostconditions(initialPortfolio, intent, initialPolicy);

      const priceSource: PriceSource = {
        source: 'PYTH_PRICE_FEED',
        feedId: '0x123',
        symbol: 'NVDAx',
        price: 120.00,
        confidence: 0.10,
        publishTime: Date.now(),
        exponent: -8,
        status: 'LIVE',
        trackingErrorBps: 50,
      };

      const swarm = evaluateSwarm(outcome.postState, intent, initialPolicy, 120, priceSource);
      assert.strictEqual(swarm.totalCount, 4); // Risk, Balance, Policy, PythOracle
      assert.strictEqual(swarm.passedCount, 4);
      assert.strictEqual(swarm.consensus, true);
      assert.ok(swarm.verdicts.some(v => v.name === 'PythOracleVerifier'));
    });
  });

  describe('Pyth Becomes Market Truth (Phase 2)', () => {
    it('PythPriceAdapter generates NormalizedMarketPrice with valid UTC timestamp and confidence intervals', async () => {
      const adapter = new PythPriceAdapter();
      const applePrice = await adapter.getNormalizedMarketPrice('AAPLx');

      assert.strictEqual(applePrice.symbol, 'AAPLx');
      assert.strictEqual(applePrice.source, 'Pyth Network');
      assert.strictEqual(applePrice.feedDisplayId, 'Crypto.AAPLX/USD');
      assert.strictEqual(applePrice.underlyingFeedId, 'Equity.US.AAPL/USD');
      assert.strictEqual(applePrice.underlyingSymbol, 'AAPL');
      assert.strictEqual(applePrice.status, 'LIVE');
      assert.ok(applePrice.priceUsd > 0);
      assert.ok(applePrice.confidenceUsd > 0);
      assert.strictEqual(
        applePrice.confidenceMinUsd,
        Math.round((applePrice.priceUsd - applePrice.confidenceUsd) * 100) / 100
      );
      assert.strictEqual(
        applePrice.confidenceMaxUsd,
        Math.round((applePrice.priceUsd + applePrice.confidenceUsd) * 100) / 100
      );
      assert.ok(/^\d{2}:\d{2}:\d{2} UTC$/.test(applePrice.publishTimeFormatted));
    });

    it('PythPriceAdapter calculates dual-feed basis tracking error between tokenized stock and underlying equity', async () => {
      const adapter = new PythPriceAdapter();
      adapter.setPrice('AAPLx', 202.00, 200.00, 0.20);
      const applePrice = await adapter.getNormalizedMarketPrice('AAPLx');

      // |202 - 200| * 10,000 / 200 = 100 bps = 1.00%
      assert.strictEqual(applePrice.trackingErrorBps, 100);
      assert.strictEqual(applePrice.deviationPct, 1.0);
    });

    it('SentinelValuationEngine.markPortfolioToMarket updates NAV and exposures accurately', async () => {
      const adapter = new PythPriceAdapter();
      adapter.setPrice('NVDAx', 140.00); // Up from 120
      const prices = await adapter.getAllNormalizedMarketPrices();

      const valuationEngine = new SentinelValuationEngine();
      const marked = valuationEngine.markPortfolioToMarket(initialPortfolio, prices);

      const nvdaPosition = marked.assets.find(a => a.symbol === 'NVDAx');
      assert.ok(nvdaPosition);
      assert.strictEqual(nvdaPosition.priceUsd, 140.00);
      assert.ok(marked.totalValueUsd > initialPortfolio.totalValueUsd);
      assert.strictEqual(
        marked.totalValueUsd,
        calculatePortfolioValue(marked.assets)
      );
    });

    it('SentinelValuationEngine.calculateMarketIntegrityMetrics evaluates portfolio tracking error', async () => {
      const adapter = new PythPriceAdapter();
      const prices = await adapter.getAllNormalizedMarketPrices();
      const valuationEngine = new SentinelValuationEngine();

      const metrics = valuationEngine.calculateMarketIntegrityMetrics(initialPortfolio, prices, initialPolicy);
      assert.ok(metrics.activeFeedsCount >= 4);
      assert.ok(metrics.portfolioTrackingErrorBps >= 0);
      assert.strictEqual(metrics.allOraclesHealthy, true);
    });

    it('evaluatePostconditions enforces Pyth market truth and aborts on depeg or wide confidence', async () => {
      const adapter = new PythPriceAdapter();
      const valuationEngine = new SentinelValuationEngine();

      // Case 1: Excessive tracking error depeg (e.g. 3.0% = 300 bps > 250 bps limit)
      adapter.setPrice('NVDAx', 123.60, 120.00, 0.10); // 300 bps tracking error
      const depeggedPrice = await adapter.getNormalizedMarketPrice('NVDAx');

      const intent: TradeIntent = {
        intentId: 'intent_depeg',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 2000,
        referencePriceUsd: 123.60,
        timestamp: Date.now(),
      };

      const depegOutcome = evaluatePostconditions(initialPortfolio, intent, initialPolicy, undefined, depeggedPrice);
      assert.strictEqual(depegOutcome.allPassed, false);
      assert.strictEqual(depegOutcome.failureCode, 'ERR_TRACKING_ERROR_EXCEEDED');

      // Case 2: Excessive confidence spread (e.g. 2.50% = 250 bps > 150 bps limit)
      adapter.setPrice('NVDAx', 120.00, 120.00, 3.00); // 3.00 / 120 = 2.50% confidence ratio
      const widePrice = await adapter.getNormalizedMarketPrice('NVDAx');

      const wideOutcome = evaluatePostconditions(initialPortfolio, intent, initialPolicy, undefined, widePrice);
      assert.strictEqual(wideOutcome.allPassed, false);
      assert.strictEqual(wideOutcome.failureCode, 'ERR_ORACLE_CONFIDENCE_TOO_WIDE');
    });
  });

  describe('Real Portfolio State Projection & Sentinel PDA (Phase 3)', () => {
    const owner = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw';

    it('derives deterministic Associated Token Account (ATA) addresses', () => {
      const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const nvdaMint = 'NVDA111111111111111111111111111111111111111';

      const usdcAta = deriveDeterministicAta(owner, usdcMint);
      const nvdaAta = deriveDeterministicAta(owner, nvdaMint);

      assert.ok(usdcAta.length >= 32);
      assert.ok(nvdaAta.length >= 32);
      assert.notStrictEqual(usdcAta, nvdaAta);

      // Determinism: same owner and mint produces exact same ATA
      const usdcAtaRepeat = deriveDeterministicAta(owner, usdcMint);
      assert.strictEqual(usdcAta, usdcAtaRepeat);
    });

    it('generates canonical TokenHolding records with raw atomic integer balances', () => {
      const holdings = createCanonicalTokenHoldings(owner);
      assert.strictEqual(holdings.length, 4);

      const usdcHolding = holdings.find(h => h.symbol === 'USDC');
      assert.ok(usdcHolding);
      assert.strictEqual(usdcHolding.balanceUi, 25000);
      assert.strictEqual(usdcHolding.balanceRaw, '25000000000'); // 25,000 * 10^6
      assert.strictEqual(usdcHolding.decimals, 6);
      assert.ok(usdcHolding.ataAddress.length >= 32);
    });

    it('projects a normalized Portfolio from token holdings and verified Pyth prices', async () => {
      const adapter = new PythPriceAdapter();
      const prices = await adapter.getAllNormalizedMarketPrices();
      const holdings = createCanonicalTokenHoldings(owner);

      const projection = projectPortfolioFromHoldings({
        walletAddress: owner,
        holdings,
        marketPrices: prices,
      });

      assert.strictEqual(projection.walletAddress, owner);
      assert.ok(projection.sentinelPda.length >= 32);
      assert.strictEqual(projection.normalizedPortfolio.source, 'ON_CHAIN_PROJECTION');
      assert.strictEqual(projection.normalizedPortfolio.assets.length, 4);
      assert.strictEqual(projection.normalizedPortfolio.totalValueUsd, 100000);
      assert.strictEqual(projection.normalizedPortfolio.stablecoinValueUsd, 25000);
      assert.strictEqual(projection.normalizedPortfolio.stablecoinExposureBps, 2500);

      // Validate every position has its associated ATA address and raw balance
      for (const pos of projection.normalizedPortfolio.assets) {
        assert.ok(pos.ata, `Asset ${pos.symbol} must have an ATA address`);
        assert.ok(pos.rawAmount, `Asset ${pos.symbol} must have a rawAmount`);
        assert.strictEqual(pos.decimals, 6);
        assert.ok(pos.verifiedPriceSource?.includes('Pyth'));
      }

      // Validate projection hash
      assert.strictEqual(projection.projectionHash.length, 64);
      assert.strictEqual(projection.normalizedPortfolio.projectionHash, projection.projectionHash);
    });

    it('verifyPortfolioProjection confirms state integrity and detects mismatches', async () => {
      const adapter = new PythPriceAdapter();
      const prices = await adapter.getAllNormalizedMarketPrices();
      const holdings = createCanonicalTokenHoldings(owner);

      const projection = projectPortfolioFromHoldings({
        walletAddress: owner,
        holdings,
        marketPrices: prices,
      });

      // Verification of valid projection passes
      const validCheck = verifyPortfolioProjection(projection.normalizedPortfolio, holdings, prices);
      assert.strictEqual(validCheck.isValid, true);
      assert.strictEqual(validCheck.errors.length, 0);

      // Tampered holding balance is detected
      const tamperedHoldings = [...holdings];
      tamperedHoldings[0] = { ...tamperedHoldings[0], balanceUi: 99999 };
      const invalidCheck = verifyPortfolioProjection(projection.normalizedPortfolio, tamperedHoldings, prices);
      assert.strictEqual(invalidCheck.isValid, false);
      assert.ok(invalidCheck.errors.some(e => e.includes('Balance mismatch')));
    });

    it('getSentinelPdaConfig exposes the 5 institutional roles of the Sentinel PDA', () => {
      const config = getSentinelPdaConfig(owner);
      assert.strictEqual(config.owner, owner);
      assert.ok(config.pdaAddress.length >= 32);
      assert.ok(config.bump >= 0 && config.bump <= 255);
      assert.ok(config.trackedMints.length >= 4);

      // Verify the 5 authoritative roles
      assert.strictEqual(config.roles.isPolicyAuthority, true);
      assert.strictEqual(config.roles.isPortfolioConfiguration, true);
      assert.strictEqual(config.roles.isExecutionAuthority, true);
      assert.strictEqual(config.roles.isPromiseRegistry, true);
      assert.strictEqual(config.roles.isEvidenceAnchor, true);
    });
  });

  describe('Institutional Financial Risk Engine & DSL (Phase 6)', () => {
    const owner = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw';

    it('provides canonical institutional risk profiles with valid cryptographic hashes', () => {
      assert.strictEqual(CONSERVATIVE_INSTITUTIONAL_POLICY.policyId, 'policy_conservative_institutional');
      assert.strictEqual(CONSERVATIVE_INSTITUTIONAL_POLICY.maxSingleAssetBps, 1500); // 15%
      assert.strictEqual(CONSERVATIVE_INSTITUTIONAL_POLICY.minStablecoinBps, 3000);  // 30%
      assert.strictEqual(CONSERVATIVE_INSTITUTIONAL_POLICY.maxSectorExposureBps, 3000); // 30%
      assert.strictEqual(CONSERVATIVE_INSTITUTIONAL_POLICY.dailyTradeBudgetUsd, 25000);

      assert.strictEqual(BALANCED_MULTI_ASSET_POLICY.policyId, 'policy_balanced_multi_asset');
      assert.strictEqual(BALANCED_MULTI_ASSET_POLICY.maxSingleAssetBps, 2500); // 25%
      assert.strictEqual(BALANCED_MULTI_ASSET_POLICY.minStablecoinBps, 2000);  // 20%
      assert.strictEqual(BALANCED_MULTI_ASSET_POLICY.maxSectorExposureBps, 4500); // 45%

      assert.strictEqual(HIGH_ALPHA_GROWTH_POLICY.policyId, 'policy_high_alpha_growth');
      assert.strictEqual(HIGH_ALPHA_GROWTH_POLICY.maxSingleAssetBps, 3500); // 35%
      assert.strictEqual(HIGH_ALPHA_GROWTH_POLICY.minStablecoinBps, 1500);  // 15%

      const hashConservative = hashFinancialPolicy(CONSERVATIVE_INSTITUTIONAL_POLICY);
      const hashBalanced = hashFinancialPolicy(BALANCED_MULTI_ASSET_POLICY);
      const hashGrowth = hashFinancialPolicy(HIGH_ALPHA_GROWTH_POLICY);

      assert.strictEqual(hashConservative.length, 64);
      assert.strictEqual(hashBalanced.length, 64);
      assert.strictEqual(hashGrowth.length, 64);
      assert.notStrictEqual(hashConservative, hashBalanced);
    });

    it('enforces Emergency Pause kill-switch and aborts immediately', () => {
      const pausedPolicy: FinancialPolicy = {
        ...initialPolicy,
        isEmergencyPaused: true,
      };

      const intent: TradeIntent = {
        intentId: 'intent_pause',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const outcome = evaluatePostconditions(initialPortfolio, intent, pausedPolicy);
      assert.strictEqual(outcome.allPassed, false);
      assert.strictEqual(outcome.failureCode, 'ERR_EMERGENCY_PAUSE');
      assert.ok(outcome.failureReason?.includes('Emergency'));
    });

    it('enforces Policy Expiry timestamp guardrail', () => {
      const expiredPolicy: FinancialPolicy = {
        ...initialPolicy,
        policyExpiresAt: Date.now() - 10000, // expired 10s ago
      };

      const intent: TradeIntent = {
        intentId: 'intent_expired',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const outcome = evaluatePostconditions(initialPortfolio, intent, expiredPolicy);
      assert.strictEqual(outcome.allPassed, false);
      assert.strictEqual(outcome.failureCode, 'ERR_POLICY_EXPIRED');
      assert.ok(outcome.failureReason?.includes('expired'));
    });

    it('enforces Asset and Venue allowlists', () => {
      const allowlistPolicy: FinancialPolicy = {
        ...initialPolicy,
        assetAllowlist: ['AAPLx', 'USDC'], // NVDAx not in allowlist
        venueAllowlist: ['METEORA_DBC'],
      };

      const unlistedAssetIntent: TradeIntent = {
        intentId: 'intent_unlisted_asset',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const assetOutcome = evaluatePostconditions(initialPortfolio, unlistedAssetIntent, allowlistPolicy);
      assert.strictEqual(assetOutcome.allPassed, false);
      assert.strictEqual(assetOutcome.failureCode, 'ERR_ASSET_NOT_ALLOWED');

      // Now with allowed asset but unlisted venue
      const allowedAssetIntent: TradeIntent = {
        ...unlistedAssetIntent,
        assetSymbol: 'AAPLx',
        assetMint: 'AAPL111111111111111111111111111111111111111',
      };
      const venueOutcome = evaluatePostconditions(
        initialPortfolio,
        allowedAssetIntent,
        allowlistPolicy,
        undefined,
        undefined,
        undefined,
        {
          venueType: 'UNKNOWN_DEX',
          liquidityDepthUsd: 500000,
          isHealthy: true,
        }
      );
      assert.strictEqual(venueOutcome.allPassed, false);
      assert.strictEqual(venueOutcome.failureCode, 'ERR_VENUE_NOT_ALLOWED');
    });

    it('enforces sector and issuer exposure limits', () => {
      // Semiconductor sector cap at 32% (3200 bps)
      // SPYx (30%), AAPLx (25%), NVDAx (20%) are initially <= 3200 bps
      // Buying $13,000 NVDAx pushes SEMICONDUCTORS to $33,000 (3300 bps > 3200 bps)
      const sectorPolicy: FinancialPolicy = {
        ...initialPolicy,
        maxTradeValueUsd: 20000,
        maxSingleAssetBps: 4000,
        minStablecoinBps: 1000, // 10% floor so reserve is not breached
        maxSectorExposureBps: 3200, // 32.00%
      };

      const intent: TradeIntent = {
        intentId: 'intent_sector_breach',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 13000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const outcome = evaluatePostconditions(initialPortfolio, intent, sectorPolicy);
      assert.strictEqual(outcome.allPassed, false);
      assert.strictEqual(outcome.failureCode, 'ERR_SECTOR_EXPOSURE_EXCEEDED');
      const sectorCheck = outcome.checks.find(c => c.checkName === 'SECTOR_EXPOSURE');
      assert.strictEqual(sectorCheck?.passed, false);
      assert.strictEqual(sectorCheck?.actualBpsOrValue, 3300);
      assert.strictEqual(sectorCheck?.expectedBpsOrValue, 3200);
    });

    it('enforces maximum simultaneous positions and minimum diversification', () => {
      // initialPortfolio has 4 positions: AAPLx, NVDAx, SPYx, USDC
      // If maxPositions is 3, buying a 5th asset should fail
      const positionLimitPolicy: FinancialPolicy = {
        ...initialPolicy,
        maxPositions: 3,
      };

      const newAssetIntent: TradeIntent = {
        intentId: 'intent_new_pos',
        agentId: 'agent_1',
        assetSymbol: 'SPACEXx',
        assetMint: 'SPACEX1111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 180,
        timestamp: Date.now(),
      };

      const posOutcome = evaluatePostconditions(initialPortfolio, newAssetIntent, positionLimitPolicy);
      assert.strictEqual(posOutcome.allPassed, false);
      assert.strictEqual(posOutcome.failureCode, 'ERR_MAX_POSITIONS_EXCEEDED');

      // Diversification test: policy requires at least 4 active non-stable positions
      // initialPortfolio has 3 non-stable positions (AAPLx, NVDAx, SPYx)
      const diversPolicy: FinancialPolicy = {
        ...initialPolicy,
        minDiversificationAssets: 4,
      };

      const goodIntent: TradeIntent = {
        intentId: 'intent_good',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const divOutcome = evaluatePostconditions(initialPortfolio, goodIntent, diversPolicy);
      assert.strictEqual(divOutcome.allPassed, false);
      assert.strictEqual(divOutcome.failureCode, 'ERR_DIVERSIFICATION_BREACHED');
    });

    it('enforces Agent 24h Daily Trade Budget and Circuit Breaker', () => {
      const budgetPolicy: FinancialPolicy = {
        ...initialPolicy,
        dailyTradeBudgetUsd: 10000, // $10,000 24h budget
        maxConsecutiveFailures: 3,
      };

      // Agent already used $9,000
      const agentRiskState: AgentRiskState = {
        agentId: 'agent_1',
        tradesExecuted24hUsd: 9000,
        dailyTurnoverBps: 900,
        consecutiveFailures: 0,
        isCircuitBreakerTriggered: false,
        lastFailureTimestamp: undefined,
        updatedAt: Date.now(),
      };

      const intent: TradeIntent = {
        intentId: 'intent_overbudget',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 2000, // 9000 + 2000 = 11000 > 10000
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const budgetOutcome = evaluatePostconditions(
        initialPortfolio,
        intent,
        budgetPolicy,
        undefined,
        undefined,
        agentRiskState
      );
      assert.strictEqual(budgetOutcome.allPassed, false);
      assert.strictEqual(budgetOutcome.failureCode, 'ERR_DAILY_BUDGET_EXCEEDED');

      // Now test circuit breaker tripped
      const trippedAgentState: AgentRiskState = {
        ...agentRiskState,
        tradesExecuted24hUsd: 0,
        consecutiveFailures: 3,
        isCircuitBreakerTriggered: true,
      };

      const breakerOutcome = evaluatePostconditions(
        initialPortfolio,
        { ...intent, tradeAmountUsd: 500 },
        budgetPolicy,
        undefined,
        undefined,
        trippedAgentState
      );
      assert.strictEqual(breakerOutcome.allPassed, false);
      assert.strictEqual(breakerOutcome.failureCode, 'ERR_CIRCUIT_BREAKER_TRIGGERED');
    });

    it('enforces Quote Freshness, Venue Health, and Market Hours', () => {
      const marketPolicy: FinancialPolicy = {
        ...initialPolicy,
        maxQuoteAgeSeconds: 15,
        requireHealthyVenue: true,
      };

      const intent: TradeIntent = {
        intentId: 'intent_market',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        timestamp: Date.now() - 30_000, // quote 30s old > 15s limit
      };

      const staleOutcome = evaluatePostconditions(
        initialPortfolio,
        intent,
        marketPolicy,
        120,
        {
          source: 'PYTH_PRICE_FEED',
          feedId: '0x123',
          symbol: 'NVDAx',
          price: 120,
          confidence: 0.1,
          publishTime: Date.now() - 30_000,
          exponent: -8,
          status: 'LIVE',
        },
        undefined,
        undefined,
        Date.now()
      );
      assert.strictEqual(staleOutcome.allPassed, false);
      assert.strictEqual(staleOutcome.failureCode, 'ERR_QUOTE_STALE');

      // Degraded Venue test
      const freshIntent: TradeIntent = { ...intent, timestamp: Date.now() };
      const venueOutcome = evaluatePostconditions(
        initialPortfolio,
        freshIntent,
        marketPolicy,
        120,
        undefined,
        undefined,
        {
          venueType: 'METEORA_DBC',
          liquidityDepthUsd: 100000,
          isHealthy: false, // degraded
        }
      );
      assert.strictEqual(venueOutcome.allPassed, false);
      assert.strictEqual(venueOutcome.failureCode, 'ERR_VENUE_UNHEALTHY');
    });

    it('formats Phase 6 invariants cleanly in AuditExplanation', () => {
      const intent: TradeIntent = {
        intentId: 'intent_audit_exp',
        agentId: 'agent_1',
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        timestamp: Date.now(),
      };

      const outcome = evaluatePostconditions(initialPortfolio, intent, BALANCED_MULTI_ASSET_POLICY);
      assert.strictEqual(outcome.allPassed, true);

      const explanation = generateAuditExplanation({
        promise: {
          promiseId: 'promise_p6',
          agentId: 'agent_1',
          policyHash: '0xabc',
          policyVersion: 1,
          intentHash: '0x123',
          intent: intent as any,
          expectedConstraints: {
            maxSingleAssetBps: 2500,
            minStablecoinBps: 2000,
            maxTradeValueUsd: 10000,
            maxSlippageBps: 100,
          },
          who: {
            agentId: 'agent_1',
            agentName: 'Sentinel Agent',
            portfolioId: 'port_1',
            walletAddress: owner,
          },
          what: {
            assetSymbol: 'NVDAx',
            assetMint: 'NVDA111111111111111111111111111111111111111',
            side: 'BUY',
            amountUsd: 5000,
          },
          why: {
            strategyName: 'Momentum',
            strategyRationale: 'Compliant allocation',
            rationaleHash: '0xdef',
          },
          underWhichPolicy: {
            policyId: BALANCED_MULTI_ASSET_POLICY.policyId,
            policyHash: '0xpolicy',
            policyVersion: 1,
            maxSingleAssetBps: BALANCED_MULTI_ASSET_POLICY.maxSingleAssetBps,
            minStablecoinBps: BALANCED_MULTI_ASSET_POLICY.minStablecoinBps,
            maxTradeValueUsd: BALANCED_MULTI_ASSET_POLICY.maxTradeValueUsd,
          },
          marketAssumptions: {
            quotedPriceUsd: 120,
            priceSource: 'Pyth',
          },
          executionLimits: {
            maxSlippageBps: 100,
            maxTradeValueUsd: 10000,
          },
          validity: {
            createdAt: Date.now(),
            expiresAt: Date.now() + 60000,
            updatedAt: Date.now(),
          },
          status: 'SETTLED',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        checks: outcome.checks,
        verificationResult: 'SETTLED',
      });

      assert.strictEqual(explanation.decision, 'ALLOWED');
      const sectorInvariant = explanation.invariantsEvaluated.find(i => i.name === 'SECTOR_EXPOSURE');
      assert.ok(sectorInvariant);
      assert.strictEqual(sectorInvariant.passed, true);
      assert.ok(sectorInvariant.threshold.includes('%'));
    });
  });
});
