import { getServerStore } from '../../../../lib/server-state';

/**
 * GET /api/agent/status
 *
 * Exposes current autonomous agent state, risk counters, active loop stage, and operational status.
 */
export async function GET() {
  try {
    const store = getServerStore();
    const agent = store.client.getAgent();
    const riskState = store.client.getAgentRiskState();

    return Response.json({
      success: true,
      status: store.status,
      agentId: agent.agentId,
      name: agent.name,
      objective: agent.objective,
      llmProvider: agent.llmProvider.providerName,
      agentStatus: agent.status,
      currentLoopStage: store.lastLoopState?.stage || 'IDLE',
      currentLoopState: store.lastLoopState || null,
      riskState,
      lastDecisionSummary: store.lastLoopResult?.summary || null,
      updatedAt: Date.now(),
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
