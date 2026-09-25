import { getServerStore, reconcilePolicyFromSolana } from '../../../../lib/server-state';

/**
 * /api/policy/[wallet]
 *
 * GET: Reconciles the authoritative financial policy invariants from Solana PolicyAccount PDA.
 * POST: Prepares an unsigned Anchor update_policy / initialize_policy transaction for the user's
 *       browser wallet to sign, while updating the server preview state.
 *       IMPORTANT: The backend NEVER signs the user's Policy PDA transaction.
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
      rawPolicy: policy,
      policy: {
        ...policy,
        owner: policy.owner,
        maxSingleAssetBps: policy.maxSingleAssetBps,
        maxSingleAssetPct: `${(policy.maxSingleAssetBps / 100).toFixed(1)}%`,
        minStablecoinBps: policy.minStablecoinBps,
        minStablecoinPct: `${(policy.minStablecoinBps / 100).toFixed(1)}%`,
        maxTradeUsd: (policy as any).maxTradeUsd ?? policy.maxTradeValueUsd,
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
    const commitMode: 'PREPARE_ONLY' | 'CONFIRMED_ON_CHAIN' | 'SIMULATION' =
      body.commitMode || (body.confirmedTxSignature ? 'CONFIRMED_ON_CHAIN' : 'SIMULATION');

    const candidatePolicy: any = { ...store.policy };

    if (body.maxSingleAssetBps !== undefined) {
      candidatePolicy.maxSingleAssetBps = Math.min(
        5000,
        Math.max(500, Number(body.maxSingleAssetBps))
      );
    }
    if (body.minStablecoinBps !== undefined) {
      candidatePolicy.minStablecoinBps = Math.min(
        5000,
        Math.max(500, Number(body.minStablecoinBps))
      );
    }
    const incomingTradeLimit = body.maxTradeUsd ?? body.maxTradeValueUsd;
    if (incomingTradeLimit !== undefined) {
      const clampedTrade = Math.max(500, Number(incomingTradeLimit));
      candidatePolicy.maxTradeUsd = clampedTrade;
      candidatePolicy.maxTradeValueUsd = clampedTrade;
    }
    if (body.maxSlippageBps !== undefined) {
      candidatePolicy.maxSlippageBps = Math.min(
        500,
        Math.max(10, Number(body.maxSlippageBps))
      );
    }
    if (body.maxPreIpoExposureBps !== undefined) {
      candidatePolicy.maxPreIpoExposureBps = Math.min(
        5000,
        Math.max(500, Number(body.maxPreIpoExposureBps))
      );
    }
    if (body.isEmergencyPaused !== undefined) {
      candidatePolicy.isEmergencyPaused = Boolean(body.isEmergencyPaused);
    }

    candidatePolicy.policyVersion = (store.policy.policyVersion || 1) + 1;
    candidatePolicy.updatedAt = Date.now();

    const ownerAddress =
      params.wallet && params.wallet !== 'default' ? params.wallet : candidatePolicy.owner;

    const preparedTransaction = await store.client.prepareUnsignedPolicyUpdateTx(
      ownerAddress,
      candidatePolicy
    );

    // Only mutate authoritative server policy when confirmed on-chain or explicitly in SIMULATION mode
    if (commitMode === 'CONFIRMED_ON_CHAIN' || commitMode === 'SIMULATION') {
      store.policy = candidatePolicy;
    }

    return Response.json({
      success: true,
      commitMode,
      committed: commitMode === 'CONFIRMED_ON_CHAIN' || commitMode === 'SIMULATION',
      confirmedTxSignature: body.confirmedTxSignature || undefined,
      message:
        commitMode === 'PREPARE_ONLY'
          ? 'Unsigned Policy PDA transaction prepared for wallet signature (server state not mutated until confirmation)'
          : 'Policy state updated',
      policy: candidatePolicy,
      preparedTransaction,
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

