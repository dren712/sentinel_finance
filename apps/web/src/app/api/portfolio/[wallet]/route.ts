import { getServerStore } from '../../../../lib/server-state';

/**
 * GET /api/portfolio/[wallet]
 *
 * Retrieves the current portfolio snapshot, token holdings, ATAs, valuations,
 * and policy compliance state for a specified wallet address.
 */
export async function GET(
  _req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const store = getServerStore();
    const wallet = params.wallet;

    // Use current active portfolio from server store
    const portfolio = store.portfolio;
    const policy = store.policy;

    // Calculate exposure percentages and compliance
    const cashReservePct = (portfolio.stablecoinExposureBps / 100);
    const minReserveFloorPct = (policy.minStablecoinBps / 100);
    const isReserveCompliant = portfolio.stablecoinExposureBps >= policy.minStablecoinBps;

    return Response.json({
      success: true,
      wallet: wallet === 'default' ? portfolio.owner : wallet,
      source: portfolio.source,
      totalValueUsd: portfolio.totalValueUsd,
      stablecoinValueUsd: portfolio.stablecoinValueUsd,
      stablecoinExposureBps: portfolio.stablecoinExposureBps,
      cashReservePct,
      minReserveFloorPct,
      isReserveCompliant,
      assets: portfolio.assets.map(a => ({
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
