import { getServerStore, queryAuthoritativeActivity } from '../../../../lib/server-state';

/**
 * GET /api/activity/[wallet]
 *
 * Queries the authoritative Postgres read model (agent_runs, decisions, executions,
 * portfolio_snapshots, evidence_index) for a wallet's history.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const store = getServerStore();
    const { wallet } = await params;

    let activityData: any = { activities: [], agentRuns: [], decisions: [], executions: [], evidenceList: [], stats: { totalRuns: 0, totalDecisions: 0, totalExecutions: 0, totalSnapshots: 0, totalEvidenceRecords: 0 } };
    let portfolioSnapshots: any[] = [];

    try {
      activityData = await queryAuthoritativeActivity(wallet);
    } catch (e) {
      console.warn('Could not query authoritative activity, using fallback:', e);
    }

    try {
      portfolioSnapshots = await store.db.queryPortfolioSnapshots(wallet);
    } catch {
      portfolioSnapshots = [];
    }

    const isPostgres = store.db.isPostgresConnected();

    return Response.json({
      success: true,
      wallet,
      authority: store.db.authority,
      source: isPostgres ? 'postgres_read_model' : 'in_memory_read_model',
      historyStore: activityData.stats,
      totalActivities: activityData.activities.length,
      activities: activityData.activities.map((item: any) => ({
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
        isSimulation: Boolean(item.isSimulation),
        venueName: item.venueName,
        source: item.isSimulation ? 'simulation' : (item.signature ? 'on_chain' : 'simulation'),
      })),
      tables: {
        agent_runs: activityData.agentRuns,
        decisions: activityData.decisions,
        executions: activityData.executions,
        portfolio_snapshots: portfolioSnapshots,
        evidence_index: activityData.evidenceList.map((e: any) => e.record),
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
