export interface AgentRunRecord {
  id: string;
  wallet: string;
  agentId: string;
  scenario: string;
  llmProvider: string;
  targetAsset: string;
  proposedAmountUsd: number;
  initialStatus: 'REJECTED' | 'SETTLED';
  adaptedStatus: 'REJECTED' | 'SETTLED';
  adaptedAmountUsd: number;
  summary: string;
  timestamp: number;
}
export interface DecisionRecord {
  id: string;
  runId: string;
  wallet: string;
  step: 'INITIAL' | 'ADAPTED';
  status: 'REJECTED' | 'SETTLED';
  asset: string;
  amountUsd: number;
  direction: string;
  failureReason?: string;
  failureCode?: string;
  evidenceId: string;
  timestamp: number;
}
export interface ExecutionRecord {
  id: string;
  decisionId: string;
  wallet: string;
  transactionSignature: string;
  venueType: string;
  venueName: string;
  inputAsset: string;
  outputAsset: string;
  inputAmount: number;
  outputAmount: number;
  executionPrice: number;
  isSimulation: boolean;
  timestamp: number;
}
export interface PortfolioSnapshotRecord {
  id: string;
  wallet: string;
  totalValueUsd: number;
  stablecoinValueUsd: number;
  stablecoinExposureBps: number;
  assetCount: number;
  source: string;
  timestamp: number;
}
export interface EvidenceIndexRecord {
  id: string;
  wallet: string;
  evidenceId: string;
  verificationResult: string;
  intentHash: string;
  policyHash: string;
  preStateHash: string;
  postStateHash: string;
  transactionSignature: string;
  timestamp: number;
}

export interface DatabaseProvider {
  recordAgentRun(run: AgentRunRecord): Promise<void>;
  recordDecision(decision: DecisionRecord): Promise<void>;
  recordExecution(execution: ExecutionRecord): Promise<void>;
  recordPortfolioSnapshot(snapshot: PortfolioSnapshotRecord): Promise<void>;
  indexEvidence(evidence: EvidenceIndexRecord): Promise<void>;
  getAgentRuns(wallet: string, limit?: number): Promise<AgentRunRecord[]>;
  getDecisions(wallet: string, limit?: number): Promise<DecisionRecord[]>;
  getExecutions(wallet: string, limit?: number): Promise<ExecutionRecord[]>;
  getPortfolioSnapshots(wallet: string, limit?: number): Promise<PortfolioSnapshotRecord[]>;
  getEvidenceIndex(wallet: string, limit?: number): Promise<EvidenceIndexRecord[]>;
  isAvailable(): Promise<boolean>;
}

export class InMemoryDatabaseProvider implements DatabaseProvider {
  private agentRuns: AgentRunRecord[] = [];
  private decisions: DecisionRecord[] = [];
  private executions: ExecutionRecord[] = [];
  private portfolioSnapshots: PortfolioSnapshotRecord[] = [];
  private evidenceIndices: EvidenceIndexRecord[] = [];

  async recordAgentRun(run: AgentRunRecord): Promise<void> {
    this.agentRuns.push(run);
  }
  async recordDecision(decision: DecisionRecord): Promise<void> {
    this.decisions.push(decision);
  }
  async recordExecution(execution: ExecutionRecord): Promise<void> {
    this.executions.push(execution);
  }
  async recordPortfolioSnapshot(snapshot: PortfolioSnapshotRecord): Promise<void> {
    this.portfolioSnapshots.push(snapshot);
  }
  async indexEvidence(evidence: EvidenceIndexRecord): Promise<void> {
    this.evidenceIndices.push(evidence);
  }
  async getAgentRuns(wallet: string, limit: number = 100): Promise<AgentRunRecord[]> {
    return this.agentRuns.filter(r => r.wallet === wallet).slice(-limit);
  }
  async getDecisions(wallet: string, limit: number = 100): Promise<DecisionRecord[]> {
    return this.decisions.filter(r => r.wallet === wallet).slice(-limit);
  }
  async getExecutions(wallet: string, limit: number = 100): Promise<ExecutionRecord[]> {
    return this.executions.filter(r => r.wallet === wallet).slice(-limit);
  }
  async getPortfolioSnapshots(wallet: string, limit: number = 100): Promise<PortfolioSnapshotRecord[]> {
    return this.portfolioSnapshots.filter(r => r.wallet === wallet).slice(-limit);
  }
  async getEvidenceIndex(wallet: string, limit: number = 100): Promise<EvidenceIndexRecord[]> {
    return this.evidenceIndices.filter(r => r.wallet === wallet).slice(-limit);
  }
  async isAvailable(): Promise<boolean> {
    return true;
  }
}

export class PostgresDatabaseProvider implements DatabaseProvider {
  private pool: any;
  private isInitialized = false;

  constructor(private connectionString: string) {}

