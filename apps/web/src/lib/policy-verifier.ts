import { PublicKey } from '@solana/web3.js';

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP: Record<string, number> = {};
for (let i = 0; i < B58_ALPHABET.length; i++) B58_MAP[B58_ALPHABET[i]] = i;

export function decodeBase58(str: string): Buffer {
  if (str.length === 0) return Buffer.alloc(0);
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = B58_MAP[c];
    if (val === undefined) throw new Error(`Invalid base58 character: ${c}`);
    let carry = val;
    for (let j = 0; j < bytes.length; ++j) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

export const UPDATE_POLICY_DISCRIMINATOR = 'd4f5f607a3971239';
export const INITIALIZE_POLICY_DISCRIMINATOR = '09ba56e181a2e738';

export interface DecodedPolicyInstruction {
  instructionType: 'update_policy' | 'initialize_policy';
  discriminatorHex: string;
  maxSingleAssetBps: number;
  minStablecoinBps: number;
  maxTradeValueUsd: bigint;
  maxSlippageBps: number;
  confirmSlots: bigint;
  recoveryWindowSlots: bigint;
  maxRecoveryCostBps: number;
  maxBountyBps: number;
  safeDestination: string;
  isActive: boolean;
}

export interface PolicyVerificationCandidate {
  maxSingleAssetBps?: number;
  minStablecoinBps?: number;
  maxTradeValueUsd?: number | bigint;
  maxTradeUsd?: number | bigint;
  maxSlippageBps?: number;
  isActive?: boolean;
  safeDestination?: string;
}

export interface PolicyVerificationResult {
  valid: boolean;
  error?: string;
  instructionType?: 'update_policy' | 'initialize_policy';
  decoded?: DecodedPolicyInstruction;
}

/**
 * Decodes the Borsh-serialized Anchor instruction data for Sentinel update_policy or initialize_policy.
 * Rejects unambiguously if discriminator does not match or if buffer is truncated.
 */
export function decodePolicyInstructionData(dataBuf: Buffer): DecodedPolicyInstruction {
  if (dataBuf.length < 8) {
    throw new Error(`Instruction data buffer too short (${dataBuf.length} bytes < 8 bytes discriminator).`);
  }

  const discriminatorHex = dataBuf.subarray(0, 8).toString('hex');

  if (discriminatorHex === UPDATE_POLICY_DISCRIMINATOR) {
    // update_policy: 8 disc + 2 + 2 + 8 + 2 + 8 + 8 + 2 + 2 + 32 + 1 = 75 bytes
    if (dataBuf.length < 75) {
      throw new Error(`update_policy data buffer too short (${dataBuf.length} bytes < 75 bytes required).`);
    }

    const maxSingleAssetBps = dataBuf.readUInt16LE(8);
    const minStablecoinBps = dataBuf.readUInt16LE(10);
    const maxTradeValueUsd = dataBuf.readBigUInt64LE(12);
    const maxSlippageBps = dataBuf.readUInt16LE(20);
    const confirmSlots = dataBuf.readBigUInt64LE(22);
    const recoveryWindowSlots = dataBuf.readBigUInt64LE(30);
    const maxRecoveryCostBps = dataBuf.readUInt16LE(38);
    const maxBountyBps = dataBuf.readUInt16LE(40);
    const safeDestination = new PublicKey(dataBuf.subarray(42, 74)).toBase58();
    const isActive = dataBuf.readUInt8(74) === 1;

    return {
      instructionType: 'update_policy',
      discriminatorHex,
      maxSingleAssetBps,
      minStablecoinBps,
      maxTradeValueUsd,
      maxSlippageBps,
      confirmSlots,
      recoveryWindowSlots,
      maxRecoveryCostBps,
      maxBountyBps,
      safeDestination,
      isActive,
    };
  }

  if (discriminatorHex === INITIALIZE_POLICY_DISCRIMINATOR) {
    // initialize_policy: 8 disc + 2 + 2 + 8 + 2 + 8 + 8 + 2 + 2 + 32 = 74 bytes
    if (dataBuf.length < 74) {
      throw new Error(`initialize_policy data buffer too short (${dataBuf.length} bytes < 74 bytes required).`);
    }

    const maxSingleAssetBps = dataBuf.readUInt16LE(8);
    const minStablecoinBps = dataBuf.readUInt16LE(10);
    const maxTradeValueUsd = dataBuf.readBigUInt64LE(12);
    const maxSlippageBps = dataBuf.readUInt16LE(20);
    const confirmSlots = dataBuf.readBigUInt64LE(22);
    const recoveryWindowSlots = dataBuf.readBigUInt64LE(30);
    const maxRecoveryCostBps = dataBuf.readUInt16LE(38);
    const maxBountyBps = dataBuf.readUInt16LE(40);
    const safeDestination = new PublicKey(dataBuf.subarray(42, 74)).toBase58();

    return {
      instructionType: 'initialize_policy',
      discriminatorHex,
      maxSingleAssetBps,
      minStablecoinBps,
      maxTradeValueUsd,
      maxSlippageBps,
      confirmSlots,
      recoveryWindowSlots,
      maxRecoveryCostBps,
      maxBountyBps,
      safeDestination,
      isActive: true,
    };
  }

  throw new Error(`Unrecognized instruction discriminator: ${discriminatorHex}`);
}

/**
 * Independently and strictly verifies a confirmed Solana transaction:
 * 1. Transaction confirmed without execution error.
 * 2. Expected owner is a signer on the transaction.
 * 3. Contains an instruction targeting expected Sentinel program ID.
 * 4. Instruction decodes unambiguously to update_policy or initialize_policy.
 * 5. Instruction accounts match expected Policy PDA and owner signer.
 * 6. Decoded instruction arguments match candidate values submitted by caller.
 * Never accepts based on PDA presence alone if decoding fails or values mismatch.
 */
export function verifyPolicyTransaction(
  parsedTx: any,
  expectedOwner: string,
  expectedPolicyPda: string,
  targetProgramId: string,
  candidatePolicy?: PolicyVerificationCandidate
): PolicyVerificationResult {
  if (!parsedTx) {
    return { valid: false, error: 'Transaction not found or could not be loaded from Solana RPC.' };
  }

  if (parsedTx.meta?.err) {
    return {
      valid: false,
      error: `Transaction confirmed with execution error on-chain: ${JSON.stringify(parsedTx.meta.err)}`,
    };
  }

  const accountKeys = parsedTx.transaction?.message?.accountKeys || [];
  const signerMatched = accountKeys.some((k: any) => {
    const keyStr = typeof k === 'string' ? k : (k?.pubkey?.toBase58 ? k.pubkey.toBase58() : String(k?.pubkey || ''));
    const isSigner = Boolean(k?.signer);
    return keyStr === expectedOwner && isSigner;
  });

  if (!signerMatched) {
    return {
      valid: false,
      error: `Transaction signer does not match expected policy owner address (${expectedOwner}).`,
    };
  }

  const instructions = parsedTx.transaction?.message?.instructions || [];
  let matchingDecoded: DecodedPolicyInstruction | null = null;
  let matchingError: string | null = null;

  for (let i = 0; i < instructions.length; i++) {
    const ix = instructions[i];
    const progKey = ix?.programId?.toBase58 ? ix.programId.toBase58() : String(ix?.programId || '');
    if (progKey !== targetProgramId) {
      continue;
    }

    const rawData = ix?.data;
    if (!rawData || typeof rawData !== 'string') {
      matchingError = `Instruction #${i} targets Sentinel program but has missing or non-string data.`;
      continue;
    }

    let dataBuf: Buffer;
    try {
      dataBuf = decodeBase58(rawData);
    } catch (err: any) {
      matchingError = `Instruction #${i} data could not be decoded from base58: ${err?.message}`;
      continue;
    }

    let decoded: DecodedPolicyInstruction;
    try {
      decoded = decodePolicyInstructionData(dataBuf);
    } catch (err: any) {
      matchingError = `Instruction #${i} failed Anchor instruction decoding: ${err?.message}`;
      continue;
    }

    // Verify accounts
    const accounts = (ix?.accounts || []).map((a: any) =>
      a?.toBase58 ? a.toBase58() : String(a?.pubkey?.toBase58 ? a.pubkey.toBase58() : a?.pubkey || a)
    );

    if (decoded.instructionType === 'update_policy') {
      // Accounts: [policy (0), vault (1), owner (2)]
      if (accounts.length < 3) {
        matchingError = `update_policy requires at least 3 accounts, received ${accounts.length}.`;
        continue;
      }
      if (accounts[0] !== expectedPolicyPda) {
        matchingError = `update_policy policy account (${accounts[0]}) does not match expected Policy PDA (${expectedPolicyPda}).`;
        continue;
      }
      if (accounts[2] !== expectedOwner) {
        matchingError = `update_policy owner account (${accounts[2]}) does not match expected owner (${expectedOwner}).`;
        continue;
      }
    } else if (decoded.instructionType === 'initialize_policy') {
      // Accounts: [policy (0), owner (1), systemProgram (2)]
      if (accounts.length < 2) {
        matchingError = `initialize_policy requires at least 2 accounts, received ${accounts.length}.`;
        continue;
      }
      if (accounts[0] !== expectedPolicyPda) {
        matchingError = `initialize_policy policy account (${accounts[0]}) does not match expected Policy PDA (${expectedPolicyPda}).`;
        continue;
      }
      if (accounts[1] !== expectedOwner) {
        matchingError = `initialize_policy owner account (${accounts[1]}) does not match expected owner (${expectedOwner}).`;
        continue;
      }
    }

    // Compare arguments against candidate policy
    if (candidatePolicy) {
      if (
        candidatePolicy.maxSingleAssetBps !== undefined &&
        decoded.maxSingleAssetBps !== candidatePolicy.maxSingleAssetBps
      ) {
        matchingError = `Decoded maxSingleAssetBps (${decoded.maxSingleAssetBps}) does not match candidate (${candidatePolicy.maxSingleAssetBps}).`;
        continue;
      }

      if (
        candidatePolicy.minStablecoinBps !== undefined &&
        decoded.minStablecoinBps !== candidatePolicy.minStablecoinBps
      ) {
        matchingError = `Decoded minStablecoinBps (${decoded.minStablecoinBps}) does not match candidate (${candidatePolicy.minStablecoinBps}).`;
        continue;
      }

      const expectedTradeLimit = candidatePolicy.maxTradeValueUsd ?? candidatePolicy.maxTradeUsd;
      if (expectedTradeLimit !== undefined && decoded.maxTradeValueUsd !== BigInt(expectedTradeLimit)) {
        matchingError = `Decoded maxTradeValueUsd (${decoded.maxTradeValueUsd}) does not match candidate (${expectedTradeLimit}).`;
        continue;
      }

      if (
        candidatePolicy.maxSlippageBps !== undefined &&
        decoded.maxSlippageBps !== candidatePolicy.maxSlippageBps
      ) {
        matchingError = `Decoded maxSlippageBps (${decoded.maxSlippageBps}) does not match candidate (${candidatePolicy.maxSlippageBps}).`;
        continue;
      }

      if (
        candidatePolicy.isActive !== undefined &&
        decoded.isActive !== candidatePolicy.isActive
      ) {
        matchingError = `Decoded isActive (${decoded.isActive}) does not match candidate (${candidatePolicy.isActive}).`;
        continue;
      }

      if (
        candidatePolicy.safeDestination &&
        decoded.safeDestination !== candidatePolicy.safeDestination
      ) {
        matchingError = `Decoded safeDestination (${decoded.safeDestination}) does not match candidate (${candidatePolicy.safeDestination}).`;
        continue;
      }
    }

    matchingDecoded = decoded;
    break;
  }

  if (!matchingDecoded) {
    return {
      valid: false,
      error:
        matchingError ||
        'Transaction does not contain a verified Sentinel policy instruction for target Policy PDA.',
    };
  }

  return {
    valid: true,
    instructionType: matchingDecoded.instructionType,
    decoded: matchingDecoded,
  };
}
