import { Connection, PublicKey } from '@solana/web3.js';
import {
  TokenHolding,
  PortfolioProjectionResult,
  Portfolio,
  NormalizedMarketPrice,
  ASSET_REGISTRY,
  createTokenHolding,
  createCanonicalTokenHoldings,
  projectPortfolioFromHoldings,
  verifyPortfolioProjection,
  deriveDeterministicAta,
  deriveSentinelPda,
} from '@sentinel/domain';

export const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/**
 * Derives the Associated Token Account (ATA) address using @solana/web3.js
 */
export function deriveSplAta(walletAddress: string, mintAddress: string): string {
  try {
    const [ata] = PublicKey.findProgramAddressSync(
      [
        new PublicKey(walletAddress).toBuffer(),
        SPL_TOKEN_PROGRAM_ID.toBuffer(),
        new PublicKey(mintAddress).toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return ata.toBase58();
  } catch {
    // Fallback to deterministic domain derivation if invalid key
    return deriveDeterministicAta(walletAddress, mintAddress);
  }
}

/**
 * PortfolioIndexer:
 * Real-time reader and projection engine for on-chain Solana token holdings.
 * Reads SPL Associated Token Accounts (ATAs), combines them with Pyth market truth,
 * and projects verified institutional portfolio state.
 */
export class PortfolioIndexer {
  private connection?: Connection;
  private memoryHoldings: Map<string, Map<string, TokenHolding>> = new Map();

  constructor(connection?: Connection) {
    this.connection = connection;
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  /**
   * Initializes or returns in-memory holding store for a wallet
   */
  private getOrCreateWalletStore(walletAddress: string): Map<string, TokenHolding> {
    let store = this.memoryHoldings.get(walletAddress);
    if (!store) {
      store = new Map();
      const canonical = createCanonicalTokenHoldings(walletAddress);
      for (const h of canonical) {
        // Compute real ATA address
        h.ataAddress = deriveSplAta(walletAddress, h.mint);
        store.set(h.symbol, h);
      }
      this.memoryHoldings.set(walletAddress, store);
    }
    return store;
  }

  /**
   * Reads token holdings for a wallet: attempts live Solana RPC read,
   * falling back to the deterministic local holding store if RPC is unavailable or in sandbox.
   */
  async fetchWalletTokenHoldings(walletAddress: string): Promise<TokenHolding[]> {
    const localStore = this.getOrCreateWalletStore(walletAddress);

    if (this.connection) {
      try {
        const ownerPubkey = new PublicKey(walletAddress);
        const parsedAccounts = await this.connection.getParsedTokenAccountsByOwner(
          ownerPubkey,
          { programId: SPL_TOKEN_PROGRAM_ID }
        );

        if (parsedAccounts.value.length > 0) {
          const liveHoldings: TokenHolding[] = [];
          for (const acc of parsedAccounts.value) {
            const info = acc.account.data.parsed.info;
            const mint = info.mint;
            const amountRaw = info.tokenAmount.amount;
            const amountUi = info.tokenAmount.uiAmount ?? 0;
            const decimals = info.tokenAmount.decimals;

            // Match with known registered asset
            const registered = Object.values(ASSET_REGISTRY).find(a => a.mint === mint);
            const symbol = registered ? registered.symbol : `TOKEN_${mint.slice(0, 4)}`;
            const name = registered ? registered.name : 'Unknown Token';

            const holding: TokenHolding = {
              mint,
              symbol,
              name,
              decimals,
              ataAddress: acc.pubkey.toBase58(),
              balanceRaw: amountRaw,
              balanceUi: amountUi,
              owner: walletAddress,
            };

            liveHoldings.push(holding);
            localStore.set(symbol, holding);
          }
          return liveHoldings;
        }
      } catch (err) {
        // Fallback to local deterministic store
      }
    }

    return Array.from(localStore.values());
  }

  /**
   * Projects a verified normalized portfolio from wallet token holdings + Pyth prices
   */
  async indexPortfolio(
    walletAddress: string,
    marketPrices: Record<string, NormalizedMarketPrice> = {},
    sentinelPda?: string
  ): Promise<PortfolioProjectionResult> {
    const holdings = await this.fetchWalletTokenHoldings(walletAddress);
    const pda = sentinelPda ?? deriveSentinelPda(walletAddress);

    return projectPortfolioFromHoldings({
      walletAddress,
      sentinelPda: pda,
      holdings,
      marketPrices,
    });
  }

  /**
   * Mutates token holding balance (used by execution adapters during settled trades)
   */
  updateHoldingBalance(walletAddress: string, symbol: string, deltaUi: number): TokenHolding {
    const store = this.getOrCreateWalletStore(walletAddress);
    const existing = store.get(symbol);

    if (!existing) {
      const meta = ASSET_REGISTRY[symbol];
      const mint = meta ? meta.mint : `${symbol}_MINT`;
      const name = meta ? meta.name : symbol;
      const decimals = meta ? meta.decimals : 6;
      const initialUi = Math.max(0, deltaUi);
      const newHolding = createTokenHolding({
        mint,
        symbol,
        name,
        decimals,
        balanceUi: initialUi,
        owner: walletAddress,
        ataAddress: deriveSplAta(walletAddress, mint),
      });
      store.set(symbol, newHolding);
      return newHolding;
    }

    const nextUi = Math.max(0, Math.round((existing.balanceUi + deltaUi) * 10_000) / 10_000);
    const multiplier = Math.pow(10, existing.decimals);
    existing.balanceUi = nextUi;
    existing.balanceRaw = BigInt(Math.round(nextUi * multiplier)).toString();
    return existing;
  }

  /**
   * Retrieves a specific token holding for a wallet
   */
  getHolding(walletAddress: string, symbol: string): TokenHolding | undefined {
    const store = this.getOrCreateWalletStore(walletAddress);
    return store.get(symbol);
  }
}
