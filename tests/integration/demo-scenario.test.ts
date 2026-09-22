import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../../packages/sdk/dist/src/index.js';

describe('Sentinel End-to-End Demo Integration Test', () => {
  it('executes full autonomous scenario: non-compliant trade rejected -> compliant trade settled', async () => {
    const client = new SentinelClient();
    const portfolio = client.createDefaultPortfolio();
    const policy = client.createDefaultPolicy();

    const result = await client.runDemoScenario(portfolio, policy);

    // Assert Step 1 Rejection
    const step1 = result.step1BadDecision;
    assert.strictEqual(step1.status, 'REJECTED');
    assert.strictEqual(step1.evaluation.allPassed, false);
    assert.strictEqual(step1.evidenceRecord.verificationResult, 'REJECTED');
    assert.strictEqual(step1.resultingPortfolio.stablecoinValueUsd, 25000); // Unchanged

    // Assert Step 2 Settlement
    const step2 = result.step2AdaptedDecision;
    assert.strictEqual(step2.status, 'SETTLED');
    assert.strictEqual(step2.evaluation.allPassed, true);
    assert.strictEqual(step2.evidenceRecord.verificationResult, 'SETTLED');
    assert.strictEqual(step2.resultingPortfolio.stablecoinValueUsd, 20000); // Spent $5,000
    assert.strictEqual(step2.resultingPortfolio.stablecoinExposureBps, 2000); // 20.00%
    assert.ok(step2.evidenceRecord.transactionSignature);

    // PROVN Cryptographic checks
    assert.strictEqual(step1.evidenceRecord.preStateHash.length, 64);
    assert.strictEqual(step2.evidenceRecord.preStateHash.length, 64);
    assert.strictEqual(step2.evidenceRecord.postStateHash.length, 64);
  });

  it('executes PreStocks $10K scenario: OPENAI $30,000 exceeds 20% Pre-IPO ceiling -> rejected -> auto-adapts under cap -> settles via PreStocks Secondary', async () => {
    const client = new SentinelClient();
    const portfolio = client.createDefaultPortfolio();
    const policy = client.createDefaultPolicy();

    const result = await client.runPreStocksDemoScenario(portfolio, policy);

    // Assert Step 1 Rejection: Pre-IPO cap breach
    const step1 = result.step1RejectedDecision;
    assert.strictEqual(step1.status, 'REJECTED');
    assert.strictEqual(step1.evaluation.allPassed, false);
    assert.strictEqual(step1.evidenceRecord.verificationResult, 'REJECTED');
    assert.strictEqual(step1.intent.assetSymbol, 'OPENAIx');
    assert.strictEqual(step1.intent.tradeAmountUsd, 30_000);
    assert.ok(result.projectedBadExposureBps > result.policyPreIpoCapBps);

    // Assert Step 2 Auto-Adaptation & Compliant Settlement
    const step2 = result.step2SettledDecision;
    assert.strictEqual(step2.status, 'SETTLED');
    assert.strictEqual(step2.evaluation.allPassed, true);
    assert.strictEqual(step2.evidenceRecord.verificationResult, 'SETTLED');
    assert.strictEqual(step2.executionResult?.venueType, 'PRESTOCKS_SECONDARY');
    assert.ok(result.adaptedExposureBps <= result.policyPreIpoCapBps);
    assert.ok(step2.evidenceRecord.transactionSignature);
    assert.strictEqual(step2.evidenceRecord.postStateHash.length, 64);
  });

  it('executes Meteora $5K Equity Market Guard scenario: BUY NVDAx $8,000 passes user policy & portfolio exposure but blocked by Meteora DBC liquidity depth', async () => {
    const client = new SentinelClient();
    const portfolio = client.createDefaultPortfolio();
    const policy = client.createDefaultPolicy();

    const result = await client.runMeteoraMarketGuardDemoScenario(portfolio, policy);

    // Assert user policy and portfolio exposure both pass
    assert.strictEqual(result.userPolicyPassed, true);
    assert.strictEqual(result.portfolioExposurePassed, true);

    // Assert Meteora DBC market quality fails (< $25k floor) and trade is blocked
    assert.strictEqual(result.meteoraMarketQualityPassed, false);
    assert.strictEqual(result.report.status, 'REJECTED');
    assert.strictEqual(result.report.evidenceRecord.verificationResult, 'REJECTED');
    assert.ok(result.blockedReason.includes('Sentinel Equity Market Guard'));
    assert.ok(result.blockedReason.includes('Meteora DBC pool liquidity depth'));
  });

  it('executes Pyth Security Input scenario: stale oracle quote halts execution -> Pyth pull update -> verified execution settles', async () => {
    const client = new SentinelClient();
    const portfolio = client.createDefaultPortfolio();
    const policy = client.createDefaultPolicy();

    const result = await client.runPythSecurityGuardDemoScenario(portfolio, policy);

    // Assert Step 1 Rejection: Stale quote halted by Sentinel
    const step1 = result.step1StaleQuoteDecision;
    assert.strictEqual(step1.status, 'REJECTED');
    assert.strictEqual(step1.evaluation.allPassed, false);
    assert.strictEqual(step1.evaluation.failureCode, 'ERR_QUOTE_STALE');
    assert.strictEqual(step1.evidenceRecord.verificationResult, 'REJECTED');
    assert.strictEqual(result.staleAgeSeconds, 140);
    assert.ok(step1.evidenceRecord.failureReason?.includes('Oracle quote is stale'));

    // Assert Step 2 Pull Update: Fresh price obtained
    assert.strictEqual(result.step2PullUpdatePrice.symbol, 'AAPLx');
    assert.strictEqual(result.freshAgeSeconds, 0);

    // Assert Step 3 Execution: Approved and Settled
    const step3 = result.step3FreshSettledDecision;
    assert.strictEqual(step3.status, 'SETTLED');
    assert.strictEqual(step3.evaluation.allPassed, true);
    assert.strictEqual(step3.evidenceRecord.verificationResult, 'SETTLED');
    assert.strictEqual(step3.evidenceRecord.postStateHash.length, 64);
    assert.ok(result.summary.includes('Pyth Security Input Protection'));
  });
});
