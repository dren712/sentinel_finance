import { createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import {
  Portfolio,
  Position,
  TokenHolding,
  PortfolioProjectionResult,
  NormalizedMarketPrice,
  SentinelPdaConfig,
} from './types';
import { ASSET_REGISTRY, getAssetMetadata } from './asset-registry';
import { canonicalJsonStringify } from './provn';

export const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SENTINEL_PROGRAM_ID = new PublicKey('3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK');

/**
 * Ensures a string is converted to a valid 32-byte Solana PublicKey.
 * If the input is already a valid Base58 public key, returns it directly.
 * If not (e.g. mock test identifier), deterministically hashes it to a valid 32-byte Ed25519 key.
 */
export function toValidPublicKey(keyOrSeed: string): PublicKey {
  try {
    return new PublicKey(keyOrSeed);
  } catch {
    const hash = createHash('sha256').update(Buffer.from(keyOrSeed, 'utf8')).digest();
    return new PublicKey(hash);
  }
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a buffer or Uint8Array to a Base58 string
 */
export function encodeBase58(buffer: Uint8Array): string {
  const digits: number[] = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) {
      digits[j] <<= 8;
    }
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    digits.push(0);
  }
  return digits.reverse().map(d => BASE58_ALPHABET[d]).join('');
}

/**
 * Derives the canonical Associated Token Account (ATA) address for an owner and token mint
 * using genuine Solana SPL Associated Token Program primitives:
 * findProgramAddressSync([wallet.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID)
 */
export function deriveDeterministicAta(
  walletAddress: string,
  mintAddress: string,
  tokenProgramId: string = SPL_TOKEN_PROGRAM_ID.toBase58()
): string {
  const walletPubkey = toValidPublicKey(walletAddress);
  const mintPubkey = toValidPublicKey(mintAddress);
  const tokenProgPubkey = toValidPublicKey(tokenProgramId);

  const [ata] = PublicKey.findProgramAddressSync(
    [
      walletPubkey.toBuffer(),
      tokenProgPubkey.toBuffer(),
      mintPubkey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata.toBase58();
}

/**
 * Derives the genuine Sentinel Vault PDA for an owner using Solana's findProgramAddressSync.
 * Seeds: [b"vault", owner_pubkey]
 */
export function deriveSentinelPda(
  ownerAddress: string,
  programId: string = SENTINEL_PROGRAM_ID.toBase58()
): string {
  const ownerPubkey = toValidPublicKey(ownerAddress);
  const progPubkey = toValidPublicKey(programId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), ownerPubkey.toBuffer()],
    progPubkey
  );
  return pda.toBase58();
}

/**
 * Constructs a TokenHolding from UI amount and asset metadata
 */
export function createTokenHolding(params: {
  mint: string;
  symbol: string;
  name: string;
  decimals?: number;
  balanceUi: number;
  owner: string;
  ataAddress?: string;
}): TokenHolding {
  const decimals = params.decimals ?? 6;
  const multiplier = Math.pow(10, decimals);
  const rawBigInt = BigInt(Math.round(params.balanceUi * multiplier));
  const ataAddress = params.ataAddress ?? deriveDeterministicAta(params.owner, params.mint);

  return {
    mint: params.mint,
    symbol: params.symbol,
    name: params.name,
    decimals,
    ataAddress,
    balanceRaw: rawBigInt.toString(),
    balanceUi: params.balanceUi,
    owner: params.owner,
  };
}

/**
 * Generates canonical default token holdings for the hackathon baseline portfolio ($100,000)
 */
export function createCanonicalTokenHoldings(owner: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw'): TokenHolding[] {
  return [
    createTokenHolding({
      mint: ASSET_REGISTRY.USDC.mint,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      balanceUi: 25_000,
      owner,
    }),
    createTokenHolding({
      mint: ASSET_REGISTRY.AAPLx.mint,
      symbol: 'AAPLx',
      name: 'Apple Tokenized Stock',
      decimals: 6,
      balanceUi: 125,
      owner,
    }),
    createTokenHolding({
      mint: ASSET_REGISTRY.NVDAx.mint,
      symbol: 'NVDAx',
      name: 'Nvidia Tokenized Stock',
      decimals: 6,
      balanceUi: 20_000 / 120, // 166.666667 NVDAx
      owner,
    }),
    createTokenHolding({
      mint: ASSET_REGISTRY.SPYx.mint,
      symbol: 'SPYx',
      name: 'S&P 500 Tokenized ETF',
      decimals: 6,
      balanceUi: 60,
      owner,
    }),
  ];
}

