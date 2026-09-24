/**
 * Sentinel Finance — Server Orchestration State
 *
 * Architectural Blueprint:
 *   SOLANA   = Authoritative Financial State (Portfolio balances, Vault PDA, Policy PDA)
 *   POSTGRES = Queryable Read Model / History (agent_runs, decisions, executions, portfolio_snapshots, evidence_index)
 *
 * Security Boundary:
 *   This module executes ONLY server-side inside Next.js API routes.
 *   Never expose DATABASE_URL or OPENAI_API_KEY via NEXT_PUBLIC_*.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  SentinelClient,
  DemoProvider,
  OpenAIProvider,
  LLMProvider,
  AutonomousAdaptationResult,
  AgentLoopState,
} from '@sentinel/sdk';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  SENTINEL_PROGRAM_ID,
} from '@sentinel/domain';
import { SentinelReadHistoryRepository } from './database';
import { APP_CONFIG } from './config';

if (typeof window !== 'undefined') {
  throw new Error(
    'Security Violation: apps/web/src/lib/server-state.ts is strictly server-only and must never be imported in browser code.'
  );
}

export interface DecisionActivityItem {
  id: string;
  timestamp: number;
  type: 'APPROVED' | 'REJECTED' | 'ADAPTED';
  asset: string;
  amountUsd: number;
  direction: 'BUY' | 'SELL';
  summary: string;
  receiptNumber?: string;
  failureReason?: string;
  signature?: string;
  evidenceId: string;
  evidenceRecord?: EvidenceRecord;
}

export interface ServerStateStore {
  client: SentinelClient;
  db: SentinelReadHistoryRepository;
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  activityHistory: DecisionActivityItem[];
  lastLoopResult?: AutonomousAdaptationResult;
  lastLoopState?: AgentLoopState;
  status: 'ACTIVE' | 'PAUSED' | 'RUNNING';
}

// Server runtime singleton (stateless across restarts because reads reconcile from Solana + Postgres)
const globalState: ServerStateStore = (() => {
  const client = new SentinelClient();
  const db = new SentinelReadHistoryRepository();
  const portfolio = client.createDefaultPortfolio();
  const policy = client.createDefaultPolicy();

  return {
    client,
    db,
    portfolio,
    policy,
    activityHistory: [],
    status: 'ACTIVE',
  };
})();

export function getServerStore(): ServerStateStore {
  return globalState;
}

/**
 * Reconciles authoritative financial policy from Solana RPC (PolicyAccount PDA: [b"policy", owner]).
 * Falls back to the current session policy if the wallet has not yet initialized a PolicyAccount on-chain.
 */
export async function reconcilePolicyFromSolana(walletAddress?: string): Promise<FinancialPolicy> {
  const store = getServerStore();
  const targetOwner =
    walletAddress && walletAddress !== 'default' ? walletAddress : store.portfolio.owner;

  try {
    const ownerPubkey = new PublicKey(targetOwner);
    const programPubkey = new PublicKey(APP_CONFIG.sentinelProgramId || SENTINEL_PROGRAM_ID.toBase58());
    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), ownerPubkey.toBuffer()],
      programPubkey
    );

    const connection = new Connection(APP_CONFIG.rpcUrl, 'confirmed');
    const accountInfo = await connection.getAccountInfo(policyPda);

    // Anchor PolicyAccount layout:
    // 8 (discriminator) + 32 (owner) + 2 (max_single_asset_bps) + 2 (min_stablecoin_bps)
    // + 8 (max_trade_value_usd) + 2 (max_slippage_bps) + 4 (policy_version) + 1 (is_active) + 1 (bump) = 60 bytes
    if (accountInfo && accountInfo.data.length >= 60) {
      const buf = accountInfo.data;
      const maxSingleAssetBps = buf.readUInt16LE(40);
      const minStablecoinBps = buf.readUInt16LE(42);
      const maxTradeValueUsd = Number(buf.readBigUInt64LE(44));
      const maxSlippageBps = buf.readUInt16LE(52);
      const policyVersion = buf.readUInt32LE(54);
      const isActive = buf.readUInt8(58) === 1;

      if (maxSingleAssetBps > 0 && minStablecoinBps > 0) {
        store.policy = {
          ...store.policy,
          owner: ownerPubkey.toBase58(),
          maxSingleAssetBps,
          minStablecoinBps,
          maxTradeValueUsd,
          maxSlippageBps,
          policyVersion,
          isActive,
        };
      }
    }
  } catch {
    // Keep existing session policy if RPC is unreachable or wallet address is synthetic
  }

  return store.policy;
}

