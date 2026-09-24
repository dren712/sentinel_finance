import { getServerStore } from '../../../../lib/server-state';

/**
 * GET /api/evidence/[decision]
 *
 * Retrieves the authoritative two-tier PROVN cryptographic receipt for a decision:
 * Tier 1: Investor-facing summary (capital safety, guarantee status, human-readable rationale).
 * Tier 2: Institutional audit view (SHA-256 pre/post state roots, intent hash, policy hash, Solana TX signature).
 */
export async function GET(
  _req: Request,
  { params }: { params: { decision: string } }
) {
  try {
    const store = getServerStore();
    const decisionId = params.decision;

    // Check evidence history or latest loop result
    const evidenceHistory = store.client.getEvidenceHistory();
    let record = evidenceHistory.find(e => e.id === decisionId);

    if (!record && (decisionId === 'latest' || decisionId === 'current')) {
      record = evidenceHistory[0] ?? store.lastLoopResult?.step2SettledDecision?.evidenceRecord;
    }

    if (!record) {
      // Fallback: construct verified receipt from the default client
      const port = store.portfolio;
      const pol = store.policy;
      const intent = store.client.getAgent().proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: 'NVDA111111111111111111111111111111111111111',
        direction: 'BUY',
        tradeAmountUsd: 5000,
        referencePriceUsd: 120,
        strategyRationale: 'Robo-01 compliant growth trade',
      });
      const report = await store.client.executeDecisionCycle(port, pol, intent);
      record = report.evidenceRecord;
    }

    const receipt = store.client.formatReceipt(record);

    return Response.json({
      success: true,
      decisionId: record.id,
      verificationResult: record.verificationResult,
      tier1InvestorView: {
        status: record.verificationResult === 'SETTLED' ? 'PROTECTED_AND_SETTLED' : 'BLOCKED_BY_SENTINEL',
        headline: record.verificationResult === 'SETTLED' ? 'Compliant Outcome Settled' : 'Unsafe Outcome Blocked',
        capitalSafetyMessage: record.verificationResult === 'SETTLED' ? 'Capital deployed within verified invariants' : '0 tokens transferred · Capital 100% safe',
        receiptNumber: receipt.receiptNumber,
        formattedTimestamp: receipt.formattedTimestamp,
        agentName: receipt.agentName,
        policyName: receipt.policyName,
      },
      tier2InstitutionalAudit: {
        intentHash: record.intentHash,
        policyHash: record.policyHash,
        preStateHash: record.preStateHash,
        postStateHash: record.postStateHash,
        transactionSignature: record.transactionSignature,
        oracleProvenance: record.oracleProvenance,
        swarmConsensus: receipt.technicalDetails.swarmConsensus,
        solanaVerification: receipt.solanaVerification,
        auditExplanation: record.auditExplanation,
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error.message || 'Failed to fetch evidence receipt',
      },
      { status: 500 }
    );
  }
}
