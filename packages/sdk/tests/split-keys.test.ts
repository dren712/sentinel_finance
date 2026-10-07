import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { Keypair, PublicKey, Connection, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, BN, Idl } from '@coral-xyz/anchor';
import {
  parseKeypair,
  getOwnerKeypair,
  getAgentKeypair,
  getSplitKeypairs,
  isOwnerOperation,
  isAgentOperation,
  OWNER_OPERATIONS,
  AGENT_OPERATIONS,
  LiveExecutionAdapter,
  SENTINEL_IDL,
  Sentinel,
} from '../src';

describe('P24 — Split Keys Security & Access Control Suite', () => {
  it('1. Keypair parser accepts JSON arrays, base58 strings, and handles malformed inputs', () => {
    const originalKp = Keypair.generate();
    const jsonStr = JSON.stringify(Array.from(originalKp.secretKey));
    const parsedFromJson = parseKeypair(jsonStr);
    assert.strictEqual(
      parsedFromJson.publicKey.toBase58(),
      originalKp.publicKey.toBase58(),
      'Parsed JSON keypair matches original public key'
    );

    assert.throws(
      () => parseKeypair('invalid_string_not_key'),
      /Invalid keypair representation/,
      'Throws on malformed key string'
    );
  });

  it('2. Operation classifications strictly partition Owner and Agent responsibilities', () => {
    assert.ok(isOwnerOperation('sync_vault'));
    assert.ok(isOwnerOperation('initialize_policy'));
    assert.ok(isOwnerOperation('initialize_agent'));
    assert.ok(isOwnerOperation('initialize_vault'));
    assert.ok(isOwnerOperation('set_agent_active'));
    assert.ok(isOwnerOperation('update_policy'));

    assert.ok(isAgentOperation('create_promise'));
    assert.ok(isAgentOperation('execute_guarded_trade'));
    assert.ok(isAgentOperation('reject_promise'));
    assert.ok(isAgentOperation('record_evidence'));

    // Verify non-intersection
    for (const op of OWNER_OPERATIONS) {
      assert.strictEqual(
        isAgentOperation(op),
        false,
        `Owner op ${op} must not be permitted for agent`
      );
    }
    for (const op of AGENT_OPERATIONS) {
      assert.strictEqual(
        isOwnerOperation(op),
        false,
        `Agent op ${op} must not be classified as owner op`
      );
    }
  });

  it('3. getSplitKeypairs correctly resolves distinct owner and agent keypairs from environment', () => {
    const ownerKp = Keypair.generate();
    const agentKp = Keypair.generate();

    const origOwnerEnv = process.env.SENTINEL_OWNER_KEYPAIR;
    const origAgentEnv = process.env.SENTINEL_AGENT_KEYPAIR;

    try {
      process.env.SENTINEL_OWNER_KEYPAIR = JSON.stringify(Array.from(ownerKp.secretKey));
      process.env.SENTINEL_AGENT_KEYPAIR = JSON.stringify(Array.from(agentKp.secretKey));

      const { ownerKeypair, agentKeypair } = getSplitKeypairs();

      assert.strictEqual(ownerKeypair.publicKey.toBase58(), ownerKp.publicKey.toBase58());
      assert.strictEqual(agentKeypair.publicKey.toBase58(), agentKp.publicKey.toBase58());
      assert.notStrictEqual(
        ownerKeypair.publicKey.toBase58(),
        agentKeypair.publicKey.toBase58(),
        'Owner and agent public keys must be distinct'
      );
    } finally {
      process.env.SENTINEL_OWNER_KEYPAIR = origOwnerEnv;
      process.env.SENTINEL_AGENT_KEYPAIR = origAgentEnv;
    }
  });

  it('4. LiveExecutionAdapter wires split keys and rejects agent-led sync_vault calls', async () => {
    const ownerKp = Keypair.generate();
    const agentKp = Keypair.generate();

    const adapter = new LiveExecutionAdapter({
      rpcEndpoint: 'https://api.devnet.solana.com',
      agentKeypair: agentKp,
      ownerKeypair: ownerKp,
      programId: '3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH',
    });

    assert.strictEqual(
      adapter.getAgentSigner()?.publicKey.toBase58(),
      agentKp.publicKey.toBase58(),
      'Adapter preserves agent signer'
    );
    assert.strictEqual(
      adapter.getOwnerSigner()?.publicKey.toBase58(),
      ownerKp.publicKey.toBase58(),
      'Adapter preserves owner signer'
    );

    // Target real Devnet owner whose vault PDA exists on-chain
    const realOwnerPubkey = new PublicKey('GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
    const [ownerVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), realOwnerPubkey.toBuffer()],
      adapter.programId
    );

    const dummyProvider = new AnchorProvider(
      adapter.getConnection(),
      {
        publicKey: agentKp.publicKey,
        signTransaction: async (tx: any) => {
          if (typeof tx.partialSign === 'function') {
            tx.partialSign(agentKp);
          }
          return tx;
        },
        signAllTransactions: async (txs: any[]) => txs,
      },
      { commitment: 'confirmed' }
    );
    const program = new Program<Sentinel>(
      SENTINEL_IDL as unknown as Idl as Sentinel,
      dummyProvider
    );

    // Build unauthorized instruction where Agent signs for sync_vault
    const syncIx = await program.methods
      .syncVault(new BN(2500000), [])
      .accountsPartial({
        vault: ownerVaultPda,
        owner: agentKp.publicKey,
      })
      .instruction();

    const tx = new Transaction().add(syncIx);
    tx.feePayer = realOwnerPubkey;
    
    let isDevnetReachable = false;
    try {
      const { blockhash } = await adapter.getConnection().getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      isDevnetReachable = true;
    } catch {
      // Offline/sandboxed environment: verify instruction structure
      assert.strictEqual(syncIx.programId.toBase58(), adapter.programId.toBase58());
      assert.strictEqual(syncIx.keys.length, 2);
      return;
    }

    // Simulate the transaction against real Devnet to verify on-chain Anchor constraint rejection
    const simulationResult = await adapter.getConnection().simulateTransaction(tx);

    assert.ok(simulationResult.value.err, 'Transaction MUST fail on-chain');
    const logs = simulationResult.value.logs || [];
    const logStr = logs.join('\n');

    // On-chain Anchor program must reject with ConstraintSeeds (2006 / 0x7d6) or ConstraintHasOne (2001 / 0x7d1)
    const isConstraintSeeds = logStr.includes('ConstraintSeeds') || logStr.includes('0x7d6') || logStr.includes('2006');
    const isConstraintHasOne = logStr.includes('ConstraintHasOne') || logStr.includes('0x7d1') || logStr.includes('2001');

    assert.ok(
      isConstraintSeeds || isConstraintHasOne,
      `Expected Anchor constraint violation when agent calls sync_vault. Logs:\n${logStr}`
    );
  });
});
