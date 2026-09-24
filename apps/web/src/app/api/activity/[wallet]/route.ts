import { getServerStore, queryAuthoritativeActivity } from '../../../../lib/server-state';

/**
 * GET /api/activity/[wallet]
 *
 * Queries the authoritative Postgres read model (agent_runs, decisions, executions,
 * portfolio_snapshots, evidence_index) for a wallet's history.
 */
export async function GET(
  _req: Request,
  { params }: { params: { wallet: string } }
) {
  try {
    const store = getServerStore();
    const wallet = params.wallet;
    const [activityData, portfolioSnapshots] = await Promise.all([
      queryAuthoritativeActivity(wallet),
      store.db.queryPortfolioSnapshots(wallet),
    ]);

    return Response.json({
      success: true,
      wallet,
      authority: store.db.authority,
      historyStore: activityData.stats,
      totalActivities: activityData.activities.length,
      activities: activityData.activities.map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        formattedTime: new Date(item.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        type: item.type,
        asset: item.asset,
        amountUsd: item.amountUsd,
        direction: item.direction,
        summary: item.summary,
        receiptNumber: item.receiptNumber,
        failureReason: item.failureReason,
        signature: item.signature,
        evidenceId: item.evidenceId,
        evidenceRecord: item.evidenceRecord,
      })),
      tables: {
        agent_runs: activityData.agentRuns,
        decisions: activityData.decisions,
        executions: activityData.executions,
        portfolio_snapshots: portfolioSnapshots,
        evidence_index: activityData.evidenceList.map((e) => e.record),
      },
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