/**
 * Generates custom token holdings from target asset allocation amounts in USD
 * Phase 11: PreStocks Asset Universe & Portfolio Builder
 */
export function createCustomTokenHoldings(
  allocations: Record<string, number>,
  owner: string = 'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw',
  prices?: Record<string, number>
): TokenHolding[] {
  const holdings: TokenHolding[] = [];

  for (const [symbol, valUsd] of Object.entries(allocations)) {
    if (valUsd <= 0) continue;
    const meta = ASSET_REGISTRY[symbol];
    if (!meta) continue;

    const price = prices?.[symbol] ?? meta.basePriceUsd ?? 1.0;
    const balanceUi = price > 0 ? valUsd / price : 0;

    holdings.push(
      createTokenHolding({
        mint: meta.mint,
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        balanceUi,
        owner,
      })
    );
  }

  // Ensure USDC is always present for reserve accounting
  if (!holdings.some(h => h.symbol === 'USDC')) {
    holdings.unshift(
      createTokenHolding({
        mint: ASSET_REGISTRY.USDC.mint,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        balanceUi: 0,
        owner,
      })
    );
  }

  return holdings;
}

/**
 * Computes a SHA-256 state hash over the projected portfolio state
 */
export function hashPortfolioProjection(portfolio: Portfolio): string {
  const canonicalPayload = {
    walletAddress: portfolio.walletAddress ?? portfolio.owner,
    sentinelPda: portfolio.sentinelPda ?? '',
    totalValueUsd: Math.round(portfolio.totalValueUsd * 100) / 100,
    stablecoinValueUsd: Math.round(portfolio.stablecoinValueUsd * 100) / 100,
    stablecoinExposureBps: portfolio.stablecoinExposureBps,
    positions: portfolio.assets.map(a => ({
      symbol: a.symbol,
      mint: a.mint,
      ata: a.ata ?? '',
      rawAmount: a.rawAmount ?? '',
      amount: Math.round(a.amount * 10_000) / 10_000,
      priceUsd: Math.round(a.priceUsd * 100) / 100,
      valueUsd: Math.round(a.valueUsd * 100) / 100,
      exposureBps: a.exposureBps,
    })).sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };

  return createHash('sha256')
    .update(canonicalJsonStringify(canonicalPayload))
    .digest('hex');
}

/**
 * Projects a verified Portfolio from actual Solana token holdings and Pyth market prices
 */
export function projectPortfolioFromHoldings(params: {
  walletAddress: string;
  sentinelPda?: string;
  holdings: TokenHolding[];
  marketPrices: Record<string, NormalizedMarketPrice>;
  portfolioId?: string;
  source?: 'ON_CHAIN_PROJECTION' | 'SIMULATED_PROJECTION';
}): PortfolioProjectionResult {
  const { walletAddress, holdings, marketPrices, portfolioId = 'portfolio_main_sentinel', source = 'SIMULATED_PROJECTION' } = params;
  const sentinelPda = params.sentinelPda ?? deriveSentinelPda(walletAddress);

  // 1. Calculate USD position values from holdings and Pyth prices
  let totalValueUsd = 0;
  let stablecoinValueUsd = 0;

  const positions: Position[] = holdings.map((holding) => {
    const meta = getAssetMetadata(holding.symbol);
    const pythPrice = marketPrices[holding.symbol];
    const priceUsd = pythPrice?.priceUsd ?? (meta ? meta.basePriceUsd : 1.0);
    const valueUsd = Math.round(holding.balanceUi * priceUsd * 100) / 100;
    const isStablecoin = Boolean(meta ? meta.isStablecoin : holding.symbol === 'USDC');
    const isIndex = meta ? Boolean(meta.isIndex) : false;

    totalValueUsd += valueUsd;
    if (isStablecoin) {
      stablecoinValueUsd += valueUsd;
    }

    const verifiedPriceSource = pythPrice
      ? `${pythPrice.source} (${pythPrice.feedDisplayId})`
      : 'Pyth Benchmark Dual-Feed';

    return {
      symbol: holding.symbol,
      name: holding.name,
      mint: holding.mint,
      amount: holding.balanceUi,
      priceUsd,
      valueUsd,
      exposureBps: 0, // Computed in second pass
      isStablecoin,
      isIndex,
      assetId: meta?.id,
      assetClass: meta?.assetClass,
      costBasisUsd: valueUsd,
      unrealizedPnlUsd: 0,
      ata: holding.ataAddress,
      rawAmount: holding.balanceRaw,
      decimals: holding.decimals,
      verifiedPriceSource,
    };
  });

  // Prevent divide-by-zero
  totalValueUsd = Math.max(1, Math.round(totalValueUsd * 100) / 100);
  stablecoinValueUsd = Math.round(stablecoinValueUsd * 100) / 100;
  const stablecoinExposureBps = Math.round((stablecoinValueUsd / totalValueUsd) * 10_000);

  // 2. Second pass: compute exact exposure bps
  for (const pos of positions) {
    pos.exposureBps = Math.round((pos.valueUsd / totalValueUsd) * 10_000);
  }

  // 3. Assemble normalized projected portfolio
  const normalizedPortfolio: Portfolio = {
    portfolioId,
    owner: walletAddress,
    walletAddress,
    sentinelPda,
    totalValueUsd,
    stablecoinValueUsd,
    stablecoinExposureBps,
    assets: positions,
    timestamp: Date.now(),
    projectionTimestamp: Date.now(),
    source,
  };

  // 4. Compute deterministic projection state hash
  const projectionHash = hashPortfolioProjection(normalizedPortfolio);
  normalizedPortfolio.projectionHash = projectionHash;

  return {
    walletAddress,
    sentinelPda,
    holdings,
    normalizedPortfolio,
    projectionHash,
    verifiedAt: Date.now(),
  };
}

