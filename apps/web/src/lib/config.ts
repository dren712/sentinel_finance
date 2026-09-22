export type SolanaCluster = 'devnet' | 'mainnet-beta' | 'localnet';

export interface AppEnvironment {
  cluster: SolanaCluster;
  clusterLabel: string;
  rpcUrl: string;
  sentinelProgramId: string;
  idlAccount: string;
  policyPda: string;
  agentPda: string;
  vaultPda: string;
  explorerBaseUrl: string;
  features: {
    agentSignerWallet: boolean;
    meteoraVerifier: boolean;
    livePrices: boolean; // Currently false: simulated benchmark prices for tokenized stocks
    demoMode: boolean;
  };
}

export const APP_CONFIG: AppEnvironment = {
  cluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster) || 'devnet',
  clusterLabel: 'DEVNET',
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com',
  sentinelProgramId: '3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK',
  idlAccount: 'H28SmQxnyeTQFUQFFyKjwbLBi77w78vtHmbQzQWrGHx6',
  policyPda: '3wTp1YDSG3xmf9TtuwZ64b11uLuLNUgQRwdesMbFJUUh',
  agentPda: '62vpHzSG92GUbAXtNh4czG6U6HyTpndrY4NvZM9euUnQ',
  vaultPda: '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y',
  explorerBaseUrl: 'https://explorer.solana.com',
  features: {
    agentSignerWallet: true,
    meteoraVerifier: true,
    livePrices: false,
    demoMode: true,
  },
};

/**
 * Builds an official Solana Explorer URL targeting the active cluster
 */
export function getExplorerTxUrl(signature: string): string {
  const clusterParam = APP_CONFIG.cluster === 'mainnet-beta' ? '' : `?cluster=${APP_CONFIG.cluster}`;
  return `${APP_CONFIG.explorerBaseUrl}/tx/${signature}${clusterParam}`;
}

export function getExplorerAddressUrl(address: string): string {
  const clusterParam = APP_CONFIG.cluster === 'mainnet-beta' ? '' : `?cluster=${APP_CONFIG.cluster}`;
  return `${APP_CONFIG.explorerBaseUrl}/address/${address}${clusterParam}`;
}
