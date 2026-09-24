import { Connection } from '@solana/web3.js';
import { getServerStore } from '../../../lib/server-state';
import { APP_CONFIG, browserRpcUrl, getServerSolanaRpcUrl } from '../../../lib/config';

/**
 * GET /api/health
 *
 * P14 Docker & Production Liveness Probe
 * Explicitly distinguishes component health:
 *   status   : "ok" | "degraded"
 *   solana   : "connected" | "configured"
 *   postgres : "connected" | "not_configured" | "disconnected"
 *   llm      : "configured" | "demo_fallback"
 *
 * Keeps HTTP 200 available for the Docker container healthcheck while never silently
 * hiding degraded persistence or missing credentials.
 */
export async function GET() {
  try {
    const store = getServerStore();

    // 1. Check Postgres connectivity honestly (`connected` | `not_configured` | `disconnected`)
    const [postgresStatus, dbStats] = await Promise.all([
      store.db.checkConnectionHealth(),
      store.db.queryStats(),
    ]);

    // 2. Check Solana Server RPC (`SOLANA_RPC_URL`) connectivity (`connected` | `configured`)
    const serverRpcUrl = getServerSolanaRpcUrl();
    let solanaStatus: 'connected' | 'configured' = 'configured';
    if (serverRpcUrl) {
      try {
        const connection = new Connection(serverRpcUrl, 'confirmed');
        const slot = await Promise.race([
          connection.getSlot(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (typeof slot === 'number' && slot > 0) {
          solanaStatus = 'connected';
        }
      } catch {
        solanaStatus = 'configured';
      }
    }

    // 3. Check LLM configuration (`configured` when OPENAI_API_KEY is present, else `demo_fallback`)
    const llmStatus: 'configured' | 'demo_fallback' = process.env.OPENAI_API_KEY
      ? 'configured'
      : 'demo_fallback';

    // If DATABASE_URL was explicitly set by operator (`postgresConfigured === true`)
    // but Postgres failed to connect (`postgresStatus === 'disconnected'`), report status="degraded"
    const overallStatus: 'ok' | 'degraded' =
      dbStats.postgresConfigured && postgresStatus === 'disconnected' ? 'degraded' : 'ok';

    return Response.json({
      status: overallStatus,
      solana: solanaStatus,
      postgres: postgresStatus,
      llm: llmStatus,
      deploymentTarget: 'DOCKER_SINGLE_CONTAINER_PLUS_MANAGED_POSTGRES',
      service: 'sentinel-finance',
      version: '1.2.0',
      authority: 'SOLANA_ON_CHAIN',
      cluster: {
        environment: APP_CONFIG.clusterLabel,
        solanaCluster: APP_CONFIG.cluster,
        browserRpcUrl,
        serverRpcConfigured: Boolean(process.env.SOLANA_RPC_URL),
        sentinelProgramId: APP_CONFIG.sentinelProgramId,
        policyPda: APP_CONFIG.policyPda,
        agentPda: APP_CONFIG.agentPda,
        vaultPda: APP_CONFIG.vaultPda,
      },
      agent: {
        agentId: store.client.getAgent().agentId,
        status: store.status,
        llmProvider: process.env.OPENAI_API_KEY
          ? 'OpenAIProvider'
          : store.client.getLLMProvider().providerName,
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
