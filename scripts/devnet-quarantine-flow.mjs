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
// Live Pyth PriceUpdateV2 account on Solana Devnet
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

  // Generate ephemeral test owner and watcher
  const owner = Keypair.generate();
  const watcher = Keypair.generate();
  console.log(`Ephemeral owner: ${owner.publicKey.toBase58()}`);
  console.log(`Ephemeral watcher: ${watcher.publicKey.toBase58()}`);

  // Fund ephemeral keypairs
  console.log('Funding ephemeral owner (0.05 SOL) and watcher (0.03 SOL)...');
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: funderKey.publicKey,
      toPubkey: owner.publicKey,
      lamports: 50_000_000,
    }),
    SystemProgram.transfer({
      fromPubkey: funderKey.publicKey,
      toPubkey: watcher.publicKey,
      lamports: 30_000_000,
    })
  );
  const fundSig = await sendAndConfirmTransaction(connection, fundTx, [funderKey]);
  console.log(`Funded in tx: ${fundSig}`);

  // Load IDL
  const idlPath = path.resolve('target/idl/sentinel.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

  const agentId = 'agent-devnet';
  const portfolioId = 'portfolio-devnet';

  // Derive PDAs
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), owner.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), owner.publicKey.toBuffer(), Buffer.from(agentId)],
    PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log(`Policy PDA: ${policyPda.toBase58()}`);
  console.log(`Agent PDA:  ${agentPda.toBase58()}`);
  console.log(`Vault PDA:  ${vaultPda.toBase58()}`);

  // Set up Anchor provider and program for owner
  const ownerWallet = new Wallet(owner);
  const ownerProvider = new AnchorProvider(connection, ownerWallet, {
    commitment: 'confirmed',
  });
  const ownerProgram = new Program(idl, ownerProvider);

  // 1. Initialize Policy
  console.log('\n--- 1. Initialize Policy ---');
  const initPolicyTx = await ownerProgram.methods
    .initializePolicy(
      2500,              // max_single_asset_bps: 25.00%
      2000,              // min_stablecoin_bps: 20.00%
      new BN(10_000_00), // max_trade_value_usd: $10,000
      200,               // max_slippage_bps: 2.00%
      new BN(2),         // confirm_slots: 2 slots hysteresis
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
  console.log(`initializePolicy TX: ${initPolicyTx}`);

  // 2. Initialize Agent
  console.log('\n--- 2. Initialize Agent ---');
  const initAgentTx = await ownerProgram.methods
    .initializeAgent(agentId, portfolioId, owner.publicKey)
    .accounts({
      agent: agentPda,
      owner: owner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log(`initializeAgent TX: ${initAgentTx}`);

  // 3. Initialize Vault with severe violation (100 units of asset @ ~$2,574 = $257,400 vs $100 USDC)
  console.log('\n--- 3. Initialize Vault (Violating Portfolio) ---');
  const feedIdBytes = Array.from(Buffer.from(FEED_ID_HEX, 'hex'));
  const symbolBytes = Array.from(Buffer.from('ETH\0\0\0\0\0'));
  const dummyMint = Keypair.generate().publicKey;
  const initVaultTx = await ownerProgram.methods
    .initializeVault(new BN(100_00), [
      {
        mint: dummyMint,
        symbol: symbolBytes,
        amountUnits: new BN(100), // 100 units
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
  console.log(`initializeVault TX: ${initVaultTx}`);

  // Set up Watcher provider and program
  const watcherWallet = new Wallet(watcher);
  const watcherProvider = new AnchorProvider(connection, watcherWallet, {
    commitment: 'confirmed',
  });
  const watcherProgram = new Program(idl, watcherProvider);

  // 4. Flag Violation #1 (Watcher Signer -> Pending)
  console.log('\n--- 4. Flag Violation #1 (Watcher Signer -> Pending) ---');
  const flag1Tx = await watcherProgram.methods
    .flagViolation()
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      signer: watcher.publicKey,
    })
    .rpc();
  console.log(`flagViolation (pending) TX: ${flag1Tx}`);

  let vaultAcc = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  console.log(`Vault Status after Flag #1:`, Object.keys(vaultAcc.status)[0] || vaultAcc.status);
  console.log(`Pending Violation Slot:    `, vaultAcc.pendingViolationSlot.toString());

  // 5. Wait for hysteresis slots (confirm_slots = 2, devnet slot ~400ms)
  console.log('\nWaiting 4 seconds for slots to advance beyond confirm_slots...');
  await new Promise((r) => setTimeout(r, 4000));

  // 6. Flag Violation #2 (Watcher Signer -> Quarantined)
  console.log('\n--- 5. Flag Violation #2 (Watcher Signer -> Quarantined) ---');
  const flag2Tx = await watcherProgram.methods
    .flagViolation()
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      signer: watcher.publicKey,
    })
    .rpc();
  console.log(`flagViolation (Quarantined) TX: ${flag2Tx}`);

  vaultAcc = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  console.log(`Vault Status after Flag #2:`, Object.keys(vaultAcc.status)[0] || vaultAcc.status);
  console.log(`Quarantine Slot:           `, vaultAcc.quarantineSlot.toString());
  console.log(`Recovery Expires Slot:     `, vaultAcc.recoveryExpiresSlot.toString());
  console.log(`Recovery Nonce:            `, vaultAcc.recoveryNonce.toString());

  // 7. Owner Release (Owner Signer -> Active)
  console.log('\n--- 6. Owner Release (Owner Signer -> Active) ---');
  const releaseTx = await ownerProgram.methods
    .ownerRelease()
    .accounts({
      vault: vaultPda,
      owner: owner.publicKey,
    })
    .rpc();
  console.log(`ownerRelease TX: ${releaseTx}`);

  vaultAcc = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  console.log(`Vault Status after Release:`, Object.keys(vaultAcc.status)[0] || vaultAcc.status);
  console.log(`Pending Violation Slot:    `, vaultAcc.pendingViolationSlot.toString());
  console.log(`Recovery Nonce:            `, vaultAcc.recoveryNonce.toString());

  console.log('\n=== DEVNET RUN COMPLETE ===');
  const result = {
    programId: PROGRAM_ID.toBase58(),
    pythAccount: PYTH_PRICE_UPDATE_DEVNET.toBase58(),
    owner: owner.publicKey.toBase58(),
    watcher: watcher.publicKey.toBase58(),
    initPolicyTx,
    initAgentTx,
    initVaultTx,
    flagViolationPendingTx: flag1Tx,
    flagViolationQuarantinedTx: flag2Tx,
    ownerReleaseTx: releaseTx,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Error during devnet run:', err);
  process.exit(1);
});
