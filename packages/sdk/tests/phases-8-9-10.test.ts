import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../src/client';
import { MeteoraStockMarket } from '@sentinel/domain';

describe('Phases 8, 9, 10 — Autonomous Adaptation, Sentinel Receipts & Meteora DBC Market', () => {
  const client = new SentinelClient();
  const portfolio = client.createDefaultPortfolio();
  const policy = client.createDefaultPolicy();

  describe('Phase 8: Agent Actually Adapts (Autonomous Reactive Loop)', () => {
    it('executes full 10-stage autonomous reactive adaptation loop', async () => {
      const recordedStages: string[] = [];
      const result = await client.runAutonomousAdaptation(
        portfolio,
        policy,
        'NVDAx',
        15_000,
        (state) => {
          recordedStages.push(state.stage);
        }
      );

      // Verify the 10 stages were traversed in order
      const expectedStages = [
        'OBSERVE',
        'FORMULATE',
        'PROPOSE',
        'SENTINEL_CHECK',
        'REJECTED',
        'READ_FAILURE',
        'ADAPT',
        'REPROPOSE',
        'SENTINEL_RECHECK',
        'SETTLED',
      ];
      assert.strictEqual(recordedStages.length, 10);
      assert.deepStrictEqual(recordedStages, expectedStages);

      // Verify initial proposed trade was $15,000 and rejected
      assert.strictEqual(result.step1RejectedDecision.status, 'REJECTED');
      assert.strictEqual(result.step1RejectedDecision.intent.tradeAmountUsd, 15_000);
      assert.strictEqual(result.step1RejectedDecision.evaluation.allPassed, false);

      // Verify breached invariants identified during READ_FAILURE
      const breachedInvariants = result.adaptationDetails.breachedInvariants;
      assert.ok(breachedInvariants.length >= 2);
      const breaches = breachedInvariants.map(b => b.name);
      assert.ok(breaches.includes('NVDAx exposure'));
      assert.ok(breaches.includes('Reserve'));

      // Verify mathematical adaptation to exactly $5,000
      assert.strictEqual(result.adaptationDetails.initialAmountUsd, 15_000);
      assert.strictEqual(result.adaptationDetails.adaptedAmountUsd, 5_000);
      assert.strictEqual(result.adaptationDetails.calculations.limitByExposure, 5_000);
      assert.strictEqual(result.adaptationDetails.calculations.limitByReserve, 5_000);
      assert.strictEqual(result.adaptationDetails.calculations.appliedLimit, 5_000);

      // Verify step 2 reproposed trade was settled
      assert.strictEqual(result.step2SettledDecision.status, 'SETTLED');
      assert.strictEqual(result.step2SettledDecision.intent.tradeAmountUsd, 5_000);
      assert.strictEqual(result.step2SettledDecision.evaluation.allPassed, true);

      // Verify resulting settled portfolio
      const resultingPortfolio = result.step2SettledDecision.resultingPortfolio;
      assert.strictEqual(resultingPortfolio.totalValueUsd, 100_000);
      assert.strictEqual(resultingPortfolio.stablecoinValueUsd, 20_000); // 20.00% minimum maintained
      const nvdaPos = resultingPortfolio.assets.find(a => a.symbol === 'NVDAx');
      assert.ok(nvdaPos);
      assert.strictEqual(nvdaPos.valueUsd, 25_000); // 25.00% max single asset limit maintained

      // Verify exact user storytelling narrative requirements
      const whyNarrative = result.loopState.whyNarrative;
      assert.ok(whyNarrative);
      assert.strictEqual(result.loopState.strategyName, 'Balanced Growth');
      assert.strictEqual(whyNarrative.initialProposalText, 'Agent initially proposed $15,000.');
      assert.strictEqual(whyNarrative.rejectionSummary, 'Sentinel rejected it because:');
      assert.strictEqual(whyNarrative.recalculationText, 'The agent recalculated the maximum compliant allocation and proposed $5,000.');
      assert.strictEqual(whyNarrative.sentinelStatusText, 'SENTINEL: ✓ APPROVED');

      const exposureBreach = whyNarrative.breachedInvariantsList.find(b => b.name === 'NVDAx exposure');
      assert.ok(exposureBreach);
      assert.strictEqual(exposureBreach.actual, '35.0%');
      assert.strictEqual(exposureBreach.limit, 'limit 25%');

      const reserveBreach = whyNarrative.breachedInvariantsList.find(b => b.name === 'Reserve');
      assert.ok(reserveBreach);
      assert.strictEqual(reserveBreach.actual, '10.0%');
      assert.strictEqual(reserveBreach.limit, 'minimum 20%');
    });

    it('agent simulator maintains live state transitions and log entries', async () => {
      const agent = client.getAgent();
      const adaptationResult = await client.runAutonomousAdaptation(portfolio, policy, 'NVDAx', 15_000);

      const state = agent.getLoopState();
      assert.ok(state);
      assert.strictEqual(state.stage, 'SETTLED');
      assert.strictEqual(state.stageIndex, 10);
      assert.strictEqual(state.status, 'ADAPTED_AND_SETTLED');
      assert.strictEqual(state.adaptedProposedAmountUsd, 5_000);
      assert.ok(adaptationResult.summary.includes('Autonomous Agent Adaptation Complete'));
    });
  });

  describe('Phase 9: PROVN Becomes the Receipt', () => {
    it('generates a first-class Sentinel Receipt with two-tier institutional separation', async () => {
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDAx111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5_000,
        referencePriceUsd: 120.0,
        strategyRationale: 'Compliant allocation target within 25% single asset exposure limit',
      });

      const cycle = await client.executeDecisionCycle(
        portfolio,
        policy,
        intent
      );

      const receipt = client.formatReceipt(cycle.evidenceRecord, 420);

      // Normal User Tier
      assert.strictEqual(receipt.receiptNumber, 'Decision #00421');
      assert.strictEqual(receipt.decision, 'APPROVED');
      assert.strictEqual(receipt.integrityVerified, true);
      assert.strictEqual(receipt.intentSummary, 'BUY NVDAx $5,000');
      assert.strictEqual(receipt.agentName, 'Sentinel Robo-01');
      assert.strictEqual(receipt.policyName, 'Balanced Growth v1');
      assert.strictEqual(receipt.marketDataSource, 'Pyth Network');
      assert.ok(receipt.executionSignature.startsWith('0x'));

      // Developer / Judge Tier (solanaVerification & technicalDetails)
      const { solanaVerification, technicalDetails } = receipt;

      // Solana On-Chain Anchoring
      assert.ok(solanaVerification.pda.length >= 32);
      assert.ok(technicalDetails.transactionSignature.length >= 32);
      assert.ok(solanaVerification.slot > 0);
      assert.strictEqual(solanaVerification.cluster, 'Solana Devnet');
      assert.strictEqual(technicalDetails.swarmConsensus.passedCount, 6);
      assert.strictEqual(technicalDetails.swarmConsensus.totalCount, 6);
      assert.strictEqual(technicalDetails.swarmConsensus.consensus, true);

      // SHA-256 Cryptographic Commitments
      assert.strictEqual(technicalDetails.policyHash.length, 64);
      assert.strictEqual(technicalDetails.intentHash.length, 64);
      assert.strictEqual(technicalDetails.preStateHash.length, 64);
      assert.strictEqual(technicalDetails.postStateHash.length, 64);
      assert.ok(technicalDetails.evidenceHash.length > 0);
      assert.ok(technicalDetails.rationaleHash ? technicalDetails.rationaleHash.length === 64 : true);
    });

    it('generates an audit receipt for rejected intent preserving failure evidence', async () => {
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDAx111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15_000,
        referencePriceUsd: 120.0,
        strategyRationale: 'Aggressive growth allocation exceeding portfolio constraints',
      });

      const cycle = await client.executeDecisionCycle(
        portfolio,
        policy,
        intent
      );

      const receipt = client.formatReceipt(cycle.evidenceRecord, 421);
      assert.strictEqual(receipt.decision, 'REJECTED');
      assert.strictEqual(receipt.integrityVerified, true);
      assert.strictEqual(receipt.technicalDetails.swarmConsensus.passedCount < 6, true);
      assert.strictEqual(receipt.technicalDetails.intentHash.length, 64);
    });
  });

  describe('Phase 10: Meteora DBC Market & Bidirectional Protection', () => {
    it('calculates bonding curve spot price, quotes and dynamic fee accurately', () => {
      const market = client.getMeteoraMarket('NVDAx');
      market.syncReservesToAnchorPrice(120.0, 72_500);

      // Initial spot price anchor: $120.00
      assert.strictEqual(market.state.spotPriceUsd, 120.0);
      assert.strictEqual(market.state.isGraduated, false);
      assert.strictEqual(market.state.graduationProgressPct, 72.5); // $72,500 / $100,000 = 72.50%

      // Calculate quote for $5,000 buy
      const quote = market.calculateQuote(5_000, true);
      assert.strictEqual(quote.inputAmount, 5_000);
      assert.ok(quote.feeAmountUsd > 0); // Dynamic base fee
      assert.strictEqual(quote.isBuy, true);
      assert.ok(quote.outputAmount > 0);
      assert.ok(quote.spotPriceAfterUsd > quote.spotPriceBeforeUsd); // Buying increases spot price along curve
      assert.ok(quote.priceImpactBps > 0);
    });

    it('tracks graduation when pool real reserve reaches $100k threshold', () => {
      const market = new MeteoraStockMarket({
        assetSymbol: 'TESTx',
        assetName: 'Test Stock Market',
        poolAddress: 'TestPool11111111111111111111111111111111111',
        graduationThresholdUsd: 100_000,
        realQuoteReserveUsd: 98_000,
      });

      assert.strictEqual(market.state.isGraduated, false);
      assert.strictEqual(market.state.graduationProgressPct, 98);

      // Apply a trade or adjust real liquidity pushing real reserve past $100,000
      market.config.realQuoteReserveUsd = 101_000;
      market.applySettledTrade(1_000, true);
      assert.strictEqual(market.state.isGraduated, true);
      assert.strictEqual(market.state.graduationProgressPct, 100);
      assert.ok(market.config.realQuoteReserveUsd > 100_000);
    });

    it('enforces bidirectional Sentinel protection on Meteora DBC markets', () => {
      const market = client.getMeteoraMarket('NVDAx');
      market.syncReservesToAnchorPrice(120.0, 72_500);

      // Test 1: Compliant trade within limits passes market protection
      const healthyEval = market.evaluateProtection(5_000, true, 120.0);
      assert.strictEqual(healthyEval.passed, true);
      assert.strictEqual(healthyEval.investorProtected, true);
      assert.strictEqual(healthyEval.marketProtected, true);
      assert.ok(healthyEval.details.includes('Confirmed'));

      // Test 2: Dimension 2 Protection — Low liquidity floor breached (< $25k)
      market.config.realQuoteReserveUsd = 20_000;
      const lowLiqEval = market.evaluateProtection(5_000, true, 120.0);
      assert.strictEqual(lowLiqEval.passed, false);
      assert.strictEqual(lowLiqEval.liquidityPassed, false);
      assert.ok(lowLiqEval.details.includes('$25,000 floor'));

      // Reset liquidity
      market.syncReservesToAnchorPrice(120.0, 72_500);

      // Test 3: Dimension 2 Protection — Pyth price divergence limit breached (> 200 bps)
      const divergentEval = market.evaluateProtection(5_000, true, 100.0); // Spot is 120, Pyth is 100 -> 20% divergence
      assert.strictEqual(divergentEval.passed, false);
      assert.strictEqual(divergentEval.priceIntegrityPassed, false);
      assert.ok(divergentEval.details.includes('diverged'));

      // Test 4: Dimension 2 Protection — Predatory price impact ceiling breached (> 600 bps)
      // Attempt massive buy of $50,000 on bonding curve
      const predatoryEval = market.evaluateProtection(50_000, true, 120.0);
      assert.strictEqual(predatoryEval.passed, false);
      assert.strictEqual(predatoryEval.priceImpactPassed, false);
      assert.ok(predatoryEval.details.includes('Predatory curve impact rejected'));
    });
  });
});
