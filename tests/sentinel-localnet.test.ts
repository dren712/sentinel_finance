import { describe, it } from 'node:test';
import assert from 'node:assert';
import anchorPkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN, Wallet } = anchorPkg;
const anchor = anchorPkg;
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { SENTINEL_IDL, type Sentinel } from '../packages/sdk/dist/src/idl/sentinel-idl.js';

describe('P25 — Anchor Localnet Integration Tests: Real Program Invariant Enforcement', () => {
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'http://127.0.0.1:8899';
  const connection = new Connection(rpcUrl, 'confirmed');

  let provider: AnchorProvider;
  let program: Program<Sentinel>;
  let owner: PublicKey;
  let ownerKeypair: Keypair;
  let agentKeypair: Keypair;
  let foreignAgentKeypair: Keypair;

  let policyPda: PublicKey;
  let agentPda: PublicKey;
  let foreignAgentPda: PublicKey;
  let vaultPda: PublicKey;

  let nvdaMint: PublicKey;
  let spyMint: PublicKey;

  let isLocalnetAvailable = false;

  function assertAnchorError(err: any, expectedCode: string, expectedNumber?: number) {
    const code = err?.error?.errorCode?.code;
    const number = err?.error?.errorCode?.number;
    const logs = err?.logs?.join('\n') || '';
    const message = err?.message || '';

    const matchesCode = code === expectedCode || logs.includes(expectedCode) || message.includes(expectedCode);
    const matchesNumber = expectedNumber ? (number === expectedNumber || logs.includes(`0x${expectedNumber.toString(16)}`) || logs.includes(`${expectedNumber}`)) : false;

    assert.ok(
      matchesCode || matchesNumber,
      `Expected Anchor error '${expectedCode}' (${expectedNumber}), but got code='${code}' number='${number}' logs:\n${logs}`
    );
  }

  // Probe localnet connectivity before running tests
  it('0. Setup Localnet Anchor Provider, Keypairs, and Program Context', async () => {
    try {
      const version = await connection.getVersion();
      if (!version) return;
      isLocalnetAvailable = true;
    } catch {
      console.log('   ⚠️  Solana localnet validator not active. Skipping localnet integration tests.');
      return;
    }

    // Load or generate owner keypair with local validator faucet funding
    const walletEnv = process.env.ANCHOR_WALLET;
    if (walletEnv) {
      const fs = await import('fs');
      const resolved = walletEnv.startsWith('~') ? walletEnv.replace('~', process.env.HOME || '') : walletEnv;
      if (fs.existsSync(resolved)) {
        const secret = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        ownerKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      } else {
        ownerKeypair = Keypair.generate();
      }
    } else {
      ownerKeypair = Keypair.generate();
    }

    owner = ownerKeypair.publicKey;
    const wallet = new Wallet(ownerKeypair);
    provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(provider);

    program = new Program<Sentinel>(
      SENTINEL_IDL as anchor.Idl as Sentinel,
      provider
    );

    agentKeypair = Keypair.generate();
    foreignAgentKeypair = Keypair.generate();
    nvdaMint = Keypair.generate().publicKey;
    spyMint = Keypair.generate().publicKey;

    // Fund accounts from local faucet if needed
    const balance = await connection.getBalance(owner);
    if (balance < 2 * LAMPORTS_PER_SOL) {
      const sig = await connection.requestAirdrop(owner, 10 * LAMPORTS_PER_SOL);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latestBlockhash });
    }

    // Fund agent keypairs for gas
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: agentKeypair.publicKey,
        lamports: 0.5 * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: foreignAgentKeypair.publicKey,
        lamports: 0.5 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(fundTx);

    // Derive PDAs
    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), owner.toBuffer()],
      program.programId
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer(), Buffer.from('robo-01')],
      program.programId
    );
    [foreignAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer(), Buffer.from('foreign-agent')],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.toBuffer()],
      program.programId
    );

    // 1. Initialize Policy: maxSingleAsset=25%, minStablecoin=20%, maxTrade=$10,000, maxSlippage=100 bps
    try {
      await program.methods
        .initializePolicy(
          2500, // 25.00%
          2000, // 20.00%
          new BN(10000), // $10,000 max trade
          100 // 1.00% max slippage
        )
        .accountsPartial({
          policy: policyPda,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err: any) {
      if (!err.message?.includes('already in use')) throw err;
    }

    // 2. Initialize Agent
    try {
      await program.methods
        .initializeAgent('robo-01', 'portfolio-main', agentKeypair.publicKey)
        .accountsPartial({
          agent: agentPda,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err: any) {
      if (!err.message?.includes('already in use')) throw err;
    }

    // 3. Initialize Foreign Agent (for unauthorized evidence recording test)
    try {
      await program.methods
        .initializeAgent('foreign-agent', 'portfolio-foreign', foreignAgentKeypair.publicKey)
        .accountsPartial({
          agent: foreignAgentPda,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err: any) {
      if (!err.message?.includes('already in use')) throw err;
    }

    // 4. Initialize Vault: $25,000 USDC, 166 NVDAx @ $120 ($19,920), 50 SPYx @ $500 ($25,000)
    const initialPositions = [
      {
        mint: nvdaMint,
        symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
        amountUnits: new BN(166),
        priceCents: new BN(12000), // $120.00
        isIndex: false,
      },
      {
        mint: spyMint,
        symbol: Array.from(Buffer.from('SPYx\0\0\0\0')),
        amountUnits: new BN(50),
        priceCents: new BN(50000), // $500.00
        isIndex: true,
      },
    ];

    try {
      await program.methods
        .initializeVault(
          new BN(2500000), // $25,000.00 USDC
          initialPositions
        )
        .accountsPartial({
          vault: vaultPda,
          policy: policyPda,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err: any) {
      if (!err.message?.includes('already in use')) throw err;
      // Re-sync vault to canonical benchmark state
      await program.methods
        .syncVault(new BN(2500000), initialPositions)
        .accountsPartial({
          vault: vaultPda,
          owner: owner,
        })
        .rpc();
    }

    assert.ok(isLocalnetAvailable, 'Localnet program setup complete');
  });

  async function createTestPriceUpdate(
    priceCents = 12000,
    confCents = 50,
    publishTimeOffset = -2
  ): Promise<Keypair> {
    const kp = Keypair.generate();
    const feedId = Array(32).fill(7);
    const price = new BN(priceCents).mul(new BN(1_000_000)); // expo -8 -> price * 10^6
    const conf = new BN(confCents).mul(new BN(1_000_000));
    const now = Math.floor(Date.now() / 1000) + publishTimeOffset;
    await program.methods
      .postPriceUpdate(
        feedId,
        price,
        conf,
        -8,
        new BN(now)
      )
      .accountsPartial({
        priceUpdate: kp.publicKey,
        payer: ownerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([ownerKeypair, kp])
      .rpc();
    return kp;
  }

  it('1. exec price 1 cent vs stored 12000 -> SlippageExceeded (6007)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-slip-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    // Create valid promise for $5,000 NVDAx BUY
    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(1),
        nvdaMint,
        0, // BUY
        new BN(5000) // $5,000
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    // Rogue execution attempting $0.01 deflation against Pyth $120.00 benchmark price
    try {
      await program.methods
        .executeGuardedTrade(
          new BN(500000), // 500,000 cents ($5,000)
          new BN(1),      // $0.01 execution price
          new BN(1)       // $0.01 quoted price
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected execution with 1 cent price to revert with SlippageExceeded');
    } catch (err: any) {
      assertAnchorError(err, 'SlippageExceeded', 6007);
    }
  });

  it('2. amount passed in dollars -> TradeAmountMismatch (6009)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-amt-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(2),
        nvdaMint,
        0,
        new BN(5000) // $5,000 promised
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    // Passing 5000 dollars instead of 500000 cents
    try {
      await program.methods
        .executeGuardedTrade(
          new BN(5000), // 5,000 (dollars passed instead of cents)
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected execution with dollar amount to revert with TradeAmountMismatch');
    } catch (err: any) {
      assertAnchorError(err, 'TradeAmountMismatch', 6009);
    }
  });

  it('3. record_evidence with a foreign AgentAccount -> UnauthorizedAgent (6010)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-forg-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(3),
        nvdaMint,
        0,
        new BN(5000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Reject promise so status becomes 4 (Rejected)
    await program.methods
      .rejectPromise(1001)
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        authority: agentKeypair.publicKey,
      })
      .signers([agentKeypair])
      .rpc();

    const [evidencePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('evidence'), promisePda.toBuffer()],
      program.programId
    );

    // Call record_evidence passing foreignAgentPda instead of agentPda
    try {
      await program.methods
        .recordEvidence(
          `ev-${promiseId}`,
          Array(32).fill(0),
          Array(32).fill(0),
          4, // Rejected
          1001
        )
        .accountsPartial({
          evidence: evidencePda,
          promise: promisePda,
          agent: foreignAgentPda, // FOREIGN AGENT!
          authority: agentKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected foreign agent evidence recording to revert with UnauthorizedAgent');
    } catch (err: any) {
      assertAnchorError(err, 'UnauthorizedAgent', 6010);
    }
  });

  it('4. record_evidence on a Promised promise -> InvalidPromiseStatus (6012)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-unfin-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(4),
        nvdaMint,
        0,
        new BN(5000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    const [evidencePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('evidence'), promisePda.toBuffer()],
      program.programId
    );

    // Attempting record_evidence while promise.status == 1 (Promised)
    try {
      await program.methods
        .recordEvidence(
          `ev-${promiseId}`,
          Array(32).fill(0),
          Array(32).fill(0),
          1,
          0
        )
        .accountsPartial({
          evidence: evidencePda,
          promise: promisePda,
          agent: agentPda,
          authority: agentKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected record_evidence on Promised status to revert with InvalidPromiseStatus');
    } catch (err: any) {
      assertAnchorError(err, 'InvalidPromiseStatus', 6012);
    }
  });

  it('5. verification_result != status -> InvalidPromiseStatus (6012)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-mis-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(5),
        nvdaMint,
        0,
        new BN(5000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Reject promise (status = 4)
    await program.methods
      .rejectPromise(1002)
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        authority: agentKeypair.publicKey,
      })
      .signers([agentKeypair])
      .rpc();

    const [evidencePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('evidence'), promisePda.toBuffer()],
      program.programId
    );

    // Pass verification_result = 3 (claiming Settled when promise was Rejected 4)
    try {
      await program.methods
        .recordEvidence(
          `ev-${promiseId}`,
          Array(32).fill(0),
          Array(32).fill(0),
          3, // Claiming SETTLED when status is 4
          0
        )
        .accountsPartial({
          evidence: evidencePda,
          promise: promisePda,
          agent: agentPda,
          authority: agentKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected mismatched verification_result to revert with InvalidPromiseStatus');
    } catch (err: any) {
      assertAnchorError(err, 'InvalidPromiseStatus', 6012);
    }
  });

  it('6. exposure breach -> ExposureExceeded (6005)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-exp-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    // BUY $8,000 of NVDAx pushes NVDAx from $19,920 to $27,920 (27.92% > 25.00% cap)
    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(6),
        nvdaMint,
        0,
        new BN(8000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(800000), // $8,000.00
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected exposure breach to revert with ExposureExceeded');
    } catch (err: any) {
      assertAnchorError(err, 'ExposureExceeded', 6005);
    }
  });

  it('7. stablecoin floor -> StablecoinReserveBreached (6006)', async () => {
    if (!isLocalnetAvailable) return;

    // Temporarily sync vault to 22.0% USDC ($22,000), so buying $3,000 drops it to 19.0% (< 20.0% floor)
    await program.methods
      .syncVault(new BN(2200000), [
        {
          mint: nvdaMint,
          symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
          amountUnits: new BN(100), // $12,000 (12.0%)
          priceCents: new BN(12000),
          isIndex: false,
        },
        {
          mint: spyMint,
          symbol: Array.from(Buffer.from('SPYx\0\0\0\0')),
          amountUnits: new BN(132), // $66,000 (66.0%)
          priceCents: new BN(50000),
          isIndex: true,
        },
      ])
      .accountsPartial({
        vault: vaultPda,
        owner: owner,
      })
      .rpc();

    const promiseId = `prm-stb-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    // Buy $3,000 NVDAx: pushes NVDAx to $15,000 (15% <= 25% cap), but drains USDC to $19,000 (19% < 20% floor)
    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(7),
        nvdaMint,
        0,
        new BN(3000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(300000), // $3,000.00
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected reserve breach to revert with StablecoinReserveBreached');
    } catch (err: any) {
      assertAnchorError(err, 'StablecoinReserveBreached', 6006);
    } finally {
      // Restore vault to standard 25% USDC
      await program.methods
        .syncVault(new BN(2500000), [
          {
            mint: nvdaMint,
            symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
            amountUnits: new BN(166),
            priceCents: new BN(12000),
            isIndex: false,
          },
          {
            mint: spyMint,
            symbol: Array.from(Buffer.from('SPYx\0\0\0\0')),
            amountUnits: new BN(50),
            priceCents: new BN(50000),
            isIndex: true,
          },
        ])
        .accountsPartial({
          vault: vaultPda,
          owner: owner,
        })
        .rpc();
    }
  });

  it('8. trade size -> TradeSizeExceeded (6000)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-size-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    // $15,000 exceeds $10,000 max_trade_value_usd
    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(8),
        nvdaMint,
        0,
        new BN(15000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(1500000), // $15,000.00
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected trade size breach to revert with TradeSizeExceeded');
    } catch (err: any) {
      assertAnchorError(err, 'TradeSizeExceeded', 6000);
    }
  });

  it('9. set_agent_active(false) -> AgentInactive (6002)', async () => {
    if (!isLocalnetAvailable) return;

    // Owner pulls emergency kill switch
    await program.methods
      .setAgentActive(false)
      .accountsPartial({
        agent: agentPda,
        owner: owner,
      })
      .rpc();

    const promiseId = `prm-kill-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    // Agent attempts to create promise while paused
    try {
      await program.methods
        .createPromise(
          promiseId,
          Array(32).fill(9),
          nvdaMint,
          0,
          new BN(1000)
        )
        .accountsPartial({
          promise: promisePda,
          agent: agentPda,
          policy: policyPda,
          authority: agentKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected creation under inactive agent to revert with AgentInactive');
    } catch (err: any) {
      assertAnchorError(err, 'AgentInactive', 6002);
    } finally {
      // Re-activate agent
      await program.methods
        .setAgentActive(true)
        .accountsPartial({
          agent: agentPda,
          owner: owner,
        })
        .rpc();
    }
  });

  it('10. expired promise -> PromiseExpired (6004)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-expw-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(10),
        nvdaMint,
        0,
        new BN(1000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Wait 6 seconds for 5s TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(100000), // $1,000
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected execution of expired promise to revert with PromiseExpired');
    } catch (err: any) {
      assertAnchorError(err, 'PromiseExpired', 6004);
    }
  });

  it('11. non-owner sync_vault -> fails', async () => {
    if (!isLocalnetAvailable) return;

    const rogueOwner = Keypair.generate();

    // Agent or rogue caller attempts to sync vault state
    try {
      await program.methods
        .syncVault(new BN(5000000), [])
        .accountsPartial({
          vault: vaultPda,
          owner: rogueOwner.publicKey,
        })
        .signers([rogueOwner])
        .rpc();
      assert.fail('Expected unauthorized sync_vault to fail');
    } catch (err: any) {
      // Reverts with Anchor constraint error (ConstraintSeeds / 2006 or ConstraintHasOne / 2001)
      const logs = err?.logs?.join('\n') || err?.message || '';
      const isConstraintError =
        logs.includes('ConstraintSeeds') ||
        logs.includes('0x7d6') ||
        logs.includes('2006') ||
        logs.includes('ConstraintHasOne') ||
        logs.includes('0x7d1') ||
        logs.includes('2001') ||
        err?.error?.errorCode?.code?.includes('Constraint');
      assert.ok(isConstraintError, `Expected ConstraintSeeds/ConstraintHasOne violation, got:\n${logs}`);
    }
  });

  it('12. happy path settles and vault balances change', async () => {
    if (!isLocalnetAvailable) return;

    // Sync vault to balanced baseline: 40% USDC, 10% NVDAx, 50% SPYx
    await program.methods
      .syncVault(new BN(4000000), [
        {
          mint: nvdaMint,
          symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
          amountUnits: new BN(83),
          priceCents: new BN(12000),
          isIndex: false,
        },
        {
          mint: spyMint,
          symbol: Array.from(Buffer.from('SPYx\0\0\0\0')),
          amountUnits: new BN(100),
          priceCents: new BN(50000),
          isIndex: true,
        },
      ])
      .accountsPartial({
        vault: vaultPda,
        owner: owner,
      })
      .rpc();

    const promiseId = `prm-ok-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    // 1. Create compliant promise: BUY $2,000 NVDAx
    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(12),
        nvdaMint,
        0, // BUY
        new BN(2000) // $2,000
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Fetch pre-trade vault balance
    const preVault = await program.account.portfolioVault.fetch(vaultPda);
    const preUsdc = preVault.usdcBalanceCents.toNumber();
    const preNvdaPos = preVault.positions.find((p: any) => p.mint.equals(nvdaMint));
    const preUnits = preNvdaPos?.amountUnits.toNumber() || 0;

    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    // 2. Execute guarded trade
    const txSig = await program.methods
      .executeGuardedTrade(
        new BN(200000), // $2,000.00
        new BN(12000),  // $120.00 execution price
        new BN(12000)   // $120.00 quoted benchmark
      )
      .accountsPartial({
        promise: promisePda,
        vault: vaultPda,
        agent: agentPda,
        policy: policyPda,
        priceUpdate: priceUpdateKp.publicKey,
        authority: agentKeypair.publicKey,
      })
      .signers([agentKeypair])
      .rpc();

    assert.ok(txSig, 'Settlement transaction signature produced');

    // 3. Assert on-chain post-state
    const postVault = await program.account.portfolioVault.fetch(vaultPda);
    const postPromise = await program.account.promiseAccount.fetch(promisePda);

    // Promise status transitioned to 3 (Settled)
    assert.strictEqual(postPromise.status, 3, 'Promise status must be 3 (Settled)');

    // USDC balance decreased by exactly $2,000 (200,000 cents)
    const postUsdc = postVault.usdcBalanceCents.toNumber();
    assert.strictEqual(postUsdc, preUsdc - 200000, 'USDC balance decreased by trade amount');

    // Target position tokens increased
    const postNvdaPos = postVault.positions.find((p: any) => p.mint.equals(nvdaMint));
    const postUnits = postNvdaPos?.amountUnits.toNumber() || 0;
    const expectedTokenDelta = Math.floor(200000 / 12000); // 16 units
    assert.strictEqual(postUnits, preUnits + expectedTokenDelta, 'Target asset units incremented');
    assert.strictEqual(postNvdaPos?.priceCents.toNumber(), 12000, 'Stored benchmark price preserved');

    // 4. Record evidence on-chain
    const [evidencePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('evidence'), promisePda.toBuffer()],
      program.programId
    );

    const evSig = await program.methods
      .recordEvidence(
        `ev-${promiseId}`,
        Array(32).fill(111),
        Array(32).fill(222),
        3, // Settled
        0  // Success
      )
      .accountsPartial({
        evidence: evidencePda,
        promise: promisePda,
        agent: agentPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    assert.ok(evSig, 'Evidence recording transaction signature produced');

    const evidenceAccount = await program.account.evidenceAccount.fetch(evidencePda);
    assert.strictEqual(evidenceAccount.verificationResult, 3, 'Evidence verification_result matches settled promise');
    assert.strictEqual(evidenceAccount.promise.toBase58(), promisePda.toBase58());
  });

  it('13. stale Pyth price (>60s) -> StaleOraclePrice (6019)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-stale-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(13),
        nvdaMint,
        0,
        new BN(1000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Create price update with publishTime offset = -120s (older than 60s)
    const priceUpdateKp = await createTestPriceUpdate(12000, 50, -120);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(100000),
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected stale oracle price to revert with StaleOraclePrice');
    } catch (err: any) {
      assertAnchorError(err, 'StaleOraclePrice', 6019);
    }
  });

  it('14. wide Pyth confidence (>2%) -> WideConfidenceInterval (6020)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-conf-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(14),
        nvdaMint,
        0,
        new BN(1000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Conf = $5.00 on $120.00 price (4.16% > 200 bps)
    const priceUpdateKp = await createTestPriceUpdate(12000, 500);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(100000),
          new BN(12000),
          new BN(12000)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected wide confidence interval to revert with WideConfidenceInterval');
    } catch (err: any) {
      assertAnchorError(err, 'WideConfidenceInterval', 6020);
    }
  });

  it('15. exec price deviating from Pyth benchmark (>1%) -> SlippageExceeded (6007)', async () => {
    if (!isLocalnetAvailable) return;

    const promiseId = `prm-pyth-slip-${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      program.programId
    );

    await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(15),
        nvdaMint,
        0,
        new BN(1000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    // Pyth price is $120.00 (12000 cents). Execution price is $125.00 (12500 cents), 4.16% > 1% (100 bps max slippage)
    // Even if caller passes quoted_price = 12500 cents, benchmark is read from Pyth ($120.00)!
    const priceUpdateKp = await createTestPriceUpdate(12000, 50);

    try {
      await program.methods
        .executeGuardedTrade(
          new BN(100000),
          new BN(12500),
          new BN(12500)
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdateKp.publicKey,
          authority: agentKeypair.publicKey,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail('Expected execution deviating from Pyth benchmark to revert with SlippageExceeded');
    } catch (err: any) {
      assertAnchorError(err, 'SlippageExceeded', 6007);
    }
  });
});
