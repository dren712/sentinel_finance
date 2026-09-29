import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { utils } from '@coral-xyz/anchor';

/**
 * Parses a Solana Keypair from various string representations:
 * 1. File path (e.g. ~/.config/solana/id.json, /path/to/key.json)
 * 2. Raw JSON byte array string (e.g. "[1,2,3...]")
 * 3. Base58 encoded secret key string
 */
export function parseKeypair(input: string): Keypair {
  const trimmed = input.trim();

  // 1. JSON array literal
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const bytes = Uint8Array.from(JSON.parse(trimmed));
      return Keypair.fromSecretKey(bytes);
    } catch (err) {
      throw new Error(`Failed to parse JSON keypair array: ${(err as Error).message}`);
    }
  }

  // 2. File path (expand ~ if present)
  const resolvedPath = trimmed.startsWith('~')
    ? path.join(process.env.HOME || '', trimmed.slice(1))
    : trimmed;

  if (fs.existsSync(resolvedPath)) {
    try {
      const content = fs.readFileSync(resolvedPath, 'utf8').trim();
      if (content.startsWith('[') && content.endsWith(']')) {
        const bytes = Uint8Array.from(JSON.parse(content));
        return Keypair.fromSecretKey(bytes);
      }
      // Or base58 in file
      const decoded = utils.bytes.bs58.decode(content);
      return Keypair.fromSecretKey(decoded);
    } catch (err) {
      throw new Error(`Failed to read keypair file at ${resolvedPath}: ${(err as Error).message}`);
    }
  }

  // 3. Base58 encoded private key string
  try {
    const decoded = utils.bytes.bs58.decode(trimmed);
    return Keypair.fromSecretKey(decoded);
  } catch (err) {
    throw new Error(
      `Invalid keypair representation: neither a valid file path, JSON byte array, nor base58 string. (${(err as Error).message})`
    );
  }
}

/**
 * Loads a keypair from environment or file path, returning undefined if missing.
 */
export function loadKeypair(envOrPath?: string): Keypair | undefined {
  if (!envOrPath || !envOrPath.trim()) return undefined;
  try {
    return parseKeypair(envOrPath);
  } catch {
    return undefined;
  }
}

/**
 * Resolves the owner keypair from SENTINEL_OWNER_KEYPAIR or default Solana CLI config.
 * Owner keypair signs: initialize_*, sync_vault, set_agent_active, update_policy.
 */
export function getOwnerKeypair(): Keypair {
  const envVal = process.env.SENTINEL_OWNER_KEYPAIR;
  if (envVal) {
    return parseKeypair(envVal);
  }
  const defaultPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  if (fs.existsSync(defaultPath)) {
    return parseKeypair(defaultPath);
  }
  throw new Error(
    'SENTINEL_OWNER_KEYPAIR environment variable not set, and default ~/.config/solana/id.json not found.'
  );
}

/**
 * Resolves the agent keypair from SENTINEL_AGENT_KEYPAIR.
 * Agent keypair signs: create_promise, execute_guarded_trade, reject_promise, record_evidence.
 */
export function getAgentKeypair(): Keypair {
  const envVal = process.env.SENTINEL_AGENT_KEYPAIR;
  if (envVal) {
    return parseKeypair(envVal);
  }
  // Fallback to owner keypair if agent keypair not independently configured
  return getOwnerKeypair();
}

/**
 * Returns both distinct keypairs configured for split-key operations.
 */
export function getSplitKeypairs(): { ownerKeypair: Keypair; agentKeypair: Keypair } {
  const ownerKeypair = getOwnerKeypair();
  const agentKeypair = getAgentKeypair();
  return { ownerKeypair, agentKeypair };
}

/**
 * Classification of on-chain operations by authorization boundary.
 */
export const OWNER_OPERATIONS = [
  'initialize_policy',
  'initialize_agent',
  'initialize_vault',
  'sync_vault',
  'set_agent_active',
  'update_policy',
] as const;

export const AGENT_OPERATIONS = [
  'create_promise',
  'execute_guarded_trade',
  'reject_promise',
  'record_evidence',
] as const;

export function isOwnerOperation(name: string): boolean {
  return (OWNER_OPERATIONS as readonly string[]).includes(name);
}

export function isAgentOperation(name: string): boolean {
  return (AGENT_OPERATIONS as readonly string[]).includes(name);
}
