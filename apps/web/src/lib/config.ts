import { PublicKey } from '@solana/web3.js';

export type ClusterEnvironment = 'LOCAL' | 'DEVNET' | 'MAINNET';
export type SolanaCluster = 'localnet' | 'devnet' | 'mainnet';

export interface DerivedDomainPdas {
  policyPda: string;
  agentPda: string;
  vaultPda: string;
  idlAccount: string;
}

export interface DevnetTransactionRegistry {
  initializePolicyTx: string;
  initializeAgentTx: string;
  initializeVaultTx: string;
  createPromiseTx: string;
  rejectBadTradeTx: string;
  executeValidTradeTx: string;
  recordEvidenceTx: string;
}

export interface AppEnvironment {
  clusterEnv: ClusterEnvironment;
  cluster: SolanaCluster;
  clusterLabel: ClusterEnvironment;
  rpcUrl: string;
  sentinelProgramId: string;
  idlAccount: string;
  policyPda: string;
  agentPda: string;
  vaultPda: string;
  explorerBaseUrl: string;
  devnetTransactions: DevnetTransactionRegistry;
  features: {
    agentSignerWallet: boolean;
    meteoraVerifier: boolean;
    livePrices: boolean;
    demoMode: boolean;
  };
}

/**
 * Normalizes raw environment cluster string into canonical LOCAL | DEVNET | MAINNET
 */
export function resolveClusterEnvironment(raw?: string): ClusterEnvironment {
  const normalized = (raw || 'devnet').trim().toUpperCase();
  if (normalized === 'LOCAL' || normalized === 'LOCALNET') return 'LOCAL';
  if (normalized === 'MAINNET' || normalized === 'MAINNET-BETA') return 'MAINNET';
  return 'DEVNET';
}

export function clusterEnvToSolanaCluster(env: ClusterEnvironment): SolanaCluster {
  if (env === 'LOCAL') return 'localnet';
  if (env === 'MAINNET') return 'mainnet';
  return 'devnet';
}

export function resolveClusterRpcUrl(env: ClusterEnvironment, customRpc?: string): string {
  if (customRpc && customRpc.trim().length > 0) {
    return customRpc.trim();
  }
  switch (env) {
    case 'LOCAL':
      return 'http://127.0.0.1:8899';
    case 'MAINNET':
      return 'https://api.mainnet-beta.solana.com';
    case 'DEVNET':
    default:
      return 'https://api.devnet.solana.com';
  }
}

/**
 * Dynamically derives the canonical Anchor PDAs (policy, agent, vault, idl)
 * from the owner public key and deployed SENTINEL_PROGRAM_ID using Solana primitives.
 * Eliminates stale hardcoded PDA addresses.
 */
export function deriveSentinelDomainPdas(
  ownerAddress: string,
  programIdStr?: string,
  agentId: string = 'robo-01'
): DerivedDomainPdas {
  const activeProgramId =
    programIdStr ||
    process.env.SENTINEL_PROGRAM_ID ||
    process.env.NEXT_PUBLIC_SENTINEL_PROGRAM_ID ||
    '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK';

  try {
    const programId = new PublicKey(activeProgramId);
    const owner = new PublicKey(ownerAddress);

    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), owner.toBuffer()],
      programId
    );
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), owner.toBuffer(), Buffer.from(agentId)],
      programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.toBuffer()],
      programId
    );
    const [idlAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor:idl'), programId.toBuffer()],
      programId
    );

    return {
      policyPda: policyPda.toBase58(),
      agentPda: agentPda.toBase58(),
      vaultPda: vaultPda.toBase58(),
      idlAccount: idlAccount.toBase58(),
    };
  } catch {
    const programId = new PublicKey('3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK');
    const defaultOwner = new PublicKey('GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw');
    const [policyPda] = PublicKey.findProgramAddressSync([Buffer.from('policy'), defaultOwner.toBuffer()], programId);
    const [agentPda] = PublicKey.findProgramAddressSync([Buffer.from('agent'), defaultOwner.toBuffer(), Buffer.from(agentId)], programId);
    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), defaultOwner.toBuffer()], programId);
    const [idlAccount] = PublicKey.findProgramAddressSync([Buffer.from('anchor:idl'), programId.toBuffer()], programId);
    return {
      policyPda: policyPda.toBase58(),
      agentPda: agentPda.toBase58(),
      vaultPda: vaultPda.toBase58(),
      idlAccount: idlAccount.toBase58(),
    };
  }
}

const clusterEnv = resolveClusterEnvironment(process.env.NEXT_PUBLIC_SOLANA_CLUSTER);
const cluster = clusterEnvToSolanaCluster(clusterEnv);
const clusterLabel = clusterEnv;

/**
 * Browser RPC (NEXT_PUBLIC_SOLANA_RPC):
 * Used exclusively by browser clients for wallet balances, account reads,
 * transaction status, and Solana Explorer links.
 */
export const browserRpcUrl = resolveClusterRpcUrl(
  clusterEnv,
  process.env.NEXT_PUBLIC_SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
);

