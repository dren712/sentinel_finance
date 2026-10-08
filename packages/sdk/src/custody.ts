import { PublicKey } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID } from './portfolio-indexer';

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const PYTH_RECEIVER_ID = new PublicKey('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ');
export const PYTH_DISCRIMINATOR = Buffer.from([34, 241, 35, 99, 157, 126, 244, 205]);

/**
 * Derives the Associated Token Account (ATA) for a mint and owner.
 */
export function getAssociatedTokenAddressSync(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = true,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    associatedTokenProgramId
  );
  return address;
}

/**
 * Resolves the 4 canonical SPL custody accounts required for on-chain recover():
 * [vault_ta, safe_dest_ta, mint, token_program]
 */
export function resolveRecoveryCustodyAccounts(
  vaultPubkey: PublicKey,
  safeDestination: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
) {
  const vaultTa = getAssociatedTokenAddressSync(mint, vaultPubkey, true, tokenProgramId);
  const safeDestTa = getAssociatedTokenAddressSync(mint, safeDestination, true, tokenProgramId);
  return [
    { pubkey: vaultTa, isWritable: true, isSigner: false },
    { pubkey: safeDestTa, isWritable: true, isSigner: false },
    { pubkey: mint, isWritable: false, isSigner: false },
    { pubkey: tokenProgramId, isWritable: false, isSigner: false },
  ];
}

export interface ParsedPythPrice {
  writeAuthority: PublicKey;
  feedId: Buffer;
  price: bigint;
  conf: bigint;
  exponent: number;
  publishTime: number;
  prevPublishTime: number;
  emaPrice: bigint;
  emaConf: bigint;
  postedSlot: bigint;
  priceCents: number;
}

/**
 * Parses binary account data from Pyth PriceUpdateV2 account
 */
export function parsePythPriceUpdateAccount(data: Buffer | Uint8Array): ParsedPythPrice {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let offset = 0;

  if (buf.length >= 8 && buf.subarray(0, 8).equals(PYTH_DISCRIMINATOR)) {
    offset = 8;
  }

  const writeAuthority = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  // VerificationLevel
  const verifVariant = buf.readUInt8(offset);
  offset += 1;
  if (verifVariant === 0) {
    // Partial { num_signatures: u8 }
    offset += 1;
  }

  // PriceFeedMessage
  const feedId = Buffer.from(buf.subarray(offset, offset + 32));
  offset += 32;

  const price = buf.readBigInt64LE(offset);
  offset += 8;

  const conf = buf.readBigUInt64LE(offset);
  offset += 8;

  const exponent = buf.readInt32LE(offset);
  offset += 4;

  const publishTime = Number(buf.readBigInt64LE(offset));
  offset += 8;

  const prevPublishTime = Number(buf.readBigInt64LE(offset));
  offset += 8;

  const emaPrice = buf.readBigInt64LE(offset);
  offset += 8;

  const emaConf = buf.readBigUInt64LE(offset);
  offset += 8;

  const postedSlot = buf.length >= offset + 8 ? buf.readBigUInt64LE(offset) : BigInt(0);

  const priceCents = convertPythPriceToCents(price, exponent);

  return {
    writeAuthority,
    feedId,
    price,
    conf,
    exponent,
    publishTime,
    prevPublishTime,
    emaPrice,
    emaConf,
    postedSlot,
    priceCents,
  };
}

function bigintPow10(exp: number): bigint {
  let res = BigInt(1);
  const ten = BigInt(10);
  for (let i = 0; i < exp; i++) {
    res = res * ten;
  }
  return res;
}

/**
 * Converts signed Pyth price and exponent to USD cents
 */
export function convertPythPriceToCents(price: bigint, expo: number): number {
  if (price <= BigInt(0)) return 0;
  if (expo < -12 || expo > 6) return 0;

  const TEN = BigInt(10);
  if (expo < 0) {
    const negExpo = -expo;
    if (negExpo >= 2) {
      const divisor = bigintPow10(negExpo - 2);
      return Number(price / divisor);
    } else {
      return Number(price * TEN);
    }
  } else {
    const multiplier = bigintPow10(expo + 2);
    return Number(price * multiplier);
  }
}


