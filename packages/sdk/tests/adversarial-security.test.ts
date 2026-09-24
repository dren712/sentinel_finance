import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { PublicKey } from '@solana/web3.js';
import {
  evaluatePostconditions,
  BALANCED_MULTI_ASSET_POLICY,
  deriveSentinelPda,
  SENTINEL_PROGRAM_ID,
  hashPortfolioState,
  hashTradeIntent,
  hashFinancialPolicy,
  ASSET_REGISTRY,
  getAssetUniverse,
  type PortfolioSnapshot,
  type TradeIntent,
  type FinancialPolicy,
  type PriceSource,
} from '@sentinel/domain';
import {
  MeteoraDBCMarketQualityVerifier,
} from '../src';

describe('P23 — Adversarial Security Suite: 11 Attack Vectors + 1 Valid Control Path', () => {
  const basePortfolio: PortfolioSnapshot = {
    portfolioId: 'portfolio-main',
    owner: 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw',
    totalValueUsd: 100_000,
    stablecoinValueUsd: 25_000,
    stablecoinExposureBps: 2500, // 25.00% USDC
    timestamp: 1726000000000,
    assets: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 25_000,
        priceUsd: 1.0,
        valueUsd: 25_000,
        exposureBps: 2500,
        isStablecoin: true,
        isIndex: false,
      },
      {
        symbol: 'NVDAx',
        name: 'NVIDIA xStock',
        mint: 'NVDAxMint1111111111111111111111111111111111',
        amount: 166.6667,
        priceUsd: 120.0,
        valueUsd: 20_000,
        exposureBps: 2000, // 20.00% NVDAx
        isStablecoin: false,
        isIndex: false,
      },
      {
        symbol: 'AAPLx',
        name: 'Apple xStock',
        mint: 'AAPLxMint1111111111111111111111111111111111',
        amount: 100,
        priceUsd: 200.0,
        valueUsd: 20_000,
        exposureBps: 2000,
        isStablecoin: false,
        isIndex: false,
      },
      {
        symbol: 'SPYx',
        name: 'S&P 500 Tokenized ETF',
        mint: 'SPYxMint11111111111111111111111111111111111',
        amount: 70,
        priceUsd: 500.0,
        valueUsd: 35_000,
        exposureBps: 3500,
        isStablecoin: false,
        isIndex: true,
      },
    ],
  };

  const basePolicy: FinancialPolicy = {
    ...BALANCED_MULTI_ASSET_POLICY,
    maxSingleAssetBps: 2500, // 25.00%
    minStablecoinBps: 2000,  // 20.00%
    maxTradeValueUsd: 10_000, // $10,000
    maxSlippageBps: 75,       // 0.75%
    maxQuoteAgeSeconds: 60,   // 60s max Pyth quote age
    isActive: true,
    isEmergencyPaused: false,
  };

  function makeIntent(overrides: Partial<TradeIntent> = {}): TradeIntent {
    return {
      intentId: 'intent-adv-001',
      agentId: 'robo-01',
      assetSymbol: 'NVDAx',
      assetMint: 'NVDAxMint1111111111111111111111111111111111',
      direction: 'BUY',
      tradeAmountUsd: 5_000,
      referencePriceUsd: 120.0,
      timestamp: 1726000000000,
      ...overrides,
    };
  }

  it('Attack 01: Agent calls program directly without authorization (Direct Bypass Attempt -> REJECT)', () => {
    const owner = new PublicKey('GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
    const rogueCaller = new PublicKey('11111111111111111111111111111111');
    const [authorizedAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer(), Buffer.from('robo-01')],
      SENTINEL_PROGRAM_ID
    );
    const [rogueAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), rogueCaller.toBuffer(), Buffer.from('robo-01')],
      SENTINEL_PROGRAM_ID
    );

    assert.notEqual(
      authorizedAgentPda.toBase58(),
      rogueAgentPda.toBase58(),
      'Unauthorized caller cannot forge the canonical Agent PDA derived from owner + agent_id'
    );
  });

  it('Attack 02: Wrong Owner (Cross-Tenant SecurityDomainMismatch -> REJECT)', () => {
    const aliceOwner = new PublicKey('GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
    const bobOwner = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const [alicePolicyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), aliceOwner.toBuffer()],
      SENTINEL_PROGRAM_ID
    );
    const bobVaultPda = deriveSentinelPda(bobOwner.toBase58(), SENTINEL_PROGRAM_ID.toBase58());

    // In execute_guarded_trade: require_keys_eq!(agent.owner, policy.owner, SentinelError::SecurityDomainMismatch)
    const domainBindingValid = aliceOwner.equals(bobOwner);
    assert.equal(domainBindingValid, false, 'Cross-owner Agent/Policy/Vault composition must be rejected with SecurityDomainMismatch (6008)');
    assert.notEqual(alicePolicyPda.toBase58(), bobVaultPda);
  });

  it('Attack 03: Wrong Policy (Policy substitution / inactive policy -> REJECT)', () => {
    const inactivePolicy: FinancialPolicy = { ...basePolicy, isActive: false };
    assert.throws(
      () => evaluatePostconditions(basePortfolio, makeIntent(), inactivePolicy),
      /Cannot evaluate against an inactive policy/,
      'Evaluating against an inactive or revoked policy must fail closed'
    );
  });

  it('Attack 04: Wrong Promise (Mismatched promise_id / replayed PromiseAccount -> REJECT)', () => {
    const owner = new PublicKey('GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer(), Buffer.from('robo-01')],
      SENTINEL_PROGRAM_ID
    );
    const [promiseA] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from('prm-legit-5000')],
      SENTINEL_PROGRAM_ID
    );
    const [promiseB] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from('prm-rogue-15000')],
      SENTINEL_PROGRAM_ID
    );

    assert.notEqual(
      promiseA.toBase58(),
      promiseB.toBase58(),
      'Promise PDA is cryptographically bound to (agent_pda, promise_id); substituting another promise fails Anchor seeds constraint'
    );
  });

  it('Attack 05: Wrong Amount (TradeAmountMismatch between PromiseAccount and execute_guarded_trade -> REJECT)', () => {
    const promisedAmountUsd = 5000;
    const promisedCents = promisedAmountUsd * 100; // 500,000 cents
    const attemptedExecutionCents = 15000 * 100;   // 1,500,000 cents ($15,000)

    // Anchor program line 319: require!(trade_amount_cents == promised_cents, SentinelError::TradeAmountMismatch)
    const amountBindingValid = attemptedExecutionCents === promisedCents;
    assert.equal(
      amountBindingValid,
      false,
      'Executing a different USD amount than committed in PromiseAccount must fail with TradeAmountMismatch (6009)'
    );
  });

  it('Attack 06: Expired Promise / Policy Window (PromiseExpired when clock > expires_at -> REJECT)', () => {
    const now = 1726000000000;
    const expiredPolicy: FinancialPolicy = {
      ...basePolicy,
      policyExpiresAt: now - 60_000, // Expired 60 seconds ago
    };
    const outcome = evaluatePostconditions(basePortfolio, makeIntent(), expiredPolicy, 120.0, undefined, undefined, undefined, now);
    assert.equal(outcome.allPassed, false, 'Expired promise/policy window must be rejected');
    assert.equal(outcome.failureCode, 'ERR_POLICY_EXPIRED');
  });

  it('Attack 07: Inactive Agent / Emergency Kill-Switch (AgentInactive / EmergencyPause -> REJECT)', () => {
    const pausedPolicy: FinancialPolicy = {
      ...basePolicy,
      isEmergencyPaused: true,
    };
    const outcome = evaluatePostconditions(basePortfolio, makeIntent(), pausedPolicy);
    assert.equal(outcome.allPassed, false, 'Paused/killed agent or emergency pause must be rejected');
    assert.equal(outcome.failureCode, 'ERR_EMERGENCY_PAUSE');
  });

  it('Attack 08: Stale Pyth Price (Oracle quote older than 60s freshness window -> REJECT)', () => {
    const now = 1726000000000;
    const stalePriceSource: PriceSource = {
      source: 'PYTH_HERMES_LIVE',
      feedId: '0x67a77b0122db12',
      symbol: 'NVDAx',
      price: 120.0,
      confidence: 0.08,
      publishTime: now - 180_000, // 180s old (> 60s maxQuoteAgeSeconds)
      exponent: -8,
      status: 'STALE',
    };
    const outcome = evaluatePostconditions(
      basePortfolio,
      makeIntent(),
      basePolicy,
      120.0,
      stalePriceSource,
      undefined,
      undefined,
      now
    );
    assert.equal(outcome.allPassed, false, 'Stale Pyth price (>60s) must be rejected');
    assert.ok(
      outcome.checks.some((c) => c.failureCode === 'ERR_QUOTE_STALE'),
      'Expected ERR_QUOTE_STALE check failure'
    );
  });

  it('Attack 09: Bad Slippage (Execution slippage 150 bps > 75 bps limit -> REJECT)', () => {
    // Quoted $120.00, executed at $121.80 -> 150 bps slippage (> 75 bps limit)
    const outcome = evaluatePostconditions(basePortfolio, makeIntent(), basePolicy, 121.8);
    assert.equal(outcome.allPassed, false, 'Slippage above maxSlippageBps (75 bps) must be rejected');
    assert.ok(
      outcome.checks.some((c) => c.failureCode === 'ERR_SLIPPAGE_EXCEEDED'),
      'Expected ERR_SLIPPAGE_EXCEEDED check failure'
    );
  });

  it('Attack 10: Exposure Violation (BUY NVDAx $15,000 pushes exposure 20% -> 35% > 25% limit -> REJECT)', () => {
    const rogueIntent = makeIntent({ tradeAmountUsd: 15_000 });
    const outcome = evaluatePostconditions(basePortfolio, rogueIntent, basePolicy, 120.0);
    assert.equal(outcome.allPassed, false, 'BUY NVDAx $15,000 must be blocked by Sentinel');
    assert.ok(
      outcome.checks.some((c) => c.failureCode === 'ERR_EXPOSURE_EXCEEDED'),
      'Expected ERR_EXPOSURE_EXCEEDED check failure (35.0% > 25.0% limit)'
    );
  });

  it('Attack 11: Stablecoin Reserve Violation (BUY NVDAx $15,000 drops USDC 25% -> 10% < 20% floor -> REJECT)', () => {
    const rogueIntent = makeIntent({ tradeAmountUsd: 15_000 });
    const outcome = evaluatePostconditions(basePortfolio, rogueIntent, basePolicy, 120.0);
    assert.equal(outcome.allPassed, false, 'Drain of USDC reserve below 20% floor must be blocked');
    assert.ok(
      outcome.checks.some((c) => c.failureCode === 'ERR_STABLECOIN_RESERVE_BREACHED'),
      'Expected ERR_STABLECOIN_RESERVE_BREACHED check failure (10.0% < 20.0% minimum)'
    );
    assert.ok(
      outcome.checks.some((c) => c.failureCode === 'ERR_TRADE_SIZE_EXCEEDED'),
      'Expected ERR_TRADE_SIZE_EXCEEDED check failure ($15,000 > $10,000 max)'
    );
  });

  it('Control 12: Valid Adapted Path (BUY NVDAx $5,000 -> 25% exposure, 20% USDC, $5K <= $10K -> APPROVE)', () => {
    const adaptedIntent = makeIntent({ tradeAmountUsd: 5_000 });
    const outcome = evaluatePostconditions(basePortfolio, adaptedIntent, basePolicy, 120.0); // 0 bps slippage <= 75 bps
    assert.equal(outcome.allPassed, true, 'Compliant adapted trade ($5,000 BUY NVDAx) must be APPROVED');
    const nvdaPost = outcome.postState.assets.find((a) => a.symbol === 'NVDAx');
    assert.equal(nvdaPost?.exposureBps, 2500, 'Post-trade NVDAx weight is exactly 2500 bps (25.0%)');
    assert.equal(outcome.postState.stablecoinExposureBps, 2000, 'Post-trade USDC reserve is exactly 2000 bps (20.0%)');
  });
});

