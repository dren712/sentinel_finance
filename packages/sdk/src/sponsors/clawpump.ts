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

  constructor(agentId: string = 'claw_sentinel_robo_1', name: string = 'Sentinel Autonomous Robo-Agent') {
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
