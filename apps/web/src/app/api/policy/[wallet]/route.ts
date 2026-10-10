import { Connection } from '@solana/web3.js';
import { deriveSentinelPda, SENTINEL_PROGRAM_ID } from '@sentinel/domain';
import { APP_CONFIG } from '../../../../lib/config';
import { getServerStore, reconcilePolicyFromSolana, fetchOnChainPolicy } from '../../../../lib/server-state';
import { verifyPolicyTransaction } from '../../../../lib/policy-verifier';

/**
 * /api/policy/[wallet]
 *
 * GET: Reconciles the authoritative financial policy invariants from Solana PolicyAccount PDA.
 * POST:
 *   - PREPARE_ONLY: Validates candidate policy and prepares an unsigned Anchor transaction
 *     bound to (wallet == policy.owner == PolicyAccount PDA) WITHOUT mutating server state.
 *   - CONFIRMED_ON_CHAIN: Strictly and independently verifies confirmedTxSignature on Solana RPC:
 *     (confirmed status, no execution error, signer == ownerAddress, Policy PDA & Program matched,
 *      instruction arguments match submitted candidate values) before reading back on-chain state.
 *   - SIMULATION: Explicitly updates in-memory simulation policy state.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet: walletParam } = await params;
    const store = getServerStore();
    const ownerAddress =
      walletParam && walletParam !== 'default' ? walletParam : store.policy.owner;

    const onChain = await fetchOnChainPolicy(ownerAddress);
    const policy = onChain ?? (await reconcilePolicyFromSolana(walletParam));
    const policyPda = deriveSentinelPda(ownerAddress);
    const authority = onChain ? 'SOLANA_ON_CHAIN' : 'POSTGRES_READ_MODEL';

    return Response.json({
      success: true,
      authority,
      wallet: ownerAddress,
      policyPda,
      policy: {
        ...policy,
        owner: ownerAddress,
        policyPda,
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
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const store = getServerStore();
    const { wallet: walletParam } = await params;
    await reconcilePolicyFromSolana(walletParam);
    const body = (await req.json().catch(() => ({}))) as any;
    const commitMode: 'PREPARE_ONLY' | 'CONFIRMED_ON_CHAIN' | 'SIMULATION' =
      body.commitMode || (body.confirmedTxSignature ? 'CONFIRMED_ON_CHAIN' : 'SIMULATION');

    const ownerAddress =
      walletParam && walletParam !== 'default' ? walletParam : store.policy.owner;

    const expectedPolicyPda = deriveSentinelPda(ownerAddress);

    // Enforce explicit wallet -> owner -> Policy PDA binding
    if (body.owner && body.owner !== ownerAddress) {
      return Response.json(
        {
          success: false,
          error: `Policy owner mismatch: payload owner (${body.owner}) does not match target wallet (${ownerAddress}).`,
        },
        { status: 400 }
      );
    }

    const candidatePolicy: any = {
      ...store.policy,
      owner: ownerAddress,
      policyPda: expectedPolicyPda,
    };

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

    const preparedTransaction = await store.client.prepareUnsignedPolicyUpdateTx(
      ownerAddress,
      candidatePolicy
    );

    let committedPolicy = candidatePolicy;

    if (commitMode === 'CONFIRMED_ON_CHAIN') {
      const sig = typeof body.confirmedTxSignature === 'string' ? body.confirmedTxSignature.trim() : '';
      if (!sig || sig.length < 64 || sig.startsWith('sim_') || sig.startsWith('SIM_')) {
        return Response.json(
          {
            success: false,
            error: 'CONFIRMED_ON_CHAIN requires a valid base58 Solana transaction signature.',
          },
          { status: 400 }
        );
      }

      // Independently verify transaction on Solana RPC before committing authoritative state
      const connection = new Connection(APP_CONFIG.rpcUrl, 'confirmed');
      const parsedTx = await connection.getParsedTransaction(sig, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      const targetProgramId = APP_CONFIG.sentinelProgramId || SENTINEL_PROGRAM_ID.toBase58();
      const verification = verifyPolicyTransaction(
        parsedTx,
        ownerAddress,
        expectedPolicyPda,
        targetProgramId,
        candidatePolicy
      );

      if (!verification.valid) {
        return Response.json(
          {
            success: false,
            error: `On-chain policy transaction verification failed: ${verification.error}`,
          },
          { status: 400 }
        );
      }

      // Read back authoritative on-chain state directly from chain
      const onChain = await fetchOnChainPolicy(ownerAddress);
      if (!onChain) {
        return Response.json(
          {
            success: false,
            error: 'Transaction confirmed, but PolicyAccount PDA could not be read or decoded from Solana RPC.',
          },
          { status: 502 }
        );
      }

      store.policy = onChain;
      committedPolicy = onChain;
    } else if (commitMode === 'SIMULATION') {
      store.policy = candidatePolicy;
      committedPolicy = candidatePolicy;
    }

    const authority =
      commitMode === 'CONFIRMED_ON_CHAIN'
        ? 'SOLANA_ON_CHAIN'
        : commitMode === 'SIMULATION'
        ? 'SIMULATION'
        : 'PREPARE_ONLY';

    const source =
      commitMode === 'CONFIRMED_ON_CHAIN'
        ? 'on_chain'
        : commitMode === 'SIMULATION'
        ? 'simulation'
        : 'candidate';

    return Response.json({
      success: true,
      authority,
      source,
      commitMode,
      committed: commitMode === 'CONFIRMED_ON_CHAIN' || commitMode === 'SIMULATION',
      confirmedTxSignature: body.confirmedTxSignature || undefined,
      owner: ownerAddress,
      policyPda: expectedPolicyPda,
      message:
        commitMode === 'PREPARE_ONLY'
          ? 'Unsigned Policy PDA transaction prepared for wallet signature (server state not mutated until RPC confirmation)'
          : commitMode === 'CONFIRMED_ON_CHAIN'
          ? 'On-chain Policy PDA transaction verified via Solana RPC and committed'
          : 'Simulation policy state updated',
      policy: committedPolicy,
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
