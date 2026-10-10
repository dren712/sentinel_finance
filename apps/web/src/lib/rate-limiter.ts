import { PublicKey } from '@solana/web3.js';

/**
 * Sentinel Finance — Rate Limiting & Input Validation Utilities
 *
 * Implements conservative sliding-window rate limiting for public Devnet endpoints
 * (setup, incident, reset, airdrop, faucet).
 *
 * Operational Limitation Disclosure:
 *   This is a per-instance in-memory rate limiter. In multi-container/multi-process
 *   deployments, protection is enforced per node. For global cluster-wide limits,
 *   a distributed cache (e.g. Redis) must be configured.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

export interface RateLimitOptions {
  limit: number;       // Maximum requests allowed in window
  windowMs: number;    // Window duration in ms
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { limit: 10, windowMs: 60_000 }
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();

  // Periodic cleanup of stale entries
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    rateLimitMap.forEach((rec, k) => {
      rec.timestamps = rec.timestamps.filter((t) => now - t < options.windowMs);
      if (rec.timestamps.length === 0) {
        rateLimitMap.delete(k);
      }
    });
  }

  let record = rateLimitMap.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(key, record);
  }

  record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);

  if (record.timestamps.length >= options.limit) {
    const oldest = record.timestamps[0];
    const retryAfterMs = Math.max(0, options.windowMs - (now - oldest));
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: options.limit - record.timestamps.length,
    retryAfterMs: 0,
  };
}

export function getClientIdentifier(req: Request, prefix: string = 'rate'): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'anon';
  return `${prefix}:${ip}`;
}

/**
 * Validates whether an input is a valid 32-byte base58 Solana public key.
 */
export function isValidSolanaAddress(address: unknown): boolean {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  try {
    const pub = new PublicKey(trimmed);
    return PublicKey.isOnCurve(pub.toBuffer());
  } catch {
    return false;
  }
}
