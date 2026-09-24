import { getServerStore } from '../../../lib/server-state';
import { APP_CONFIG } from '../../../lib/config';

/**
 * GET /api/health
 *
 * P14 Docker & Production Liveness Probe
 * Exposes service health, active Solana cluster environment (LOCAL | DEVNET | MAINNET),
 * dynamically derived Anchor PDAs, and live Postgres read-model row counts.
 */
export async function GET() {
  try {
    const store = getServerStore();
    const dbStats = await store.db.queryStats();

    return Response.json({
      status: 'ok',
      service: 'sentinel-finance',
      version: '1.2.0',
      authority: 'SOLANA_ON_CHAIN',
      cluster: {
        environment: APP_CONFIG.clusterLabel,
        solanaCluster: APP_CONFIG.cluster,
        rpcUrl: APP_CONFIG.rpcUrl,
        sentinelProgramId: APP_CONFIG.sentinelProgramId,
        policyPda: APP_CONFIG.policyPda,
        agentPda: APP_CONFIG.agentPda,
        vaultPda: APP_CONFIG.vaultPda,
      },
      agent: {
        agentId: store.client.getAgent().agentId,
        status: store.status,
        llmProvider: store.client.getLLMProvider().providerName,
      },
      historyStore: dbStats,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return Response.json(
      {
        status: 'error',
        error: error.message || 'Health check failed',
      },
      { status: 500 }
    );
  }
}
