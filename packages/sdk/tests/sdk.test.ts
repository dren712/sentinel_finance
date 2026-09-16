import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../src/client';
import { MeteoraDBCMarketQualityVerifier } from '../src/sponsors/meteora';
import { ClawPumpAgentWallet } from '../src/sponsors/clawpump';
import { LiveExecutionAdapter } from '../src/adapters/execution-adapter';

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
  });

  describe('Live Adapter Honesty Check (Rule 3)', () => {
    it('LiveExecutionAdapter rejects execution without signer and never fabricates signatures', async () => {
      const liveAdapter = new LiveExecutionAdapter();
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Live trade attempt',
      });

      await assert.rejects(
        async () => {
          await liveAdapter.executeTrade(intent, portfolio);
        },
        {
          message: /Live execution requires an authorized Solana signer keypair or connected wallet/,
        }
      );
    });
  });

  describe('Real Cryptographic Ed25519 Signatures (Finding 6)', () => {
    it('generates and verifies genuine Ed25519 signatures over canonical intent bytes', () => {
      const agentWallet = new ClawPumpAgentWallet('claw_agent_test', 'Test Robo-Agent');
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Test strategy with Ed25519 signature',
      });

      const signedIntent = agentWallet.signIntent(intent);
      assert.ok(signedIntent.signatureBase64.length > 40);

      // Verify authentic signature
      const isValid = ClawPumpAgentWallet.verifySignature(signedIntent);
      assert.strictEqual(isValid, true);

      // Tampering detection: if trade amount is altered, signature must FAIL
      const tampered = {
        ...signedIntent,
        canonicalMessage: signedIntent.canonicalMessage.replace('5000', '15000'),
      };
      const isTamperedValid = ClawPumpAgentWallet.verifySignature(tampered);
      assert.strictEqual(isTamperedValid, false);
    });
  });

  describe('Meteora DBC Market-Quality Verifier (Finding 8)', () => {
    it('evaluates bonding curve depth and price stability', () => {
      const verifier = new MeteoraDBCMarketQualityVerifier(25000, 200);

      // Healthy DBC market
      const healthyResult = verifier.verifyMarketQuality({
        poolAddress: 'DBC_Pool_NVDA_111111111111111111111111111',
        assetSymbol: 'NVDAx',
        liquidityDepthUsd: 50000,
        currentPriceUsd: 120.5,
        referencePriceUsd: 120,
        isGraduated: false,
      });
      assert.strictEqual(healthyResult.passed, true);

      // Low liquidity DBC market -> FAIL
      const shallowResult = verifier.verifyMarketQuality({
        poolAddress: 'DBC_Pool_THIN_111111111111111111111111111',
        assetSymbol: 'THINx',
        liquidityDepthUsd: 5000,
        currentPriceUsd: 100,
        referencePriceUsd: 100,
        isGraduated: false,
      });
      assert.strictEqual(shallowResult.passed, false);
      assert.strictEqual(shallowResult.liquidityPassed, false);
    });
  });

  describe('Pyth Market Truth & Provenance Integration (Phase 2)', () => {
    it('SentinelClient fetches normalized market prices and marks portfolio to market', async () => {
      const prices = await client.getMarketPrices();
      assert.ok(prices['AAPLx']);
      assert.ok(prices['NVDAx']);
      assert.strictEqual(prices['AAPLx'].source, 'Pyth Network');
      assert.strictEqual(prices['AAPLx'].feedDisplayId, 'Crypto.AAPLX/USD');

      const revalued = await client.valuePortfolio(portfolio);
      assert.ok(revalued.totalValueUsd > 0);
      assert.strictEqual(revalued.assets.length, 4);
    });

    it('SentinelClient.executeDecisionCycle embeds oracle provenance in PROVN evidence', async () => {
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 2000,
        referencePriceUsd: 120,
        strategyRationale: 'Pyth test intent for oracle provenance verification',
      });

      const report = await client.executeDecisionCycle(portfolio, policy, intent);
      assert.ok(report.evidenceRecord.oracleProvenance);
      assert.strictEqual(report.evidenceRecord.oracleProvenance.source, 'Pyth Network');
      assert.strictEqual(report.evidenceRecord.oracleProvenance.feedDisplayId, 'Crypto.NVDAX/USD');
      assert.ok(report.evidenceRecord.oracleProvenance.publishTimeFormatted.includes('UTC'));
      assert.ok(report.evidenceRecord.oracleProvenance.confidenceUsd > 0);
      assert.ok(report.evidenceRecord.oracleProvenance.confidenceMinUsd < report.evidenceRecord.oracleProvenance.confidenceMaxUsd);
    });

    it('SentinelClient computes portfolio market integrity metrics', async () => {
      const metrics = await client.getMarketIntegrityMetrics(portfolio, policy);
      assert.ok(metrics.activeFeedsCount >= 4);
      assert.strictEqual(metrics.allOraclesHealthy, true);
      assert.ok(metrics.portfolioConfidenceBps >= 0);
    });
  });

  describe('Real Portfolio State Projection & Sentinel PDA (Phase 3)', () => {
    const p3Client = new SentinelClient();
    const p3Owner = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw';
    const p3Portfolio = p3Client.createDefaultPortfolio(p3Owner);
    const p3Policy = p3Client.createDefaultPolicy(p3Owner);

    it('createDefaultPortfolio populates real Associated Token Accounts (ATAs) and projection hash', () => {
      const defaultPort = p3Client.createDefaultPortfolio(p3Owner);
      assert.strictEqual(defaultPort.source, 'ON_CHAIN_PROJECTION');
      assert.strictEqual(defaultPort.walletAddress, p3Owner);
      assert.ok(defaultPort.sentinelPda);
      assert.ok(defaultPort.projectionHash);
      assert.strictEqual(defaultPort.projectionHash.length, 64);

      for (const asset of defaultPort.assets) {
        assert.ok(asset.ata, `Asset ${asset.symbol} must have an ATA address`);
        assert.ok(asset.rawAmount, `Asset ${asset.symbol} must have a rawAmount`);
        assert.strictEqual(asset.decimals, 6);
        assert.ok(asset.verifiedPriceSource?.includes('Pyth'));
      }
    });

    it('PortfolioIndexer reads wallet token holdings and projects verified portfolio', async () => {
      const indexer = p3Client.getPortfolioIndexer();
      const holdings = await indexer.fetchWalletTokenHoldings(p3Owner);
      assert.strictEqual(holdings.length, 4);

      const usdcHolding = holdings.find(h => h.symbol === 'USDC');
      assert.ok(usdcHolding);
      assert.strictEqual(usdcHolding.balanceUi, 25000);
      assert.ok(usdcHolding.ataAddress.length >= 32);

      const projection = await p3Client.indexWalletPortfolio(p3Owner);
      assert.strictEqual(projection.walletAddress, p3Owner);
      assert.strictEqual(projection.normalizedPortfolio.totalValueUsd, 100000);
      assert.strictEqual(projection.normalizedPortfolio.assets.length, 4);
    });

    it('getSentinelPdaConfig exposes the 5 institutional roles of the Sentinel PDA', () => {
      const pdaConfig = p3Client.getSentinelPdaConfig(p3Owner);
      assert.strictEqual(pdaConfig.owner, p3Owner);
      assert.ok(pdaConfig.pdaAddress.length >= 32);
      assert.strictEqual(pdaConfig.roles.isPolicyAuthority, true);
      assert.strictEqual(pdaConfig.roles.isPortfolioConfiguration, true);
      assert.strictEqual(pdaConfig.roles.isExecutionAuthority, true);
      assert.strictEqual(pdaConfig.roles.isPromiseRegistry, true);
      assert.strictEqual(pdaConfig.roles.isEvidenceAnchor, true);
    });

    it('settling a trade synchronizes real token holdings in PortfolioIndexer', async () => {
      const initialHoldings = await p3Client.getWalletHoldings(p3Owner);
      const initialUsdc = initialHoldings.find(h => h.symbol === 'USDC')!.balanceUi;

      const intent = p3Client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Phase 3 sync test',
      });

      const report = await p3Client.executeDecisionCycle(p3Portfolio, p3Policy, intent);
      assert.strictEqual(report.status, 'SETTLED');

      const updatedHoldings = await p3Client.getWalletHoldings(p3Owner);
      const updatedUsdc = updatedHoldings.find(h => h.symbol === 'USDC')!.balanceUi;
      assert.strictEqual(updatedUsdc, initialUsdc - 5000);
    });
  });
});
