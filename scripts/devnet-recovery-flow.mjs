import fs from 'node:fs';
import path from 'node:path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import anchorPkg from '@coral-xyz/anchor';
const { BN, Wallet, AnchorProvider, Program } = anchorPkg;

const PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
// Live Pyth PriceUpdateV2 account on Solana Devnet (ETH/USD)
const PYTH_PRICE_UPDATE_DEVNET = new PublicKey('GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i');
const FEED_ID_HEX = 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';

async function main() {
  console.log('Connecting to Solana Devnet...');
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load funder keypair from standard config
  const funderKeyPath = path.join(process.env.HOME, '.config/solana/id.json');
  const funderKey = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(funderKeyPath, 'utf8')))
  );
  console.log(`Funder wallet: ${funderKey.publicKey.toBase58()}`);

  const balance = await connection.getBalance(funderKey.publicKey);
  console.log(`Funder balance: ${(balance / 1e9).toFixed(4)} SOL`);

  // Ephemeral test owner and solver
  const owner = Keypair.generate();
  const solver = Keypair.generate();
  console.log(`Ephemeral owner:  ${owner.publicKey.toBase58()}`);
  console.log(`Ephemeral solver: ${solver.publicKey.toBase58()}`);

  // Fund ephemeral keypairs
  console.log('\nFunding ephemeral owner (0.05 SOL) and solver (0.05 SOL)...');
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: funderKey.publicKey,
      toPubkey: owner.publicKey,
      lamports: 50_000_000,
    }),
    SystemProgram.transfer({
      fromPubkey: funderKey.publicKey,
      toPubkey: solver.publicKey,
      lamports: 50_000_000,
    })
  );
  const fundSig = await sendAndConfirmTransaction(connection, fundTx, [funderKey]);
  console.log(`Funding TX: ${fundSig}`);

  // Load IDL
  const idlPath = path.resolve('target/idl/sentinel.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

  // Derive PDAs
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), owner.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log(`Policy PDA: ${policyPda.toBase58()}`);
  console.log(`Vault PDA:  ${vaultPda.toBase58()}`);

  const ownerProvider = new AnchorProvider(connection, new Wallet(owner), { commitment: 'confirmed' });
  const ownerProgram = new Program(idl, ownerProvider);

  const solverProvider = new AnchorProvider(connection, new Wallet(solver), { commitment: 'confirmed' });
  const solverProgram = new Program(idl, solverProvider);

  const evidenceRecords = [];

  // 1. Initialize Policy
  console.log('\n--- 1. Initialize Policy ---');
  const initPolicySig = await ownerProgram.methods
    .initializePolicy(
      2500,              // max_single_asset_bps: 25.00%
      2000,              // min_stablecoin_bps: 20.00%
      new BN(10_000_00), // max_trade_value_usd: $10,000
      200,               // max_slippage_bps: 2.00%
      new BN(2),         // confirm_slots: 2 slots
      new BN(100),       // recovery_window_slots: 100 slots
      500,               // max_recovery_cost_bps: 5.00%
      100,               // max_bounty_bps: 1.00%
      owner.publicKey    // safe_destination
    )
    .accounts({
      policy: policyPda,
      owner: owner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`initializePolicy TX: ${initPolicySig}`);
  let conf = await connection.getTransaction(initPolicySig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  evidenceRecords.push({
    instruction: 'initialize_policy',
    signature: initPolicySig,
    slot: conf?.slot ?? (await connection.getSlot()),
    signer: owner.publicKey.toBase58(),
  });

  // 2. Initialize Vault with compliant balances
  console.log('\n--- 2. Initialize Vault (Compliant State) ---');
  const feedIdBytes = Array.from(Buffer.from(FEED_ID_HEX, 'hex'));
  const symbolBytes = Array.from(Buffer.from('ETH\0\0\0\0\0'));
  const dummyMint = Keypair.generate().publicKey;

  const initVaultSig = await ownerProgram.methods
    .initializeVault(new BN(10_000_00), [
      {
        mint: dummyMint,
        symbol: symbolBytes,
        amountUnits: new BN(1), // 1 unit @ $2,500 = $2,500 vs $10,000 USDC -> 20% exposure (<= 25%)
        priceCents: new BN(2500_00),
        isIndex: false,
        feedId: feedIdBytes,
      },
    ])
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      owner: owner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`initializeVault TX: ${initVaultSig}`);
  conf = await connection.getTransaction(initVaultSig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  evidenceRecords.push({
    instruction: 'initialize_vault',
    signature: initVaultSig,
    slot: conf?.slot ?? (await connection.getSlot()),
    signer: owner.publicKey.toBase58(),
  });

  // 3. Induce Violation via Owner sync_vault ledger update
  console.log('\n--- 3. Induce Violation via Owner sync_vault (Ledger Update) ---');
  // 100 units of volatile asset @ ~$2,568 vs $100 USDC -> >99% exposure (violates 2500 bps cap)
  const syncVaultSig = await ownerProgram.methods
    .syncVault(new BN(100_00), [
      {
        mint: dummyMint,
        symbol: symbolBytes,
        amountUnits: new BN(100),
        priceCents: new BN(2500_00),
        isIndex: false,
        feedId: feedIdBytes,
      },
    ])
    .accounts({
      vault: vaultPda,
      owner: owner.publicKey,
    })
    .rpc();
  console.log(`syncVault (violation induced) TX: ${syncVaultSig}`);
  conf = await connection.getTransaction(syncVaultSig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  evidenceRecords.push({
    instruction: 'sync_vault',
    signature: syncVaultSig,
    slot: conf?.slot ?? (await connection.getSlot()),
    signer: owner.publicKey.toBase58(),
  });

  // 4. Flag Violation #1 (Solver/Watcher Signer -> PendingViolation)
  console.log('\n--- 4. Flag Violation #1 (Permissionless Signer -> PendingViolation) ---');
  const flag1Sig = await solverProgram.methods
    .flagViolation()
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      signer: solver.publicKey,
    })
    .rpc();
  console.log(`flagViolation (pending) TX: ${flag1Sig}`);
  conf = await connection.getTransaction(flag1Sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  evidenceRecords.push({
    instruction: 'flag_violation_pending',
    signature: flag1Sig,
    slot: conf?.slot ?? (await connection.getSlot()),
    signer: solver.publicKey.toBase58(),
  });

  let vaultAcc = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  console.log(`Vault Status after Flag #1:`, Object.keys(vaultAcc.status)[0] || vaultAcc.status);
  console.log(`Pending Violation Slot:    `, vaultAcc.pendingViolationSlot.toString());

  // 5. Wait for hysteresis slots (confirm_slots = 2, wait 4 seconds)
  console.log('\nWaiting 4 seconds for slots to advance beyond confirm_slots (2)...');
  await new Promise((r) => setTimeout(r, 4000));

  // 6. Flag Violation #2 (Permissionless Signer -> Quarantined)
  console.log('\n--- 5. Flag Violation #2 (Permissionless Signer -> Quarantined) ---');
  const flag2Sig = await solverProgram.methods
    .flagViolation()
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      signer: solver.publicKey,
    })
    .rpc();
  console.log(`flagViolation (quarantined) TX: ${flag2Sig}`);
  conf = await connection.getTransaction(flag2Sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  evidenceRecords.push({
    instruction: 'flag_violation_quarantined',
    signature: flag2Sig,
    slot: conf?.slot ?? (await connection.getSlot()),
    signer: solver.publicKey.toBase58(),
  });

  vaultAcc = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  console.log(`Vault Status after Flag #2:`, Object.keys(vaultAcc.status)[0] || vaultAcc.status);
  console.log(`Quarantine Slot:           `, vaultAcc.quarantineSlot.toString());
  console.log(`Recovery Expires Slot:     `, vaultAcc.recoveryExpiresSlot.toString());
  console.log(`Recovery Nonce:            `, vaultAcc.recoveryNonce.toString());

  // 7. Recover (Permissionless Solver -> Active)
  console.log('\n--- 6. Permissionless Solver Recovery (reduce-only rebalancing) ---');
  const sellUnits = new BN(78); // Sells 78 units out of 100, leaving 22 units (~22.04% exposure, satisfying 20-25% band)
  const expectedNonce = vaultAcc.recoveryNonce;

  const recoverSig = await solverProgram.methods
    .recover(sellUnits, expectedNonce)
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      solver: solver.publicKey,
    })
    .rpc();
  console.log(`recover TX: ${recoverSig}`);
  conf = await connection.getTransaction(recoverSig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  evidenceRecords.push({
    instruction: 'recover',
    signature: recoverSig,
    slot: conf?.slot ?? (await connection.getSlot()),
    signer: solver.publicKey.toBase58(),
  });

  // Verify post-recovery vault state
  vaultAcc = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  const statusKey = Object.keys(vaultAcc.status)[0] || vaultAcc.status;
  console.log('\n--- Post-Recovery Vault State ---');
  console.log(`Vault Status:              ${statusKey}`);
  console.log(`Pending Violation Slot:    ${vaultAcc.pendingViolationSlot.toString()}`);
  console.log(`Quarantine Slot:           ${vaultAcc.quarantineSlot.toString()}`);
  console.log(`Recovery Expires Slot:     ${vaultAcc.recoveryExpiresSlot.toString()}`);
  console.log(`Recovery Nonce:            ${vaultAcc.recoveryNonce.toString()}`);
  console.log(`Last Recovery Slot:        ${vaultAcc.lastRecoverySlot.toString()}`);
  console.log(`Last Recovery Solver:      ${vaultAcc.lastRecoverySolver.toBase58()}`);
  console.log(`Remaining Asset Units:     ${vaultAcc.positions[0].amountUnits.toString()}`);
  console.log(`USDC Balance Cents:        ${vaultAcc.usdcBalanceCents.toString()}`);

  if (statusKey !== 'active') {
    throw new Error(`Expected vault status 'active', got: ${statusKey}`);
  }
  if (vaultAcc.lastRecoverySolver.toBase58() !== solver.publicKey.toBase58()) {
    throw new Error('lastRecoverySolver mismatch!');
  }

  // 8. Write evidence to docs/cwf/devnet-evidence.json
  const evidenceData = {
    programId: PROGRAM_ID.toBase58(),
    cluster: 'devnet',
    timestamp: new Date().toISOString(),
    pythAccount: PYTH_PRICE_UPDATE_DEVNET.toBase58(),
    feedId: FEED_ID_HEX,
    vault: vaultPda.toBase58(),
    policy: policyPda.toBase58(),
    owner: owner.publicKey.toBase58(),
    solver: solver.publicKey.toBase58(),
    transactions: evidenceRecords,
    postRecoveryState: {
      status: statusKey,
      recoveryNonce: vaultAcc.recoveryNonce.toNumber(),
      lastRecoverySlot: vaultAcc.lastRecoverySlot.toNumber(),
      lastRecoverySolver: vaultAcc.lastRecoverySolver.toBase58(),
      usdcBalanceCents: vaultAcc.usdcBalanceCents.toNumber(),
      remainingUnits: vaultAcc.positions[0].amountUnits.toNumber(),
    },
  };

  const evidenceFilePath = path.resolve('docs/cwf/devnet-evidence.json');
  fs.writeFileSync(evidenceFilePath, JSON.stringify(evidenceData, null, 2), 'utf8');
  console.log(`\nSuccessfully recorded devnet evidence to ${evidenceFilePath}`);
  console.log(JSON.stringify(evidenceData, null, 2));
}

main().catch((err) => {
  console.error('Devnet recovery flow failed:', err);
  process.exit(1);
});
