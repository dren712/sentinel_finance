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

const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
const idl = JSON.parse(fs.readFileSync(path.resolve('target/idl/sentinel.json'), 'utf8'));

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
