import { getServerStore, reconcilePolicyFromSolana } from '../../../../lib/server-state';

/**
 * /api/policy/[wallet]
 *
 * GET: Reconciles the authoritative financial policy invariants from Solana PolicyAccount PDA.
 * POST: Updates financial policy risk boundaries.
 */
export async function GET(
  _req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const policy = await reconcilePolicyFromSolana(params.wallet);

    return Response.json({
      success: true,
      authority: 'SOLANA_ON_CHAIN',
      wallet: params.wallet === 'default' ? policy.owner : params.wallet,
      policy: {
        owner: policy.owner,
        maxSingleAssetBps: policy.maxSingleAssetBps,
        maxSingleAssetPct: `${(policy.maxSingleAssetBps / 100).toFixed(1)}%`,
        minStablecoinBps: policy.minStablecoinBps,
        minStablecoinPct: `${(policy.minStablecoinBps / 100).toFixed(1)}%`,
        maxTradeValueUsd: policy.maxTradeValueUsd,
        maxSlippageBps: policy.maxSlippageBps,
        maxSlippagePct: `${(policy.maxSlippageBps / 100).toFixed(2)}%`,
        maxPreIpoExposureBps: policy.maxPreIpoExposureBps ?? 2000,
        maxPreIpoExposurePct: `${((policy.maxPreIpoExposureBps ?? 2000) / 100).toFixed(1)}%`,
        isEmergencyPaused: policy.isEmergencyPaused,
        policyVersion: policy.policyVersion,
        updatedAt: policy.updatedAt,
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch policy',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const store = getServerStore();
    await reconcilePolicyFromSolana(params.wallet);
    const body = (await req.json().catch(() => ({}))) as any;

    if (body.maxSingleAssetBps !== undefined) {
      store.policy.maxSingleAssetBps = Math.min(5000, Math.max(500, Number(body.maxSingleAssetBps)));
    }
    if (body.minStablecoinBps !== undefined) {
      store.policy.minStablecoinBps = Math.min(5000, Math.max(500, Number(body.minStablecoinBps)));
    }
    if (body.maxTradeValueUsd !== undefined) {
      store.policy.maxTradeValueUsd = Math.max(500, Number(body.maxTradeValueUsd));
    }
    if (body.maxSlippageBps !== undefined) {
      store.policy.maxSlippageBps = Math.min(500, Math.max(10, Number(body.maxSlippageBps)));
    }
    if (body.maxPreIpoExposureBps !== undefined) {
      store.policy.maxPreIpoExposureBps = Math.min(5000, Math.max(500, Number(body.maxPreIpoExposureBps)));
    }
    if (body.isEmergencyPaused !== undefined) {
      store.policy.isEmergencyPaused = Boolean(body.isEmergencyPaused);
    }

    store.policy.policyVersion += 1;
    store.policy.updatedAt = Date.now();

    return Response.json({
      success: true,
      message: 'Financial policy updated successfully',
      policy: store.policy,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to update policy',
      },
      { status: 500 }
    );
  }
}
