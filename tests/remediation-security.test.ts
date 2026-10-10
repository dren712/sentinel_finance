import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { startAnchor } from 'solana-bankrun';
import { PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = anchorPkg;
import fs from 'node:fs';
import path from 'node:path';
import { checkRateLimit, isValidSolanaAddress } from '../apps/web/src/lib/rate-limiter.ts';
import { SentinelReadHistoryRepository } from '../apps/web/src/lib/database.ts';
import {
  verifyPolicyTransaction,
  decodePolicyInstructionData,
  UPDATE_POLICY_DISCRIMINATOR,
  INITIALIZE_POLICY_DISCRIMINATOR,
} from '../apps/web/src/lib/policy-verifier.ts';
import { fetchPythPriceReading } from '../apps/web/src/lib/oracle-reader.ts';
const bs58 = (anchorPkg as any).utils?.bytes?.bs58 || (anchorPkg as any).default?.utils?.bytes?.bs58;

const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
const idl = JSON.parse(fs.readFileSync(path.resolve('target/idl/sentinel.json'), 'utf8'));

function encodeUpdatePolicy(args: {
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxTradeValueUsd: bigint;
  maxSlippageBps: number;
  confirmSlots: bigint;
  recoveryWindowSlots: bigint;
  maxRecoveryCostBps: number;
  maxBountyBps: number;
  safeDestination: PublicKey;
  isActive: boolean;
}): Buffer {
  const buf = Buffer.alloc(75);
  Buffer.from(UPDATE_POLICY_DISCRIMINATOR, 'hex').copy(buf, 0);
  buf.writeUInt16LE(args.maxSingleAssetBps, 8);
  buf.writeUInt16LE(args.minStablecoinBps, 10);
  buf.writeBigUInt64LE(args.maxTradeValueUsd, 12);
  buf.writeUInt16LE(args.maxSlippageBps, 20);
  buf.writeBigUInt64LE(args.confirmSlots, 22);
  buf.writeBigUInt64LE(args.recoveryWindowSlots, 30);
  buf.writeUInt16LE(args.maxRecoveryCostBps, 38);
  buf.writeUInt16LE(args.maxBountyBps, 40);
  args.safeDestination.toBuffer().copy(buf, 42);
  buf.writeUInt8(args.isActive ? 1 : 0, 74);
  return buf;
}

function encodeInitializePolicy(args: {
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxTradeValueUsd: bigint;
  maxSlippageBps: number;
  confirmSlots: bigint;
  recoveryWindowSlots: bigint;
  maxRecoveryCostBps: number;
  maxBountyBps: number;
  safeDestination: PublicKey;
}): Buffer {
  const buf = Buffer.alloc(74);
  Buffer.from(INITIALIZE_POLICY_DISCRIMINATOR, 'hex').copy(buf, 0);
  buf.writeUInt16LE(args.maxSingleAssetBps, 8);
  buf.writeUInt16LE(args.minStablecoinBps, 10);
  buf.writeBigUInt64LE(args.maxTradeValueUsd, 12);
  buf.writeUInt16LE(args.maxSlippageBps, 20);
  buf.writeBigUInt64LE(args.confirmSlots, 22);
  buf.writeBigUInt64LE(args.recoveryWindowSlots, 30);
  buf.writeUInt16LE(args.maxRecoveryCostBps, 38);
  buf.writeUInt16LE(args.maxBountyBps, 40);
  args.safeDestination.toBuffer().copy(buf, 42);
  return buf;
}

function createPythAccountData(params: {
  price: bigint;
  conf: bigint;
  exponent: number;
  publishTime: number;
}): Buffer {
  const buf = Buffer.alloc(125);
  PublicKey.default.toBuffer().copy(buf, 0);
  buf.writeUInt8(1, 32); // Full verification
  Buffer.alloc(32, 1).copy(buf, 33); // feedId
  buf.writeBigInt64LE(params.price, 65);
  buf.writeBigUInt64LE(params.conf, 73);
  buf.writeInt32LE(params.exponent, 81);
  buf.writeBigInt64LE(BigInt(params.publishTime), 85);
  buf.writeBigInt64LE(BigInt(params.publishTime - 1), 93);
  buf.writeBigInt64LE(params.price, 101);
  buf.writeBigUInt64LE(params.conf, 109);
  buf.writeBigUInt64LE(BigInt(100), 117);
  return buf;
}

describe('CWF 2026 Remediation Security & Integrity Suite', () => {
  describe('P0: Activity & Evidence Integrity', () => {
    it('in-memory read model starts empty and does not manufacture live executions', async () => {
      const repo = new SentinelReadHistoryRepository();
      const randomWallet = Keypair.generate().publicKey.toBase58();
      const decisions = await repo.queryDecisions(randomWallet, 10);
      assert.strictEqual(decisions.length, 0);

      const executions = await repo.queryExecutions(randomWallet, 10);
      assert.strictEqual(executions.length, 0);
    });

    it('seeded simulation records must carry is_simulation = true and sim_ signature prefix', async () => {
      const repo = new SentinelReadHistoryRepository();
      const testWallet = 'TestWallet111111111111111111111111111111111';

      await repo.recordDecision({
        decision_id: 'dec_sim_01',
        run_id: 'run_sim_01',
        wallet_address: testWallet,
        model_provider: 'Simulation Specimen',
        structured_intent_json: { action: 'BUY', asset: 'NVDAx', amountUsd: 5000 },
        asset_symbol: 'NVDAx',
        direction: 'BUY',
        amount_usd: 5000,
        status: 'SETTLED',
        rationale: 'Simulation test',
        policy_version: 1,
        policy_snapshot_json: {},
        evidence_id: 'evi_sim_01',
        transaction_signature: 'sim_specimen_tx_01',
        created_at: Date.now(),
      });

      await repo.recordExecution({
        execution_id: 'exec_sim_01',
        decision_id: 'dec_sim_01',
        wallet_address: testWallet,
        venue_type: 'SOLANA',
        venue_name: 'Simulated Execution',
        transaction_signature: 'sim_specimen_tx_01',
        executed_amount_usd: 5000,
        executed_price_usd: 120,
        cluster: 'DEVNET',
        is_simulation: true,
        created_at: Date.now(),
      });

      const executions = await repo.queryExecutions(testWallet, 5);
      assert.strictEqual(executions.length, 1);
      assert.strictEqual(executions[0].is_simulation, true);
      assert.ok(executions[0].transaction_signature.startsWith('sim_'));
    });

    it('evidence query returns undefined/null for non-existent decision and does not invent chain evidence', async () => {
      const repo = new SentinelReadHistoryRepository();
      const nonExistent = repo.getEvidenceById('non_existent_decision_123');
      assert.strictEqual(nonExistent, undefined);
    });
  });

  describe('P0: Policy-Update Transaction Verification Suite', () => {
    const owner = Keypair.generate();
    const ownerStr = owner.publicKey.toBase58();
    const policyPda = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), owner.publicKey.toBuffer()],
      PROGRAM_ID
    )[0];
    const vaultPda = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.publicKey.toBuffer()],
      PROGRAM_ID
    )[0];
    const safeDest = Keypair.generate().publicKey;

    it('verifies a valid update_policy transaction with matching arguments', () => {
      const buf = encodeUpdatePolicy({
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxTradeValueUsd: BigInt(10000),
        maxSlippageBps: 100,
        confirmSlots: BigInt(2),
        recoveryWindowSlots: BigInt(100),
        maxRecoveryCostBps: 500,
        maxBountyBps: 100,
        safeDestination: safeDest,
        isActive: true,
      });

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: ownerStr, signer: true, writable: true },
              { pubkey: policyPda.toBase58(), signer: false, writable: true },
              { pubkey: vaultPda.toBase58(), signer: false, writable: false },
            ],
            instructions: [
              {
                programId: PROGRAM_ID,
                accounts: [policyPda, vaultPda, owner.publicKey],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58(), {
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxTradeValueUsd: 10000,
        maxSlippageBps: 100,
        isActive: true,
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.instructionType, 'update_policy');
      assert.strictEqual(res.decoded?.maxSingleAssetBps, 2500);
      assert.strictEqual(res.decoded?.safeDestination, safeDest.toBase58());
    });

    it('verifies a valid initialize_policy transaction with matching arguments', () => {
      const buf = encodeInitializePolicy({
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxTradeValueUsd: BigInt(10000),
        maxSlippageBps: 100,
        confirmSlots: BigInt(2),
        recoveryWindowSlots: BigInt(100),
        maxRecoveryCostBps: 500,
        maxBountyBps: 100,
        safeDestination: safeDest,
      });

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: ownerStr, signer: true, writable: true },
              { pubkey: policyPda.toBase58(), signer: false, writable: true },
            ],
            instructions: [
              {
                programId: PROGRAM_ID,
                accounts: [policyPda, owner.publicKey, SystemProgram.programId],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58(), {
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxTradeValueUsd: 10000,
        maxSlippageBps: 100,
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.instructionType, 'initialize_policy');
    });

    it('rejects an unrelated transaction containing no Sentinel instructions', () => {
      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: true, writable: true }],
            instructions: [
              {
                programId: SystemProgram.programId,
                accounts: [owner.publicKey],
                data: bs58.encode(Buffer.from('transfer_dummy')),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('does not contain a verified Sentinel policy instruction'));
    });

    it('rejects transaction with on-chain execution error', () => {
      const parsedTx = {
        meta: { err: { InstructionError: [0, 'Custom'] } },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: true, writable: true }],
            instructions: [],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('execution error'));
    });

    it('rejects transaction where expected owner is not a signer', () => {
      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: false, writable: true }],
            instructions: [],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('signer does not match'));
    });

    it('rejects transaction targeting wrong program ID', () => {
      const otherProgram = Keypair.generate().publicKey;
      const buf = encodeUpdatePolicy({
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxTradeValueUsd: BigInt(10000),
        maxSlippageBps: 100,
        confirmSlots: BigInt(2),
        recoveryWindowSlots: BigInt(100),
        maxRecoveryCostBps: 500,
        maxBountyBps: 100,
        safeDestination: safeDest,
        isActive: true,
      });

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: true, writable: true }],
            instructions: [
              {
                programId: otherProgram,
                accounts: [policyPda, vaultPda, owner.publicKey],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
    });

    it('rejects transaction targeting wrong Policy PDA', () => {
      const otherPda = Keypair.generate().publicKey;
      const buf = encodeUpdatePolicy({
        maxSingleAssetBps: 2500,
        minStablecoinBps: 2000,
        maxTradeValueUsd: BigInt(10000),
        maxSlippageBps: 100,
        confirmSlots: BigInt(2),
        recoveryWindowSlots: BigInt(100),
        maxRecoveryCostBps: 500,
        maxBountyBps: 100,
        safeDestination: safeDest,
        isActive: true,
      });

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: true, writable: true }],
            instructions: [
              {
                programId: PROGRAM_ID,
                accounts: [otherPda, vaultPda, owner.publicKey],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('does not match expected Policy PDA'));
    });

    it('rejects transaction with invalid discriminator', () => {
      const buf = Buffer.alloc(75);
      Buffer.from('deadbeefdeadbeef', 'hex').copy(buf, 0);

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: true, writable: true }],
            instructions: [
              {
                programId: PROGRAM_ID,
                accounts: [policyPda, vaultPda, owner.publicKey],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
    });

    it('rejects transaction with truncated instruction data', () => {
      const buf = Buffer.alloc(20);
      Buffer.from(UPDATE_POLICY_DISCRIMINATOR, 'hex').copy(buf, 0);

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: ownerStr, signer: true, writable: true }],
            instructions: [
              {
                programId: PROGRAM_ID,
                accounts: [policyPda, vaultPda, owner.publicKey],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58());
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('too short'));
    });

    it('rejects transaction when instruction arguments do not match submitted candidate', () => {
      const buf = encodeUpdatePolicy({
        maxSingleAssetBps: 3000, // Altered in tx (30.0%)
        minStablecoinBps: 2000,
        maxTradeValueUsd: BigInt(10000),
        maxSlippageBps: 100,
        confirmSlots: BigInt(2),
        recoveryWindowSlots: BigInt(100),
        maxRecoveryCostBps: 500,
        maxBountyBps: 100,
        safeDestination: safeDest,
        isActive: true,
      });

      const parsedTx = {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: ownerStr, signer: true, writable: true },
              { pubkey: policyPda.toBase58(), signer: false, writable: true },
              { pubkey: vaultPda.toBase58(), signer: false, writable: false },
            ],
            instructions: [
              {
                programId: PROGRAM_ID,
                accounts: [policyPda, vaultPda, owner.publicKey],
                data: bs58.encode(buf),
              },
            ],
          },
        },
      };

      const res = verifyPolicyTransaction(parsedTx, ownerStr, policyPda.toBase58(), PROGRAM_ID.toBase58(), {
        maxSingleAssetBps: 2500, // Candidate expects 25.0%
        minStablecoinBps: 2000,
        maxTradeValueUsd: 10000,
      });

      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('Decoded maxSingleAssetBps (3000) does not match candidate (2500)'));
    });
  });

  describe('P1: Live-Oracle Fail-Closed & Simulation Mode Suite', () => {
    it('fails closed in live mode when Pyth account does not exist on RPC', async () => {
      const mockConnMissing = {
        getAccountInfo: async () => null,
      } as any;

      await assert.rejects(
        async () => {
          await fetchPythPriceReading(mockConnMissing, { explicitSimulation: false });
        },
        (err: any) => {
          assert.ok(err.message.includes('Fails closed in live mode'));
          return true;
        }
      );
    });

    it('fails closed in live mode when Pyth price reading is stale (> 60s)', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const staleData = createPythAccountData({
        price: BigInt(2500_00000000),
        conf: BigInt(10_00000000),
        exponent: -8,
        publishTime: nowSec - 120, // 120s old
      });

      const mockConnStale = {
        getAccountInfo: async () => ({ data: staleData }),
      } as any;

      await assert.rejects(
        async () => {
          await fetchPythPriceReading(mockConnStale, { explicitSimulation: false });
        },
        (err: any) => {
          assert.ok(err.message.includes('stale') && err.message.includes('Fails closed'));
          return true;
        }
      );
    });

    it('fails closed in live mode when Pyth confidence ratio is wider than 200 bps', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const wideConfData = createPythAccountData({
        price: BigInt(100_00000000), // $100
        conf: BigInt(5_00000000),    // ±$5 (500 bps spread > 200 bps limit)
        exponent: -8,
        publishTime: nowSec - 5,
      });

      const mockConnWide = {
        getAccountInfo: async () => ({ data: wideConfData }),
      } as any;

      await assert.rejects(
        async () => {
          await fetchPythPriceReading(mockConnWide, { explicitSimulation: false });
        },
        (err: any) => {
          assert.ok(err.message.includes('confidence interval too wide'));
          return true;
        }
      );
    });

    it('returns verified live reading when Pyth account is fresh and within confidence bound', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validData = createPythAccountData({
        price: BigInt(2500_00000000), // $2500
        conf: BigInt(10_00000000),    // ±$10 (40 bps spread <= 200 bps)
        exponent: -8,
        publishTime: nowSec - 5,
      });

      const mockConnValid = {
        getAccountInfo: async () => ({ data: validData }),
      } as any;

      const reading = await fetchPythPriceReading(mockConnValid, { explicitSimulation: false });
      assert.strictEqual(reading.isLive, true);
      assert.strictEqual(reading.isSimulation, false);
      assert.strictEqual(reading.source, 'live_pyth_devnet');
      assert.strictEqual(reading.priceCents, 250000);
    });

    it('explicit simulation returns isSimulation: true and controlled_scenario_simulation provenance', async () => {
      const mockConn = {
        getAccountInfo: async () => null,
      } as any;

      const reading = await fetchPythPriceReading(mockConn, { explicitSimulation: true });
      assert.strictEqual(reading.isLive, false);
      assert.strictEqual(reading.isSimulation, true);
      assert.strictEqual(reading.source, 'controlled_scenario_simulation');
      assert.strictEqual(reading.priceCents, 250000);
    });
  });

  describe('P1: Devnet Sandbox, Input Validation & Rate Limiting', () => {
    it('rate limiter enforces limit and blocks excessive requests within window', () => {
      const testKey = `test_ip_${Date.now()}`;
      const options = { limit: 3, windowMs: 10_000 };

      const r1 = checkRateLimit(testKey, options);
      assert.strictEqual(r1.allowed, true);
      assert.strictEqual(r1.remaining, 2);

      const r2 = checkRateLimit(testKey, options);
      assert.strictEqual(r2.allowed, true);
      assert.strictEqual(r2.remaining, 1);

      const r3 = checkRateLimit(testKey, options);
      assert.strictEqual(r3.allowed, true);
      assert.strictEqual(r3.remaining, 0);

      const r4 = checkRateLimit(testKey, options);
      assert.strictEqual(r4.allowed, false);
      assert.strictEqual(r4.remaining, 0);
      assert.ok(r4.retryAfterMs > 0);
    });

    it('isValidSolanaAddress validates genuine base58 public keys and rejects malicious input', () => {
      const validPubkey = Keypair.generate().publicKey.toBase58();
      assert.strictEqual(isValidSolanaAddress(validPubkey), true);

      assert.strictEqual(isValidSolanaAddress(''), false);
      assert.strictEqual(isValidSolanaAddress('not-base58-0OIl'), false);
      assert.strictEqual(isValidSolanaAddress('12345'), false);
      assert.strictEqual(isValidSolanaAddress('../../../etc/passwd'), false);
      assert.strictEqual(isValidSolanaAddress(null as any), false);
      assert.strictEqual(isValidSolanaAddress(undefined as any), false);
    });
  });

  describe('P1: On-Chain Portfolio Position Invariants (Bankrun Verification)', () => {
    let ctx: any;
    let provider: any;
    let program: any;
    let owner: Keypair;
    let policyPda: PublicKey;
    let vaultPda: PublicKey;
    const feedId = Array(32).fill(7);
    const mint1 = Keypair.generate().publicKey;
    const mint2 = Keypair.generate().publicKey;

    before(async () => {
      ctx = await startAnchor(
        path.resolve('.'),
        [],
        []
      );
      provider = new AnchorProvider(ctx.banksClient as any, Keypair.generate() as any, {});
      program = new Program(idl, provider);

      owner = Keypair.generate();
      ctx.setAccount(owner.publicKey, {
        lamports: 10_000_000_000,
        data: Buffer.alloc(0),
        owner: SystemProgram.programId,
        executable: false,
      });

      [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), owner.publicKey.toBuffer()],
        PROGRAM_ID
      );
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), owner.publicKey.toBuffer()],
        PROGRAM_ID
      );

      // Initialize policy
      const initPolicyIx = await program.methods
        .initializePolicy(
          2500,
          2000,
          new BN(10000),
          100,
          new BN(2),
          new BN(15),
          100,
          50,
          owner.publicKey
        )
        .accountsPartial({
          policy: policyPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      const tx = new Transaction().add(initPolicyIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);
      await ctx.banksClient.processTransaction(tx);
    });

    it('rejects initialize_vault with 2 positions (InvalidVolatileAssetConfiguration 6040)', async () => {
      const initVaultIx = await program.methods
        .initializeVault(
          new BN(2500000),
          [
            {
              mint: mint1,
              symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
              amountUnits: new BN(100),
              priceCents: new BN(12000),
              isIndex: false,
              feedId,
            },
            {
              mint: mint2,
              symbol: Array.from(Buffer.from('AAPL\0\0\0\0')),
              amountUnits: new BN(50),
              priceCents: new BN(20000),
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

      const tx = new Transaction().add(initVaultIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);

      await assert.rejects(
        async () => {
          await ctx.banksClient.processTransaction(tx);
        },
        (err: any) => {
          assert.ok(err.toString().includes('custom program error: 0x1795') || err.toString().includes('6037'));
          return true;
        }
      );
    });

    it('rejects initialize_vault with an index position (InvalidVolatileAssetConfiguration 6037)', async () => {
      const initVaultIx = await program.methods
        .initializeVault(
          new BN(2500000),
          [
            {
              mint: mint1,
              symbol: Array.from(Buffer.from('SPY\0\0\0\0\0')),
              amountUnits: new BN(100),
              priceCents: new BN(50000),
              isIndex: true, // index position not allowed in single volatile asset MVP
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

      const tx = new Transaction().add(initVaultIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);

      await assert.rejects(
        async () => {
          await ctx.banksClient.processTransaction(tx);
        },
        (err: any) => {
          assert.ok(err.toString().includes('custom program error: 0x1795') || err.toString().includes('6037'));
          return true;
        }
      );
    });

    it('rejects initialize_vault with default empty mint (AssetNotFound 6010)', async () => {
      const initVaultIx = await program.methods
        .initializeVault(
          new BN(2500000),
          [
            {
              mint: PublicKey.default,
              symbol: Array.from(Buffer.from('NONE\0\0\0\0')),
              amountUnits: new BN(100),
              priceCents: new BN(12000),
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

      const tx = new Transaction().add(initVaultIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);

      await assert.rejects(
        async () => {
          await ctx.banksClient.processTransaction(tx);
        },
        (err: any) => {
          assert.ok(err.toString().includes('custom program error: 0x177a') || err.toString().includes('6010'));
          return true;
        }
      );
    });

    it('rejects initialize_vault with amount_units > 0 and price_cents == 0 (InvalidPrice 6017)', async () => {
      const initVaultIx = await program.methods
        .initializeVault(
          new BN(2500000),
          [
            {
              mint: mint1,
              symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
              amountUnits: new BN(100),
              priceCents: new BN(0), // zero price with non-zero units
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

      const tx = new Transaction().add(initVaultIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);

      await assert.rejects(
        async () => {
          await ctx.banksClient.processTransaction(tx);
        },
        (err: any) => {
          assert.ok(err.toString().includes('custom program error: 0x1781') || err.toString().includes('6017'));
          return true;
        }
      );
    });

    it('successfully initializes vault with exactly 1 valid volatile position', async () => {
      const initVaultIx = await program.methods
        .initializeVault(
          new BN(2500000),
          [
            {
              mint: mint1,
              symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
              amountUnits: new BN(100),
              priceCents: new BN(12000),
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

      const tx = new Transaction().add(initVaultIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);
      await ctx.banksClient.processTransaction(tx);

      const acc = await ctx.banksClient.getAccount(vaultPda);
      assert.ok(acc);
      const vaultAccount = program.coder.accounts.decode('portfolioVault', Buffer.from(acc.data));
      assert.strictEqual(vaultAccount.positions.length, 1);
      assert.strictEqual(vaultAccount.positions[0].amountUnits.toNumber(), 100);
      assert.strictEqual(vaultAccount.totalValueCents.toNumber(), 2500000 + 100 * 12000);
    });

    it('rejects sync_vault with 2 positions (InvalidVolatileAssetConfiguration 6037)', async () => {
      const syncVaultIx = await program.methods
        .syncVault(
          new BN(2500000),
          [
            {
              mint: mint1,
              symbol: Array.from(Buffer.from('NVDAx\0\0\0')),
              amountUnits: new BN(100),
              priceCents: new BN(12000),
              isIndex: false,
              feedId,
            },
            {
              mint: mint2,
              symbol: Array.from(Buffer.from('AAPL\0\0\0\0')),
              amountUnits: new BN(50),
              priceCents: new BN(20000),
              isIndex: false,
              feedId,
            },
          ]
        )
        .accountsPartial({
          vault: vaultPda,
          policy: policyPda,
          owner: owner.publicKey,
        })
        .instruction();

      const tx = new Transaction().add(syncVaultIx);
      tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
      tx.feePayer = owner.publicKey;
      tx.sign(owner);

      await assert.rejects(
        async () => {
          await ctx.banksClient.processTransaction(tx);
        },
        (err: any) => {
          assert.ok(err.toString().includes('custom program error: 0x1795') || err.toString().includes('6037'));
          return true;
        }
      );
    });
  });
});
