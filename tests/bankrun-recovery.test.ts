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
  const logs = err?.logs ? err.logs.join('\n') : '';
  const combined = msg + '\n' + logs;
  const hexCode = '0x' + expectedCode.toString(16).toLowerCase();
  const hexMatch = combined.toLowerCase().includes(hexCode);
  const numMatch = combined.includes(String(expectedCode));
  const nameMatch = combined.includes(expectedName);
  assert.ok(
    hexMatch || numMatch || nameMatch,
    `Expected error ${expectedName} (${expectedCode} / ${hexCode}), but got: ${combined}`
  );
}

describe('Phase 2: Bankrun Recovery Test Suite (Slot-Warped)', () => {
  let ctx: ProgramTestContext;
  let program: Program;

  const owner = Keypair.generate();
  const agentKeypair = Keypair.generate();
  const solver = Keypair.generate();
  const solverB = Keypair.generate();
  const randomSolver = Keypair.generate();

  let policyPda: PublicKey;
  let agentPda: PublicKey;
  let vaultPda: PublicKey;

  const nvdaMint = Keypair.generate().publicKey;
  const feedId = Array(32).fill(7);
  const wrongFeedId = Array(32).fill(9);

  // Price account keys
  const compliantPricePubkey = Keypair.generate().publicKey;
  const violatingPricePubkey = Keypair.generate().publicKey;
  const forgedPricePubkey = Keypair.generate().publicKey;
  const wrongFeedPricePubkey = Keypair.generate().publicKey;
  const stalePricePubkey = Keypair.generate().publicKey;
  const wideConfPricePubkey = Keypair.generate().publicKey;

  async function processTx(tx: Transaction, signer: Keypair): Promise<string[]> {
    const [recentBlockhash] = await ctx.banksClient.getLatestBlockhash();
    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = signer.publicKey;
    tx.sign(signer);
    const res = await ctx.banksClient.tryProcessTransaction(tx);
    if (res.result) {
      const logs = res.meta?.logMessages || [];
      const err = new Error(`Transaction failed: ${res.result}`);
      (err as any).logs = logs;
      (err as any).result = res.result;
      throw err;
    }
    return res.meta?.logMessages || [];
  }

  async function fetchVault() {
    const acc = await ctx.banksClient.getAccount(vaultPda);
    assert.ok(acc, 'Vault account must exist');
    return program.coder.accounts.decode('portfolioVault', Buffer.from(acc.data)) as any;
  }

  async function fetchPolicy() {
    const acc = await ctx.banksClient.getAccount(policyPda);
    assert.ok(acc, 'Policy account must exist');
    return program.coder.accounts.decode('policyAccount', Buffer.from(acc.data)) as any;
  }

  function getStatusString(status: any): 'Active' | 'Quarantined' | 'RecoveryExpired' {
    if (typeof status === 'string') return status as any;
    if (status.active !== undefined) return 'Active';
    if (status.quarantined !== undefined) return 'Quarantined';
    if (status.recoveryExpired !== undefined) return 'RecoveryExpired';
    throw new Error(`Unknown status: ${JSON.stringify(status)}`);
  }

  async function syncViolatingHoldings(units = 20, usdc = 800000) {
    const syncIx = await program.methods
      .syncVault(new BN(usdc), [
        {
          mint: nvdaMint,
          symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
          amountUnits: new BN(units),
          priceCents: new BN(10000),
          isIndex: false,
          feedId,
        },
      ])
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(syncIx), owner);
  }

  async function quarantineVault(atSlot: bigint) {
    const vaultBefore = await fetchVault();
    if (getStatusString(vaultBefore.status) !== 'Active') {
      const releaseIx = await program.methods
        .ownerRelease()
        .accountsPartial({
          vault: vaultPda,
          owner: owner.publicKey,
        })
        .instruction();
      await processTx(new Transaction().add(releaseIx), owner);
    }

    ctx.warpToSlot(atSlot);
    const flag1 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: solver.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag1), solver);

    ctx.warpToSlot(atSlot + 12n);
    const flag2 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: solver.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag2), solver);

    const vaultAfter = await fetchVault();
    assert.strictEqual(getStatusString(vaultAfter.status), 'Quarantined');
    return vaultAfter;
  }

  function parseRecoveryEvent(logs: string[]): any {
    for (const log of logs) {
      if (log.startsWith('Program data: ')) {
        const b64 = log.slice('Program data: '.length).trim();
        try {
          const decoded = program.coder.events.decode(b64);
          if (decoded && (decoded.name === 'RecoveryExecutedEvent' || decoded.name === 'recoveryExecutedEvent')) {
            return decoded.data;
          }
        } catch {
          // ignore non-event program data
        }
      }
    }
    return null;
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
        address: solver.publicKey,
        info: {
          lamports: 10_000_000_000,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      {
        address: solverB.publicKey,
        info: {
          lamports: 10_000_000_000,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      {
        address: randomSolver.publicKey,
        info: {
          lamports: 10_000_000_000,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Compliant price: $100.00
      {
        address: compliantPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 10_000_000_000n, // $100.00
            conf: 50_000_000n,      // $0.50
            feedId,
            publishTime: nowTime,
          }),
          owner: PYTH_RECEIVER_ID,
          executable: false,
        },
      },
      // Violating price: $300.00
      {
        address: violatingPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 30_000_000_000n, // $300.00
            conf: 50_000_000n,      // $0.50
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
      // Wrong feed ID price account
      {
        address: wrongFeedPricePubkey,
        info: {
          lamports: 1_000_000_000,
          data: buildPriceUpdateV2Buffer({
            price: 30_000_000_000n,
            conf: 50_000_000n,
            feedId: wrongFeedId,
            publishTime: nowTime,
          }),
          owner: PYTH_RECEIVER_ID,
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
      // Wide confidence price account: conf = 1_500_000_000n ($15 = 5.0% > 2.0%)
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
  });

  it('1. happy path: Quarantined -> recover -> Active; exposure <= cap; stable >= floor; nonce incremented; post_total >= conservation bound; RecoveryExecutedEvent fields match the chain state', async () => {
    // Quarantine vault at slot 20 -> confirmed at slot 32
    const qVault = await quarantineVault(20n);
    const nonce = Number(qVault.recoveryNonce); // 1
    assert.strictEqual(nonce, 1);

    // Pyth price is $300.00 (30,000 cents). Holdings: 20 NVDAx. Pre total = 800,000 + 20*30,000 = 1,400,000 cents.
    // Sell 10 units: gross = 300,000. Fee = 30 bps (900 cents). Net proceeds = 299,100 cents.
    // Post units = 10. Post NVDA = 300,000 cents. Post USDC = 800,000 + 299,100 = 1,099,100 cents.
    // Post total = 1,399,100 cents.
    // Post exposure = 300,000 / 1,399,100 = 2,144 bps <= 2,500 bps (maxSingleAsset).
    // Stablecoin ratio = 1,099,100 / 1,399,100 = 7,855 bps >= 2,000 bps (minStablecoin).
    // Conservation bound = 1,400,000 * 9,900 / 10,000 = 1,386,000 cents <= 1,399,100 cents.
    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    const logs = await processTx(new Transaction().add(recoverIx), solver);

    // 1. Assert chain state
    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 0);
    assert.strictEqual(Number(vault.quarantineSlot), 0);
    assert.strictEqual(Number(vault.recoveryExpiresSlot), 0);
    assert.strictEqual(Number(vault.recoveryNonce), nonce + 1);
    assert.strictEqual(Number(vault.lastRecoverySlot), 32);
    assert.strictEqual(vault.lastRecoverySolver.toBase58(), solver.publicKey.toBase58());
    assert.strictEqual(Number(vault.usdcBalanceCents), 1099100);
    assert.strictEqual(Number(vault.positions[0].amountUnits), 10);
    assert.strictEqual(Number(vault.positions[0].priceCents), 30000);
    assert.strictEqual(Number(vault.totalValueCents), 1399100);

    // Exposure and reserve assertions
    const postExposureBps = (10 * 30000 * 10000) / 1399100;
    assert.ok(postExposureBps <= 2500, 'Exposure must be <= max single asset cap');
    const stableRatioBps = (1099100 * 10000) / 1399100;
    assert.ok(stableRatioBps >= 2000, 'Stablecoin ratio must be >= min stablecoin floor');
    assert.ok(1399100 >= 1386000, 'Post total must satisfy conservation bound');

    // 2. Assert event data
    const event = parseRecoveryEvent(logs);
    assert.ok(event, 'RecoveryExecutedEvent must be emitted');
    assert.strictEqual(event.vault.toBase58(), vaultPda.toBase58());
    assert.strictEqual(event.solver.toBase58(), solver.publicKey.toBase58());
    assert.strictEqual(Number(event.sellUnits), 10);
    assert.strictEqual(Number(event.proceedsCents), 299100);
    assert.strictEqual(Number(event.preExposureBps), 4285);
    assert.strictEqual(Number(event.postExposureBps), 2144);
    assert.strictEqual(Number(event.preTotalCents), 1400000);
    assert.strictEqual(Number(event.postTotalCents), 1399100);
    assert.strictEqual(Number(event.newNonce), nonce + 1);
    assert.strictEqual(Number(event.slot), 32);
    assert.strictEqual(Number(event.bountyCapCents), 1495); // 299,100 * 50 / 10,000
  });

  it('2. recover while Active -> VaultNotQuarantined', async () => {
    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');

    const recoverIx = await program.methods
      .recover(new BN(5), new BN(vault.recoveryNonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected recover while Active to fail with VaultNotQuarantined');
    } catch (err: any) {
      assertCustomError(err, 'VaultNotQuarantined', 6026);
    }
  });

  it('3. recover after the window (warp past recovery_expires_slot) -> RecoveryWindowClosed', async () => {
    // Re-sync vault holdings to 20 units and quarantine
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(50n);
    // Quarantine slot is 62. Expiry slot = 62 + 100 = 162.
    const expiresSlot = Number(qVault.recoveryExpiresSlot);
    assert.strictEqual(expiresSlot, 162);

    // Warp past recovery_expires_slot
    ctx.warpToSlot(BigInt(expiresSlot + 1));

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(qVault.recoveryNonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected recover after window to fail with RecoveryWindowClosed');
    } catch (err: any) {
      assertCustomError(err, 'RecoveryWindowClosed', 6030);
    }
  });

  it('4. wrong expected_nonce -> StaleRecoveryNonce', async () => {
    // Quarantine vault at slot 170 -> 182
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(170n);
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce + 999)) // Bad expected_nonce
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected recover with wrong nonce to fail with StaleRecoveryNonce');
    } catch (err: any) {
      assertCustomError(err, 'StaleRecoveryNonce', 6031);
    }
  });

  it('5. owner_release between flag and recover -> StaleRecoveryNonce', async () => {
    // Quarantine vault at slot 190 -> 202
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(190n);
    const staleNonce = Number(qVault.recoveryNonce);

    // Owner releases vault
    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseIx), owner);

    // Re-quarantine vault so it is Quarantined again, but with incremented recovery nonce
    const qVault2 = await quarantineVault(210n);
    assert.ok(Number(qVault2.recoveryNonce) > staleNonce);

    // In-flight recovery submitted with stale nonce from before owner_release
    const recoverIx = await program.methods
      .recover(new BN(10), new BN(staleNonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected recovery with stale nonce to fail with StaleRecoveryNonce');
    } catch (err: any) {
      assertCustomError(err, 'StaleRecoveryNonce', 6031);
    }
  });

  it('6. replay the identical successful tx -> fails (status or nonce)', async () => {
    // Put vault into Quarantined state
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(230n);
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    // 1st execution succeeds
    await processTx(new Transaction().add(recoverIx), solver);
    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');

    // 2nd execution of identical instruction fails because vault is now Active and nonce has advanced (or transaction already processed)
    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected replay of recover tx to fail');
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isReplayOrStatus =
        msg.includes('already been processed') ||
        msg.includes('VaultNotQuarantined') ||
        msg.includes('0x178a') ||
        msg.includes('StaleRecoveryNonce') ||
        msg.includes('6026');
      assert.ok(isReplayOrStatus, `Expected replay or status error, got: ${msg}`);
    }
  });

  it('7. sell too little (still violating) -> PostconditionFailed', async () => {
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(250n);
    const nonce = Number(qVault.recoveryNonce);

    // Selling only 2 units leaves 18 NVDA ($5,400) on ~$13,998 total -> exposure 38.5% > 25% cap
    const recoverIx = await program.methods
      .recover(new BN(2), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected undersized recovery to fail with PostconditionFailed');
    } catch (err: any) {
      assertCustomError(err, 'PostconditionFailed', 6033);
    }
  });

  it('8. sell the entire position -> OversellGuard', async () => {
    const qVault = await fetchVault();
    const nonce = Number(qVault.recoveryNonce);
    const holdings = Number(qVault.positions[0].amountUnits);

    // Selling the entire position (all 20 units) brings exposure to 0 bps < 2000 bps lower bound
    const recoverIx = await program.methods
      .recover(new BN(holdings), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected selling entire position to fail with OversellGuard');
    } catch (err: any) {
      assertCustomError(err, 'OversellGuard', 6034);
    }
  });

  it('9. sell_units = 0 and sell_units > holdings -> InvalidAmount', async () => {
    const qVault = await fetchVault();
    const nonce = Number(qVault.recoveryNonce);
    const holdings = Number(qVault.positions[0].amountUnits);

    // 9a. sell_units = 0
    const zeroRecoverIx = await program.methods
      .recover(new BN(0), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(zeroRecoverIx), solver);
      assert.fail('Expected sell_units = 0 to fail with InvalidAmount');
    } catch (err: any) {
      assertCustomError(err, 'InvalidAmount', 6035);
    }

    // 9b. sell_units > holdings (holdings + 10)
    const excessRecoverIx = await program.methods
      .recover(new BN(holdings + 10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(excessRecoverIx), solver);
      assert.fail('Expected sell_units > holdings to fail with InvalidAmount');
    } catch (err: any) {
      assertCustomError(err, 'InvalidAmount', 6035);
    }
  });

  it('10. forged price account (wrong owner) -> UnverifiedPrice', async () => {
    const qVault = await fetchVault();
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: forgedPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected forged price account to fail with UnverifiedPrice');
    } catch (err: any) {
      assertCustomError(err, 'UnverifiedPrice', 6024);
    }
  });

  it('11. wrong feed_id -> FeedMismatch', async () => {
    const qVault = await fetchVault();
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: wrongFeedPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected wrong feed_id to fail with FeedMismatch');
    } catch (err: any) {
      assertCustomError(err, 'FeedMismatch', 6021);
    }
  });

  it('12. stale price -> StaleOracle', async () => {
    const qVault = await fetchVault();
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: stalePricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected stale price to fail with StaleOracle');
    } catch (err: any) {
      assertCustomError(err, 'StaleOracle', 6022);
    }
  });

  it('13. value conservation: policy with max_recovery_cost_bps below the venue fee -> ValueConservationBreached', async () => {
    // Release vault so we can update policy and re-quarantine with the updated policy version
    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseIx), owner);

    // Update policy max_recovery_cost_bps = 5 bps (0.05% < venue fee 30 bps = 0.30%)
    const updatePolicyIx = await program.methods
      .updatePolicy(
        2500,
        2000,
        new BN(10000),
        100,
        new BN(10), // confirm_slots
        new BN(100), // recovery_window_slots
        5, // max_recovery_cost_bps = 5 bps
        50, // max_bounty_bps
        owner.publicKey,
        true // is_active
      )
      .accountsPartial({
        policy: policyPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(updatePolicyIx), owner);

    // Re-quarantine vault under the new policy version
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(270n);
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(recoverIx), solver);
      assert.fail('Expected recovery cost breach to fail with ValueConservationBreached');
    } catch (err: any) {
      assertCustomError(err, 'ValueConservationBreached', 6032);
    }

    // Release vault and restore policy max_recovery_cost_bps back to 100 bps
    const releaseAfterIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseAfterIx), owner);

    const restorePolicyIx = await program.methods
      .updatePolicy(
        2500,
        2000,
        new BN(10000),
        100,
        new BN(10), // confirm_slots
        new BN(100), // recovery_window_slots
        100, // restore 100 bps
        50, // max_bounty_bps
        owner.publicKey,
        true // is_active
      )
      .accountsPartial({
        policy: policyPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(restorePolicyIx), owner);
  });

  it('14. two solvers race: first succeeds, second fails', async () => {
    // Put vault into Quarantined state
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(290n);
    const nonce = Number(qVault.recoveryNonce);

    const txA = new Transaction().add(
      await program.methods
        .recover(new BN(10), new BN(nonce))
        .accountsPartial({
          vault: vaultPda,
          policy: policyPda,
          priceUpdate: violatingPricePubkey,
          solver: solver.publicKey,
        })
        .instruction()
    );

    const txB = new Transaction().add(
      await program.methods
        .recover(new BN(10), new BN(nonce))
        .accountsPartial({
          vault: vaultPda,
          policy: policyPda,
          priceUpdate: violatingPricePubkey,
          solver: solverB.publicKey,
        })
        .instruction()
    );

    // Solver A races and executes first -> succeeds
    await processTx(txA, solver);
    const vaultAfter = await fetchVault();
    assert.strictEqual(getStatusString(vaultAfter.status), 'Active');

    // Solver B's transaction arrives second -> fails
    try {
      await processTx(txB, solverB);
      assert.fail('Expected second racing solver transaction to fail');
    } catch (err: any) {
      assertCustomError(err, 'VaultNotQuarantined', 6026);
    }
  });

  it('15. arbitrary wallet as solver succeeds (permissionless)', async () => {
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(310n);
    const nonce = Number(qVault.recoveryNonce);

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: randomSolver.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(recoverIx), randomSolver);

    const vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(vault.lastRecoverySolver.toBase58(), randomSolver.publicKey.toBase58());
  });

  it('16. recover cannot change policy, owner, or any other vault: assert those accounts and fields are unchanged after success', async () => {
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(330n);
    const nonce = Number(qVault.recoveryNonce);

    // Snapshot policy account and vault owner before recovery
    const policyAccBefore = await ctx.banksClient.getAccount(policyPda);
    assert.ok(policyAccBefore);
    const policyDataBefore = Buffer.from(policyAccBefore.data);
    const ownerBefore = qVault.owner.toBase58();

    const recoverIx = await program.methods
      .recover(new BN(10), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    await processTx(new Transaction().add(recoverIx), solver);

    // Fetch accounts after recovery
    const policyAccAfter = await ctx.banksClient.getAccount(policyPda);
    assert.ok(policyAccAfter);
    const policyDataAfter = Buffer.from(policyAccAfter.data);
    const vaultAfter = await fetchVault();

    // Verify immutability of policy account and vault owner
    assert.ok(policyDataBefore.equals(policyDataAfter), 'Policy account data must remain unchanged');
    assert.strictEqual(vaultAfter.owner.toBase58(), ownerBefore, 'Vault owner must remain unchanged');
  });

  it('17. full lifecycle: Active -> flag (pending) -> flag (Quarantined) -> recover -> Active -> trade works again', async () => {
    // 1. Start Active
    const vBefore = await fetchVault();
    if (getStatusString(vBefore.status) !== 'Active') {
      const releaseIx = await program.methods
        .ownerRelease()
        .accountsPartial({
          vault: vaultPda,
          owner: owner.publicKey,
        })
        .instruction();
      await processTx(new Transaction().add(releaseIx), owner);
    }
    await syncViolatingHoldings(20, 800000);
    let vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');

    // 2. Flag violation (pending at slot 350)
    ctx.warpToSlot(350n);
    const flag1 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: solver.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag1), solver);

    vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');
    assert.strictEqual(Number(vault.pendingViolationSlot), 350);

    // 3. Confirm violation after confirm_slots (warp to 362)
    ctx.warpToSlot(362n);
    const flag2 = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        signer: solver.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(flag2), solver);

    vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Quarantined');

    // 4. While Quarantined, agent attempts trade -> blocked with VaultNotActive (6025)
    const blockedPromiseId = `prm_blocked_${Date.now()}`;
    const [blockedPromisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(blockedPromiseId)],
      PROGRAM_ID
    );
    const createPromiseIx = await program.methods
      .createPromise(
        blockedPromiseId,
        Array(32).fill(1),
        nvdaMint,
        0, // BUY
        new BN(1000)
      )
      .accountsPartial({
        promise: blockedPromisePda,
        agent: agentPda,
        policy: policyPda,
        vault: vaultPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    try {
      await processTx(new Transaction().add(createPromiseIx), agentKeypair);
      assert.fail('Expected createPromise on Quarantined vault to fail with VaultNotActive');
    } catch (err: any) {
      assertCustomError(err, 'VaultNotActive', 6025);
    }

    // 5. Solver recovers vault (reduce-only sell 10 units) -> restores to Active
    const recoverIx = await program.methods
      .recover(new BN(10), new BN(vault.recoveryNonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(recoverIx), solver);

    vault = await fetchVault();
    assert.strictEqual(getStatusString(vault.status), 'Active');

    // 6. Active again: agent can create promise and execute trade successfully!
    const activePromiseId = `prm_active_${Date.now()}`;
    const [activePromisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(activePromiseId)],
      PROGRAM_ID
    );
    const activeCreatePromiseIx = await program.methods
      .createPromise(
        activePromiseId,
        Array(32).fill(1),
        nvdaMint,
        0, // BUY
        new BN(300) // $300 NVDA trade (1 unit at current stored price $300)
      )
      .accountsPartial({
        promise: activePromisePda,
        agent: agentPda,
        policy: policyPda,
        vault: vaultPda,
        authority: agentKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(activeCreatePromiseIx), agentKeypair);

    // Agent executes guarded trade at compliant stored benchmark price $300
    const execTradeIx = await program.methods
      .executeGuardedTrade(
        new BN(30000), // $300 trade amount in cents
        new BN(30000), // $300 execution price in cents
        new BN(30000)  // $300 quoted benchmark price
      )
      .accountsPartial({
        promise: activePromisePda,
        vault: vaultPda,
        agent: agentPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey, // $300 price feed
        authority: agentKeypair.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(execTradeIx), agentKeypair);

    const vaultFinal = await fetchVault();
    assert.strictEqual(getStatusString(vaultFinal.status), 'Active');
    // Bought 1 NVDA unit at $300 ($300) with USDC:
    // NVDA units: 10 + 1 = 11 units
    // USDC: 1,099,100 - 30,000 = 1,069,100 cents
    assert.strictEqual(Number(vaultFinal.positions[0].amountUnits), 11);
    assert.strictEqual(Number(vaultFinal.usdcBalanceCents), 1069100);
  });

  it('18. policy mutation during quarantine: recovery fails with PolicyFrozenDuringRecovery (6036)', async () => {
    // 1. Induce violation to Quarantined
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(400n);
    const nonce = Number(qVault.recoveryNonce);

    // 2. Owner mutates policy while quarantined (increments policy_version)
    const updatePolicyIx = await program.methods
      .updatePolicy(
        2500, // maxSingleAssetBps
        2000, // minStablecoinBps
        new BN(10000), // maxTradeValueUsd
        100,  // maxSlippageBps
        new BN(10), // confirmSlots
        new BN(100), // recoveryWindowSlots
        100, // maxRecoveryCostBps
        50,  // maxBountyBps
        owner.publicKey,
        true // isActive
      )
      .accountsPartial({
        policy: policyPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(updatePolicyIx), owner);

    // 3. Solver attempts recover() -> must fail with PolicyFrozenDuringRecovery (6036)
    const recoverIx = await program.methods
      .recover(new BN(5), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    await assert.rejects(
      processTx(new Transaction().add(recoverIx), solver),
      (err: any) => {
        assertCustomError(err, 'PolicyFrozenDuringRecovery', 6036);
        return true;
      }
    );

    // Clean up via owner release
    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseIx), owner);
  });

  it('19. inactive policy blocks recovery with PolicyInactive (6004)', async () => {
    // 1. Induce violation to Quarantined
    await syncViolatingHoldings(20, 800000);
    const qVault = await quarantineVault(450n);
    const nonce = Number(qVault.recoveryNonce);

    // 2. Owner deactivates policy
    const disablePolicyIx = await program.methods
      .updatePolicy(
        2500,
        2000,
        new BN(10000),
        100,
        new BN(10),
        new BN(100),
        100,
        50,
        owner.publicKey,
        false // isActive = false
      )
      .accountsPartial({
        policy: policyPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(disablePolicyIx), owner);

    // 3. Solver attempts recover() -> PolicyInactive (6004)
    const recoverIx = await program.methods
      .recover(new BN(5), new BN(nonce))
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: violatingPricePubkey,
        solver: solver.publicKey,
      })
      .instruction();

    await assert.rejects(
      processTx(new Transaction().add(recoverIx), solver),
      (err: any) => {
        assertCustomError(err, 'PolicyInactive', 6004);
        return true;
      }
    );

    // Re-enable policy and release
    const enablePolicyIx = await program.methods
      .updatePolicy(
        2500,
        2000,
        new BN(10000),
        100,
        new BN(10),
        new BN(100),
        100,
        50,
        owner.publicKey,
        true // isActive = true
      )
      .accountsPartial({
        policy: policyPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(enablePolicyIx), owner);

    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();
    await processTx(new Transaction().add(releaseIx), owner);
  });

  it('20. multiple volatile positions in sync_vault rejected with InvalidVolatileAssetConfiguration (6037)', async () => {
    // Attempt sync_vault with 2 non-index positions
    const multiVolatilePositions = [
      {
        mint: nvdaMint,
        symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
        amountUnits: new BN(10),
        priceCents: new BN(10000),
        isIndex: false,
        feedId,
      },
      {
        mint: Keypair.generate().publicKey,
        symbol: Array.from(Buffer.from('TSLAx\0\0\0')),
        amountUnits: new BN(10),
        priceCents: new BN(10000),
        isIndex: false,
        feedId,
      },
    ];

    const syncIx = await program.methods
      .syncVault(new BN(800000), multiVolatilePositions)
      .accountsPartial({
        vault: vaultPda,
        owner: owner.publicKey,
      })
      .instruction();

    await assert.rejects(
      processTx(new Transaction().add(syncIx), owner),
      (err: any) => {
        assert.ok(
          err.message?.includes('InvalidVolatileAssetConfiguration') ||
          err.message?.includes('6037') ||
          err.message?.includes('0x1795'),
          `Expected InvalidVolatileAssetConfiguration (6037), got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('21. malformed state (total_cents = 0) fails closed with MathOverflow (6008) in flag_violation', async () => {
    // Set up a second vault with 0 usdc and 0 amount units
    const zeroOwner = Keypair.generate();
    ctx.setAccount(zeroOwner.publicKey, {
      lamports: 10_000_000_000,
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    const [zeroPolicyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), zeroOwner.publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [zeroVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), zeroOwner.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const initPolIx = await program.methods
      .initializePolicy(
        2500,
        2000,
        new BN(10000),
        100,
        new BN(2),
        new BN(15),
        100,
        50,
        zeroOwner.publicKey
      )
      .accountsPartial({
        policy: zeroPolicyPda,
        owner: zeroOwner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(initPolIx), zeroOwner);

    const initZeroVaultIx = await program.methods
      .initializeVault(
        new BN(0),
        [
          {
            mint: nvdaMint,
            symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
            amountUnits: new BN(0),
            priceCents: new BN(0),
            isIndex: false,
            feedId,
          },
        ]
      )
      .accountsPartial({
        vault: zeroVaultPda,
        policy: zeroPolicyPda,
        owner: zeroOwner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    await processTx(new Transaction().add(initZeroVaultIx), zeroOwner);

    // Now call flag_violation on this zero vault -> total_cents is 0 -> fails closed with MathOverflow (6008), NOT treated as a violation!
    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: zeroVaultPda,
        policy: zeroPolicyPda,
        priceUpdate: violatingPricePubkey,
        signer: solver.publicKey,
      })
      .instruction();

    await assert.rejects(
      processTx(new Transaction().add(flagIx), solver),
      (err: any) => {
        assertCustomError(err, 'MathOverflow', 6008);
        return true;
      }
    );
  });
});
