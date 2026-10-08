import fs from 'node:fs';
import path from 'node:path';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import devnetAssets from './devnet-assets.json';

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SENTINEL_PROGRAM_ID = new PublicKey('3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH');
export const PYTH_PRICE_UPDATE_DEVNET = new PublicKey('GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i');
export const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

export interface DevnetAssetConfig {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
}

export const DEVNET_MINTS: Record<string, DevnetAssetConfig> = devnetAssets.mints;

// In-memory rate limiting map: walletAddress -> lastRequestTimestamp
const rateLimitMap: Map<string, number> = new Map();
const RATE_LIMIT_COOLDOWN_MS = 10_000; // 10s cooldown per wallet

/**
 * Loads the Faucet Authority keypair securely on the server.
 * Never leaks secret keys to the browser.
 */
let cachedAuthority: Keypair | null = null;
export function getFaucetAuthority(): Keypair {
  if (cachedAuthority) return cachedAuthority;

  if (process.env.DEVNET_FAUCET_SECRET_KEY) {
    try {
      const raw = process.env.DEVNET_FAUCET_SECRET_KEY.trim();
      if (raw.startsWith('[')) {
        cachedAuthority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
        return cachedAuthority;
      }
    } catch (e) {
      console.warn('Failed parsing DEVNET_FAUCET_SECRET_KEY env, falling back to disk key:', e);
    }
  }

  const idPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  if (fs.existsSync(idPath)) {
    try {
      const secret = JSON.parse(fs.readFileSync(idPath, 'utf8'));
      cachedAuthority = Keypair.fromSecretKey(new Uint8Array(secret));
      return cachedAuthority;
    } catch (e) {
      console.warn('Failed reading id.json from disk:', e);
    }
  }

  // Fallback: Generate an ephemeral keypair for test/CI fallback
  console.warn('No persistent devnet keypair found; generating ephemeral faucet authority.');
  cachedAuthority = Keypair.generate();
  return cachedAuthority;
}

/**
 * Derives Associated Token Account address
 */
export function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

/**
 * Constructs idempotent ATA creation instruction
 */
export function createAtaIdempotentInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // create_idempotent
  });
}

/**
 * Constructs SPL MintTo instruction
 */
export function createMintToInstruction(
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  rawUnits: bigint | number
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0); // 7 = MintTo
  data.writeBigUInt64LE(BigInt(rawUnits), 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Native SOL Airdrop with Faucet Authority direct transfer fallback
 */
export async function requestSolAirdrop(
  recipientAddress: string,
  amountSol = 1
): Promise<{
  success: boolean;
  txSignature?: string;
  method: 'rpc_airdrop' | 'faucet_transfer' | 'rate_limited';
  message: string;
  balanceSol: number;
  faucetUrl?: string;
}> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const recipient = new PublicKey(recipientAddress);

  // Rate limit check
  const now = Date.now();
  const lastReq = rateLimitMap.get(recipientAddress) || 0;
  if (now - lastReq < RATE_LIMIT_COOLDOWN_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (now - lastReq)) / 1000);
    const balance = await connection.getBalance(recipient).catch(() => 0);
    return {
      success: false,
      method: 'rate_limited',
      message: `Cooldown active. Please wait ${waitSec}s before requesting again.`,
      balanceSol: balance / LAMPORTS_PER_SOL,
      faucetUrl: 'https://faucet.solana.com',
    };
  }
  rateLimitMap.set(recipientAddress, now);

  // 1. Try public RPC requestAirdrop
  try {
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const sig = await connection.requestAirdrop(recipient, lamports);
    await connection.confirmTransaction(sig, 'confirmed');
    const balance = await connection.getBalance(recipient);
    return {
      success: true,
      txSignature: sig,
      method: 'rpc_airdrop',
      message: `Successfully airdropped ${amountSol} Devnet SOL via Solana RPC!`,
      balanceSol: balance / LAMPORTS_PER_SOL,
    };
  } catch (rpcErr: any) {
    console.warn('RPC airdrop failed, attempting Faucet Authority direct transfer...', rpcErr?.message);
  }

  // 2. Fallback: Transfer 0.5 SOL directly from funded Faucet Authority
  try {
    const authority = getFaucetAuthority();
    const authBalance = await connection.getBalance(authority.publicKey);
    if (authBalance > 0.5 * LAMPORTS_PER_SOL) {
      const transferAmount = 0.5 * LAMPORTS_PER_SOL;
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [authority]);
      const balance = await connection.getBalance(recipient);
      return {
        success: true,
        txSignature: sig,
        method: 'faucet_transfer',
        message: `Funded 0.5 Devnet SOL directly from Sentinel Faucet Authority!`,
        balanceSol: balance / LAMPORTS_PER_SOL,
      };
    }
  } catch (transferErr: any) {
    console.warn('Faucet Authority direct transfer also failed:', transferErr?.message);
  }

  const curBalance = await connection.getBalance(recipient).catch(() => 0);
  return {
    success: false,
    method: 'rate_limited',
    message: 'Devnet RPC airdrop limit reached. Please use the official Solana Foundation Faucet.',
    balanceSol: curBalance / LAMPORTS_PER_SOL,
    faucetUrl: 'https://faucet.solana.com',
  };
}

