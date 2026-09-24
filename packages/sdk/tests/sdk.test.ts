import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SentinelClient } from '../src/client';
import { AgentSignerWallet } from '../src/agent-wallet';
import { MeteoraDBCMarketQualityVerifier } from '../src/sponsors/meteora';
import { LiveExecutionAdapter } from '../src/adapters/execution-adapter';
import { WalletSigner } from '../src/types';
import { PublicKey, Keypair, SystemProgram, Transaction, Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { SentinelAuthorizationTicket, hashTradeIntent } from '@sentinel/domain';

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

  describe('Live Adapter Honesty Check (Rule 3 & Non-Bypass Invariant)', () => {
    it('LiveExecutionAdapter blocks direct execution without Sentinel authorization ticket', async () => {
      const liveAdapter = new LiveExecutionAdapter();
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Live trade attempt without ticket',
      });

      // Direct bypass attempt without authorization ticket
      await assert.rejects(
        async () => {
          await liveAdapter.executeTrade(intent, portfolio);
        },
        {
          name: 'SecurityViolationError',
          message: /Direct Agent->DEX execution prohibited/,
        }
      );
    });

    it('LiveExecutionAdapter rejects execution with ticket but without signer and never fabricates signatures', async () => {
      const liveAdapter = new LiveExecutionAdapter();
      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Live trade attempt with ticket but no signer',
      });

      const fakeTicket = {
        ticketId: 'auth_test_123',
        promiseId: 'promise_test_123',
        agentId: intent.agentId,
        intentHash: (await import('@sentinel/domain')).hashTradeIntent(intent),
        policyHash: (await import('@sentinel/domain')).hashFinancialPolicy(policy),
        preStateHash: (await import('@sentinel/domain')).hashPortfolioState(portfolio),
        authorizedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        authorizedAmountUsd: 5000,
        authorizedDirection: 'BUY' as const,
        targetAssetSymbol: 'NVDAx',
        maxSlippageBps: 100,
      };

      await assert.rejects(
        async () => {
          await liveAdapter.executeTrade(intent, portfolio, fakeTicket);
        },
        {
          message: /Live execution requires an authorized Solana signer keypair or connected wallet/,
        }
      );
    });

    it('LiveExecutionAdapter builds typed Anchor instructions via IDL without manual buffer manipulation', async () => {
      const liveAdapter = new LiveExecutionAdapter();
      const program = liveAdapter.getProgram();

      assert.ok(program);
      assert.strictEqual(program.programId.toBase58(), '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK');
      assert.ok(typeof program.methods.createPromise === 'function');
      assert.ok(typeof program.methods.executeGuardedTrade === 'function');
      assert.ok(typeof program.methods.setAgentActive === 'function');

      const mockAuthority = Keypair.generate().publicKey;
      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent'), mockAuthority.toBuffer(), Buffer.from('sentinel-robo-01')],
        program.programId
      );
      const [promisePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from('promise_test')],
        program.programId
      );
      const [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), mockAuthority.toBuffer()],
        program.programId
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), mockAuthority.toBuffer()],
        program.programId
      );

      // Verify createPromise instruction building
      const createIx = await program.methods
        .createPromise(
          'promise_test',
          Array(32).fill(7),
          PublicKey.default,
          0,
          new BN(5000)
        )
        .accountsPartial({
          promise: promisePda,
          agent: agentPda,
          policy: policyPda,
          authority: mockAuthority,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      assert.strictEqual(createIx.programId.toBase58(), program.programId.toBase58());
      assert.strictEqual(createIx.keys.length, 5);
      // Anchor discriminator for create_promise: [233, 170, 35, 24, 34, 120, 82, 200]
      assert.deepStrictEqual(Array.from(createIx.data.subarray(0, 8)), [233, 170, 35, 24, 34, 120, 82, 200]);

      // Verify executeGuardedTrade instruction building
      const executeIx = await program.methods
        .executeGuardedTrade(
          new BN(500000),
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          authority: mockAuthority,
        })
        .instruction();

      assert.strictEqual(executeIx.programId.toBase58(), program.programId.toBase58());
      assert.strictEqual(executeIx.keys.length, 5);
      // Anchor discriminator for execute_guarded_trade: [173, 223, 79, 146, 151, 58, 98, 99]
      assert.deepStrictEqual(Array.from(executeIx.data.subarray(0, 8)), [173, 223, 79, 146, 151, 58, 98, 99]);
    });

    it('executes real browser wallet flow with signTransaction and returns cluster Explorer link', async () => {
      const mockKeypair = Keypair.generate();
      let signedCount = 0;
      let sentRawCount = 0;
      let confirmedCount = 0;

      const mockWalletSigner: WalletSigner = {
        publicKey: mockKeypair.publicKey,
        signTransaction: async (tx: Transaction) => {
          signedCount++;
          tx.partialSign(mockKeypair);
          return tx;
        },
      };

      const adapter = new LiveExecutionAdapter(
        'https://api.devnet.solana.com',
        mockWalletSigner,
        '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK',
        'devnet'
      );

      assert.strictEqual(adapter.venueType, 'SOLANA');
      assert.strictEqual(adapter.venueName, 'Solana Devnet');
      assert.strictEqual(adapter.cluster, 'devnet');

      // Mock connection methods to verify browser wallet execution without real network call
      const conn = adapter.getConnection();
      conn.getLatestBlockhash = async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 1234567,
      });
      conn.getAccountInfo = async () => null;
      conn.sendRawTransaction = async (_rawTx: Buffer | Uint8Array) => {
        sentRawCount++;
        return '5abc111111111111111111111111111111111111111111111111111111111111111111111111111111111111';
      };
      conn.confirmTransaction = async () => {
        confirmedCount++;
        return { context: { slot: 100 }, value: { err: null } } as any;
      };

      const intent = client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Browser wallet live execution test',
      });

      const authorization: SentinelAuthorizationTicket = {
        ticketId: 'ticket-browser-wallet',
        promiseId: 'promise_test',
        agentId: 'sentinel-robo-01',
        intentHash: hashTradeIntent(intent),
        policyHash: 'hash_policy',
        preStateHash: 'hash_prestate',
        authorizedAt: Date.now() - 100,
        expiresAt: Date.now() + 60_000,
        authorizedAmountUsd: 5000,
        authorizedDirection: 'BUY',
        targetAssetSymbol: 'NVDAx',
        maxSlippageBps: 100,
      };

      const preState = client.createDefaultPortfolio();
      const result = await adapter.executeTrade(intent, preState, authorization);

      assert.strictEqual(result.success, true);
      assert.strictEqual(signedCount, 1, 'wallet.signTransaction must be called');
      assert.strictEqual(sentRawCount, 1, 'connection.sendRawTransaction must be called');
      assert.strictEqual(confirmedCount, 1, 'connection.confirmTransaction must be called');
      assert.strictEqual(result.venueType, 'SOLANA');
      assert.strictEqual(result.cluster, 'devnet');
      assert.ok(result.explorerUrl?.includes('cluster=devnet'));
      assert.ok(result.explorerUrl?.includes('explorer.solana.com/tx/'));
    });
  });

  describe('Real Cryptographic Ed25519 Signatures (Finding 6)', () => {
    it('generates and verifies genuine Ed25519 signatures over canonical intent bytes', () => {
      const agentWallet = new AgentSignerWallet('agent_test', 'Test Robo-Agent');
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
      const isValid = AgentSignerWallet.verifySignature(signedIntent);
      assert.strictEqual(isValid, true);

      // Tampering detection: if trade amount is altered, signature must FAIL
      const tampered = {
        ...signedIntent,
        canonicalMessage: signedIntent.canonicalMessage.replace('5000', '15000'),
      };
      const isTamperedValid = AgentSignerWallet.verifySignature(tampered);
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
      assert.strictEqual(defaultPort.source, 'SIMULATED_PROJECTION');
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

  describe('Real Execution Adapters & Non-Bypass Security (Phase 4)', () => {
    const {
      MeteoraExecutionAdapter,
      PreStocksExecutionAdapter,
      DemoExecutionAdapter,
      SecurityViolationError,
    } = require('../src/index');
    const { hashTradeIntent, hashFinancialPolicy, hashPortfolioState } = require('@sentinel/domain');

    const testIntent = client.getAgent().proposeIntent({
      assetSymbol: 'NVDAx',
      assetMint: 'NVDA111111111111111111111111111111111111111',
      direction: 'BUY',
      tradeAmountUsd: 5000,
      referencePriceUsd: 120,
      strategyRationale: 'Phase 4 Execution Adapter Validation',
    });

    const createValidTicket = (intent = testIntent) => ({
      ticketId: `auth_${Date.now()}`,
      promiseId: `promise_${Date.now()}`,
      agentId: intent.agentId,
      intentHash: hashTradeIntent(intent),
      policyHash: hashFinancialPolicy(policy),
      preStateHash: hashPortfolioState(portfolio),
      authorizedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      authorizedAmountUsd: intent.tradeAmountUsd,
      authorizedDirection: intent.direction,
      targetAssetSymbol: intent.assetSymbol,
      maxSlippageBps: policy.maxSlippageBps,
    });

    it('MeteoraExecutionAdapter strictly enforces Sentinel authorization ticket (Non-Bypass)', async () => {
      const meteora = new MeteoraExecutionAdapter();
      // Calling directly without ticket must fail!
      await assert.rejects(
        async () => {
          await meteora.executeTrade(testIntent, portfolio);
        },
        {
          name: 'SecurityViolationError',
          message: /Direct Agent->DEX execution prohibited/,
        }
      );
    });

    it('MeteoraExecutionAdapter blocks trade if DBC curve liquidity depth is below $25,000 floor', async () => {
      const meteora = new MeteoraExecutionAdapter();
      meteora.setPoolDepth('NVDAx', 12_000); // Only $12,000 depth (< $25,000 minimum)

      const ticket = createValidTicket();
      await assert.rejects(
        async () => {
          await meteora.executeTrade(testIntent, portfolio, ticket);
        },
        {
          name: 'SecurityViolationError',
          message: /insufficient liquidity depth: \$12,000 < minimum \$25,000/,
        }
      );
    });

    it('MeteoraExecutionAdapter blocks trade if DBC price divergence exceeds 200 bps limit', async () => {
      const meteora = new MeteoraExecutionAdapter();
      meteora.setPoolDepth('NVDAx', 150_000); // Sufficient depth
      meteora.setPoolPriceDivergence('NVDAx', 350); // 350 bps divergence (> 200 bps max)

      const ticket = createValidTicket();
      await assert.rejects(
        async () => {
          await meteora.executeTrade(testIntent, portfolio, ticket);
        },
        {
          name: 'SecurityViolationError',
          message: /excessive price deviation: 3.50% exceeds max allowed 2.00%/,
        }
      );
    });

    it('MeteoraExecutionAdapter settles compliant tokenized equity trade with genuine venue metadata', async () => {
      const meteora = new MeteoraExecutionAdapter();
      meteora.setPoolDepth('NVDAx', 145_000);
      meteora.setPoolPriceDivergence('NVDAx', 18); // 18 bps divergence (< 200 bps)

      const ticket = createValidTicket();
      const result = await meteora.executeTrade(testIntent, portfolio, ticket);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.venueType, 'METEORA_DBC');
      assert.strictEqual(result.venueName, 'Meteora Dynamic Bonding Curve');
      assert.strictEqual(result.poolAddress, '4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk');
      assert.ok(result.route.includes('Meteora DBC Pool'));
      assert.ok(result.marketQuality?.passed);
      assert.ok(result.marketQuality.liquidityPassed);
      assert.ok(result.marketQuality.priceDeviationPassed);
      assert.strictEqual(result.isSimulation, true);
      assert.ok(result.transactionSignature.startsWith('sim_met_dbc_'));
    });

    it('PreStocksExecutionAdapter routes pre-IPO private equity trades with non-bypass check', async () => {
      const preStocks = new PreStocksExecutionAdapter();

      const spacexIntent = client.getAgent().proposeIntent({
        assetSymbol: 'SPACEXx',
        assetMint: 'SPACEX111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 4000,
        referencePriceUsd: 220,
        strategyRationale: 'PreStocks pre-IPO equity allocation',
      });

      // 1. Direct bypass attempt without ticket
      await assert.rejects(
        async () => {
          await preStocks.executeTrade(spacexIntent, portfolio);
        },
        {
          name: 'SecurityViolationError',
          message: /Direct Agent->DEX execution prohibited/,
        }
      );

      // 2. Gated execution with valid Sentinel ticket
      const ticket = createValidTicket(spacexIntent);
      const result = await preStocks.executeTrade(spacexIntent, portfolio, ticket);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.venueType, 'PRESTOCKS_SECONDARY');
      assert.strictEqual(result.venueName, 'PreStocks Secondary Liquidity');
      assert.strictEqual(result.poolAddress, 'PreStkSPACEXVault1111111111111111111111111');
      assert.ok(result.route.includes('PreStocks Secondary Vault'));
      assert.ok(result.transactionSignature.startsWith('sim_prestk_'));
    });

    it('DemoExecutionAdapter rejects expired or tampered authorization tickets', async () => {
      const demo = new DemoExecutionAdapter();

      // Expired ticket
      const expiredTicket = {
        ...createValidTicket(),
        expiresAt: Date.now() - 5000,
      };
      await assert.rejects(
        async () => {
          await demo.executeTrade(testIntent, portfolio, expiredTicket);
        },
        {
          name: 'SecurityViolationError',
          message: /Authorization ticket expired/,
        }
      );

      // Tampered intent hash
      const tamperedTicket = {
        ...createValidTicket(),
        intentHash: 'tampered_hash_00000000000000000000',
      };
      await assert.rejects(
        async () => {
          await demo.executeTrade(testIntent, portfolio, tamperedTicket);
        },
        {
          name: 'SecurityViolationError',
          message: /Authorization ticket intent hash mismatch/,
        }
      );
    });

    it('SentinelClient dynamically routes intents by venue and embeds executionVenue in PROVN evidence', async () => {
      const p4Client = new SentinelClient();
      assert.strictEqual(p4Client.getExecutionVenue(), 'METEORA_DBC');

      // 1. Execute public equity trade -> routes to Meteora DBC
      const reportMeteora = await p4Client.executeDecisionCycle(portfolio, policy, testIntent);
      assert.strictEqual(reportMeteora.status, 'SETTLED');
      assert.strictEqual(reportMeteora.executionResult?.venueType, 'METEORA_DBC');
      assert.strictEqual(reportMeteora.evidenceRecord.executionVenue?.venueType, 'METEORA_DBC');
      assert.ok(reportMeteora.evidenceRecord.executionVenue.poolAddress);

      // 2. Execute pre-IPO private equity trade -> auto-routes to PreStocks Secondary
      const spacexIntent = p4Client.getAgent().proposeIntent({
        assetSymbol: 'SPACEXx',
        assetMint: 'SPACEX111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 2500,
        referencePriceUsd: 220,
        strategyRationale: 'PreStocks auto-routing test',
      });

      const reportPreStocks = await p4Client.executeDecisionCycle(portfolio, policy, spacexIntent);
      assert.strictEqual(reportPreStocks.status, 'SETTLED');
      assert.strictEqual(reportPreStocks.executionResult?.venueType, 'PRESTOCKS_SECONDARY');
      assert.strictEqual(reportPreStocks.evidenceRecord.executionVenue?.venueType, 'PRESTOCKS_SECONDARY');
      assert.ok(reportPreStocks.evidenceRecord.executionVenue.route?.includes('PreStocks Secondary Vault'));

      // 3. Explicit venue switching to Demo Simulation
      p4Client.setExecutionVenue('DEMO_SIMULATION');
      assert.strictEqual(p4Client.getExecutionVenue(), 'DEMO_SIMULATION');
      const reportDemo = await p4Client.executeDecisionCycle(portfolio, policy, testIntent);
      assert.strictEqual(reportDemo.status, 'SETTLED');
      assert.strictEqual(reportDemo.executionResult?.venueType, 'DEMO_SIMULATION');
      assert.strictEqual(reportDemo.evidenceRecord.executionVenue?.venueType, 'DEMO_SIMULATION');
    });
  });

  describe('Promise Model 2.0 & Institutional Audit Explanations (Phase 5)', () => {
    it('constructs a rich 7-dimensional Promise with cryptographic rationale hash', async () => {
      const pClient = new SentinelClient();
      const compliantIntent = pClient.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Targeted allocation expansion within single-asset cap',
      });

      const report = await pClient.executeDecisionCycle(portfolio, policy, compliantIntent);
      const promise = report.promise;

      // Dimension 1: WHO
      assert.strictEqual(promise.who.agentId, pClient.getAgent().agentId);
      assert.strictEqual(promise.who.portfolioId, portfolio.portfolioId);
      assert.ok(promise.who.walletAddress);

      // Dimension 2: WHAT
      assert.strictEqual(promise.what.assetSymbol, 'NVDAx');
      assert.strictEqual(promise.what.side, 'BUY');
      assert.strictEqual(promise.what.amountUsd, 5000);
      assert.strictEqual(promise.what.estimatedTokens, 41.6667);

      // Dimension 3: WHY
      assert.strictEqual(promise.why.strategyRationale, 'Targeted allocation expansion within single-asset cap');
      assert.ok(promise.why.rationaleHash);
      assert.strictEqual(promise.why.rationaleHash.length, 64); // 32-byte sha256 hex string

      // Dimension 4: UNDER WHICH POLICY
      assert.strictEqual(promise.underWhichPolicy.policyVersion, 1);
      assert.ok(promise.underWhichPolicy.policyHash);
      assert.strictEqual(promise.underWhichPolicy.maxSingleAssetBps, 2500);
      assert.strictEqual(promise.underWhichPolicy.minStablecoinBps, 2000);

      // Dimension 5: MARKET ASSUMPTIONS (Pyth)
      assert.strictEqual(promise.marketAssumptions.quotedPriceUsd, 120);
      assert.ok(promise.marketAssumptions.priceSource.includes('Pyth'));
      assert.ok(promise.marketAssumptions.feedId);
      assert.ok(typeof promise.marketAssumptions.publishTimeUtc === 'string');

      // Dimension 6: EXECUTION LIMITS
      assert.strictEqual(promise.executionLimits.maxSlippageBps, 100);
      assert.strictEqual(promise.executionLimits.maxTradeValueUsd, 10000);
      assert.strictEqual(promise.executionLimits.minLiquidityDepthUsd, 25000);

      // Dimension 7: VALIDITY & LIFECYCLE
      assert.strictEqual(promise.status, 'SETTLED');
      assert.ok(promise.validity.createdAt > 0);
      assert.ok(promise.validity.expiresAt > promise.validity.createdAt);
      assert.strictEqual(promise.validity.expiresAt - promise.validity.createdAt, 60000);
    });

    it('generates deterministic "Why did Sentinel allow this?" audit explanations with invariant table', async () => {
      const pClient = new SentinelClient();
      const compliantIntent = pClient.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Expand NVDA position safely within 25% single-stock ceiling',
      });

      const report = await pClient.executeDecisionCycle(portfolio, policy, compliantIntent);
      const explanation = report.evidenceRecord.auditExplanation;

      assert.ok(explanation);
      assert.strictEqual(explanation.decision, 'ALLOWED');
      assert.ok(explanation.headline.includes('Sentinel Authorized'));
      assert.strictEqual(explanation.invariantsEvaluated.length, 6);

      // Invariant 1: Single asset ceiling
      const singleAssetInv = explanation.invariantsEvaluated.find(i => i.name === 'MAX_SINGLE_ASSET');
      assert.ok(singleAssetInv);
      assert.strictEqual(singleAssetInv.passed, true);
      assert.strictEqual(singleAssetInv.threshold, '≤ 25.00%');

      // Invariant 2: Cash reserve floor
      const cashInv = explanation.invariantsEvaluated.find(i => i.name === 'MIN_STABLECOIN');
      assert.ok(cashInv);
      assert.strictEqual(cashInv.passed, true);
      assert.strictEqual(cashInv.threshold, '≥ 20.00%');

      // Invariant 3: Sizing limit
      const sizeInv = explanation.invariantsEvaluated.find(i => i.name === 'MAX_TRADE_SIZE');
      assert.ok(sizeInv);
      assert.strictEqual(sizeInv.passed, true);
      assert.strictEqual(sizeInv.threshold, '≤ $10,000');

      // Invariant 4: Oracle confidence
      const oracleInv = explanation.invariantsEvaluated.find(i => i.name === 'ORACLE_CONFIDENCE');
      assert.ok(oracleInv);
      assert.strictEqual(oracleInv.passed, true);

      // Invariant 5: Quote freshness (Pyth Security Input)
      const freshInv = explanation.invariantsEvaluated.find(i => i.name === 'QUOTE_FRESHNESS');
      assert.ok(freshInv);
      assert.strictEqual(freshInv.passed, true);

      assert.ok(explanation.summary.length > 30);
      assert.ok(explanation.marketTruthSummary.includes('Pyth'));
      assert.ok(explanation.venueQualitySummary.includes('Meteora'));
    });

    it('generates clear "Why did Sentinel block this?" explanations for non-compliant intents', async () => {
      const pClient = new SentinelClient();
      const badIntent = pClient.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15000,
        referencePriceUsd: 120,
        strategyRationale: 'Attempt oversized position exceeding cash floor and trade cap',
      });

      const report = await pClient.executeDecisionCycle(portfolio, policy, badIntent);
      assert.strictEqual(report.status, 'REJECTED');
      assert.strictEqual(report.promise.status, 'REJECTED');

      const explanation = report.evidenceRecord.auditExplanation;
      assert.ok(explanation);
      assert.strictEqual(explanation.decision, 'BLOCKED');
      assert.ok(explanation.headline.includes('Sentinel Blocked'));

      const failedInvariants = explanation.invariantsEvaluated.filter(i => !i.passed);
      assert.ok(failedInvariants.length >= 1);
      assert.ok(explanation.summary.includes('rejected'));
    });
  });

  describe('Institutional Risk Engine DSL & Agent State Tracking (Phase 6)', () => {
    const {
      CONSERVATIVE_INSTITUTIONAL_POLICY,
      BALANCED_MULTI_ASSET_POLICY,
      HIGH_ALPHA_GROWTH_POLICY,
    } = require('@sentinel/domain');

    it('tracks 24h trade volume, turnover, and consecutive failures in AgentRiskState', async () => {
      const p6Client = new SentinelClient();
      const agent = p6Client.getAgent();

      assert.strictEqual(agent.agentRiskState.tradesExecuted24hUsd, 0);
      assert.strictEqual(agent.agentRiskState.consecutiveFailures, 0);

      // Execute a compliant trade ($5,000 NVDAx)
      const compliantIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Phase 6 compliant spend tracking',
      });

      const report1 = await p6Client.executeDecisionCycle(portfolio, policy, compliantIntent);
      assert.strictEqual(report1.status, 'SETTLED');

      const riskStateAfterSettled = p6Client.getAgentRiskState();
      assert.strictEqual(riskStateAfterSettled.tradesExecuted24hUsd, 5000);
      assert.strictEqual(riskStateAfterSettled.consecutiveFailures, 0);
      assert.ok(riskStateAfterSettled.dailyTurnoverBps > 0);

      // Execute a non-compliant trade (rejected) -> consecutive failures increment
      const badIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15000,
        referencePriceUsd: 120,
        strategyRationale: 'Phase 6 failure counter increment test',
      });

      const report2 = await p6Client.executeDecisionCycle(portfolio, policy, badIntent);
      assert.strictEqual(report2.status, 'REJECTED');

      const riskStateAfterReject = p6Client.getAgentRiskState();
      assert.strictEqual(riskStateAfterReject.tradesExecuted24hUsd, 5000); // Unchanged
      assert.strictEqual(riskStateAfterReject.consecutiveFailures, 1);
    });

    it('triggers circuit breaker after repeated failures and blocks future trades until reset', async () => {
      const p6Client = new SentinelClient();
      const agent = p6Client.getAgent();
      const breakerPolicy = {
        ...policy,
        maxConsecutiveFailures: 2,
      };

      const badIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 15000,
        referencePriceUsd: 120,
        strategyRationale: 'Trigger breaker failure 1',
      });

      // Failure 1
      await p6Client.executeDecisionCycle(portfolio, breakerPolicy, badIntent);
      assert.strictEqual(agent.agentRiskState.consecutiveFailures, 1);
      assert.strictEqual(agent.agentRiskState.isCircuitBreakerTriggered, false);

      // Failure 2 -> triggers circuit breaker
      await p6Client.executeDecisionCycle(portfolio, breakerPolicy, badIntent);
      assert.strictEqual(agent.agentRiskState.consecutiveFailures, 2);
      assert.strictEqual(agent.agentRiskState.isCircuitBreakerTriggered, true);

      // Next trade (even compliant one) is blocked by circuit breaker
      const compliantIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        strategyRationale: 'Attempt compliant trade while tripped',
      });

      const blockedReport = await p6Client.executeDecisionCycle(portfolio, breakerPolicy, compliantIntent);
      assert.strictEqual(blockedReport.status, 'REJECTED');
      assert.strictEqual(blockedReport.evidenceRecord.failureCode, 'ERR_CIRCUIT_BREAKER_TRIGGERED');

      // Reset circuit breaker
      p6Client.resetAgentCircuitBreaker();
      assert.strictEqual(p6Client.getAgentRiskState().isCircuitBreakerTriggered, false);
      assert.strictEqual(p6Client.getAgentRiskState().consecutiveFailures, 0);

      // Now compliant trade succeeds!
      const unblockedReport = await p6Client.executeDecisionCycle(portfolio, breakerPolicy, compliantIntent);
      assert.strictEqual(unblockedReport.status, 'SETTLED');
    });

    it('toggles Emergency Pause kill-switch and immediately rejects trades', async () => {
      const p6Client = new SentinelClient();
      const pausedPolicy = p6Client.setEmergencyPause(policy, true);
      assert.strictEqual(pausedPolicy.isEmergencyPaused, true);
      assert.strictEqual(pausedPolicy.policyVersion, policy.policyVersion + 1);

      const intent = p6Client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 1000,
        referencePriceUsd: 120,
        strategyRationale: 'Trade during emergency pause',
      });

      const report = await p6Client.executeDecisionCycle(portfolio, pausedPolicy, intent);
      assert.strictEqual(report.status, 'REJECTED');
      assert.strictEqual(report.evidenceRecord.failureCode, 'ERR_EMERGENCY_PAUSE');

      // Unpause
      const unpausedPolicy = p6Client.setEmergencyPause(pausedPolicy, false);
      assert.strictEqual(unpausedPolicy.isEmergencyPaused, false);
    });

    it('SentinelClient applies institutional risk DSL profiles seamlessly', () => {
      const p6Client = new SentinelClient();

      const conservative = p6Client.applyRiskProfile(CONSERVATIVE_INSTITUTIONAL_POLICY);
      assert.strictEqual(conservative.policyId, 'policy_conservative_institutional');
      assert.strictEqual(conservative.maxSingleAssetBps, 1500);

      const balanced = p6Client.applyRiskProfile(BALANCED_MULTI_ASSET_POLICY);
      assert.strictEqual(balanced.policyId, 'policy_balanced_multi_asset');
      assert.strictEqual(balanced.maxSingleAssetBps, 2500);

      const growth = p6Client.applyRiskProfile(HIGH_ALPHA_GROWTH_POLICY);
      assert.strictEqual(growth.policyId, 'policy_high_alpha_growth');
      assert.strictEqual(growth.maxSingleAssetBps, 3500);
    });
  });

  describe('P5 & P6: Real Portfolio State Projection & Pyth Market Truth Separation', () => {
    const testOwner = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw';

    it('P5: createDefaultPortfolio and buildPortfolio strictly set source to SIMULATED_PROJECTION', () => {
      const pClient = new SentinelClient();
      const defaultPort = pClient.createDefaultPortfolio(testOwner);
      assert.strictEqual(defaultPort.source, 'SIMULATED_PROJECTION');

      const customPort = pClient.buildPortfolio({
        NVDAx: 30000,
        AAPLx: 30000,
        USDC: 40000,
      }, 100000, testOwner);
      assert.strictEqual(customPort.source, 'SIMULATED_PROJECTION');
    });

    it('P5: fetchLiveOnChainPortfolio authoritatively returns ON_CHAIN_PROJECTION when reading SPL token accounts from Solana RPC', async () => {
      const pClient = new SentinelClient();

      // Mock Solana Connection returning genuine parsed token accounts
      const mockRpcConnection = {
        getParsedTokenAccountsByOwner: async (_owner: any, _filter: any) => ({
          value: [
            {
              pubkey: new PublicKey('3wQ9cR6v78y6mQvA4G9n7Z1V4x7K2tL9P6pB1v2m3a4b'),
              account: {
                data: {
                  parsed: {
                    info: {
                      mint: 'NVDA111111111111111111111111111111111111111',
                      tokenAmount: {
                        amount: '150000000',
                        uiAmount: 150,
                        decimals: 6,
                      },
                    },
                  },
                },
              },
            },
            {
              pubkey: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
              account: {
                data: {
                  parsed: {
                    info: {
                      mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
                      tokenAmount: {
                        amount: '35000000000',
                        uiAmount: 35000,
                        decimals: 6,
                      },
                    },
                  },
                },
              },
            },
          ],
        }),
      } as any as Connection;

      pClient.setConnection(mockRpcConnection);
      const livePort = await pClient.fetchLiveOnChainPortfolio(testOwner);

      assert.strictEqual(livePort.source, 'ON_CHAIN_PROJECTION');
      assert.strictEqual(livePort.walletAddress, testOwner);
      assert.strictEqual(livePort.assets.length, 2);

      const nvda = livePort.assets.find(a => a.symbol === 'NVDAx');
      assert.ok(nvda);
      assert.strictEqual(nvda.amount, 150);
      assert.strictEqual(nvda.rawAmount, '150000000');
      assert.strictEqual(nvda.decimals, 6);

      const usdc = livePort.assets.find(a => a.symbol === 'USDC');
      assert.ok(usdc);
      assert.strictEqual(usdc.amount, 35000);
      assert.strictEqual(usdc.rawAmount, '35000000000');
    });

    it('P5: fetchLiveOnChainPortfolio defaults to SIMULATED_PROJECTION when RPC has no token accounts', async () => {
      const pClient = new SentinelClient();
      const emptyMockRpc = {
        getParsedTokenAccountsByOwner: async () => ({ value: [] }),
      } as any as Connection;
      pClient.setConnection(emptyMockRpc);

      const port = await pClient.fetchLiveOnChainPortfolio(testOwner);
      assert.strictEqual(port.source, 'SIMULATED_PROJECTION');
    });

    it('P6: PythPriceAdapter cleanly separates LIVE vs BENCHMARK modes', async () => {
      const pClient = new SentinelClient();
      assert.strictEqual(pClient.getPythMode(), 'BENCHMARK');

      const benchmarkPrice = await pClient.getMarketPrice('NVDAx');
      assert.strictEqual(benchmarkPrice.isSimulation, true);
      assert.ok(benchmarkPrice.source.includes('Pyth'));

      pClient.setPythMode('LIVE');
      assert.strictEqual(pClient.getPythMode(), 'LIVE');

      pClient.setPythMode('BENCHMARK');
      assert.strictEqual(pClient.getPythMode(), 'BENCHMARK');
    });

    it('P6: Stale Pyth oracle quote immediately halts execution with ERR_QUOTE_STALE (fail-closed guarantee)', async () => {
      const pClient = new SentinelClient();
      const port = pClient.createDefaultPortfolio();
      const pol = pClient.createDefaultPolicy();

      const stalePrice: any = {
        symbol: 'NVDAx',
        feedId: '0x0000000000000000000000000000000000000000000000000000000000000001',
        sourceName: 'Pyth Network Hermes Live Feed',
        priceUsd: 120,
        price: 120,
        confidenceUsd: 0.1,
        confidence: 0.1,
        confidenceBps: 8,
        publishTime: Math.floor(Date.now() / 1000) - 180, // 3 minutes stale
        publishTimeUtc: new Date(Date.now() - 180_000).toISOString(),
        ageSeconds: 180,
        status: 'STALE',
        underlyingSymbol: 'NVDA',
        underlyingPriceUsd: 120,
        trackingErrorBps: 0,
        isSimulation: false,
      };

      const intent = pClient.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Compliant sized trade against stale oracle quote',
      });

      // Trade must be rejected because Pyth quote is stale (> 60s maxQuoteAgeSeconds)
      const report = await pClient.executeDecisionCycle(port, pol, intent, stalePrice);
      assert.strictEqual(report.status, 'REJECTED');
      assert.strictEqual(report.evidenceRecord.verificationResult, 'REJECTED');
      assert.strictEqual(report.evidenceRecord.failureCode, 'ERR_QUOTE_STALE');
      assert.ok(report.evidenceRecord.failureReason?.includes('stale'));
    });
  });

  describe('P7, P8 & P9: Pyth Dual-Feeds, PreStocks API Integration & Meteora DBC PDA Derivation', () => {
    const {
      PYTH_METADATA_REGISTRY,
      PYTH_FEED_IDS,
      calculateTrackingErrorBps,
      PreStocksApiClient,
      hashTradeIntent,
    } = require('@sentinel/domain');
    const {
      deriveMeteoraDbcPoolPda,
      METEORA_DBC_PROGRAM_ID,
      METEORA_DBC_AUTHORITY,
      METEORA_DBC_POOLS,
      MeteoraExecutionAdapter,
    } = require('../src/adapters/meteora-adapter');

    it('P7: verifies genuine distinct Pyth feed IDs for tokenized and underlying assets', () => {
      // AAPLx: tokenized and underlying feed IDs must be distinct and non-empty
      const aaplMeta = PYTH_METADATA_REGISTRY.AAPLx;
      assert.ok(aaplMeta);
      assert.notStrictEqual(aaplMeta.tokenizedFeedId, aaplMeta.underlyingFeedId);
      assert.strictEqual(aaplMeta.tokenizedFeedId, PYTH_FEED_IDS.AAPLx.tokenizedFeedId);
      assert.strictEqual(aaplMeta.underlyingFeedId, PYTH_FEED_IDS.AAPLx.underlyingFeedId);

      // NVDAx: tokenized and underlying feed IDs must be distinct
      const nvdaMeta = PYTH_METADATA_REGISTRY.NVDAx;
      assert.ok(nvdaMeta);
      assert.notStrictEqual(nvdaMeta.tokenizedFeedId, nvdaMeta.underlyingFeedId);
      assert.strictEqual(nvdaMeta.tokenizedFeedId, PYTH_FEED_IDS.NVDAx.tokenizedFeedId);
      assert.strictEqual(nvdaMeta.underlyingFeedId, PYTH_FEED_IDS.NVDAx.underlyingFeedId);

      // SPYx: tokenized and underlying feed IDs must be distinct
      const spyMeta = PYTH_METADATA_REGISTRY.SPYx;
      assert.ok(spyMeta);
      assert.notStrictEqual(spyMeta.tokenizedFeedId, spyMeta.underlyingFeedId);
      assert.strictEqual(spyMeta.tokenizedFeedId, PYTH_FEED_IDS.SPYx.tokenizedFeedId);
      assert.strictEqual(spyMeta.underlyingFeedId, PYTH_FEED_IDS.SPYx.underlyingFeedId);
    });

    it('P7: calculates tracking error and enforces peg deviation invariant', () => {
      // 120 vs 122.4 -> 200 bps deviation (2.0%)
      const trackingErrorBps = calculateTrackingErrorBps(122.4, 120);
      assert.strictEqual(trackingErrorBps, 200);

      // Zero deviation
      const zeroError = calculateTrackingErrorBps(100, 100);
      assert.strictEqual(zeroError, 0);

      // Negative deviation (tokenized discount)
      const discountError = calculateTrackingErrorBps(98, 100);
      assert.strictEqual(discountError, 200);
    });

    it('P8: PreStocksApiClient fetches verified pre-IPO assets with certified 409A NAVs', async () => {
      const pClient = new SentinelClient();
      const prestocks = pClient.getPreStocksApiClient();
      assert.ok(prestocks instanceof PreStocksApiClient);

      const assets = await prestocks.fetchPreIpoAssets();
      assert.ok(assets.length >= 4);

      const openai = assets.find((a: any) => a.symbol === 'OPENAIx');
      assert.ok(openai);
      assert.strictEqual(openai.status, 'ACTIVE');
      assert.strictEqual(openai.certifiedNavUsd, 210.00);
      assert.strictEqual(openai.shareClass, 'Secondary Employee Tender Tranche');
      assert.ok(openai.secondaryVaultPda);

      const spacex = assets.find((a: any) => a.symbol === 'SPACEXx');
      assert.ok(spacex);
      assert.strictEqual(spacex.certifiedNavUsd, 140.00);
    });

    it('P8: PreStocks evaluateProposedPreIpoTrade blocks 18% -> 23% and calculates exact $2,000 compliant headroom', () => {
      const pClient = new SentinelClient();
      const prestocks = pClient.getPreStocksApiClient();

      // Construct a $100K portfolio with $18K in Pre-IPO assets (18%)
      const port: any = {
        totalValueUsd: 100_000,
        stablecoinValueUsd: 20_000,
        assets: [
          { symbol: 'OPENAIx', valueUsd: 18_000, assetClass: 'PRE_IPO' },
          { symbol: 'NVDAx', valueUsd: 40_000, assetClass: 'PUBLIC_EQUITY' },
          { symbol: 'AAPLx', valueUsd: 22_000, assetClass: 'PUBLIC_EQUITY' },
          { symbol: 'USDC', valueUsd: 20_000, assetClass: 'STABLE' },
        ],
      };
      const pol: any = {
        maxPreIpoExposureBps: 2000, // 20.00% ceiling
        maxTradeValueUsd: 10_000,
      };

      // 1. Proposed trade: BUY $5,000 OPENAIx -> projected 23% ($23K / $100K) -> MUST BLOCK!
      const nonCompliant = prestocks.evaluateProposedPreIpoTrade(port, pol, 'OPENAIx', 5000);
      assert.strictEqual(nonCompliant.canExecute, false);
      assert.strictEqual(nonCompliant.projectedExposureBps, 2300); // 23.00%
      assert.strictEqual(nonCompliant.maxCompliantAmountUsd, 2000); // Exactly $2,000 headroom
      assert.ok(nonCompliant.rejectionReason?.includes('23.0%'));
      assert.ok(nonCompliant.rejectionReason?.includes('20.0%'));

      // 2. Auto-adapted trade: BUY $2,000 OPENAIx -> projected 20% ($20K / $100K) -> MUST PASS!
      const compliant = prestocks.evaluateProposedPreIpoTrade(port, pol, 'OPENAIx', 2000);
      assert.strictEqual(compliant.canExecute, true);
      assert.strictEqual(compliant.projectedExposureBps, 2000); // Exactly 20.00%
      assert.strictEqual(compliant.maxCompliantAmountUsd, 2000);
    });

    it('P9: derives genuine Meteora DBC pool PDAs matching verified Solana addresses', () => {
      assert.strictEqual(METEORA_DBC_PROGRAM_ID.toBase58(), 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
      assert.strictEqual(METEORA_DBC_AUTHORITY.toBase58(), 'FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM');

      // NVDAx pool PDA derived from official mint
      const nvdaxMint = 'NVDA111111111111111111111111111111111111111';
      const nvdaxDerived = deriveMeteoraDbcPoolPda(nvdaxMint);
      assert.strictEqual(nvdaxDerived, '4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk');
      assert.strictEqual(METEORA_DBC_POOLS.NVDAx, '4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk');

      // AAPLx pool PDA derived from official mint
      const aaplxMint = 'AAPL111111111111111111111111111111111111111';
      const aaplxDerived = deriveMeteoraDbcPoolPda(aaplxMint);
      assert.strictEqual(aaplxDerived, 'Lju8wdGRe5UreH3j8oPw5puDEeJTR9CQQWyj4EFmmga');
      assert.strictEqual(METEORA_DBC_POOLS.AAPLx, 'Lju8wdGRe5UreH3j8oPw5puDEeJTR9CQQWyj4EFmmga');

      // SPYx pool PDA derived from official mint
      const spyxMint = 'SPYX111111111111111111111111111111111111111';
      const spyxDerived = deriveMeteoraDbcPoolPda(spyxMint);
      assert.strictEqual(spyxDerived, '7qyKe5feUC4s7mWmYVnxuRstGCW3txuxjZ7ULk5KxHtM');
      assert.strictEqual(METEORA_DBC_POOLS.SPYx, '7qyKe5feUC4s7mWmYVnxuRstGCW3txuxjZ7ULk5KxHtM');
    });

    it('P9: Meteora Equity Market Guard enforces liquidity floor ($25k) and price divergence limits', async () => {
      const meteora = new MeteoraExecutionAdapter();
      const pClient = new SentinelClient();
      const port = pClient.createDefaultPortfolio();
      const intent = pClient.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Equity Market Guard verification',
      });
      const ticket: any = {
        ticketId: 'test_ticket_001',
        promiseId: 'test_promise_001',
        agentId: intent.agentId,
        intentHash: hashTradeIntent(intent),
        policyHash: 'hash_002',
        preStateHash: 'hash_003',
        authorizedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        authorizedAmountUsd: 5000,
        authorizedDirection: 'BUY',
        targetAssetSymbol: 'NVDAx',
        maxSlippageBps: 100,
      };

      // 1. Shallow liquidity ($15k < $25k floor) -> Blocked
      meteora.setPoolDepth('NVDAx', 15_000);
      meteora.setPoolPriceDivergence('NVDAx', 20);
      await assert.rejects(
        async () => {
          await meteora.executeTrade(intent, port, ticket);
        },
        {
          name: 'SecurityViolationError',
          message: /insufficient liquidity depth: \$15,000 < minimum \$25,000/,
        }
      );

      // 2. Excessive divergence (250 bps > 200 bps limit) -> Blocked
      meteora.setPoolDepth('NVDAx', 100_000);
      meteora.setPoolPriceDivergence('NVDAx', 250);
      await assert.rejects(
        async () => {
          await meteora.executeTrade(intent, port, ticket);
        },
        {
          name: 'SecurityViolationError',
          message: /price deviation: 2.50% exceeds max allowed 2.00%/,
        }
      );

      // 3. Healthy depth ($100k) and tight pricing (20 bps) -> Settles with genuine derived pool PDA
      meteora.setPoolDepth('NVDAx', 100_000);
      meteora.setPoolPriceDivergence('NVDAx', 20);
      const execution = await meteora.executeTrade(intent, port, ticket);
      assert.strictEqual(execution.success, true);
      assert.strictEqual(execution.poolAddress, '4bHAChVfYLtyVuZLXmfa6oysGbJnJix93LJsz61WLckk');
      assert.strictEqual(execution.venueType, 'METEORA_DBC');
    });
  });
});

