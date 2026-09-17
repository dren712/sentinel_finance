import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../src/client';
import { ClawPumpAgentWallet } from '../src/sponsors/clawpump';
import { TesseraExecutionAdapter } from '../src/sponsors/tessera';
import {
  CANONICAL_CLAWPUMP_AGENT_TOKEN,
  TESSERA_SPV_REGISTRY,
  getTesseraTranche,
  evaluateTesseraEligibility,
  evaluatePostconditions,
  hashTradeIntent,
  hashFinancialPolicy,
  hashPortfolioState,
} from '@sentinel/domain';

describe('Phase 12 — ClawPump & Tessera Integration', () => {
  const client = new SentinelClient();
  const portfolio = client.createPreStocksPortfolio();
  const preStocksPolicy = client.createPreStocksPolicy();

  describe('1. ClawPump: 4-Stage Pipeline (Identity ➔ Stock-Linked Token ➔ Meteora DBC ➔ Sentinel Guard)', () => {
    it('initializes agent identity, provisions stock-linked agent token, and binds to Meteora DBC pool', () => {
      const wallet = new ClawPumpAgentWallet('claw_sentinel_robo_1', 'Sentinel Autonomous Robo-01');
      assert.strictEqual(wallet.agentId, 'claw_sentinel_robo_1');
      assert.ok(wallet.getPublicKeyString());

      const launch = wallet.getAgentLaunch();
      assert.strictEqual(launch.config.symbol, 'ROBOx');
      assert.strictEqual(launch.config.pairedVenueType, 'METEORA_DBC');
      assert.strictEqual(launch.config.pairedPoolAddress, 'MeteoraRoboDbcPool111111111111111111111111111');
      assert.strictEqual(launch.config.initialSpotPriceUsd, 1.0);
      assert.strictEqual(launch.config.initialLiquidityUsd, 50_000);
      assert.strictEqual(launch.currentSpotPriceUsd, 1.0);
      assert.strictEqual(launch.currentLiquidityUsd, 50_000);
    });

    it('ClawPumpAgentWallet produces valid Ed25519 signatures over canonical intents', () => {
      const wallet = new ClawPumpAgentWallet();
      const intent = wallet.proposeAgentTokenBuyIntent(5000);
      const signedIntent = wallet.signIntent(intent);

      assert.strictEqual(signedIntent.intent.intentId, intent.intentId);
      assert.ok(signedIntent.signatureBase64);
      assert.strictEqual(ClawPumpAgentWallet.verifySignature(signedIntent), true);
    });
  });

  describe('2. Anti-Self-Dealing Guard: Sentinel Blocks Rogue Agent Token Allocations', () => {
    it('blocks rogue agent intent to dump $8,000 portfolio capital into its own token (8% > 5% limit)', async () => {
      const wallet = new ClawPumpAgentWallet();
      const rogueIntent = wallet.proposeAgentTokenBuyIntent(8_000, 1.0);

      // Evaluate under Sentinel risk engine
      const evaluation = evaluatePostconditions(portfolio, rogueIntent, preStocksPolicy);
      assert.strictEqual(evaluation.allPassed, false);

      const selfDealingCheck = evaluation.checks.find(c => c.checkName === 'AGENT_SELF_DEALING_CAP');
      assert.ok(selfDealingCheck, 'Anti-Self-Dealing invariant check must be evaluated');
      assert.strictEqual(selfDealingCheck.passed, false);
      assert.strictEqual(selfDealingCheck.failureCode, 'ERR_AGENT_SELF_DEALING_EXCEEDED');
      assert.strictEqual(selfDealingCheck.actualBpsOrValue, 800);
      assert.strictEqual(selfDealingCheck.expectedBpsOrValue, 500);

      // Full decision cycle through SentinelClient
      const report = await client.executeDecisionCycle(portfolio, preStocksPolicy, rogueIntent);
      assert.strictEqual(report.status, 'REJECTED');
      assert.strictEqual(report.evaluation.allPassed, false);
      assert.strictEqual(report.evidenceRecord.verificationResult, 'REJECTED');
      assert.ok(report.evidenceRecord.failureReason?.toLowerCase().includes('anti-self-dealing'));
    });

    it('agent autonomously adapts: recalculates compliant allocation ($5,000) and settles via Meteora DBC', async () => {
      const wallet = new ClawPumpAgentWallet();
      
      // Step 1: Agent proposes rogue trade ($8,000) -> Rejected
      const rogueIntent = wallet.proposeAgentTokenBuyIntent(8_000, 1.0);
      const step1 = await client.executeDecisionCycle(portfolio, preStocksPolicy, rogueIntent);
      assert.strictEqual(step1.status, 'REJECTED');

      // Step 2: Agent calculates maximum compliant trade under maxAgentTokenExposureBps (500 bps = $5,000)
      const maxAllowedBps = preStocksPolicy.maxAgentTokenExposureBps ?? 500;
      const maxAllowedUsd = (portfolio.totalValueUsd * maxAllowedBps) / 10_000; // $5,000
      assert.strictEqual(maxAllowedUsd, 5000);

      const compliantIntent = wallet.proposeAgentTokenBuyIntent(maxAllowedUsd, 1.0);
      const step2 = await client.executeDecisionCycle(portfolio, preStocksPolicy, compliantIntent);

      assert.strictEqual(step2.status, 'SETTLED');
      assert.strictEqual(step2.evaluation.allPassed, true);
      assert.strictEqual(step2.executionResult?.venueType, 'METEORA_DBC');
      assert.strictEqual(step2.resultingPortfolio.stablecoinValueUsd, 20_000); // Spent $5,000 USDC
      assert.strictEqual(step2.evidenceRecord.verificationResult, 'SETTLED');
    });

    it('accrues strategy performance fees into the ClawPump agent pool liquidity', () => {
      const launch = client.getClawPumpLaunch();
      const initialLiquidity = launch.currentLiquidityUsd;
      
      // Accrue $1,250 performance fee from alpha generation
      launch.accrueStrategyPerformanceFee(1250);
      assert.strictEqual(launch.performanceFeeAccumulatedUsd, 1250);
      assert.strictEqual(launch.currentLiquidityUsd, initialLiquidity + 1250);
    });
  });

  describe('3. Tessera: Fractional SPV Tranche Layer & Safeguards', () => {
    it('registers authenticated SPV tranches for SpaceX, OpenAI, and Stripe with 409A / Forge NAV attestations', () => {
      const tranches = client.getTesseraTranches();
      assert.ok(tranches.SPACEXx);
      assert.ok(tranches.OPENAIx);
      assert.ok(tranches.STRIPEx);

      const spacex = tranches.SPACEXx;
      assert.strictEqual(spacex.trancheId, 'TESSERA_SPACEX_SERIES_N');
      assert.strictEqual(spacex.spvLegalEntity, 'Tessera Private Alpha SpaceX SPV LLC');
      assert.strictEqual(spacex.shareClass, 'Series N Preferred');
      assert.strictEqual(spacex.navAttestationUsd, 135.0);
      assert.ok(spacex.navAttestor.includes('Carta Certified 409A'));

      const openai = tranches.OPENAIx;
      assert.strictEqual(openai.trancheId, 'TESSERA_OPENAI_TENDER_TRANCHE');
      assert.strictEqual(openai.navAttestationUsd, 200.0);
      assert.ok(openai.navAttestor.includes('Forge Global'));
    });

    it('Sentinel blocks Tessera trade if secondary price exceeds certified NAV by > 15%', () => {
      const spacexTranche = getTesseraTranche('SPACEXx')!;
      // NAV is $135. Secondary quoted price $180 is a 33.33% premium (> 15%)
      const quotedPrice = 180.0;
      const evaluation = evaluateTesseraEligibility(spacexTranche, quotedPrice, 1500);

      assert.strictEqual(evaluation.passed, false);
      assert.strictEqual(evaluation.failureCode, 'ERR_TESSERA_NAV_PREMIUM_EXCEEDED');
      assert.ok(evaluation.reason.includes('exceeding 15.00% limit'));
    });

    it('Sentinel approves Tessera trade when secondary price is within certified NAV premium bound', () => {
      const spacexTranche = getTesseraTranche('SPACEXx')!;
      // NAV is $135. Secondary price $140 is a 3.70% premium (<= 15%)
      const quotedPrice = 140.0;
      const evaluation = evaluateTesseraEligibility(spacexTranche, quotedPrice, 1500);

      assert.strictEqual(evaluation.passed, true);
      assert.strictEqual(evaluation.premiumBps, 370);
      assert.ok(evaluation.reason.includes('verified'));
    });

    it('Sentinel blocks Tessera trade if SPV secondary lockup is still active', () => {
      const lockedTranche = {
        ...getTesseraTranche('SPACEXx')!,
        secondaryLockupExpiry: Date.now() + 86400_000, // 24 hours in the future
      };
      const evaluation = evaluateTesseraEligibility(lockedTranche, 140.0, 1500);

      assert.strictEqual(evaluation.passed, false);
      assert.strictEqual(evaluation.failureCode, 'ERR_TESSERA_LOCKUP_ACTIVE');
      assert.ok(evaluation.reason.includes('is locked until'));
    });
  });

  describe('4. Tessera Execution Adapter & Strict Non-Bypass Invariant', () => {
    const tessera = new TesseraExecutionAdapter();
    const compliantSpacexIntent = client.getAgent().proposeIntent({
      assetSymbol: 'SPACEXx',
      assetMint: 'SPACEX111111111111111111111111111111111111',
      direction: 'BUY',
      tradeAmountUsd: 5000,
      referencePriceUsd: 140, // within NAV premium
      strategyRationale: 'Institutional allocation into SpaceX Series N SPV Tranche',
    });

    it('blocks direct Agent -> Tessera execution without Sentinel authorization ticket', async () => {
      await assert.rejects(
        async () => {
          await tessera.executeTrade(compliantSpacexIntent, portfolio);
        },
        {
          name: 'SecurityViolationError',
          message: /Direct Agent->Tessera Vault execution prohibited/,
        }
      );
    });

    it('settles private equity secondary trade when authorized by Sentinel ticket', async () => {
      // Create valid authorization ticket
      const ticket = {
        ticketId: 'tessera_ticket_001',
        promiseId: 'promise_tessera_001',
        agentId: compliantSpacexIntent.agentId,
        intentHash: hashTradeIntent(compliantSpacexIntent),
        policyHash: hashFinancialPolicy(preStocksPolicy),
        preStateHash: hashPortfolioState(portfolio),
        authorizedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        authorizedAmountUsd: 5000,
        authorizedDirection: 'BUY' as const,
        targetAssetSymbol: 'SPACEXx',
        maxSlippageBps: 100,
      };

      const result = await tessera.executeTrade(compliantSpacexIntent, portfolio, ticket);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.venueType, 'TESSERA_VAULT');
      assert.strictEqual(result.venueName, 'Tessera Fractional SPV Secondary Vault');
      assert.ok(result.poolAddress.includes('TesseraVaultSpaceXSeriesN'));
      assert.ok(result.route.includes('Tessera SPV Vault (TESSERA_SPACEX_SERIES_N)'));
      assert.ok(result.transactionSignature.startsWith('tessera_spv_tx_spacexx_'));
    });
  });
});