/**
 * Reconciles authoritative portfolio state from Solana RPC.
 * Architectural Rule:
 *   SOLANA   -> authoritative financial state
 *   POSTGRES -> queryable history / read model (never trusted as "your actual portfolio" unless reconciled against Solana)
 */
export async function reconcilePortfolioFromSolana(walletAddress?: string): Promise<PortfolioSnapshot> {
  const store = getServerStore();
  const targetOwner =
    walletAddress && walletAddress !== 'default' ? walletAddress : store.portfolio.owner;

  try {
    // 1. Check live SPL token accounts via SentinelClient
    const livePortfolio = await store.client.fetchLiveOnChainPortfolio(targetOwner);
    if (livePortfolio.source === 'ON_CHAIN_PROJECTION' && livePortfolio.totalValueUsd > 0) {
      store.portfolio = livePortfolio;
      await store.db.recordPortfolioSnapshot(livePortfolio);
      return livePortfolio;
    }

    // 2. Check on-chain Sentinel VaultAccount PDA ([b"vault", owner]) on Solana Devnet
    const ownerPubkey = new PublicKey(targetOwner);
    const programPubkey = new PublicKey(APP_CONFIG.sentinelProgramId || SENTINEL_PROGRAM_ID.toBase58());
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), ownerPubkey.toBuffer()],
      programPubkey
    );

    const connection = new Connection(APP_CONFIG.rpcUrl, 'confirmed');
    const vaultInfo = await connection.getAccountInfo(vaultPda);
    if (vaultInfo && vaultInfo.data.length >= 60) {
      // VaultAccount exists on-chain on Solana Devnet: mark reconciled projection as ON_CHAIN_PROJECTION
      store.portfolio = {
        ...store.portfolio,
        owner: ownerPubkey.toBase58(),
        source: 'ON_CHAIN_PROJECTION',
      };
      return store.portfolio;
    }
  } catch {
    // Fallback to session simulated projection when offline
  }

  return store.portfolio;
}

/**
 * Queries authoritative decision activity, runs, executions, and PROVN evidence from Postgres
 * (falling back to in-memory cache only when DATABASE_URL is not configured).
 */
export async function queryAuthoritativeActivity(walletAddress?: string) {
  const store = getServerStore();
  const [decisions, executions, agentRuns, evidenceList, stats] = await Promise.all([
    store.db.queryDecisions(walletAddress),
    store.db.queryExecutions(walletAddress),
    store.db.queryAgentRuns(walletAddress),
    store.db.queryEvidenceList(walletAddress),
    store.db.queryStats(),
  ]);

  const evidenceMap = new Map<string, EvidenceRecord>();
  for (const row of evidenceList) {
    evidenceMap.set(row.decision_id, row.record);
    evidenceMap.set(row.evidence_id, row.record);
  }

  // Reconstruct rich activity items from Postgres decisions + evidence_index
  const dbActivities: DecisionActivityItem[] = decisions.map((dec) => {
    const ev = evidenceMap.get(dec.decision_id) || evidenceMap.get(dec.evidence_id);
    const type: 'APPROVED' | 'REJECTED' | 'ADAPTED' =
      dec.status === 'REJECTED' ? 'REJECTED' : dec.status === 'ADAPTED' ? 'ADAPTED' : 'APPROVED';

    return {
      id: dec.decision_id,
      timestamp: dec.created_at,
      type,
      asset: dec.asset_symbol,
      amountUsd: dec.amount_usd,
      direction: dec.direction,
      summary:
        dec.status === 'REJECTED'
          ? `Initial $${dec.amount_usd.toLocaleString()} intent blocked by Sentinel postconditions.`
          : `Auto-adapted trade approved: $${dec.amount_usd.toLocaleString()} ${dec.direction} ${dec.asset_symbol} settled on-chain.`,
      receiptNumber: dec.evidence_id || ev?.id,
      failureReason: dec.failure_reason ?? ev?.failureReason,
      signature: dec.transaction_signature ?? ev?.transactionSignature,
      evidenceId: dec.evidence_id || ev?.id || dec.decision_id,
      evidenceRecord: ev,
    };
  });

  const activities = dbActivities.length > 0 ? dbActivities : store.activityHistory;

  return {
    activities,
    decisions,
    executions,
    agentRuns,
    evidenceList,
    stats,
  };
}

