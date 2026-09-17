import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../src/client';
import {
  getAssetUniverse,
  getAssetCategory,
  evaluateAssetClassAllocations,
  evaluatePostconditions,
  evaluatePortfolioVerifier,
} from '@sentinel/domain';

describe('Phase 11 — PreStocks: Asset Universe, Portfolio Builder & Asset Class Policies', () => {
  const client = new SentinelClient();

  describe('1. Asset Universe Taxonomy', () => {
    it('structures assets into canonical tripartite universe: Public Equities, Pre-IPO, and Stable', () => {
      const universe = getAssetUniverse();

      // Category 1: Public Equities
      assert.ok(universe.PUBLIC_EQUITIES);
      assert.strictEqual(universe.PUBLIC_EQUITIES.displayName, 'Public Equities');
      assert.strictEqual(universe.PUBLIC_EQUITIES.defaultMaxExposureBps, 7000); // 70%
      const publicSymbols = universe.PUBLIC_EQUITIES.assets.map(a => a.symbol);
      assert.ok(publicSymbols.includes('AAPLx'));
      assert.ok(publicSymbols.includes('NVDAx'));
      assert.ok(publicSymbols.includes('SPYx'));

      // Category 2: Pre-IPO (PreStocks)
      assert.ok(universe.PRE_IPO);
      assert.strictEqual(universe.PRE_IPO.displayName, 'Pre-IPO (PreStocks)');
      assert.strictEqual(universe.PRE_IPO.defaultMaxExposureBps, 2000); // 20%
      const preIpoSymbols = universe.PRE_IPO.assets.map(a => a.symbol);
      assert.ok(preIpoSymbols.includes('SPACEXx'));
      assert.ok(preIpoSymbols.includes('OPENAIx'));
      assert.ok(preIpoSymbols.includes('STRIPEx'));
      for (const asset of universe.PRE_IPO.assets) {
        assert.strictEqual(asset.issuer, 'PreStocks Protocol');
        assert.strictEqual(asset.assetClass, 'PRE_IPO');
      }

      // Category 3: Stable Reserve
      assert.ok(universe.STABLE);
      assert.strictEqual(universe.STABLE.displayName, 'Stablecoin Reserve');
      assert.strictEqual(universe.STABLE.assets[0].symbol, 'USDC');
    });

    it('accurately categorizes any registered or prospective asset symbol', () => {
      assert.strictEqual(getAssetCategory('AAPLx'), 'PUBLIC_EQUITIES');
      assert.strictEqual(getAssetCategory('NVDAx'), 'PUBLIC_EQUITIES');
      assert.strictEqual(getAssetCategory('SPYx'), 'PUBLIC_EQUITIES');
      assert.strictEqual(getAssetCategory('SPACEXx'), 'PRE_IPO');
      assert.strictEqual(getAssetCategory('OPENAIx'), 'PRE_IPO');
      assert.strictEqual(getAssetCategory('STRIPEx'), 'PRE_IPO');
      assert.strictEqual(getAssetCategory('USDC'), 'STABLE');
    });
  });

  describe('2. Asset Class Policy Understanding & Verification', () => {
    it('evaluates multi-asset portfolio compliance across Public Equities <= 70%, Pre-IPO <= 20%, Stable >= 10%', () => {
      // PreStocks balanced portfolio ($100k NAV):
      // 60% Public Equities ($60k), 15% Pre-IPO ($15k), 25% USDC ($25k)
      const portfolio = client.createPreStocksPortfolio();
      const policy = client.createPreStocksPolicy();

      assert.strictEqual(policy.maxPublicEquitiesExposureBps, 7000); // <= 70%
      assert.strictEqual(policy.maxPreIpoExposureBps, 2000);         // <= 20%
      assert.strictEqual(policy.minStablecoinBps, 1000);            // >= 10%

      const report = evaluateAssetClassAllocations(portfolio, policy);

      assert.strictEqual(report.allPassed, true);
      assert.strictEqual(report.publicEquities.passed, true);
      assert.strictEqual(report.publicEquities.exposureBps, 6000); // 60.00%
      assert.strictEqual(report.preIpo.passed, true);
      assert.strictEqual(report.preIpo.exposureBps, 1500);         // 15.00%
      assert.strictEqual(report.stable.passed, true);
      assert.strictEqual(report.stable.exposureBps, 2500);         // 25.00%
    });

    it('SWARM PortfolioVerifier evaluates both Pre-IPO and Public Equities subchecks', () => {
      const portfolio = client.createPreStocksPortfolio();
      const policy = client.createPreStocksPolicy();

      const verdict = evaluatePortfolioVerifier(portfolio, policy);
      assert.strictEqual(verdict.passed, true);
      assert.ok(verdict.subChecks);

      const preIpoSubcheck = verdict.subChecks.find(c => c.name === 'Pre-IPO Exposure');
      assert.ok(preIpoSubcheck);
      assert.strictEqual(preIpoSubcheck.passed, true);
      assert.strictEqual(preIpoSubcheck.actual, '15.0% projected');
      assert.strictEqual(preIpoSubcheck.limit, '≤ 20.0%');

      const publicEqSubcheck = verdict.subChecks.find(c => c.name === 'Public Equities Exposure');
      assert.ok(publicEqSubcheck);
      assert.strictEqual(publicEqSubcheck.passed, true);
      assert.strictEqual(publicEqSubcheck.actual, '60.0% projected');
      assert.strictEqual(publicEqSubcheck.limit, '≤ 70.0%');
    });
  });

  describe('3. Sentinel Invariant Enforcement on PreStocks Private Equities', () => {
    it('blocks trade if Pre-IPO allocation would breach 20% ceiling', async () => {
      const portfolio = client.createPreStocksPortfolio(); // already has $15,000 (15%) in Pre-IPO
      const policy = client.createPreStocksPolicy();

      // Propose buying $10,000 of SpaceX -> would push Pre-IPO to $25,000 (25% > 20% limit)
      const intent = client.getAgent().proposePreIpoIntent({
        assetSymbol: 'SPACEXx',
        tradeAmountUsd: 10_000,
        referencePriceUsd: 140.0,
      });

      const outcome = evaluatePostconditions(portfolio, intent, policy);
      assert.strictEqual(outcome.allPassed, false);

      const failedPreIpoCheck = outcome.checks.find(c => c.checkName === 'MAX_PRE_IPO_EXPOSURE');
      assert.ok(failedPreIpoCheck);
      assert.strictEqual(failedPreIpoCheck.passed, false);
      assert.ok(failedPreIpoCheck.description.includes('Pre-IPO exposure ceiling exceeded'));
    });

    it('blocks trade if Public Equities allocation would breach 70% ceiling', async () => {
      const portfolio = client.createPreStocksPortfolio(); // 60% public equities
      const policy = client.createPreStocksPolicy();

      // Propose buying $15,000 of AAPLx -> would push public equities to $75,000 (75% > 70% limit)
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'AAPLx',
        assetMint: 'AAPL111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15_000,
        referencePriceUsd: 180.0,
        strategyRationale: 'Aggressive AAPLx overweight attempt',
      });

      const outcome = evaluatePostconditions(portfolio, intent, policy);
      assert.strictEqual(outcome.allPassed, false);

      const failedPublicCheck = outcome.checks.find(c => c.checkName === 'MAX_PUBLIC_EQUITIES_EXPOSURE');
      assert.ok(failedPublicCheck);
      assert.strictEqual(failedPublicCheck.passed, false);
      assert.ok(failedPublicCheck.description.includes('Public equities exposure ceiling exceeded'));
    });
  });

  describe('4. Autonomous Robo Strategy Materially Uses PreStocks', () => {
    it('agent autonomously calculates compliant trade amount for Pre-IPO stocks under 20% limit', () => {
      const portfolio = client.createPreStocksPortfolio(); // has $15k Pre-IPO ($5k SpaceX, $5k OpenAI, $5k Stripe)
      const policy = client.createPreStocksPolicy(); // 20% Pre-IPO cap ($20k), 25% single asset cap ($25k)

      // Available Pre-IPO headroom = $20,000 - $15,000 = $5,000
      const agent = client.getAgent();
      const compliantAmount = agent.calculateCompliantTradeAmount(portfolio, policy, 'SPACEXx');

      assert.strictEqual(compliantAmount, 5000);
    });

    it('executes full decision cycle for compliant PreStocks trade routing through PreStocks Secondary', async () => {
      const portfolio = client.createPreStocksPortfolio();
      const policy = client.createPreStocksPolicy();

      // Compliant $5,000 SpaceX allocation
      const compliantIntent = client.getAgent().proposePreIpoIntent({
        assetSymbol: 'SPACEXx',
        tradeAmountUsd: 5000,
        referencePriceUsd: 140.0,
      });

      client.setExecutionVenue('PRESTOCKS_SECONDARY');
      const report = await client.executeDecisionCycle(portfolio, policy, compliantIntent);
      assert.strictEqual(report.status, 'SETTLED');
      assert.strictEqual(report.executionResult?.venueType, 'PRESTOCKS_SECONDARY');
      assert.ok(report.executionResult?.route.includes('PreStocks Secondary Vault'));
      assert.strictEqual(report.resultingPortfolio.totalValueUsd, 100000);

      // Post-trade Pre-IPO exposure is exactly 20.00% ($20,000 / $100,000)
      const postReport = evaluateAssetClassAllocations(report.resultingPortfolio, policy);
      assert.strictEqual(postReport.preIpo.exposureBps, 2000);
      assert.strictEqual(postReport.preIpo.passed, true);
    });
  });

  describe('5. Build Your Portfolio Custom Construction', () => {
    it('builds a custom verified portfolio projection with genuine ATAs across all 3 asset classes', () => {
      const customPortfolio = client.buildPortfolio({
        AAPLx: 25_000,
        NVDAx: 25_000,
        SPACEXx: 10_000,
        STRIPEx: 10_000,
        USDC: 30_000,
      }, 100_000);

      assert.strictEqual(customPortfolio.totalValueUsd, 100000);
      assert.strictEqual(customPortfolio.stablecoinValueUsd, 30000);
      assert.strictEqual(customPortfolio.stablecoinExposureBps, 3000);
      assert.strictEqual(customPortfolio.assets.length, 5);

      // Check genuine SPL ATA derivation for each asset
      for (const asset of customPortfolio.assets) {
        assert.ok(asset.ata);
        assert.strictEqual(asset.ata.length > 30, true);
      }

      // Check SHA-256 state hash
      assert.ok(customPortfolio.projectionHash);
      assert.strictEqual(customPortfolio.projectionHash.length, 64);
    });
  });
});
