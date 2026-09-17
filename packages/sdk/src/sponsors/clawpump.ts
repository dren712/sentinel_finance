import { Keypair, PublicKey } from '@solana/web3.js';
import {
  TradeIntent,
  FinancialPolicy,
  canonicalJsonStringify,
  ClawPumpAgentLaunch,
  ClawPumpAgentTokenConfig,
  CANONICAL_CLAWPUMP_AGENT_TOKEN,
} from '@sentinel/domain';
import nacl from 'tweetnacl';

export interface SignedTradeIntent {
  intent: TradeIntent;
  canonicalMessage: string;
  signatureBase64: string;
  signerPublicKey: string;
}

/**
 * ClawPumpAgentWallet:
 * Implements the ClawPump Autonomous Agent Wallet Pattern.
 * Generates an autonomous agent Solana keypair, produces cryptographically genuine
 * Ed25519 signatures over canonical trade intents, and enforces that the agent cannot
 * execute outside the user's Sentinel on-chain policy bounds.
 */
export class ClawPumpAgentWallet {
  private keypair: Keypair;
  public readonly agentId: string;
  public readonly name: string;
  private tokenLaunch?: ClawPumpAgentLaunch;

  constructor(agentId: string = 'claw_sentinel_robo_1', name: string = 'Sentinel Autonomous Robo-Agent') {
    this.agentId = agentId;
    this.name = name;
    this.keypair = Keypair.generate();
  }

  /**
   * Provisions a stock-linked agent token launch on ClawPump with paired Meteora DBC liquidity
   * Phase 12: Agent Identity ➔ Stock-Linked Token ➔ Meteora Liquidity ➔ Sentinel Policy
   */
  launchStockLinkedToken(config?: ClawPumpAgentTokenConfig): ClawPumpAgentLaunch {
    const launchConfig: ClawPumpAgentTokenConfig = config ?? {
      ...CANONICAL_CLAWPUMP_AGENT_TOKEN,
      creatorAgentId: this.agentId,
      creatorAgentName: this.name,
    };
    this.tokenLaunch = new ClawPumpAgentLaunch(launchConfig);
    return this.tokenLaunch;
  }

  /**
   * Returns active stock-linked token launch metadata
   */
  getAgentLaunch(): ClawPumpAgentLaunch {
    if (!this.tokenLaunch) {
      this.tokenLaunch = this.launchStockLinkedToken();
    }
    return this.tokenLaunch;
  }

  /**
   * Proposes a trade intent for the agent's own token to test anti-self-dealing verification
   */
  proposeAgentTokenBuyIntent(tradeAmountUsd: number, referencePriceUsd: number = 1.0): TradeIntent {
    const launch = this.getAgentLaunch();
    return {
      intentId: `intent_agent_token_${Date.now()}`,
      agentId: this.agentId,
      assetSymbol: launch.config.symbol,
      assetMint: launch.config.mint,
      direction: 'BUY',
      tradeAmountUsd,
      referencePriceUsd,
      timestamp: Date.now(),
      strategyRationale: `Autonomous self-allocation intent: allocate $${tradeAmountUsd.toLocaleString()} into agent's native ${launch.config.symbol} token on Meteora DBC`,
    };
  }

  getPublicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  getPublicKeyString(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Cryptographically signs a trade intent using the agent's Ed25519 secret key
   * over RFC-8785 canonical JSON bytes.
   */
  signIntent(intent: TradeIntent): SignedTradeIntent {
    const canonicalMessage = canonicalJsonStringify(intent);
    const messageBytes = Buffer.from(canonicalMessage, 'utf-8');
    const signatureBytes = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

    return {
      intent,
      canonicalMessage,
      signatureBase64,
      signerPublicKey: this.keypair.publicKey.toBase58(),
    };
  }

  /**
   * Cryptographically verifies an Ed25519 signature over a canonical intent message.
   */
  static verifySignature(signedIntent: SignedTradeIntent): boolean {
    try {
      const messageBytes = Buffer.from(signedIntent.canonicalMessage, 'utf-8');
      const signatureBytes = Buffer.from(signedIntent.signatureBase64, 'base64');
      const publicKeyBytes = new PublicKey(signedIntent.signerPublicKey).toBytes();

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch {
      return false;
    }
  }

  /**
   * Verifies that the agent wallet address matches the authorized agent authority in the policy
   */
  isAuthorizedUnderPolicy(policy: FinancialPolicy, registeredAgentAuthority: string): boolean {
    if (!policy.isActive) return false;
    return this.keypair.publicKey.toBase58() === registeredAgentAuthority;
  }
}
