import { getServerStore } from '../../../../lib/server-state';

/**
 * GET /api/activity/[wallet]
 *
 * Returns recent decision activity, approved trades, Sentinel rejections,
 * and autonomous adaptations.
 */
export async function GET(
  _req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const store = getServerStore();
    const history = store.activityHistory;

    return Response.json({
      success: true,
      wallet: params.wallet,
      totalActivities: history.length,
      activities: history.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        formattedTime: new Date(item.timestamp).toLocaleTimeString(),
        type: item.type,
        asset: item.asset,
        amountUsd: item.amountUsd,
        direction: item.direction,
        summary: item.summary,
        receiptNumber: item.receiptNumber,
        failureReason: item.failureReason,
        signature: item.signature,
        evidenceId: item.evidenceId,
      })),
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch activity',
      },
      { status: 500 }
    );
  }
}