/**
 * Server RPC (SOLANA_RPC_URL):
 * Used exclusively on the Next.js server for agent execution, Pyth update workflows,
 * server-side verification, and indexing/reconciliation without exposing private RPC credentials.
 */
export function getServerSolanaRpcUrl(): string {
  return resolveClusterRpcUrl(
    clusterEnv,
    process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC
  );
}

const rpcUrl = browserRpcUrl;

const sentinelProgramId =
  process.env.SENTINEL_PROGRAM_ID ||
  process.env.NEXT_PUBLIC_SENTINEL_PROGRAM_ID ||
  '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK';

const defaultAuthority =
  process.env.NEXT_PUBLIC_DEFAULT_OWNER_WALLET ||
  'GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw';

const derivedPdas = deriveSentinelDomainPdas(defaultAuthority, sentinelProgramId);

const livePricesEnv = process.env.NEXT_PUBLIC_LIVE_PRICES;
const livePrices =
  livePricesEnv !== undefined
    ? livePricesEnv === 'true'
    : clusterEnv === 'MAINNET' || clusterEnv === 'DEVNET';

const demoModeEnv = process.env.NEXT_PUBLIC_DEMO_MODE;
const demoMode =
  demoModeEnv !== undefined ? demoModeEnv === 'true' : clusterEnv !== 'MAINNET';

export const APP_CONFIG: AppEnvironment = {
  clusterEnv,
  cluster,
  clusterLabel,
  rpcUrl,
  sentinelProgramId,
  idlAccount: 'H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6',
  policyPda: process.env.SENTINEL_POLICY_PDA || derivedPdas.policyPda,
  agentPda: process.env.SENTINEL_AGENT_PDA || derivedPdas.agentPda,
  vaultPda: process.env.SENTINEL_VAULT_PDA || derivedPdas.vaultPda,
  explorerBaseUrl: 'https://explorer.solana.com',
  devnetTransactions: {
    initializePolicyTx: '5FStukmor2DmjU49o8s2LRxfHyp67rLzu2Ds3bbZQEg4KKKwpFcoAt14HQEvLgrkrPT1ZDtnnZGVrAbrBuE5HEnV',
    initializeAgentTx: '3h9Gjcxjqmd6DWr4ST8RMEEvTVWZrejRcCSfoeQn6CoEYyKLMmGN6tdE6JEQZmaXkQEePQoobDfJU3WwNHYHz8hm',
    initializeVaultTx: '3gD1hqUwhXLSUFTE2RLo3PBLS7mVGXYhHVHKoJ8G5Jj2RsNYb8x21rMp5ua9LhdHuh8pzre17q7WjzLtvZ98XV7V',
    createPromiseTx: '3Hw2L1JWCgngXpWHQA2wxRbLCYH4AKGoT6NYhR8JYRpTy3qCsAHpyYLyvTtHVetVkUYh3BXFmX6Uud2fg3jKBzET',
    rejectBadTradeTx: '2haBLUKavXYzqa6nTtDMNaNNUu4ax5rqSnYmQKMAxCwJeqzaUw4tPSSMtDdynbWjqSW32EgqmHxaeHj4eGWsTjCD',
    executeValidTradeTx: '59KCBrondaKxhKmTqeib4cMGFZRh1mRQW815GUeazmAK5PYwD3Vomy957XreERfXmsLQKDc3XibcjURPnWJVmqUd',
    recordEvidenceTx: '3pvsnpVZ7A2f2ESd8jeHjbMbTYFsPv7g7RstKnNzBRpiR4mdUtCkQY5RQEPSb1fL8934sArLRp9KRDNXzFfT19Lw',
  },
  features: {
    agentSignerWallet: true,
    meteoraVerifier: true,
    livePrices,
    demoMode,
  },
};

/**
 * Builds an official Solana Explorer URL targeting the active cluster (LOCAL | DEVNET | MAINNET)
 */
export function getExplorerTxUrl(signature: string): string {
  if (APP_CONFIG.clusterEnv === 'MAINNET') {
    return `${APP_CONFIG.explorerBaseUrl}/tx/${signature}`;
  }
  if (APP_CONFIG.clusterEnv === 'LOCAL') {
    return `${APP_CONFIG.explorerBaseUrl}/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(APP_CONFIG.rpcUrl)}`;
  }
  return `${APP_CONFIG.explorerBaseUrl}/tx/${signature}?cluster=devnet`;
}

export function getExplorerAddressUrl(address: string): string {
  if (APP_CONFIG.clusterEnv === 'MAINNET') {
    return `${APP_CONFIG.explorerBaseUrl}/address/${address}`;
  }
  if (APP_CONFIG.clusterEnv === 'LOCAL') {
    return `${APP_CONFIG.explorerBaseUrl}/address/${address}?cluster=custom&customUrl=${encodeURIComponent(APP_CONFIG.rpcUrl)}`;
  }
  return `${APP_CONFIG.explorerBaseUrl}/address/${address}?cluster=devnet`;
}
