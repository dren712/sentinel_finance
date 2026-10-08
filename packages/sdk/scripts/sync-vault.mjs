#!/usr/bin/env node
/**
 * Sentinel Finance — Owner-Level Portfolio Vault Synchronization
 * STRICT ACCESS CONTROL: Only the Vault Owner authority key can invoke sync_vault.
 * Agent keys are strictly prevented from revaluing or syncing baseline balances.
 */
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
const { AnchorProvider, Program, Wallet, BN } = anchor;
import fs from 'fs';
import path from 'path';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.SENTINEL_PROGRAM_ID || '3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');

function loadOwnerKeypair() {
  const envVal = process.env.SENTINEL_OWNER_KEYPAIR || process.env.SOLANA_OWNER_KEYPAIR;
  if (envVal) {
    const trimmed = envVal.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
    }
    if (fs.existsSync(trimmed)) {
      const raw = JSON.parse(fs.readFileSync(trimmed, 'utf8'));
      return Keypair.fromSecretKey(Uint8Array.from(raw));
    }
  }

  const defaultSolanaId = path.join(process.env.HOME || '', '.config', 'solana', 'id.json');
  if (fs.existsSync(defaultSolanaId)) {
    const raw = JSON.parse(fs.readFileSync(defaultSolanaId, 'utf8'));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }

  throw new Error(
    'Vault sync requires an owner keypair. Set SENTINEL_OWNER_KEYPAIR or create ~/.config/solana/id.json'
  );
}

function encodeSymbol8(sym) {
  const buf = Buffer.alloc(8, 0);
  buf.write(sym.slice(0, 8), 'utf8');
  return Array.from(buf);
}

async function main() {
  console.log('===================================================================');
  console.log('🏦 SENTINEL FINANCE — OWNER VAULT RECONCILIATION & SYNC');
  console.log('===================================================================');

  const connection = new Connection(RPC_URL, 'confirmed');
  const ownerKeypair = loadOwnerKeypair();
  const wallet = new Wallet(ownerKeypair);

  console.log(`[+] Owner Authority: ${ownerKeypair.publicKey.toBase58()}`);

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), ownerKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`[+] Vault PDA:       ${vaultPda.toBase58()}`);

  const idlPath = new URL('../../../target/idl/sentinel.json', import.meta.url).pathname;
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  const program = new Program(idl, provider);

  // Check if vault account exists
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (!vaultInfo) {
    throw new Error(`Vault PDA ${vaultPda.toBase58()} does not exist on cluster ${RPC_URL}. Initialize vault first.`);
  }

  // Canonical sample portfolio allocations for Devnet
  // USDC balance: $25,000.00 (2,500,000 cents)
  const usdcBalanceCents = new BN(2500000);
  const samplePositions = [
    {
      mint: new PublicKey('NVDAxMint1111111111111111111111111111111111'),
      symbol: encodeSymbol8('NVDAx'),
      amountUnits: new BN(166),
      priceCents: new BN(12000), // $120.00
      isIndex: false,
    },
    {
      mint: new PublicKey('AAPLxMint1111111111111111111111111111111111'),
      symbol: encodeSymbol8('AAPLx'),
      amountUnits: new BN(100),
      priceCents: new BN(20000), // $200.00
      isIndex: false,
    },
    {
      mint: new PublicKey('SPYxMint11111111111111111111111111111111111'),
      symbol: encodeSymbol8('SPYx'),
      amountUnits: new BN(70),
      priceCents: new BN(50000), // $500.00
      isIndex: true,
    },
    {
      mint: new PublicKey('QQQxMint11111111111111111111111111111111111'),
      symbol: encodeSymbol8('QQQx'),
      amountUnits: new BN(25),
      priceCents: new BN(60000), // $600.00
      isIndex: true,
    },
  ];

  console.log(`\n⏳ Submitting sync_vault transaction signed by owner authority...`);
  const txSignature = await program.methods
    .syncVault(usdcBalanceCents, samplePositions)
    .accounts({
      vault: vaultPda,
      owner: ownerKeypair.publicKey,
    })
    .rpc();

  console.log(`[✓] Confirmed sync_vault TX Signature: ${txSignature}`);
  console.log(`[✓] Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
  console.log('===================================================================');
  console.log('✅ VAULT POSITIONS SYNCHRONIZED SUCCESSFULLY BY OWNER!');
  console.log('===================================================================');
}

main().catch((err) => {
  console.error('❌ Vault sync failed:', err);
  process.exit(1);
});
