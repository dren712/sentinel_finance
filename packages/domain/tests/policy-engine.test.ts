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
});