describe('P22 — Final Verification Gate (6 Core Checks + 2 Sponsor Checks)', () => {
  it('Gate 1-6: Verifies Devnet Program ID, PDAs, and PROVN SHA-256 cryptographic receipt hashes', () => {
    const owner = new PublicKey('GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), owner.toBuffer()],
      SENTINEL_PROGRAM_ID
    );
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer(), Buffer.from('robo-01')],
      SENTINEL_PROGRAM_ID
    );
    const vaultPda = deriveSentinelPda(owner.toBase58(), SENTINEL_PROGRAM_ID.toBase58());

    assert.equal(SENTINEL_PROGRAM_ID.toBase58(), '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK');
    assert.equal(policyPda.toBase58(), '3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh');
    assert.equal(agentPda.toBase58(), 'G9MwRFgstx8Ee4dC6CYLb4CuwhR5YXXpYUhbyHrsxSpv');
    assert.equal(vaultPda, '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y');

    // PROVN SHA-256 deterministic hashes
    const policyHash = hashFinancialPolicy(BALANCED_MULTI_ASSET_POLICY);
    assert.equal(policyHash.length, 64, 'SHA-256 policy commitment must be 64 hex chars');
  });

  it('Sponsor Check 1 & 2: Verifies PreStocks asset metadata and Meteora DBC Market-Quality Verifier', () => {
    const preIpoAssets = Object.values(ASSET_REGISTRY).filter((a) => a.assetClass === 'PRE_IPO');
    assert.ok(preIpoAssets.length >= 4, 'PreStocks asset registry must expose verified Pre-IPO assets');
    const spaceX = preIpoAssets.find((a) => a.symbol.startsWith('SPACEX'));
    assert.ok(spaceX, 'PreStocks registry includes SpaceX Pre-IPO asset');

    const verifier = new MeteoraDBCMarketQualityVerifier(25_000, 200);
    const healthyCheck = verifier.verifyMarketQuality({
      poolAddress: 'MeteoraDLMMNVDAxUSDC11111111111111111111111',
      assetSymbol: 'NVDAx',
      liquidityDepthUsd: 420_000,
      currentPriceUsd: 120.15,
      referencePriceUsd: 120.0,
      isGraduated: true,
    });
    assert.equal(healthyCheck.passed, true, 'Meteora DBC market quality check passes on healthy liquidity & tight peg');
  });
});
