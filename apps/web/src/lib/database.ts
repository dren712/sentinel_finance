import { Pool } from 'pg';
import { EvidenceRecord, PortfolioSnapshot, hashPortfolioState } from '@sentinel/domain';

/**
 * P13 — PERSISTENT READ HISTORY REPOSITORY (POSTGRES + FALLBACK)
 *
 * Architectural Rule:
 *   Solana   = Authoritative Financial State (Portfolio balances, Vault PDA, Policy PDA)
 *   Postgres = Queryable Read Model / History (agent_runs, decisions, executions, portfolio_snapshots, evidence_index)
 *
 * Security & Observability Rules:
 *   1. Connects ONLY server-side inside Next.js API routes using the explicitly installed `pg` driver.
 *   2. Never swallows DB failures silently — emits structured `[WARN] postgres_write_failed` /
 *      `[WARN] postgres_read_failed` / `[WARN] postgres_init_failed` diagnostics so production
 *      operators immediately know if persistence degrades, while continuing gracefully if DB is optional.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'Security Violation: apps/web/src/lib/database.ts is strictly server-only and must never be imported in browser code.'
  );
}

if (
  typeof process !== 'undefined' &&
  (process.env?.NEXT_PUBLIC_OPENAI_API_KEY || process.env?.NEXT_PUBLIC_DATABASE_URL)
) {
  console.error(
    '[ERROR] security_violation_public_secret_detected Never set NEXT_PUBLIC_OPENAI_API_KEY or NEXT_PUBLIC_DATABASE_URL. Stripping from environment.'
  );
  delete process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  delete process.env.NEXT_PUBLIC_DATABASE_URL;
}

export const POSTGRES_READ_HISTORY_DDL = `
-- 1. agent_runs: Autonomous 10-stage decision loop executions (AGENTS domain)
CREATE TABLE IF NOT EXISTS agent_runs (
  run_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  scenario TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- 2. decisions: Individual trade intents evaluated by Sentinel postconditions (DECISIONS domain)
CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agent_runs(run_id),
  wallet_address TEXT NOT NULL,
  model_provider TEXT NOT NULL DEFAULT 'DemoProvider',
  structured_intent_json JSONB,
  asset_symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  status TEXT NOT NULL,
  failure_code TEXT,
  failure_reason TEXT,
  rationale TEXT,
  policy_version INTEGER NOT NULL DEFAULT 1,
  policy_snapshot_json JSONB,
  evidence_id TEXT NOT NULL DEFAULT '',
  transaction_signature TEXT,
  created_at BIGINT NOT NULL
);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS model_provider TEXT NOT NULL DEFAULT 'DemoProvider';
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS structured_intent_json JSONB;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS policy_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS policy_snapshot_json JSONB;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS evidence_id TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS transaction_signature TEXT;

-- 3. executions: Venue settlement or pre-execution atomic revert records
CREATE TABLE IF NOT EXISTS executions (
  execution_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES decisions(decision_id),
  wallet_address TEXT NOT NULL,
  venue_type TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  transaction_signature TEXT NOT NULL,
  executed_amount_usd NUMERIC NOT NULL,
  executed_price_usd NUMERIC NOT NULL,
  slot BIGINT,
  cluster TEXT NOT NULL,
  is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

-- 4. portfolio_snapshots: Historical portfolio valuations and reserve compliance (audit trail only; Solana is authoritative)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  source TEXT NOT NULL,
  total_value_usd NUMERIC NOT NULL,
  stablecoin_value_usd NUMERIC NOT NULL,
  stablecoin_exposure_bps INTEGER NOT NULL,
  assets_json JSONB NOT NULL,
  state_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- 5. evidence_index: Authoritative PROVN SHA-256 commitments and receipts
CREATE TABLE IF NOT EXISTS evidence_index (
  evidence_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  verification_result TEXT NOT NULL,
  intent_hash TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  pre_state_hash TEXT NOT NULL,
  post_state_hash TEXT NOT NULL,
  transaction_signature TEXT NOT NULL,
  record_json JSONB NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_wallet ON agent_runs(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_wallet ON decisions(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_wallet ON executions(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_wallet ON portfolio_snapshots(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_wallet ON evidence_index(wallet_address, created_at DESC);
`;

export interface AgentRunRow {
  run_id: string;
  agent_id: string;
  wallet_address: string;
  scenario: string;
  llm_provider: string;
  stage: string;
  status: 'COMPLETED' | 'BLOCKED' | 'RUNNING' | 'FAILED';
  summary: string;
  created_at: number;
}

export interface DecisionRow {
  decision_id: string;
  run_id: string;
  wallet_address: string;
  model_provider?: string;
  structured_intent_json?: Record<string, unknown>;
  asset_symbol: string;
  direction: 'BUY' | 'SELL';
  amount_usd: number;
  status: 'SETTLED' | 'REJECTED' | 'ADAPTED';
  failure_code?: string;
  failure_reason?: string;
  rationale?: string;
  policy_version?: number;
  policy_snapshot_json?: Record<string, unknown>;
  evidence_id: string;
  transaction_signature?: string;
  created_at: number;
}

export interface ExecutionRow {
  execution_id: string;
  decision_id: string;
  wallet_address: string;
  venue_type: string;
  venue_name: string;
  transaction_signature: string;
  executed_amount_usd: number;
  executed_price_usd: number;
  slot?: number;
  cluster: string;
  is_simulation: boolean;
  created_at: number;
}

export interface PortfolioSnapshotRow {
  snapshot_id: string;
  wallet_address: string;
  source: string;
  total_value_usd: number;
  stablecoin_value_usd: number;
  stablecoin_exposure_bps: number;
  assets_json: string;
  state_hash: string;
  created_at: number;
}

export interface EvidenceIndexRow {
  evidence_id: string;
  decision_id: string;
  wallet_address: string;
  verification_result: 'SETTLED' | 'REJECTED';
  intent_hash: string;
  policy_hash: string;
  pre_state_hash: string;
  post_state_hash: string;
  transaction_signature: string;
  record: EvidenceRecord;
  created_at: number;
}

export class SentinelReadHistoryRepository {
  public readonly authority = 'SOLANA_ON_CHAIN' as const;
  public readonly role = 'QUERY_INDEX_HISTORY' as const;

  private agentRuns: AgentRunRow[] = [];
  private decisions: DecisionRow[] = [];
  private executions: ExecutionRow[] = [];
  private portfolioSnapshots: PortfolioSnapshotRow[] = [];
  private evidenceIndex: EvidenceIndexRow[] = [];
  private pgPool: Pool | null = null;
  private pgInitialized = false;
  private initPromise: Promise<void> | null = null;
  private lastError: string | null = null;
  private lastErrorAt: number | null = null;

  constructor(private databaseUrl: string | undefined = process.env.DATABASE_URL) {
    if (this.databaseUrl) {
      this.initPromise = this.initPostgresAsync();
    }
  }

  private logDbWarning(
    event: 'postgres_init_failed' | 'postgres_write_failed' | 'postgres_read_failed',
    meta: {
      table?: string;
      run_id?: string;
      decision_id?: string;
      execution_id?: string;
      snapshot_id?: string;
      evidence_id?: string;
      error: unknown;
    }
  ): void {
    const errMsg = meta.error instanceof Error ? meta.error.message : String(meta.error);
    this.lastError = errMsg;
    this.lastErrorAt = Date.now();
    const lines = [
      `[WARN] ${event}`,
      meta.run_id ? `run_id=${meta.run_id}` : null,
      meta.decision_id ? `decision_id=${meta.decision_id}` : null,
      meta.execution_id ? `execution_id=${meta.execution_id}` : null,
      meta.snapshot_id ? `snapshot_id=${meta.snapshot_id}` : null,
      meta.evidence_id ? `evidence_id=${meta.evidence_id}` : null,
      meta.table ? `table=${meta.table}` : null,
      `error=${JSON.stringify(errMsg)}`,
    ].filter(Boolean);
    console.warn(lines.join('\n'));
  }

  private async initPostgresAsync(): Promise<void> {
    if (!this.databaseUrl || this.pgInitialized) return;
    try {
      this.pgPool = new Pool({
        connectionString: this.databaseUrl,
        connectionTimeoutMillis: 5000,
      });
      await this.pgPool.query(POSTGRES_READ_HISTORY_DDL);
      this.pgInitialized = true;
      this.lastError = null;
    } catch (error) {
      this.logDbWarning('postgres_init_failed', { table: 'all_ddl', error });
      this.pgPool = null;
      this.pgInitialized = false;
    }
  }

  public async ensureReady(): Promise<boolean> {
    if (this.initPromise) {
      await this.initPromise;
    } else if (this.databaseUrl && !this.pgInitialized) {
      this.initPromise = this.initPostgresAsync();
      await this.initPromise;
    }
    return this.isPostgresConnected();
  }

  public async checkConnectionHealth(): Promise<'connected' | 'not_configured' | 'disconnected'> {
    if (!this.databaseUrl) {
      return 'not_configured';
    }
    const ready = await this.ensureReady();
    if (!ready || !this.pgPool) {
      return 'disconnected';
    }
    try {
      await this.pgPool.query('SELECT 1');
      this.lastError = null;
      return 'connected';
    } catch (error) {
      this.logDbWarning('postgres_read_failed', { table: 'health_ping', error });
      return 'disconnected';
    }
  }

  public isPostgresConnected(): boolean {
    return Boolean(this.pgPool && this.pgInitialized);
  }

  public getMode(): 'POSTGRES_READ_MODEL' | 'IN_MEMORY_FALLBACK_INDEX' {
    return this.isPostgresConnected() ? 'POSTGRES_READ_MODEL' : 'IN_MEMORY_FALLBACK_INDEX';
  }

  // ---------------------------------------------------------------------------
  // WRITE METHODS (Persist to Postgres + structured warning on failure)
  // ---------------------------------------------------------------------------

  public async recordAgentRun(row: AgentRunRow): Promise<void> {
    this.agentRuns.unshift(row);
    if ((await this.ensureReady()) && this.pgPool) {
      await this.pgPool
        .query(
          `INSERT INTO agent_runs (run_id, agent_id, wallet_address, scenario, llm_provider, stage, status, summary, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (run_id) DO UPDATE SET
             stage = EXCLUDED.stage,
             status = EXCLUDED.status,
             summary = EXCLUDED.summary`,
          [
            row.run_id,
            row.agent_id,
            row.wallet_address,
            row.scenario,
            row.llm_provider,
            row.stage,
            row.status,
            row.summary,
            row.created_at,
          ]
        )
        .catch((error: unknown) => {
          this.logDbWarning('postgres_write_failed', {
            table: 'agent_runs',
            run_id: row.run_id,
            error,
          });
        });
    }
  }

  public async recordDecision(row: DecisionRow): Promise<void> {
    this.decisions.unshift(row);
    if ((await this.ensureReady()) && this.pgPool) {
      await this.pgPool
        .query(
          `INSERT INTO decisions (
             decision_id, run_id, wallet_address, model_provider, structured_intent_json,
             asset_symbol, direction, amount_usd, status, failure_code, failure_reason,
             rationale, policy_version, policy_snapshot_json, evidence_id, transaction_signature, created_at
           )
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17)
           ON CONFLICT (decision_id) DO NOTHING`,
          [
            row.decision_id,
            row.run_id,
            row.wallet_address,
            row.model_provider ?? 'DemoProvider',
            JSON.stringify(
              row.structured_intent_json ?? {
                action: row.direction,
                asset: row.asset_symbol,
                amountUsd: row.amount_usd,
              }
            ),
            row.asset_symbol,
            row.direction,
            row.amount_usd,
            row.status,
            row.failure_code ?? null,
            row.failure_reason ?? null,
            row.rationale ?? null,
            row.policy_version ?? 1,
            row.policy_snapshot_json ? JSON.stringify(row.policy_snapshot_json) : null,
            row.evidence_id ?? '',
            row.transaction_signature ?? null,
            row.created_at,
          ]
        )
        .catch((error: unknown) => {
          this.logDbWarning('postgres_write_failed', {
            table: 'decisions',
            run_id: row.run_id,
            decision_id: row.decision_id,
            error,
          });
        });
    }
  }

  public async recordExecution(row: ExecutionRow): Promise<void> {
    this.executions.unshift(row);
    if ((await this.ensureReady()) && this.pgPool) {
      await this.pgPool
        .query(
          `INSERT INTO executions (
             execution_id, decision_id, wallet_address, venue_type, venue_name,
             transaction_signature, executed_amount_usd, executed_price_usd, slot, cluster, is_simulation, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (execution_id) DO NOTHING`,
          [
            row.execution_id,
            row.decision_id,
            row.wallet_address,
            row.venue_type,
            row.venue_name,
            row.transaction_signature,
            row.executed_amount_usd,
            row.executed_price_usd,
            row.slot ?? null,
            row.cluster,
            row.is_simulation,
            row.created_at,
          ]
        )
        .catch((error: unknown) => {
          this.logDbWarning('postgres_write_failed', {
            table: 'executions',
            decision_id: row.decision_id,
            execution_id: row.execution_id,
            error,
          });
        });
    }
  }

  public async recordPortfolioSnapshot(portfolio: PortfolioSnapshot): Promise<PortfolioSnapshotRow> {
    const row: PortfolioSnapshotRow = {
      snapshot_id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      wallet_address: portfolio.owner,
      source: portfolio.source ?? 'SIMULATED_PROJECTION',
      total_value_usd: portfolio.totalValueUsd,
      stablecoin_value_usd: portfolio.stablecoinValueUsd,
      stablecoin_exposure_bps: portfolio.stablecoinExposureBps,
      assets_json: JSON.stringify(portfolio.assets),
      state_hash: hashPortfolioState(portfolio),
      created_at: Date.now(),
    };
    this.portfolioSnapshots.unshift(row);
    if ((await this.ensureReady()) && this.pgPool) {
      await this.pgPool
        .query(
          `INSERT INTO portfolio_snapshots (
             snapshot_id, wallet_address, source, total_value_usd, stablecoin_value_usd,
             stablecoin_exposure_bps, assets_json, state_hash, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
           ON CONFLICT (snapshot_id) DO NOTHING`,
          [
            row.snapshot_id,
            row.wallet_address,
            row.source,
            row.total_value_usd,
            row.stablecoin_value_usd,
            row.stablecoin_exposure_bps,
            row.assets_json,
            row.state_hash,
            row.created_at,
          ]
        )
        .catch((error: unknown) => {
          this.logDbWarning('postgres_write_failed', {
            table: 'portfolio_snapshots',
            snapshot_id: row.snapshot_id,
            error,
          });
        });
    }
    return row;
  }

  public async recordEvidenceIndex(
    record: EvidenceRecord,
    decisionId: string,
    walletAddress: string
  ): Promise<EvidenceIndexRow> {
    const row: EvidenceIndexRow = {
      evidence_id: record.id,
      decision_id: decisionId,
      wallet_address: walletAddress,
      verification_result: record.verificationResult,
      intent_hash: record.intentHash,
      policy_hash: record.policyHash,
      pre_state_hash: record.preStateHash,
      post_state_hash: record.postStateHash,
      transaction_signature: record.transactionSignature,
      record,
      created_at: record.timestamp,
    };
    this.evidenceIndex.unshift(row);
    if ((await this.ensureReady()) && this.pgPool) {
      await this.pgPool
        .query(
          `INSERT INTO evidence_index (
             evidence_id, decision_id, wallet_address, verification_result,
             intent_hash, policy_hash, pre_state_hash, post_state_hash,
             transaction_signature, record_json, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
           ON CONFLICT (evidence_id) DO NOTHING`,
          [
            row.evidence_id,
            row.decision_id,
            row.wallet_address,
            row.verification_result,
            row.intent_hash,
            row.policy_hash,
            row.pre_state_hash,
            row.post_state_hash,
            row.transaction_signature,
            JSON.stringify(record),
            row.created_at,
          ]
        )
        .catch((error: unknown) => {
          this.logDbWarning('postgres_write_failed', {
            table: 'evidence_index',
            decision_id: decisionId,
            evidence_id: row.evidence_id,
            error,
          });
        });
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // AUTHORITATIVE POSTGRES READ METHODS (Primary Read Path -> Fallback Cache)
  // ---------------------------------------------------------------------------

  public async queryAgentRuns(wallet?: string, limit: number = 100): Promise<AgentRunRow[]> {
    const filterWallet = wallet && wallet !== 'default' ? wallet : null;
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const res = filterWallet
          ? await this.pgPool.query(
              `SELECT * FROM agent_runs WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
              [filterWallet, limit]
            )
          : await this.pgPool.query(
              `SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT $1`,
              [limit]
            );
        return res.rows.map((r: any) => ({
          run_id: r.run_id,
          agent_id: r.agent_id,
          wallet_address: r.wallet_address,
          scenario: r.scenario,
          llm_provider: r.llm_provider,
          stage: r.stage,
          status: r.status,
          summary: r.summary,
          created_at: Number(r.created_at),
        }));
      } catch (error) {
        this.logDbWarning('postgres_read_failed', { table: 'agent_runs', error });
      }
    }
    return this.getAgentRuns(wallet).slice(0, limit);
  }

  public async queryDecisions(wallet?: string, limit: number = 100): Promise<DecisionRow[]> {
    const filterWallet = wallet && wallet !== 'default' ? wallet : null;
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const res = filterWallet
          ? await this.pgPool.query(
              `SELECT * FROM decisions WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
              [filterWallet, limit]
            )
          : await this.pgPool.query(
              `SELECT * FROM decisions ORDER BY created_at DESC LIMIT $1`,
              [limit]
            );
        return res.rows.map((r: any) => ({
          decision_id: r.decision_id,
          run_id: r.run_id,
          wallet_address: r.wallet_address,
          model_provider: r.model_provider ?? undefined,
          structured_intent_json:
            typeof r.structured_intent_json === 'string'
              ? JSON.parse(r.structured_intent_json)
              : (r.structured_intent_json ?? undefined),
          asset_symbol: r.asset_symbol,
          direction: r.direction as 'BUY' | 'SELL',
          amount_usd: Number(r.amount_usd),
          status: r.status as 'SETTLED' | 'REJECTED' | 'ADAPTED',
          failure_code: r.failure_code ?? undefined,
          failure_reason: r.failure_reason ?? undefined,
          rationale: r.rationale ?? undefined,
          policy_version:
            r.policy_version !== null && r.policy_version !== undefined
              ? Number(r.policy_version)
              : undefined,
          policy_snapshot_json:
            typeof r.policy_snapshot_json === 'string'
              ? JSON.parse(r.policy_snapshot_json)
              : (r.policy_snapshot_json ?? undefined),
          evidence_id: r.evidence_id ?? '',
          transaction_signature: r.transaction_signature ?? undefined,
          created_at: Number(r.created_at),
        }));
      } catch (error) {
        this.logDbWarning('postgres_read_failed', { table: 'decisions', error });
      }
    }
    return this.getDecisions(wallet).slice(0, limit);
  }

  public async queryExecutions(wallet?: string, limit: number = 100): Promise<ExecutionRow[]> {
    const filterWallet = wallet && wallet !== 'default' ? wallet : null;
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const res = filterWallet
          ? await this.pgPool.query(
              `SELECT * FROM executions WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
              [filterWallet, limit]
            )
          : await this.pgPool.query(
              `SELECT * FROM executions ORDER BY created_at DESC LIMIT $1`,
              [limit]
            );
        return res.rows.map((r: any) => ({
          execution_id: r.execution_id,
          decision_id: r.decision_id,
          wallet_address: r.wallet_address,
          venue_type: r.venue_type,
          venue_name: r.venue_name,
          transaction_signature: r.transaction_signature,
          executed_amount_usd: Number(r.executed_amount_usd),
          executed_price_usd: Number(r.executed_price_usd),
          slot: r.slot !== null && r.slot !== undefined ? Number(r.slot) : undefined,
          cluster: r.cluster,
          is_simulation: Boolean(r.is_simulation),
          created_at: Number(r.created_at),
        }));
      } catch (error) {
        this.logDbWarning('postgres_read_failed', { table: 'executions', error });
      }
    }
    return this.getExecutions(wallet).slice(0, limit);
  }

  public async queryPortfolioSnapshots(wallet?: string, limit: number = 100): Promise<PortfolioSnapshotRow[]> {
    const filterWallet = wallet && wallet !== 'default' ? wallet : null;
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const res = filterWallet
          ? await this.pgPool.query(
              `SELECT * FROM portfolio_snapshots WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
              [filterWallet, limit]
            )
          : await this.pgPool.query(
              `SELECT * FROM portfolio_snapshots ORDER BY created_at DESC LIMIT $1`,
              [limit]
            );
        return res.rows.map((r: any) => ({
          snapshot_id: r.snapshot_id,
          wallet_address: r.wallet_address,
          source: r.source,
          total_value_usd: Number(r.total_value_usd),
          stablecoin_value_usd: Number(r.stablecoin_value_usd),
          stablecoin_exposure_bps: Number(r.stablecoin_exposure_bps),
          assets_json: typeof r.assets_json === 'string' ? r.assets_json : JSON.stringify(r.assets_json),
          state_hash: r.state_hash,
          created_at: Number(r.created_at),
        }));
      } catch (error) {
        this.logDbWarning('postgres_read_failed', { table: 'portfolio_snapshots', error });
      }
    }
    return this.getPortfolioSnapshots(wallet).slice(0, limit);
  }

  public async queryEvidenceList(wallet?: string, limit: number = 100): Promise<EvidenceIndexRow[]> {
    const filterWallet = wallet && wallet !== 'default' ? wallet : null;
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const res = filterWallet
          ? await this.pgPool.query(
              `SELECT * FROM evidence_index WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
              [filterWallet, limit]
            )
          : await this.pgPool.query(
              `SELECT * FROM evidence_index ORDER BY created_at DESC LIMIT $1`,
              [limit]
            );
        return res.rows.map((r: any) => ({
          evidence_id: r.evidence_id,
          decision_id: r.decision_id,
          wallet_address: r.wallet_address,
          verification_result: r.verification_result as 'SETTLED' | 'REJECTED',
          intent_hash: r.intent_hash,
          policy_hash: r.policy_hash,
          pre_state_hash: r.pre_state_hash,
          post_state_hash: r.post_state_hash,
          transaction_signature: r.transaction_signature,
          record: typeof r.record_json === 'string' ? JSON.parse(r.record_json) : r.record_json,
          created_at: Number(r.created_at),
        }));
      } catch (error) {
        this.logDbWarning('postgres_read_failed', { table: 'evidence_index', error });
      }
    }
    return this.getEvidenceList(wallet).slice(0, limit);
  }

  public async queryEvidenceById(decisionOrEvidenceId: string): Promise<EvidenceIndexRow | undefined> {
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const res =
          decisionOrEvidenceId === 'latest' || decisionOrEvidenceId === 'current'
            ? await this.pgPool.query(`SELECT * FROM evidence_index ORDER BY created_at DESC LIMIT 1`)
            : await this.pgPool.query(
                `SELECT * FROM evidence_index
                 WHERE evidence_id = $1 OR decision_id = $1 OR transaction_signature = $1
                 ORDER BY created_at DESC LIMIT 1`,
                [decisionOrEvidenceId]
              );
        if (res.rows.length > 0) {
          const r = res.rows[0];
          return {
            evidence_id: r.evidence_id,
            decision_id: r.decision_id,
            wallet_address: r.wallet_address,
            verification_result: r.verification_result as 'SETTLED' | 'REJECTED',
            intent_hash: r.intent_hash,
            policy_hash: r.policy_hash,
            pre_state_hash: r.pre_state_hash,
            post_state_hash: r.post_state_hash,
            transaction_signature: r.transaction_signature,
            record: typeof r.record_json === 'string' ? JSON.parse(r.record_json) : r.record_json,
            created_at: Number(r.created_at),
          };
        }
      } catch (error) {
        this.logDbWarning('postgres_read_failed', {
          table: 'evidence_index',
          evidence_id: decisionOrEvidenceId,
          error,
        });
      }
    }
    return this.getEvidenceById(decisionOrEvidenceId);
  }

  public async queryStats() {
    if ((await this.ensureReady()) && this.pgPool) {
      try {
        const [runs, decs, execs, snaps, evs] = await Promise.all([
          this.pgPool.query(`SELECT COUNT(*)::int AS c FROM agent_runs`),
          this.pgPool.query(`SELECT COUNT(*)::int AS c FROM decisions`),
          this.pgPool.query(`SELECT COUNT(*)::int AS c FROM executions`),
          this.pgPool.query(`SELECT COUNT(*)::int AS c FROM portfolio_snapshots`),
          this.pgPool.query(`SELECT COUNT(*)::int AS c FROM evidence_index`),
        ]);
        return {
          authority: this.authority,
          role: this.role,
          mode: this.getMode(),
          postgresConfigured: Boolean(this.databaseUrl),
          postgresConnected: true,
          lastError: this.lastError,
          lastErrorAt: this.lastErrorAt,
          tables: {
            agent_runs: runs.rows[0]?.c ?? 0,
            decisions: decs.rows[0]?.c ?? 0,
            executions: execs.rows[0]?.c ?? 0,
            portfolio_snapshots: snaps.rows[0]?.c ?? 0,
            evidence_index: evs.rows[0]?.c ?? 0,
          },
        };
      } catch (error) {
        this.logDbWarning('postgres_read_failed', { table: 'stats_count', error });
      }
    }
    return this.getStats();
  }

  // Synchronous fallback accessors (used when Postgres is not configured)
  public getAgentRuns(wallet?: string): AgentRunRow[] {
    if (!wallet || wallet === 'default') return [...this.agentRuns];
    return this.agentRuns.filter((r) => r.wallet_address === wallet);
  }

  public getDecisions(wallet?: string): DecisionRow[] {
    if (!wallet || wallet === 'default') return [...this.decisions];
    return this.decisions.filter((d) => d.wallet_address === wallet);
  }

  public getExecutions(wallet?: string): ExecutionRow[] {
    if (!wallet || wallet === 'default') return [...this.executions];
    return this.executions.filter((e) => e.wallet_address === wallet);
  }

  public getPortfolioSnapshots(wallet?: string): PortfolioSnapshotRow[] {
    if (!wallet || wallet === 'default') return [...this.portfolioSnapshots];
    return this.portfolioSnapshots.filter((s) => s.wallet_address === wallet);
  }

  public getEvidenceList(wallet?: string): EvidenceIndexRow[] {
    if (!wallet || wallet === 'default') return [...this.evidenceIndex];
    return this.evidenceIndex.filter((e) => e.wallet_address === wallet);
  }

  public getEvidenceById(decisionOrEvidenceId: string): EvidenceIndexRow | undefined {
    if (decisionOrEvidenceId === 'latest' || decisionOrEvidenceId === 'current') {
      return this.evidenceIndex[0];
    }
    return this.evidenceIndex.find(
      (e) =>
        e.evidence_id === decisionOrEvidenceId ||
        e.decision_id === decisionOrEvidenceId ||
        e.transaction_signature === decisionOrEvidenceId
    );
  }

  public getStats() {
    return {
      authority: this.authority,
      role: this.role,
      mode: this.getMode(),
      postgresConfigured: Boolean(this.databaseUrl),
      postgresConnected: this.isPostgresConnected(),
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      tables: {
        agent_runs: this.agentRuns.length,
        decisions: this.decisions.length,
        executions: this.executions.length,
        portfolio_snapshots: this.portfolioSnapshots.length,
        evidence_index: this.evidenceIndex.length,
      },
    };
  }
}
