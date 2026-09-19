import anchor from '@coral-xyz/anchor';
const { AnchorProvider, Program, Wallet, BN, web3 } = anchor;
const { Connection, Keypair, PublicKey, SystemProgram } = web3;
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Initializing Sentinel Finance On-Chain State on Solana Devnet...\n');

  // 1. Connection & Wallet Setup
  const rpcUrl = 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  const walletPath = path.resolve(process.env.HOME || '', '.config/solana/id.json');
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Deployer wallet not found at ${walletPath}`);
  }
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const deployerKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  const wallet = new Wallet(deployerKeypair);

  console.log(`Deployer / Owner Address: ${deployerKeypair.publicKey.toBase58()}`);
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  console.log(`Deployer SOL Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // 2. Program Setup
  const programId = new PublicKey('3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK');
  const idlPath = new URL('../../../target/idl/sentinel.json', import.meta.url).pathname;
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  const program = new Program(idl, provider);

  // 3. Derive PDAs
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), deployerKeypair.publicKey.toBuffer()],
    programId
  );
  console.log(`Policy PDA: ${policyPda.toBase58()}`);

  const agentId = 'sentinel-robo-01';
  const portfolioId = 'portfolio-devnet-01';
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), deployerKeypair.publicKey.toBuffer(), Buffer.from(agentId)],
    programId
  );
  console.log(`Agent PDA:  ${agentPda.toBase58()}`);

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), deployerKeypair.publicKey.toBuffer()],
    programId
  );
  console.log(`Vault PDA:  ${vaultPda.toBase58()}\n`);

  // 4. Initialize Policy if not already initialized
  const policyAccountInfo = await connection.getAccountInfo(policyPda);
  if (policyAccountInfo) {
    console.log('✓ PolicyAccount already exists on Devnet.');
  } else {
    console.log('⏳ Initializing PolicyAccount on Devnet...');
    // Parameters:
    // max_single_asset_bps = 2500 (25.00%)
    // min_stablecoin_bps = 2000 (20.00%)
    // max_trade_value_usd = 10000 ($10,000)
    // max_slippage_bps = 100 (1.00%)
    const tx = await program.methods
      .initializePolicy(2500, 2000, new BN(10000), 100)
      .accounts({
        policy: policyPda,
        owner: deployerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`✓ PolicyAccount initialized! Tx: ${tx}`);
  }

  // 5. Initialize Agent if not already initialized
  const agentAccountInfo = await connection.getAccountInfo(agentPda);
  if (agentAccountInfo) {
    console.log('✓ AgentAccount already exists on Devnet.');
  } else {
    console.log('⏳ Initializing AgentAccount on Devnet...');
    const agentAuthority = deployerKeypair.publicKey;
    const tx = await program.methods
      .initializeAgent(agentId, portfolioId, agentAuthority)
      .accounts({
        agent: agentPda,
        owner: deployerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`✓ AgentAccount initialized! Tx: ${tx}`);
  }

  // 6. Initialize Portfolio Vault if not already initialized
  const vaultAccountInfo = await connection.getAccountInfo(vaultPda);
  if (vaultAccountInfo) {
    console.log('✓ PortfolioVault already exists on Devnet.');
  } else {
    console.log('⏳ Initializing PortfolioVault on Devnet...');
    const initialUsdcCents = new BN(2500000); // $25,000.00
    const tx = await program.methods
      .initializeVault(initialUsdcCents, [])
      .accounts({
        vault: vaultPda,
        policy: policyPda,
        owner: deployerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`✓ PortfolioVault initialized! Tx: ${tx}`);
  }

  console.log('\n🎉 Phase 2 On-Chain Initialization Complete on Solana Devnet!');
  console.log(`Program: https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`);
  console.log(`Policy:  https://explorer.solana.com/address/${policyPda.toBase58()}?cluster=devnet`);
  console.log(`Agent:   https://explorer.solana.com/address/${agentPda.toBase58()}?cluster=devnet`);
  console.log(`Vault:   https://explorer.solana.com/address/${vaultPda.toBase58()}?cluster=devnet`);
}

main().catch((err) => {
  console.error('❌ Error during Devnet initialization:', err);
  process.exit(1);
});
