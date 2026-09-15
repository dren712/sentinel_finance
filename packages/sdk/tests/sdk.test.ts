import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../src/client';
import { MeteoraDBCMarketQualityVerifier } from '../src/sponsors/meteora';
import { ClawPumpAgentWallet } from '../src/sponsors/clawpump';

describe('Sentinel SDK & Autonomous Agent Simulator Tests', () => {
  const client = new SentinelClient();
  const portfolio = client.createDefaultPortfolio();
  const policy = client.createDefaultPolicy();

  it('initializes canonical default portfolio ($100,000) and policy', () => {
    assert.strictEqual(portfolio.totalValueUsd, 100000);
    assert.strictEqual(portfolio.stablecoinValueUsd, 25000);
    assert.strictEqual(portfolio.stablecoinExposureBps, 2500); // 25.00%
    assert.strictEqual(portfolio.assets.length, 4);

    assert.strictEqual(policy.maxSingleAssetBps, 2500); // 25.00%
    assert.strictEqual(policy.minStablecoinBps, 2000);  // 20.00%
    assert.strictEqual(policy.maxTradeValueUsd, 10000); // $10,000
    assert.strictEqual(policy.maxSlippageBps, 100);     // 1.00%
  });

  it('calculates the exact maximum compliant trade size for auto-adaptation', () => {
    const agent = client.getAgent();
    const compliantAmount = agent.calculateCompliantTradeAmount(portfolio, policy, 'NVDAx');
    // NVDA is at $20,000. Cap is 25% of $100,000 = $25,000. So max increase is $5,000.
    // Stablecoin is at $25,000. Floor is 20% of $100,000 = $20,000. So max spend is $5,000.
    // Policy max trade is $10,000.
    // Minimum of (5000, 5000, 10000) = $5,000!
    assert.strictEqual(compliantAmount, 5000);
  });

  it('runs complete 2-step autonomous hackathon demo scenario (Section 17)', async () => {
    const demoResult = await client.runDemoScenario(portfolio, policy);

    // Step 1: Bad decision is REJECTED
    const step1 = demoResult.step1BadDecision;
    assert.strictEqual(step1.status, 'REJECTED');
    assert.strictEqual(step1.intent.tradeAmountUsd, 15000);
    assert.strictEqual(step1.evaluation.allPassed, false);
    assert.strictEqual(step1.resultingPortfolio.totalValueUsd, 100000);
    assert.strictEqual(step1.resultingPortfolio.stablecoinValueUsd, 25000); // Unchanged!
    assert.ok(step1.evidenceRecord.failureReason);
    assert.strictEqual(step1.evidenceRecord.verificationResult, 'REJECTED');

    // Step 2: Auto-adapted decision is SETTLED
    const step2 = demoResult.step2AdaptedDecision;
    assert.strictEqual(step2.status, 'SETTLED');
    assert.strictEqual(step2.intent.tradeAmountUsd, 5000);
    assert.strictEqual(step2.evaluation.allPassed, true);
    assert.strictEqual(step2.resultingPortfolio.stablecoinValueUsd, 20000); // Spent $5,000
    assert.strictEqual(step2.resultingPortfolio.stablecoinExposureBps, 2000); // Exactly 20.00% reserve
    assert.ok(step2.executionResult?.transactionSignature);
    assert.strictEqual(step2.evidenceRecord.verificationResult, 'SETTLED');

    // Evidence history contains both records
    const history = client.getEvidenceHistory();
    assert.ok(history.length >= 2);
  });

  describe('Sponsor Tracks (Meteora DBC & ClawPump)', () => {
    it('MeteoraDBCMarketQualityVerifier: evaluates bonding curve depth and price stability', () => {
      const verifier = new MeteoraDBCMarketQualityVerifier(25000, 200);

      // Healthy DBC market
      const healthyResult = verifier.verifyMarketQuality({
        poolAddress: 'DBC_Pool_NVDA_111111111111111111111111111',
        assetSymbol: 'NVDAx',
        liquidityDepthUsd: 50000,
        currentPriceUsd: 120.5,
        referencePriceUsd: 120, // ~0.41% deviation <= 2%
        isGraduated: false,
      });
      assert.strictEqual(healthyResult.passed, true);

      // Low liquidity DBC market -> FAIL
      const shallowResult = verifier.verifyMarketQuality({
        poolAddress: 'DBC_Pool_THIN_111111111111111111111111111',
        assetSymbol: 'THINx',
        liquidityDepthUsd: 5000, // < $25,000
        currentPriceUsd: 100,
        referencePriceUsd: 100,
        isGraduated: false,
      });
      assert.strictEqual(shallowResult.passed, false);
      assert.strictEqual(shallowResult.liquidityPassed, false);

      // Manipulated / high deviation DBC market -> FAIL
      const deviatedResult = verifier.verifyMarketQuality({
        poolAddress: 'DBC_Pool_VOLATILE_11111111111111111111',
        assetSymbol: 'VOLx',
        liquidityDepthUsd: 100000,
        currentPriceUsd: 130, // Reference is 120 -> 8.33% deviation > 2%
        referencePriceUsd: 120,
        isGraduated: false,
      });
      assert.strictEqual(deviatedResult.passed, false);
      assert.strictEqual(deviatedResult.priceDeviationPassed, false);
    });

    it('ClawPumpAgentWallet: generates autonomous agent identity and signs trade intents', () => {
      const agentWallet = new ClawPumpAgentWallet('claw_agent_test', 'Test Robo-Agent');
      assert.ok(agentWallet.getPublicKeyString().length > 30);

      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Test strategy',
      });

      const signed = agentWallet.signIntent(intent);
      assert.ok(signed.agentSignature.startsWith('claw_sig_'));
      assert.strictEqual(signed.intent.tradeAmountUsd, 5000);
    });
  });
});
