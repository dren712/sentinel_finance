import { describe, it } from 'node:test';
import assert from 'node:assert';
// Import Route Handlers from Next.js server app
import { POST as runAgentPost } from '../../apps/web/src/app/api/agent/run/route';
import { GET as getAgentStatus } from '../../apps/web/src/app/api/agent/status/route';
import { GET as getPortfolio } from '../../apps/web/src/app/api/portfolio/[wallet]/route';
import { GET as getMarket } from '../../apps/web/src/app/api/market/[asset]/route';
import { GET as getPolicy, POST as postPolicy } from '../../apps/web/src/app/api/policy/[wallet]/route';
import { GET as getActivity } from '../../apps/web/src/app/api/activity/[wallet]/route';
import { GET as getEvidence } from '../../apps/web/src/app/api/evidence/[decision]/route';

describe('P12: Next.js Server Routes (Backend Orchestrator Integration Test)', () => {
  it('1. GET /api/agent/status exposes active agent, risk state, and current loop stage', async () => {
    const res = await getAgentStatus();
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.agentId, 'sentinel_robo_agent_1');
    assert.ok(data.name.includes('Sentinel'));
    assert.ok(data.llmProvider);
    assert.ok(data.riskState);
  });

  it('2. POST /api/agent/run executes 10-stage loop (LLM proposal -> Sentinel check -> Block -> Adapt -> Settle)', async () => {
    const req = new Request('http://localhost:3000/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: 'flagship',
        llmProvider: 'demo',
        targetAsset: 'NVDAx',
        proposedAmountUsd: 15_000,
      }),
    });

    const res = await runAgentPost(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.initialDecision.status, 'REJECTED');
    assert.strictEqual(data.adaptedDecision.status, 'SETTLED');
    assert.strictEqual(data.adaptedDecision.intent.tradeAmountUsd, 5000);
    assert.strictEqual(data.loopState.stage, 'SETTLED');
    assert.ok(data.summary.includes('Adapt'));
  });

  it('3. GET /api/portfolio/[wallet] returns real asset holdings, valuations, and reserve floor compliance', async () => {
    const req = new Request('http://localhost:3000/api/portfolio/default');
    const res = await getPortfolio(req, { params: { wallet: 'default' } });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.totalValueUsd, 100_000);
    assert.ok(data.assets.length >= 4);
    assert.strictEqual(data.isReserveCompliant, true);
    assert.strictEqual(data.minReserveFloorPct, 20);
  });

  it('4. GET /api/market/[asset] returns Pyth dual-feed pricing, basis tracking error, and Meteora DBC metrics', async () => {
    const req = new Request('http://localhost:3000/api/market/NVDAx');
    const res = await getMarket(req, { params: { asset: 'NVDAx' } });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.symbol, 'NVDAX');
    assert.ok(data.priceUsd > 0);
    assert.ok(data.dualFeed);
    assert.strictEqual(data.dualFeed.underlyingSymbol, 'NVDA');
    assert.ok(data.dualFeed.trackingErrorBps !== undefined);
    assert.strictEqual(data.dualFeed.pegCompliant, true);

    // Meteora DBC quality metrics
    assert.strictEqual(data.meteoraMetrics.liquidityFloorPassed, true);
    assert.strictEqual(data.meteoraMetrics.priceImpactPassed, true);
    assert.strictEqual(data.meteoraMetrics.poolAddress, '4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk');
  });

  it('5. GET & POST /api/policy/[wallet] inspects and updates policy invariants', async () => {
    // 1. GET initial policy
    const getReq = new Request('http://localhost:3000/api/policy/default');
    const getRes = await getPolicy(getReq, { params: { wallet: 'default' } });
    const getData = await getRes.json();
    assert.strictEqual(getData.success, true);
    assert.strictEqual(getData.policy.maxSingleAssetBps, 2500);

    // 2. POST update maxSingleAssetBps to 3000 (30%)
    const postReq = new Request('http://localhost:3000/api/policy/default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxSingleAssetBps: 3000,
      }),
    });
    const postRes = await postPolicy(postReq, { params: { wallet: 'default' } });
    const postData = await postRes.json();
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postData.success, true);
    assert.strictEqual(postData.policy.maxSingleAssetBps, 3000);
  });

  it('6. GET /api/activity/[wallet] returns ordered history of trade decisions and adaptations', async () => {
    const req = new Request('http://localhost:3000/api/activity/default');
    const res = await getActivity(req, { params: { wallet: 'default' } });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.activities.length >= 2);

    const adaptedActivity = data.activities.find((a: any) => a.type === 'ADAPTED');
    assert.ok(adaptedActivity);
    assert.strictEqual(adaptedActivity.amountUsd, 5000);

    const rejectedActivity = data.activities.find((a: any) => a.type === 'REJECTED');
    assert.ok(rejectedActivity);
    assert.strictEqual(rejectedActivity.amountUsd, 15000);
  });

  it('7. GET /api/evidence/[decision] returns authoritative two-tier PROVN receipt', async () => {
    const req = new Request('http://localhost:3000/api/evidence/latest');
    const res = await getEvidence(req, { params: { decision: 'latest' } });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.verificationResult, 'SETTLED');

    // Tier 1: Investor view
    assert.strictEqual(data.tier1InvestorView.status, 'PROTECTED_AND_SETTLED');
    assert.ok(data.tier1InvestorView.capitalSafetyMessage);

    // Tier 2: Institutional audit view
    assert.strictEqual(data.tier2InstitutionalAudit.intentHash.length, 64);
    assert.strictEqual(data.tier2InstitutionalAudit.policyHash.length, 64);
    assert.strictEqual(data.tier2InstitutionalAudit.preStateHash.length, 64);
    assert.strictEqual(data.tier2InstitutionalAudit.postStateHash.length, 64);
    assert.ok(data.tier2InstitutionalAudit.transactionSignature);
  });
});