  private async getPool() {
    if (typeof (globalThis as any).window !== 'undefined') {
      throw new Error('PostgresDatabaseProvider is server-only and cannot be used in the browser.');
    }
    if (!this.pool) {
      try {
        const loadPg = new Function('return import("pg")') as () => Promise<any>;
        const pgMod = await loadPg();
        const Pool = pgMod.Pool || pgMod.default?.Pool;
        this.pool = new Pool({ connectionString: this.connectionString });
      } catch (e) {
        throw new Error('pg module not found. Install pg to use PostgresDatabaseProvider.');
      }
    }
    return this.pool;
  }

  private async initialize() {
    if (this.isInitialized) return;
    const pool = await this.getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id VARCHAR(255) PRIMARY KEY,
        wallet VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255),
        scenario VARCHAR(255),
        llm_provider VARCHAR(255),
        target_asset VARCHAR(255),
        proposed_amount_usd FLOAT,
        initial_status VARCHAR(50),
        adapted_status VARCHAR(50),
        adapted_amount_usd FLOAT,
        summary TEXT,
        timestamp BIGINT
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id VARCHAR(255) PRIMARY KEY,
        run_id VARCHAR(255),
        wallet VARCHAR(255) NOT NULL,
        step VARCHAR(50),
        status VARCHAR(50),
        asset VARCHAR(255),
        amount_usd FLOAT,
        direction VARCHAR(50),
        failure_reason TEXT,
        failure_code VARCHAR(255),
        evidence_id VARCHAR(255),
        timestamp BIGINT
      );
      CREATE TABLE IF NOT EXISTS executions (
        id VARCHAR(255) PRIMARY KEY,
        decision_id VARCHAR(255),
        wallet VARCHAR(255) NOT NULL,
        transaction_signature VARCHAR(255),
        venue_type VARCHAR(255),
        venue_name VARCHAR(255),
        input_asset VARCHAR(255),
        output_asset VARCHAR(255),
        input_amount FLOAT,
        output_amount FLOAT,
        execution_price FLOAT,
        is_simulation BOOLEAN,
        timestamp BIGINT
      );
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id VARCHAR(255) PRIMARY KEY,
        wallet VARCHAR(255) NOT NULL,
        total_value_usd FLOAT,
        stablecoin_value_usd FLOAT,
        stablecoin_exposure_bps FLOAT,
        asset_count INT,
        source VARCHAR(255),
        timestamp BIGINT
      );
      CREATE TABLE IF NOT EXISTS evidence_indices (
        id VARCHAR(255) PRIMARY KEY,
        wallet VARCHAR(255) NOT NULL,
        evidence_id VARCHAR(255),
        verification_result TEXT,
        intent_hash VARCHAR(255),
        policy_hash VARCHAR(255),
        pre_state_hash VARCHAR(255),
        post_state_hash VARCHAR(255),
        transaction_signature VARCHAR(255),
        timestamp BIGINT
      );
    `);
    this.isInitialized = true;
  }

  async recordAgentRun(run: AgentRunRecord): Promise<void> {
    await this.initialize();
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO agent_runs (id, wallet, agent_id, scenario, llm_provider, target_asset, proposed_amount_usd, initial_status, adapted_status, adapted_amount_usd, summary, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [run.id, run.wallet, run.agentId, run.scenario, run.llmProvider, run.targetAsset, run.proposedAmountUsd, run.initialStatus, run.adaptedStatus, run.adaptedAmountUsd, run.summary, run.timestamp]
    );
  }

  async recordDecision(decision: DecisionRecord): Promise<void> {
    await this.initialize();
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO decisions (id, run_id, wallet, step, status, asset, amount_usd, direction, failure_reason, failure_code, evidence_id, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [decision.id, decision.runId, decision.wallet, decision.step, decision.status, decision.asset, decision.amountUsd, decision.direction, decision.failureReason, decision.failureCode, decision.evidenceId, decision.timestamp]
    );
  }

  async recordExecution(execution: ExecutionRecord): Promise<void> {
    await this.initialize();
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO executions (id, decision_id, wallet, transaction_signature, venue_type, venue_name, input_asset, output_asset, input_amount, output_amount, execution_price, is_simulation, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [execution.id, execution.decisionId, execution.wallet, execution.transactionSignature, execution.venueType, execution.venueName, execution.inputAsset, execution.outputAsset, execution.inputAmount, execution.outputAmount, execution.executionPrice, execution.isSimulation, execution.timestamp]
    );
  }

  async recordPortfolioSnapshot(snapshot: PortfolioSnapshotRecord): Promise<void> {
    await this.initialize();
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO portfolio_snapshots (id, wallet, total_value_usd, stablecoin_value_usd, stablecoin_exposure_bps, asset_count, source, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [snapshot.id, snapshot.wallet, snapshot.totalValueUsd, snapshot.stablecoinValueUsd, snapshot.stablecoinExposureBps, snapshot.assetCount, snapshot.source, snapshot.timestamp]
    );
  }

  async indexEvidence(evidence: EvidenceIndexRecord): Promise<void> {
    await this.initialize();
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO evidence_indices (id, wallet, evidence_id, verification_result, intent_hash, policy_hash, pre_state_hash, post_state_hash, transaction_signature, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [evidence.id, evidence.wallet, evidence.evidenceId, evidence.verificationResult, evidence.intentHash, evidence.policyHash, evidence.preStateHash, evidence.postStateHash, evidence.transactionSignature, evidence.timestamp]
    );
  }

  async getAgentRuns(wallet: string, limit: number = 100): Promise<AgentRunRecord[]> {
    await this.initialize();
    const pool = await this.getPool();
    const res = await pool.query(`SELECT * FROM agent_runs WHERE wallet = $1 ORDER BY timestamp DESC LIMIT $2`, [wallet, limit]);
    return res.rows.map((row: any) => ({
      id: row.id, wallet: row.wallet, agentId: row.agent_id, scenario: row.scenario, llmProvider: row.llm_provider, targetAsset: row.target_asset, proposedAmountUsd: row.proposed_amount_usd, initialStatus: row.initial_status, adaptedStatus: row.adapted_status, adaptedAmountUsd: row.adapted_amount_usd, summary: row.summary, timestamp: parseInt(row.timestamp)
    }));
  }

  async getDecisions(wallet: string, limit: number = 100): Promise<DecisionRecord[]> {
    await this.initialize();
    const pool = await this.getPool();
    const res = await pool.query(`SELECT * FROM decisions WHERE wallet = $1 ORDER BY timestamp DESC LIMIT $2`, [wallet, limit]);
    return res.rows.map((row: any) => ({
      id: row.id, runId: row.run_id, wallet: row.wallet, step: row.step, status: row.status, asset: row.asset, amountUsd: row.amount_usd, direction: row.direction, failureReason: row.failure_reason, failureCode: row.failure_code, evidenceId: row.evidence_id, timestamp: parseInt(row.timestamp)
    }));
  }

  async getExecutions(wallet: string, limit: number = 100): Promise<ExecutionRecord[]> {
    await this.initialize();
    const pool = await this.getPool();
    const res = await pool.query(`SELECT * FROM executions WHERE wallet = $1 ORDER BY timestamp DESC LIMIT $2`, [wallet, limit]);
    return res.rows.map((row: any) => ({
      id: row.id, decisionId: row.decision_id, wallet: row.wallet, transactionSignature: row.transaction_signature, venueType: row.venue_type, venueName: row.venue_name, inputAsset: row.input_asset, outputAsset: row.output_asset, inputAmount: row.input_amount, outputAmount: row.output_amount, executionPrice: row.execution_price, isSimulation: row.is_simulation, timestamp: parseInt(row.timestamp)
    }));
  }

  async getPortfolioSnapshots(wallet: string, limit: number = 100): Promise<PortfolioSnapshotRecord[]> {
    await this.initialize();
    const pool = await this.getPool();
    const res = await pool.query(`SELECT * FROM portfolio_snapshots WHERE wallet = $1 ORDER BY timestamp DESC LIMIT $2`, [wallet, limit]);
    return res.rows.map((row: any) => ({
      id: row.id, wallet: row.wallet, totalValueUsd: row.total_value_usd, stablecoinValueUsd: row.stablecoin_value_usd, stablecoinExposureBps: row.stablecoin_exposure_bps, assetCount: row.asset_count, source: row.source, timestamp: parseInt(row.timestamp)
    }));
  }

  async getEvidenceIndex(wallet: string, limit: number = 100): Promise<EvidenceIndexRecord[]> {
    await this.initialize();
    const pool = await this.getPool();
    const res = await pool.query(`SELECT * FROM evidence_indices WHERE wallet = $1 ORDER BY timestamp DESC LIMIT $2`, [wallet, limit]);
    return res.rows.map((row: any) => ({
      id: row.id, wallet: row.wallet, evidenceId: row.evidence_id, verificationResult: row.verification_result, intentHash: row.intent_hash, policyHash: row.policy_hash, preStateHash: row.pre_state_hash, postStateHash: row.post_state_hash, transactionSignature: row.transaction_signature, timestamp: parseInt(row.timestamp)
    }));
  }

  async isAvailable(): Promise<boolean> {
    try {
      const pool = await this.getPool();
      await pool.query('SELECT 1');
      return true;
    } catch (e) {
      return false;
    }
  }
}

export function createDatabaseProvider(config?: { connectionString?: string }): DatabaseProvider {
  if (config?.connectionString) {
    try {
      return new PostgresDatabaseProvider(config.connectionString);
    } catch (e) {
      console.warn('Failed to initialize Postgres provider, falling back to InMemory:', e);
    }
  }
  return new InMemoryDatabaseProvider();
}
