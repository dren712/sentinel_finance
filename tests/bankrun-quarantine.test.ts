import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { startAnchor, ProgramTestContext } from 'solana-bankrun';
import { PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = anchorPkg;
import fs from 'node:fs';
import path from 'node:path';

const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
export const PYTH_RECEIVER_ID = new PublicKey('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ');

// Load IDL
const idl = JSON.parse(fs.readFileSync(path.resolve('target/idl/sentinel.json'), 'utf8'));

/**
 * Builds a serialized PriceUpdateV2 account binary buffer matching Pyth Solana Receiver V2
 */
function buildPriceUpdateV2Buffer(options: {
  writeAuthority?: PublicKey;
  verificationLevel?: 'Full' | 'Partial';
  feedId?: number[];
  price?: bigint; // $120.00 = 12000 cents * 10^6 (for expo -8)
  conf?: bigint;
  exponent?: number;
  publishTime?: number;
  postedSlot?: bigint;
}) {
  const disc = Buffer.from([34, 241, 35, 99, 157, 126, 244, 205]);
  const writeAuthPubkey = options.writeAuthority || Keypair.generate().publicKey;
  const writeAuthBuf = writeAuthPubkey.toBuffer();

  const verifBuf = options.verificationLevel === 'Partial'
    ? Buffer.from([0, 1])
    : Buffer.from([1]); // Full

  const feedIdBuf = Buffer.from(options.feedId || Array(32).fill(7));
  const priceBuf = Buffer.alloc(8);
  priceBuf.writeBigInt64LE(options.price !== undefined ? BigInt(options.price) : 10_000_000_000n);

  const confBuf = Buffer.alloc(8);
  confBuf.writeBigUInt64LE(options.conf !== undefined ? BigInt(options.conf) : 50_000_000n);

  const expoBuf = Buffer.alloc(4);
  expoBuf.writeInt32LE(options.exponent !== undefined ? options.exponent : -8);

  const now = options.publishTime || Math.floor(Date.now() / 1000);
  const pubTimeBuf = Buffer.alloc(8);
  pubTimeBuf.writeBigInt64LE(BigInt(now));

  const prevPubTimeBuf = Buffer.alloc(8);
  prevPubTimeBuf.writeBigInt64LE(BigInt(now - 1));

  const emaPriceBuf = Buffer.alloc(8);
  emaPriceBuf.writeBigInt64LE(options.price !== undefined ? BigInt(options.price) : 10_000_000_000n);

  const emaConfBuf = Buffer.alloc(8);
  emaConfBuf.writeBigUInt64LE(options.conf !== undefined ? BigInt(options.conf) : 50_000_000n);

  const slotBuf = Buffer.alloc(8);
  slotBuf.writeBigUInt64LE(options.postedSlot || 100n);

  return Buffer.concat([
    disc,
    writeAuthBuf,
    verifBuf,
    feedIdBuf,
    priceBuf,
    confBuf,
    expoBuf,
    pubTimeBuf,
    prevPubTimeBuf,
    emaPriceBuf,
    emaConfBuf,
    slotBuf,
  ]);
}

function assertCustomError(err: any, expectedName: string, expectedCode: number) {
  const msg = err?.message || String(err);
  const hexCode = '0x' + expectedCode.toString(16).toLowerCase();
  const hexMatch = msg.toLowerCase().includes(hexCode);
  const numMatch = msg.includes(String(expectedCode));
  const nameMatch = msg.includes(expectedName);
  assert.ok(
    hexMatch || numMatch || nameMatch,
    `Expected error ${expectedName} (${expectedCode} / ${hexCode}), but got: ${msg}`
  );
}

describe('Phase B: Quarantine State Machine Bankrun Test Suite (B7)', () => {
  let ctx: ProgramTestContext;
  let program: Program;

  const owner = Keypair.generate();
  const agentKeypair = Keypair.generate();
  const arbitrarySigner = Keypair.generate();

  let policyPda: PublicKey;
  let agentPda: PublicKey;
  let vaultPda: PublicKey;

  const nvdaMint = Keypair.generate().publicKey;
  const feedId = Array(32).fill(7);

  // Price account keys
  const compliantPricePubkey = Keypair.generate().publicKey;
  const violatingPricePubkey = Keypair.generate().publicKey;
  const forgedPricePubkey = Keypair.generate().publicKey;
  const stalePricePubkey = Keypair.generate().publicKey;
  const wideConfPricePubkey = Keypair.generate().publicKey;

  async function processTx(tx: Transaction, signer: Keypair) {
    const [recentBlockhash] = await ctx.banksClient.getLatestBlockhash();
    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = signer.publicKey;
    tx.sign(signer);
    await ctx.banksClient.processTransaction(tx);
  }

  async function fetchVault() {
    const acc = await ctx.banksClient.getAccount(vaultPda);
    assert.ok(acc, 'Vault account must exist');
    return (program.coder.accounts.decode('portfolioVault', Buffer.from(acc.data)) as any);
  }

  function getStatusString(status: any): 'Active' | 'Quarantined' | 'RecoveryExpired' {
    if (typeof status === 'string') return status as any;
    if (status.active !== undefined) return 'Active';
    if (status.quarantined !== undefined) return 'Quarantined';
    if (status.recoveryExpired !== undefined) return 'RecoveryExpired';
    throw new Error(`Unknown status: ${JSON.stringify(status)}`);
  }

  before(async () => {
    const nowTime = Math.floor(Date.now() / 1000);

    const initialAccounts = [
      {
        address: owner.publicKey,
        info: {
          lamports: 10_000_000_000,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      {
        address: agentKeypair.publicKey,
        info: {
          lamports: 10_000_000_000,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      {
        address: arbitrarySigner.publicKey,
        info: {
          lamports: 10_000_000_000,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Compliant price: $100.00 (20 units * $100 = $2,000; USDC = $8,000; total = $10,000 -> NVDA = 20.00% <= 25%, USDC = 80.00% >= 20%)
      {
        address: compliantPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 10_000_000_000n, // $100.00
            conf: 50_000_000n,      // $0.50 (50 bps < 200 bps)
            feedId,
            publishTime: nowTime,
          }),
          owner: PYTH_RECEIVER_ID,
          executable: false,
        },
      },
      // Violating price: $300.00 (20 units * $300 = $6,000; USDC = $8,000; total = $14,000 -> NVDA = 42.85% > 25.00%)
      {
        address: violatingPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 30_000_000_000n, // $300.00
            conf: 50_000_000n,      // $0.50 (16 bps < 200 bps)
            feedId,
            publishTime: nowTime,
          }),
          owner: PYTH_RECEIVER_ID,
          executable: false,
        },
      },
      // Forged price account: owned by PROGRAM_ID instead of PYTH_RECEIVER_ID
      {
        address: forgedPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 30_000_000_000n,
            conf: 50_000_000n,
            feedId,
            publishTime: nowTime,
          }),
          owner: PROGRAM_ID,
          executable: false,
        },
      },
      // Stale price account: publishTime = nowTime - 120 (120s old > 60s)
      {
        address: stalePricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 30_000_000_000n,
            conf: 50_000_000n,
            feedId,
            publishTime: nowTime - 120,
          }),
          owner: PYTH_RECEIVER_ID,
          executable: false,
        },
      },
      // Wide confidence price account: conf = 1_500_000_000n ($15 = 500 bps = 5.0% > 2.0% max conf)
      {
        address: wideConfPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 30_000_000_000n,
            conf: 1_500_000_000n,
            feedId,
            publishTime: nowTime,
          }),
          owner: PYTH_RECEIVER_ID,
          executable: false,
        },
      },
    ];

    ctx = await startAnchor('.', [{ name: 'sentinel', programId: PROGRAM_ID }], initialAccounts);

    const dummyWallet = {
      publicKey: owner.publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    const dummyConn = {
      getLatestBlockhash: async () => {
        const bh = await ctx.banksClient.getLatestBlockhash();
        return { blockhash: bh[0], lastValidBlockHeight: 1000 };
      },
    };
    const provider = new AnchorProvider(dummyConn as any, dummyWallet as any, { commitment: 'confirmed' });
    program = new Program(idl, provider);

    // Derive PDAs
    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), owner.publicKey.toBuffer()],
      PROGRAM_ID
    );
    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.publicKey.toBuffer(), Buffer.from('robo-01')],
      PROGRAM_ID
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // 1. Initialize Policy: maxSingleAsset=25%, minStablecoin=20%, confirm_slots=10, recovery_window=100
    const initPolicyIx = await program.methods
      .initializePolicy(
        2500, // 25.00%
        2000, // 20.00%
        new BN(10000), // $10,000 max trade
        100, // 1.00% max slippage
        new BN(10), // confirm_slots = 10
        new BN(100), // recovery_window_slots = 100
        100, // max_recovery_cost_bps
        50, // max_bounty_bps
        owner.publicKey // safe_destination
      )
      .accountsPartial({
        policy: policyPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(initPolicyIx), owner);

    // 2. Initialize Agent
    const initAgentIx = await program.methods
      .initializeAgent('robo-01', 'portfolio-main', agentKeypair.publicKey)
      .accountsPartial({
        agent: agentPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(initAgentIx), owner);

    // 3. Initialize Vault: USDC=$8,000 (800,000 cents), 20 NVDAx @ $100 ($2,000 = 200,000 cents)
    const initVaultIx = await program.methods
      .initializeVault(
        new BN(800000),
        [
          {
            mint: nvdaMint,
            symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
            amountUnits: new BN(20),
            priceCents: new BN(10000),
            isIndex: false,
            feedId,
          },
        ]
      )
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(initVaultIx), owner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 0);
  });

  it('1. no violation, pending == 0 -> NoViolation (6027)', async () => {
    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: compliantPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(flagIx), arbitrarySigner);
      assert.fail('Expected flagViolation to fail with NoViolation');
    } catch (err: any) {
      assertCustomError(err, 'NoViolation', 6027);
    }

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 0);
  });

  it('2. first violating flag -> pending set, status stays Active', async () => {
    ctx.warpToSlot(20n);

    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(flagIx), arbitrarySigner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 20);
    assert.strictEqual(Number(vault.quarantineSlot), 0);
  });

  it('3. second flag before confirm_slots -> ViolationNotConfirmed (6028), no state change', async () => {
    // Current pending is 20, confirm_slots is 10. Warp to 25 (25 - 20 = 5 < 10)
    ctx.warpToSlot(25n);

    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(flagIx), arbitrarySigner);
      assert.fail('Expected flagViolation to fail with ViolationNotConfirmed');
    } catch (err: any) {
      assertCustomError(err, 'ViolationNotConfirmed', 6028);
    }

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 20);
    assert.strictEqual(Number(vault.quarantineSlot), 0);
  });

  it('4. second flag after confirm_slots -> Quarantined, expiry set, nonce incremented', async () => {
    // Current pending is 20, confirm_slots is 10. Warp to 32 (32 - 20 = 12 >= 10)
    ctx.warpToSlot(32n);

    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(flagIx), arbitrarySigner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Quarantined');
    assert.strictEqual(Number(vault.pendingViolationSlot), 0);
    assert.strictEqual(Number(vault.quarantineSlot), 32);
    assert.strictEqual(Number(vault.recoveryExpiresSlot), 132); // 32 + 100 recovery_window_slots
    assert.strictEqual(Number(vault.recoveryNonce), 1);
  });

  it('5. price recovers before confirm, flag called -> pending cleared', async () => {
    // Release vault back to Active first
    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseIx), owner);

    let vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.recoveryNonce), 2);

    // Warp to slot 40 and initiate violation flag
    ctx.warpToSlot(40n);
    const flagViolateIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flagViolateIx), arbitrarySigner);

    vault = await fetchVault();
    assert.strictEqual(Number(vault.pendingViolationSlot), 40);

    // Warp to slot 45 (before confirm_slots). Price recovers to compliant ($100)!
    ctx.warpToSlot(45n);
    const flagRecoverIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: compliantPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(flagRecoverIx), arbitrarySigner);

    vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 0); // Cleared!
  });

  it('6. execute_guarded_trade while Quarantined -> VaultNotActive (6025)', async () => {
    // 1. Create a promise while vault is still Active (from test 5 recovery)
    const promiseId = `prm_trade_${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      PROGRAM_ID
    );

    const createPromiseIx = await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(1),
        nvdaMint,
        0, // BUY
        new BN(1000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        vault: vaultPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(createPromiseIx), agentKeypair);

    // 2. Put vault into Quarantined state: flag at slot 50, confirm at slot 62
    ctx.warpToSlot(50n);
    const flag1 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag1), arbitrarySigner);

    ctx.warpToSlot(62n);
    const flag2 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag2), arbitrarySigner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Quarantined');

    // 3. Attempting execute_guarded_trade while Quarantined -> VaultNotActive
    const execIx = await program.methods
      .executeGuardedTrade(
        new BN(100000), // $1,000 trade
        new BN(10000),  // $100 price
        new BN(10000)
      )
      .accountsPartial({
        promise: promisePda,
        vault: vaultPda,
        agent: agentPda,
        policy: policyPda,
        priceUpdate: compliantPricePubkey,
        authority: agentKeypair.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(execIx), agentKeypair);
      assert.fail('Expected executeGuardedTrade to fail with VaultNotActive');
    } catch (err: any) {
      assertCustomError(err, 'VaultNotActive', 6025);
    }
  });

  it('7. create_promise while Quarantined -> VaultNotActive (6025)', async () => {
    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Quarantined');

    const promiseId = `prm_gate_${Date.now()}`;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      PROGRAM_ID
    );

    const createPromiseIx = await program.methods
      .createPromise(
        promiseId,
        Array(32).fill(1),
        nvdaMint,
        0, // BUY
        new BN(1000)
      )
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        policy: policyPda,
        vault: vaultPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(createPromiseIx), agentKeypair);
      assert.fail('Expected createPromise to fail with VaultNotActive');
    } catch (err: any) {
      assertCustomError(err, 'VaultNotActive', 6025);
    }
  });

  it('8. owner_release by a non-owner -> fails; by the owner -> Active, nonce incremented', async () => {
    const vaultBefore = await fetchVault();
    const nonceBefore = Number(vaultBefore.recoveryNonce);

    // Non-owner attempts owner_release -> FAILS
    const unauthorizedReleaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(unauthorizedReleaseIx), arbitrarySigner);
      assert.fail('Expected unauthorized ownerRelease to fail');
    } catch (err: any) {
      const msg = err?.message || String(err);
      assert.ok(
        msg.includes('ConstraintHasOne') ||
        msg.includes('ConstraintSeeds') ||
        msg.includes('2001') ||
        msg.includes('2006') ||
        msg.includes('0x7d1') ||
        msg.includes('0x7d6') ||
        msg.includes('custom program error'),
        `Expected constraint failure on unauthorized ownerRelease, got: ${msg}`
      );
    }

    // Owner performs owner_release -> SUCCEEDS
    const authorizedReleaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(authorizedReleaseIx), owner);

    const vaultAfter = await fetchVault();
    assert.strictEqual(getStatusString(vaultAfter.status), 'Active');
    assert.strictEqual(Number(vaultAfter.recoveryNonce), nonceBefore + 1);
    assert.strictEqual(Number(vaultAfter.pendingViolationSlot), 0);
  });

  it('9. expire_quarantine before expiry -> rejected; after -> RecoveryExpired', async () => {
    // Put vault into Quarantined state again at slot 70, confirmed at slot 85
    ctx.warpToSlot(70n);
    const flag1 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag1), arbitrarySigner);

    ctx.warpToSlot(85n);
    const flag2 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag2), arbitrarySigner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Quarantined');
    const expirySlot = Number(vault.recoveryExpiresSlot);
    assert.strictEqual(expirySlot, 85 + 100); // 185

    // Attempt expire_quarantine before expiry at slot 100 (< 185)
    ctx.warpToSlot(100n);
    const expireBeforeIx = await program.methods
      .expireQuarantine()
      .accountsPartial({
        vault: vaultPda,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(expireBeforeIx), arbitrarySigner);
      assert.fail('Expected expireQuarantine before expiry to fail with RecoveryNotExpired');
    } catch (err: any) {
      assertCustomError(err, 'RecoveryNotExpired', 6029);
    }

    // Warp to slot 190 (> 185 expirySlot) and call expire_quarantine (permissionless!)
    ctx.warpToSlot(190n);
    const expireAfterIx = await program.methods
      .expireQuarantine()
      .accountsPartial({
        vault: vaultPda,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(expireAfterIx), arbitrarySigner);

    const vaultAfter = await fetchVault();
    assert.strictEqual(getStatusString(vaultAfter.status), 'RecoveryExpired');
    assert.strictEqual(Number(vaultAfter.recoveryNonce), Number(vault.recoveryNonce) + 1);
  });

  it('10. flag_violation with a forged price account (wrong owner) -> rejected (UnverifiedPrice 6024)', async () => {
    // Release vault back to Active first
    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseIx), owner);

    let vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');

    ctx.warpToSlot(200n);

    // Call flag_violation with forgedPricePubkey (owned by PROGRAM_ID instead of Pyth receiver)
    const forgedFlagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: forgedPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(forgedFlagIx), arbitrarySigner);
      assert.fail('Expected forged price account to fail with UnverifiedPrice');
    } catch (err: any) {
      assertCustomError(err, 'UnverifiedPrice', 6024);
    }

    vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 0);
  });

  it('11. flag_violation with a stale or wide-confidence price -> rejected', async () => {
    ctx.warpToSlot(210n);

    // 1. Stale price (> 60s)
    const staleFlagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: stalePricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(staleFlagIx), arbitrarySigner);
      assert.fail('Expected stale price to fail with StaleOracle');
    } catch (err: any) {
      assertCustomError(err, 'StaleOracle', 6022);
    }

    // 2. Wide confidence (> 2.0%)
    const wideFlagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: wideConfPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(wideFlagIx), arbitrarySigner);
      assert.fail('Expected wide confidence price to fail with ConfidenceTooWide');
    } catch (err: any) {
      assertCustomError(err, 'ConfidenceTooWide', 6023);
    }
  });

  it('12. flag_violation signed by an arbitrary wallet works', async () => {
    // Permissionless: any arbitrary wallet can initiate the violation flag
    ctx.warpToSlot(220n);

    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(flagIx), arbitrarySigner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 220);
  });

  it('13. vault already Quarantined, flag called -> error (wrong status / VaultNotActive 6025)', async () => {
    // Complete the quarantine transition
    ctx.warpToSlot(235n);
    const confirmFlagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(confirmFlagIx), arbitrarySigner);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Quarantined');

    // Warp slot to get new blockhash and avoid duplicate transaction error
    ctx.warpToSlot(240n);

    // Call flagViolation while already Quarantined
    const errorFlagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: arbitrarySigner.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(errorFlagIx), arbitrarySigner);
      assert.fail('Expected flagViolation on Quarantined vault to fail with VaultNotActive');
    } catch (err: any) {
      assertCustomError(err, 'VaultNotActive', 6025);
    }
  });
});
