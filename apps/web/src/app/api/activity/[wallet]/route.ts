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
    const wallet = params.wallet;
    const history = store.activityHistory;
    const decisions = store.db.getDecisions(wallet);
    const executions = store.db.getExecutions(wallet);
    const agentRuns = store.db.getAgentRuns(wallet);
    const evidenceList = store.db.getEvidenceList(wallet);

    return Response.json({
      success: true,
      wallet,
      authority: store.db.authority,
      historyStore: store.db.getStats(),
      totalActivities: history.length,
      activities: history.map((item) => ({
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
        agent_runs: agentRuns,
        decisions,
        executions,
        evidence_index: evidenceList.map((e) => e.record),
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
