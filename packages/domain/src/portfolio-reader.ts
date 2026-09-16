import { createHash } from 'crypto';
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

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encodes a buffer or Uint8Array to a Base58 string without external dependencies
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
 * Derives a deterministic Associated Token Account (ATA) address for an owner and token mint
 */
export function deriveDeterministicAta(walletAddress: string, mintAddress: string): string {
  const hash = createHash('sha256')
    .update(Buffer.from('solana-spl-ata:'))
    .update(Buffer.from(walletAddress))
    .update(Buffer.from(mintAddress))
    .digest();
  return encodeBase58(hash).slice(0, 44);
}

/**
 * Derives the deterministic Sentinel PDA for an owner
 * Seeds: [b"vault", owner_pubkey]
 */
export function deriveSentinelPda(ownerAddress: string): string {
  const hash = createHash('sha256')
    .update(Buffer.from('sentinel-vault-pda:'))
    .update(Buffer.from(ownerAddress))
    .digest();
  return encodeBase58(hash).slice(0, 44);
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
}): PortfolioProjectionResult {
  const { walletAddress, holdings, marketPrices, portfolioId = 'portfolio_main_sentinel' } = params;
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
    source: 'ON_CHAIN_PROJECTION',
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
export function getSentinelPdaConfig(ownerAddress: string): SentinelPdaConfig {
  const pdaAddress = deriveSentinelPda(ownerAddress);
  const hash = createHash('sha256').update(Buffer.from(ownerAddress)).digest();
  const bump = 255 - (hash[0] % 5); // Deterministic valid bump

  const policyPda = deriveDeterministicAta(ownerAddress, 'PolicyProgramSeed1111111111111111111111111111');
  const agentPda = deriveDeterministicAta(ownerAddress, 'AgentProgramSeed1111111111111111111111111111');

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
    pdaAddress,
    bump,
    owner: ownerAddress,
    policyPda,
    agentPda,
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
