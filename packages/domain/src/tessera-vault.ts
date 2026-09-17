export interface TesseraSpvTranche {
  trancheId: string;
  assetSymbol: string;
  spvLegalEntity: string;
  shareClass: string;
  navAttestationUsd: number;
  navAttestationDate: string;
  navAttestor: string;
  secondaryLockupExpiry: number;
  isAccreditedEligible: boolean;
  vaultPda: string;
  maxAllowedNavPremiumBps: number;
}

export const TESSERA_SPV_REGISTRY: Record<string, TesseraSpvTranche> = {
  SPACEXx: {
    trancheId: 'TESSERA_SPACEX_SERIES_N',
    assetSymbol: 'SPACEXx',
    spvLegalEntity: 'Tessera Private Alpha SpaceX SPV LLC',
    shareClass: 'Series N Preferred',
    navAttestationUsd: 135.0,
    navAttestationDate: '2026-08-15',
    navAttestor: 'Carta Certified 409A / Forge Global Secondary Index',
    secondaryLockupExpiry: 1723680000000, // August 2024 (unlocked)
    isAccreditedEligible: true,
    vaultPda: 'TesseraVaultSpaceXSeriesN111111111111111111111',
    maxAllowedNavPremiumBps: 1500, // 15.00% max secondary premium
  },
  OPENAIx: {
    trancheId: 'TESSERA_OPENAI_TENDER_TRANCHE',
    assetSymbol: 'OPENAIx',
    spvLegalEntity: 'Tessera AI Innovations SPV LLC',
    shareClass: 'Secondary Employee Tender Offer Tranche',
    navAttestationUsd: 200.0,
    navAttestationDate: '2026-08-01',
    navAttestor: 'Forge Global Institutional Secondary Composite',
    secondaryLockupExpiry: 1722470400000, // August 2024 (unlocked)
    isAccreditedEligible: true,
    vaultPda: 'TesseraVaultOpenAITender11111111111111111111',
    maxAllowedNavPremiumBps: 1500,
  },
  STRIPEx: {
    trancheId: 'TESSERA_STRIPE_SERIES_I',
    assetSymbol: 'STRIPEx',
    spvLegalEntity: 'Tessera Fintech Growth SPV LLC',
    shareClass: 'Series I Preferred',
    navAttestationUsd: 80.0,
    navAttestationDate: '2026-07-20',
    navAttestor: 'ApexFunder Secondary Valuation / Carta 409A',
    secondaryLockupExpiry: 1721433600000, // July 2024 (unlocked)
    isAccreditedEligible: true,
    vaultPda: 'TesseraVaultStripeSeriesI111111111111111111111',
    maxAllowedNavPremiumBps: 1500,
  },
};

export interface TesseraEvaluationResult {
  passed: boolean;
  failureCode?: 'ERR_TESSERA_LOCKUP_ACTIVE' | 'ERR_TESSERA_NAV_PREMIUM_EXCEEDED';
  premiumBps: number;
  maxPremiumBps: number;
  reason: string;
}

/**
 * Returns the registered Tessera SPV tranche metadata for a private equity symbol
 */
export function getTesseraTranche(symbol: string): TesseraSpvTranche | undefined {
  return TESSERA_SPV_REGISTRY[symbol];
}

/**
 * Evaluates Tessera SPV fractional tranche constraints:
 * 1. Lockup Expiry: secondary transfer lockup must be expired.
 * 2. NAV Premium: secondary trade price cannot exceed certified NAV by more than authorized limit.
 */
export function evaluateTesseraEligibility(
  tranche: TesseraSpvTranche,
  quotedPriceUsd: number,
  maxPremiumBps: number = 1500,
  currentTimeMs: number = Date.now()
): TesseraEvaluationResult {
  // 1. Lockup check
  if (currentTimeMs < tranche.secondaryLockupExpiry) {
    return {
      passed: false,
      failureCode: 'ERR_TESSERA_LOCKUP_ACTIVE',
      premiumBps: 0,
      maxPremiumBps,
      reason: `Tessera SPV tranche ${tranche.trancheId} is locked until ${new Date(tranche.secondaryLockupExpiry).toISOString()}`,
    };
  }

  // 2. NAV premium check
  const navPrice = tranche.navAttestationUsd;
  const premiumUsd = quotedPriceUsd - navPrice;
  const premiumBps = Math.round((premiumUsd / navPrice) * 10_000);

  if (premiumBps > maxPremiumBps) {
    return {
      passed: false,
      failureCode: 'ERR_TESSERA_NAV_PREMIUM_EXCEEDED',
      premiumBps,
      maxPremiumBps,
      reason: `Secondary price $${quotedPriceUsd.toFixed(2)} represents a ${(premiumBps / 100).toFixed(2)}% premium over certified NAV ($${navPrice.toFixed(2)}), exceeding ${(maxPremiumBps / 100).toFixed(2)}% limit`,
    };
  }

  return {
    passed: true,
    premiumBps,
    maxPremiumBps,
    reason: `Tessera SPV tranche ${tranche.trancheId} verified: secondary lockup elapsed, premium ${(premiumBps / 100).toFixed(2)}% <= ${(maxPremiumBps / 100).toFixed(2)}% limit`,
  };
}