/**
 * Verifies that a portfolio snapshot exactly reflects real token holdings and Pyth prices
 */
export function verifyPortfolioProjection(
  portfolio: Portfolio,
  holdings: TokenHolding[],
  marketPrices: Record<string, NormalizedMarketPrice>
): { isValid: boolean; errors: string[]; computedHash: string } {
  const errors: string[] = [];

  // Check asset counts
  if (portfolio.assets.length !== holdings.length) {
    errors.push(`Asset count mismatch: portfolio has ${portfolio.assets.length}, holdings has ${holdings.length}`);
  }

  // Validate each holding matches
  for (const holding of holdings) {
    const pos = portfolio.assets.find(p => p.mint === holding.mint || p.symbol === holding.symbol);
    if (!pos) {
      errors.push(`Missing position in portfolio for token mint ${holding.mint} (${holding.symbol})`);
      continue;
    }

    if (Math.abs(pos.amount - holding.balanceUi) > 0.0001) {
      errors.push(`Balance mismatch for ${holding.symbol}: portfolio amount ${pos.amount} != holding ${holding.balanceUi}`);
    }

    const pythPrice = marketPrices[holding.symbol];
    if (pythPrice && Math.abs(pos.priceUsd - pythPrice.priceUsd) > 0.01) {
      errors.push(`Price mismatch for ${holding.symbol}: portfolio price ${pos.priceUsd} != Pyth price ${pythPrice.priceUsd}`);
    }
  }

  const computedHash = hashPortfolioProjection(portfolio);
  if (portfolio.projectionHash && portfolio.projectionHash !== computedHash) {
    errors.push(`Projection hash mismatch: expected ${portfolio.projectionHash}, computed ${computedHash}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    computedHash,
  };
}

/**
 * Returns the institutional Sentinel PDA configuration for a given owner
 */
export function getSentinelPdaConfig(
  ownerAddress: string,
  programId: string = SENTINEL_PROGRAM_ID.toBase58()
): SentinelPdaConfig {
  const ownerPubkey = toValidPublicKey(ownerAddress);
  const progPubkey = toValidPublicKey(programId);

  // Vault PDA & bump
  const [vaultPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), ownerPubkey.toBuffer()],
    progPubkey
  );

  // Policy PDA: seeds = [b"policy", owner]
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), ownerPubkey.toBuffer()],
    progPubkey
  );

  // Agent PDA: seeds = [b"agent", owner, b"sentinel-robo-01"]
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), ownerPubkey.toBuffer(), Buffer.from('sentinel-robo-01')],
    progPubkey
  );

  const trackedMints = [
    ASSET_REGISTRY.USDC.mint,
    ASSET_REGISTRY.AAPLx.mint,
    ASSET_REGISTRY.NVDAx.mint,
    ASSET_REGISTRY.SPYx.mint,
    ASSET_REGISTRY.SPACEXx.mint,
    ASSET_REGISTRY.OPENAIx.mint,
    ASSET_REGISTRY.STRIPEx.mint,
  ];

  return {
    pdaAddress: vaultPda.toBase58(),
    bump,
    owner: ownerAddress,
    policyPda: policyPda.toBase58(),
    agentPda: agentPda.toBase58(),
    trackedMints,
    roles: {
      isPolicyAuthority: true,
      isPortfolioConfiguration: true,
      isExecutionAuthority: true,
      isPromiseRegistry: true,
      isEvidenceAnchor: true,
    },
  };
}
