import {
  getServerStore,
  reconcilePortfolioFromSolana,
  reconcilePolicyFromSolana,
} from '../../../../lib/server-state';

/**
 * GET /api/portfolio/[wallet]
 *
 * Reconciles the current portfolio snapshot against Solana (authoritative financial state)
 * and attaches historical snapshots from the Postgres read model (`portfolio_snapshots`).
 */
export async function GET(
  _req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const store = getServerStore();
    const wallet = params.wallet;

    let portfolio = store.portfolio;
    let policy = store.policy;
    let historicalSnapshots: any[] = [];

    try {
      portfolio = await reconcilePortfolioFromSolana(wallet);
    } catch {
      portfolio = store.portfolio;
    }

    try {
      policy = await reconcilePolicyFromSolana(wallet);
    } catch {
      policy = store.policy;
    }

    try {
      historicalSnapshots = await store.db.queryPortfolioSnapshots(wallet, 20);
    } catch {
      historicalSnapshots = [];
    }

    const cashReservePct = (portfolio?.stablecoinExposureBps ?? 2500) / 100;
    const minReserveFloorPct = (policy?.minStablecoinBps ?? 2000) / 100;
    const isReserveCompliant = (portfolio?.stablecoinExposureBps ?? 2500) >= (policy?.minStablecoinBps ?? 2000);

    return Response.json({
      success: true,
      authority: 'SOLANA_ON_CHAIN',
      wallet: wallet === 'default' ? portfolio.owner : wallet,
      source: portfolio.source,
      totalValueUsd: portfolio.totalValueUsd,
      stablecoinValueUsd: portfolio.stablecoinValueUsd,
      stablecoinExposureBps: portfolio.stablecoinExposureBps,
      cashReservePct,
      minReserveFloorPct,
      isReserveCompliant,
      assets: portfolio.assets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        mint: a.mint,
        amount: a.amount,
        priceUsd: a.priceUsd,
        valueUsd: a.valueUsd,
        exposureBps: a.exposureBps,
        allocationPct: Number(((a.valueUsd / (portfolio.totalValueUsd || 1)) * 100).toFixed(2)),
        isStablecoin: a.isStablecoin,
        assetClass: a.assetClass,
        ata: a.ata,
      })),
      historicalSnapshots,
      timestamp: portfolio.timestamp,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch portfolio',
      },
      { status: 500 }
    );
  }
}
