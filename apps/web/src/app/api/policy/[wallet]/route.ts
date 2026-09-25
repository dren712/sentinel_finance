import { Connection } from '@solana/web3.js';
import { deriveSentinelPda } from '@sentinel/domain';
import { APP_CONFIG } from '../../../../lib/config';
import { getServerStore, reconcilePolicyFromSolana } from '../../../../lib/server-state';

/**
 * /api/policy/[wallet]
 *
 * GET: Reconciles the authoritative financial policy invariants from Solana PolicyAccount PDA.
 * POST:
 *   - PREPARE_ONLY: Validates candidate policy and prepares an unsigned Anchor transaction
 *     bound to (wallet == policy.owner == PolicyAccount PDA) WITHOUT mutating server state.
 *   - CONFIRMED_ON_CHAIN: Independently verifies confirmedTxSignature on Solana RPC
 *     (confirmed status, no execution error, signer == ownerAddress, Policy PDA / Program matched)
 *     before committing to server state.
 *   - SIMULATION: Explicitly updates in-memory simulation policy state.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet: walletParam } = await params;
    const policy = await reconcilePolicyFromSolana(walletParam);
    const ownerAddress =
      walletParam && walletParam !== 'default' ? walletParam : policy.owner;
    const policyPda = deriveSentinelPda(ownerAddress);

    return Response.json({
      success: true,
      authority: 'SOLANA_ON_CHAIN',
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

      if (!parsedTx || parsedTx.meta?.err) {
        return Response.json(
          {
            success: false,
            error: 'On-chain transaction signature could not be verified as confirmed without error on Solana RPC.',
          },
          { status: 400 }
        );
      }

      const accountKeys = parsedTx.transaction.message.accountKeys || [];
      const signerMatched = accountKeys.some(
        (k: any) => k.signer && k.pubkey?.toBase58?.() === ownerAddress
      );
      const targetMatched = accountKeys.some((k: any) => {
        const keyStr = k.pubkey?.toBase58?.();
        return keyStr === expectedPolicyPda || keyStr === APP_CONFIG.sentinelProgramId;
      });

      if (!signerMatched || !targetMatched) {
        return Response.json(
          {
            success: false,
            error: 'Transaction signer or Policy PDA account does not match wallet owner binding.',
          },
          { status: 400 }
        );
      }

      store.policy = candidatePolicy;
      await reconcilePolicyFromSolana(ownerAddress).catch(() => {});
    } else if (commitMode === 'SIMULATION') {
      store.policy = candidatePolicy;
    }

    return Response.json({
      success: true,
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