/**
 * Runs an autonomous agent cycle via the server orchestrator, reconciles state with Solana,
 * and indexes persistent read history into the 5 Postgres tables:
 * agent_runs, decisions, executions, portfolio_snapshots, evidence_index.
 */
export async function runServerAgentCycle(params: {
  wallet?: string;
  scenario?: 'flagship' | 'prestocks' | 'meteora' | 'pyth';
  llmProvider?: 'openai' | 'demo';
  targetAsset?: string;
  proposedAmountUsd?: number;
}): Promise<AutonomousAdaptationResult> {
  const store = getServerStore();
  store.status = 'RUNNING';

  const scenario = params.scenario ?? 'flagship';
  const targetAsset = params.targetAsset ?? (scenario === 'prestocks' ? 'OPENAIx' : 'NVDAx');
  const proposedAmount = params.proposedAmountUsd ?? (scenario === 'prestocks' ? 5000 : 15000);
  const walletAddress =
    params.wallet && params.wallet !== 'default' ? params.wallet : store.portfolio.owner;

  // Reconcile policy & portfolio against Solana before evaluating trade intent
  await Promise.all([
    reconcilePolicyFromSolana(walletAddress),
    reconcilePortfolioFromSolana(walletAddress),
  ]);

  // Initialize selected LLM provider (server-side OPENAI_API_KEY only)
  let provider: LLMProvider;
  if (params.llmProvider === 'openai' && process.env.OPENAI_API_KEY) {
    provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, fallbackToDemo: true });
  } else {
    provider = new DemoProvider(scenario);
  }

  store.client.setLLMProvider(provider);

  // Execute 10-stage autonomous loop
  const result = await store.client.getAgent().executeAutonomousAdaptationLoop(
    store.portfolio,
    store.policy,
    targetAsset,
    proposedAmount,
    store.client.getDemoAdapter(),
    undefined,
    (loopState) => {
      store.lastLoopState = loopState;
    },
    {
      llmProvider: provider,
      userGoal: `Autonomous portfolio management with focus on ${targetAsset}`,
    }
  );

  store.lastLoopResult = result;
  store.status = 'ACTIVE';

  // Apply settled outcome to active portfolio projection
  if (result.step2SettledDecision.status === 'SETTLED' && result.step2SettledDecision.resultingPortfolio) {
    store.portfolio = result.step2SettledDecision.resultingPortfolio;
  }

  // Persist into P13 Postgres read history repository (agent_runs, decisions, executions, portfolio_snapshots, evidence_index)
  const now = Date.now();
  const step1 = result.step1RejectedDecision;
  const step2 = result.step2SettledDecision;

  await store.db.recordAgentRun({
    run_id: result.cycleId,
    agent_id: result.agentId,
    wallet_address: walletAddress,
    scenario,
    llm_provider: provider.providerName,
    stage: result.loopState.stage,
    status: 'COMPLETED',
    summary: result.summary,
    created_at: now,
  });

  const dec1Id = `dec_${step1.cycleId}_step1`;
  const dec2Id = `dec_${step2.cycleId}_step2`;

  await store.db.recordDecision({
    decision_id: dec1Id,
    run_id: result.cycleId,
    wallet_address: walletAddress,
    asset_symbol: step1.intent.assetSymbol,
    direction: step1.intent.direction,
    amount_usd: step1.intent.tradeAmountUsd,
    status: 'REJECTED',
    failure_code: step1.evidenceRecord.failureCode,
    failure_reason: step1.evidenceRecord.failureReason,
    rationale: step1.intent.strategyRationale,
    evidence_id: step1.evidenceRecord.id,
    transaction_signature: step1.evidenceRecord.transactionSignature,
    created_at: now - 1000,
  });

  await store.db.recordDecision({
    decision_id: dec2Id,
    run_id: result.cycleId,
    wallet_address: walletAddress,
    asset_symbol: step2.intent.assetSymbol,
    direction: step2.intent.direction,
    amount_usd: step2.intent.tradeAmountUsd,
    status: 'ADAPTED',
    rationale: step2.intent.strategyRationale,
    evidence_id: step2.evidenceRecord.id,
    transaction_signature: step2.executionResult?.transactionSignature ?? step2.evidenceRecord.transactionSignature,
    created_at: now,
  });

  await store.db.recordExecution({
    execution_id: `exec_${step1.cycleId}_revert`,
    decision_id: dec1Id,
    wallet_address: walletAddress,
    venue_type: step1.evidenceRecord.executionVenue?.venueType ?? 'SENTINEL_GUARD',
    venue_name: step1.evidenceRecord.executionVenue?.venueName ?? 'Sentinel Postcondition Guard',
    transaction_signature: step1.evidenceRecord.transactionSignature,
    executed_amount_usd: 0,
    executed_price_usd: step1.intent.referencePriceUsd,
    cluster: APP_CONFIG.clusterLabel,
    is_simulation: Boolean(step1.evidenceRecord.isSimulation),
    created_at: now - 1000,
  });

  await store.db.recordExecution({
    execution_id: `exec_${step2.cycleId}_settle`,
    decision_id: dec2Id,
    wallet_address: walletAddress,
    venue_type: step2.executionResult?.venueType ?? 'METEORA_DBC',
    venue_name: step2.executionResult?.venueName ?? 'Meteora Dynamic Bonding Curve',
    transaction_signature: step2.executionResult?.transactionSignature ?? step2.evidenceRecord.transactionSignature,
    executed_amount_usd: step2.intent.tradeAmountUsd,
    executed_price_usd: step2.intent.referencePriceUsd,
    cluster: APP_CONFIG.clusterLabel,
    is_simulation: Boolean(step2.evidenceRecord.isSimulation),
    created_at: now,
  });

  await store.db.recordPortfolioSnapshot(store.portfolio);
  await store.db.recordEvidenceIndex(step1.evidenceRecord, dec1Id, walletAddress);
  await store.db.recordEvidenceIndex(step2.evidenceRecord, dec2Id, walletAddress);

  // Keep in-memory fallback synchronized when Postgres is not configured
  store.activityHistory.unshift(
    {
      id: dec2Id,
      timestamp: now,
      type: 'ADAPTED',
      asset: step2.intent.assetSymbol,
      amountUsd: step2.intent.tradeAmountUsd,
      direction: step2.intent.direction,
      summary: `Auto-adapted trade approved: proposed $${result.adaptationDetails.adaptedAmountUsd.toLocaleString()} after $${result.adaptationDetails.initialAmountUsd.toLocaleString()} rejection.`,
      receiptNumber: step2.evidenceRecord.id,
      signature: step2.executionResult?.transactionSignature ?? step2.evidenceRecord.transactionSignature,
      evidenceId: step2.evidenceRecord.id,
      evidenceRecord: step2.evidenceRecord,
    },
    {
      id: dec1Id,
      timestamp: now - 1000,
      type: 'REJECTED',
      asset: step1.intent.assetSymbol,
      amountUsd: step1.intent.tradeAmountUsd,
      direction: step1.intent.direction,
      summary: `Initial $${step1.intent.tradeAmountUsd.toLocaleString()} intent blocked by Sentinel postconditions.`,
      failureReason: step1.evidenceRecord.failureReason,
      signature: step1.evidenceRecord.transactionSignature,
      evidenceId: step1.evidenceRecord.id,
      evidenceRecord: step1.evidenceRecord,
    }
  );

  return result;
}