/**
 * Mints Sentinel Devnet Test SPL Tokens (sUSD or sASSET)
 */
export async function mintTestTokens(
  recipientAddress: string,
  assetKey: 'sUSD' | 'sASSET',
  amount: number
): Promise<{
  success: boolean;
  signature?: string;
  asset: string;
  amount: number;
  userAta?: string;
  explorerUrl?: string;
  error?: string;
}> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const recipient = new PublicKey(recipientAddress);
  const assetConfig = DEVNET_MINTS[assetKey];

  if (!assetConfig) {
    return { success: false, asset: assetKey, amount, error: `Unknown asset: ${assetKey}` };
  }

  const mintPubkey = new PublicKey(assetConfig.address);
  const authority = getFaucetAuthority();
  const userAta = getAssociatedTokenAddress(mintPubkey, recipient);

  try {
    const rawMultiplier = BigInt(10 ** assetConfig.decimals);
    const rawUnits = BigInt(Math.round(amount)) * rawMultiplier;

    const tx = new Transaction()
      .add(createAtaIdempotentInstruction(authority.publicKey, userAta, recipient, mintPubkey))
      .add(createMintToInstruction(mintPubkey, userAta, authority.publicKey, rawUnits));

    const sig = await sendAndConfirmTransaction(connection, tx, [authority]);

    return {
      success: true,
      signature: sig,
      asset: assetConfig.symbol,
      amount,
      userAta: userAta.toBase58(),
      explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    };
  } catch (err: any) {
    console.error(`Error minting ${assetKey}:`, err);
    return {
      success: false,
      asset: assetConfig.symbol,
      amount,
      error: err?.message || 'Failed to mint test tokens on Devnet.',
    };
  }
}

/**
 * Reads user's on-chain balances for Devnet SOL, sUSD, and sASSET
 */
export async function getUserBalances(walletAddress: string): Promise<{
  solBalance: number;
  sUsdBalance: number;
  sAssetBalance: number;
  sUsdAta: string;
  sAssetAta: string;
}> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const wallet = new PublicKey(walletAddress);

  const susdMint = new PublicKey(DEVNET_MINTS.sUSD.address);
  const sassetMint = new PublicKey(DEVNET_MINTS.sASSET.address);

  const susdAta = getAssociatedTokenAddress(susdMint, wallet);
  const sassetAta = getAssociatedTokenAddress(sassetMint, wallet);

  let sol = 0;
  let susd = 0;
  let sasset = 0;

  try {
    const lamports = await connection.getBalance(wallet);
    sol = lamports / LAMPORTS_PER_SOL;
  } catch {}

  try {
    const b = await connection.getTokenAccountBalance(susdAta);
    susd = Number(b.value.uiAmount ?? 0);
  } catch {}

  try {
    const b = await connection.getTokenAccountBalance(sassetAta);
    sasset = Number(b.value.uiAmount ?? 0);
  } catch {}

  return {
    solBalance: sol,
    sUsdBalance: susd,
    sAssetBalance: sasset,
    sUsdAta: susdAta.toBase58(),
    sAssetAta: sassetAta.toBase58(),
  };
}
