import { runServerAgentCycle, getServerStore } from '../../../../lib/server-state';

/**
 * POST /api/agent/run
 *
 * Initiates an autonomous agent decision cycle or 10-stage adaptation loop.
 * The backend orchestrates the execution while Sentinel deterministically enforces invariants.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { wallet, scenario, llmProvider, targetAsset, proposedAmountUsd } = body;

    const result = await runServerAgentCycle({
      wallet,
      scenario,
      llmProvider,
      targetAsset,
      proposedAmountUsd,
    });

    return Response.json({
      success: true,
      cycleId: result.cycleId,
      agentId: result.agentId,
      initialDecision: {
        status: result.step1RejectedDecision.status,
        intent: result.step1RejectedDecision.intent,
        failureReason: result.step1RejectedDecision.evidenceRecord.failureReason,
        failureCode: result.step1RejectedDecision.evidenceRecord.failureCode,
      },
      adaptedDecision: {
        status: result.step2SettledDecision.status,
        intent: result.step2SettledDecision.intent,
        resultingPortfolio: result.step2SettledDecision.resultingPortfolio,
        transactionSignature: result.step2SettledDecision.executionResult?.transactionSignature,
        evidenceId: result.step2SettledDecision.evidenceRecord.id,
      },
      adaptationDetails: result.adaptationDetails,
      loopState: result.loopState,
      summary: result.summary,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to execute agent run',
      },
      { status: 500 }
    );
  }
}
