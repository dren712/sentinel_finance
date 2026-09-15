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
});
