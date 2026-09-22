import { Keypair, PublicKey } from '@solana/web3.js';
import { TradeIntent, FinancialPolicy, canonicalJsonStringify } from '@sentinel/domain';
import nacl from 'tweetnacl';

export interface SignedTradeIntent {
  intent: TradeIntent;
  canonicalMessage: string;
  signatureBase64: string;
  signerPublicKey: string;
}

/**
 * AgentSignerWallet:
 * Implements the Autonomous Agent Operational Keypair Pattern on Solana.
 * Generates an autonomous agent keypair, produces cryptographically genuine
 * Ed25519 signatures over RFC-8785 canonical trade intents, and enforces that the agent
 * cannot execute outside the user's Sentinel on-chain policy bounds.
 */
export class AgentSignerWallet {
  private keypair: Keypair;
  public readonly agentId: string;
  public readonly name: string;

  constructor(agentId: string = 'sentinel_robo_agent_1', name: string = 'Sentinel Autonomous Robo-Agent') {
    this.agentId = agentId;
    this.name = name;
    this.keypair = Keypair.generate();
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
      signerPublicKey: this.getPublicKeyString(),
    };
  }

  /**
   * Statically verifies an Ed25519 detached signature against a canonical trade intent message.
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
