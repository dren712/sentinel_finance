import { getServerStore } from '../../../../lib/server-state';

/**
 * GET /api/agent/status
 *
 * Exposes current autonomous agent state, risk counters, active loop stage,
 * and latest run summary queried from the Postgres `agent_runs` read model.
 */
export async function GET() {
  try {
    const store = getServerStore();
    const agent = store.client.getAgent();
    const riskState = store.client.getAgentRiskState();
    const recentRuns = await store.db.queryAgentRuns('default', 1);
    const latestDbRun = recentRuns[0];

    return Response.json({
      success: true,
      status: store.status,
      agentId: agent.agentId,
      name: agent.name,
      objective: agent.objective,
      llmProvider: latestDbRun?.llm_provider || agent.llmProvider.providerName,
      agentStatus: agent.status,
      currentLoopStage: store.lastLoopState?.stage || latestDbRun?.stage || 'IDLE',
      currentLoopState: store.lastLoopState || null,
      riskState,
      lastDecisionSummary: store.lastLoopResult?.summary || latestDbRun?.summary || null,
      updatedAt: latestDbRun?.created_at || Date.now(),
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch agent status',
      },
      { status: 500 }
    );
  }
}
