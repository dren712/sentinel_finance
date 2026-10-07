import {
  TradeIntent,
  PortfolioSnapshot,
  SentinelAuthorizationTicket,
  hashTradeIntent,
  PYTH_FEED_IDS,
} from '@sentinel/domain';
import {
  ExecutionAdapter,
  ExecutionResult,
  ExecutionVenueType,
  SecurityViolationError,
  WalletSigner,
  SolanaCluster,
  VaultStatusType,
  OnChainVaultStatus,
} from '../types';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { SENTINEL_IDL, Sentinel } from '../idl';
import { loadKeypair } from '../keys';

export { DemoExecutionAdapter, SimulatedExecutionAdapter } from './demo-adapter';
export {
  MeteoraExecutionAdapter,
  METEORA_DBC_POOLS,
  METEORA_DBC_PROGRAM_ID,
  METEORA_DBC_AUTHORITY,
  deriveMeteoraDbcPoolPda,
} from './meteora-adapter';
export { PreStocksExecutionAdapter, PRESTOCKS_SECONDARY_POOLS } from './prestocks-adapter';

function encodeSymbol8(sym: string): number[] {
  const buf = Buffer.alloc(8, 0);
  buf.write(sym.slice(0, 8), 'utf8');
  return Array.from(buf);
}

function to32Bytes(str: string): number[] {
  if (/^[0-9a-fA-F]{64}$/.test(str)) {
    return Array.from(Buffer.from(str, 'hex'));
  }
  const buf = Buffer.alloc(32, 0);
  buf.write(str.slice(0, 32), 'utf8');
  return Array.from(buf);
}

function extractErrorCode(err: unknown): number {
  if (err && typeof err === 'object') {
    const anyErr = err as any;
    if (anyErr.error?.errorCode?.number) {
      return anyErr.error.errorCode.number;
    }
  }
  const str = String(err instanceof Error ? err.message : err);
  const match = str.match(/Error Code: (\w+)|custom program error: (0x[0-9a-fA-F]+)|Error Number: (\d+)/);
  if (match) {
    if (match[3]) return parseInt(match[3], 10);
    if (match[2]) return parseInt(match[2], 16);
    const nameMap: Record<string, number> = {
      ExposureExceeded: 6000,
      StablecoinReserveBreached: 6001,
      TradeSizeExceeded: 6002,
      SlippageExceeded: 6003,
      PolicyInactive: 6004,
      UnauthorizedAgent: 6005,
      UnauthorizedExecution: 6006,
      InvalidPromiseStatus: 6007,
      MathOverflow: 6008,
      InvalidPolicyBounds: 6009,
      AssetNotFound: 6010,
      InsufficientStablecoinReserve: 6011,
      PromiseExpired: 6012,
      SecurityDomainMismatch: 6013,
      AgentInactive: 6014,
      TradeAmountMismatch: 6015,
      InvalidTradeDirection: 6016,
      InvalidPrice: 6017,
    };
    if (nameMap[match[1]]) return nameMap[match[1]];
  }
  return 6000;
}

export interface LiveExecutionAdapterOptions {
  rpcEndpoint?: string;
  signer?: Keypair | WalletSigner;
  agentSigner?: Keypair | WalletSigner;
  ownerSigner?: Keypair | WalletSigner;
  agentKeypair?: Keypair | WalletSigner;
  ownerKeypair?: Keypair | WalletSigner;
  programId?: string;
  cluster?: SolanaCluster;
}

/**
 * LiveExecutionAdapter:
 * Connects to Solana RPC and builds on-chain transactions targeting the Sentinel Anchor program.
 * In accordance with Phase 4 security invariants: Requires a genuine wallet or keypair signer
 * and strictly verifies Sentinel authorization tickets before on-chain execution.
 */
export class LiveExecutionAdapter implements ExecutionAdapter {
  public readonly venueType: ExecutionVenueType = 'SOLANA';
  public readonly venueName: string;
  public readonly cluster: SolanaCluster;
  private connection: Connection;
  public readonly programId: PublicKey;
  private agentSigner?: Keypair | WalletSigner;
  private ownerSigner?: Keypair | WalletSigner;
  private signer?: Keypair | WalletSigner;

  constructor(
    rpcEndpointOrOptions: string | LiveExecutionAdapterOptions = 'https://api.devnet.solana.com',
    signer?: Keypair | WalletSigner,
    programId: string = '3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH',
    cluster: SolanaCluster = 'devnet',
    ownerSigner?: Keypair | WalletSigner
  ) {
    let rpcEndpoint = 'https://api.devnet.solana.com';
    if (typeof rpcEndpointOrOptions === 'object') {
      rpcEndpoint = rpcEndpointOrOptions.rpcEndpoint || rpcEndpoint;
      this.programId = new PublicKey(rpcEndpointOrOptions.programId || programId);
      this.cluster = rpcEndpointOrOptions.cluster || cluster;
      this.agentSigner =
        rpcEndpointOrOptions.agentKeypair ||
        rpcEndpointOrOptions.agentSigner ||
        rpcEndpointOrOptions.signer;
      this.ownerSigner =
        rpcEndpointOrOptions.ownerKeypair ||
        rpcEndpointOrOptions.ownerSigner;
      this.signer = rpcEndpointOrOptions.signer || this.agentSigner || this.ownerSigner;
    } else {
      rpcEndpoint = rpcEndpointOrOptions;
      this.programId = new PublicKey(programId);
      this.cluster = cluster;
      this.agentSigner = signer;
      this.ownerSigner = ownerSigner;
      this.signer = signer;
    }

    this.venueName = this.cluster === 'mainnet' ? 'Solana Mainnet' : 'Solana Devnet';
    this.connection = new Connection(rpcEndpoint, 'confirmed');

    // Automatic discovery via environment variables
    if (!this.agentSigner) {
      this.agentSigner =
        loadKeypair(process.env.SENTINEL_AGENT_KEYPAIR) ||
        loadKeypair(process.env.SOLANA_AGENT_KEYPAIR);
    }
    if (!this.ownerSigner) {
      this.ownerSigner =
        ownerSigner ||
        loadKeypair(process.env.SENTINEL_OWNER_KEYPAIR) ||
        loadKeypair(process.env.SOLANA_OWNER_KEYPAIR);
    }
    if (!this.signer) {
      this.signer = this.agentSigner || this.ownerSigner;
    }
    if (!this.ownerSigner && this.signer) {
      this.ownerSigner = this.signer;
    }
    if (!this.agentSigner && this.signer) {
      this.agentSigner = this.signer;
    }
  }

  getMode(): 'LIVE' {
    return 'LIVE';
  }

  setSignerKeypair(keypair: Keypair): void {
    this.signer = keypair;
    this.agentSigner = keypair;
  }

  setWalletSigner(signer: WalletSigner): void {
    this.signer = signer;
    this.agentSigner = signer;
  }

  setAgentSigner(signer: Keypair | WalletSigner): void {
    this.agentSigner = signer;
    if (!this.signer) this.signer = signer;
  }

  setOwnerSigner(signer: Keypair | WalletSigner): void {
    this.ownerSigner = signer;
  }

  getSigner(): Keypair | WalletSigner | undefined {
    return this.signer;
  }

  getAgentSigner(): Keypair | WalletSigner | undefined {
    return this.agentSigner || this.signer;
  }

  getOwnerSigner(): Keypair | WalletSigner | undefined {
    return this.ownerSigner || this.signer;
  }

  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Initializes a typed Anchor Program client instance targeting the Sentinel IDL
   */
  public getProgram(customSigner?: Keypair | WalletSigner): Program<Sentinel> {
    const activeSigner = customSigner || this.agentSigner || this.signer;
    const dummyWallet = {
      publicKey: activeSigner?.publicKey ?? PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    const provider = new AnchorProvider(this.connection, dummyWallet, {
      commitment: 'confirmed',
    });
    return new Program<Sentinel>(SENTINEL_IDL as unknown as Idl as Sentinel, provider);
  }

  /**
   * Builds and submits a real on-chain transaction to execute a guarded trade
   */
  async executeTrade(
    intent: TradeIntent,
    _preState: PortfolioSnapshot,
    authorization?: SentinelAuthorizationTicket,
    options?: { priceUpdateAccount?: PublicKey }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. Non-Bypass Invariant: Direct Agent -> DEX is prohibited!
    if (!authorization) {
      throw new SecurityViolationError(
        'Direct Agent->DEX execution prohibited: LiveExecutionAdapter requires an authorized SentinelAuthorizationTicket. Direct execution bypasses Sentinel risk governance.',
        'BYPASS_ATTEMPT'
      );
    }

    // 2. Ticket expiration check
    if (authorization.expiresAt < Date.now()) {
      throw new SecurityViolationError(
        `Authorization ticket expired at ${new Date(authorization.expiresAt).toISOString()} (current time: ${new Date().toISOString()})`,
        'EXPIRED_TICKET'
      );
    }

    // 3. Intent hash binding check
    const currentIntentHash = hashTradeIntent(intent);
    if (authorization.intentHash !== currentIntentHash) {
      throw new SecurityViolationError(
        `Authorization ticket intent hash mismatch. Expected ${authorization.intentHash}, got ${currentIntentHash}`,
        'INVALID_TICKET'
      );
    }

    const activeSigner = this.agentSigner || this.signer;
    if (!activeSigner) {
      throw new Error(
        'Live execution requires an authorized Solana signer keypair or connected wallet. ' +
        'Please connect a funded Solana wallet or use SIMULATION mode for deterministic offline evaluation.'
      );
    }

    try {
      // Check RPC connection liveness
      const { blockhash } = await this.connection.getLatestBlockhash();

      const isBuy = intent.direction === 'BUY';
      const inputAsset = isBuy ? 'USDC' : intent.assetSymbol;
      const outputAsset = isBuy ? intent.assetSymbol : 'USDC';
      const inputAmount = isBuy ? intent.tradeAmountUsd : intent.tradeAmountUsd / intent.referencePriceUsd;
      const outputAmount = isBuy ? intent.tradeAmountUsd / intent.referencePriceUsd : intent.tradeAmountUsd;

      // Derive PDAs matching Anchor on-chain constraints
      const authorityPubkey = activeSigner.publicKey;
      const ownerPubkey = _preState?.owner
        ? new PublicKey(_preState.owner)
        : (this.ownerSigner?.publicKey || authorityPubkey);

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), ownerPubkey.toBuffer()],
        this.programId
      );

      const [policyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('policy'), ownerPubkey.toBuffer()],
        this.programId
      );

      const rawAgentId = intent.agentId === 'sentinel-robo-01' ? 'robo-01' : (intent.agentId || 'robo-01');
      const agentId = rawAgentId.slice(0, 28);
      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('agent'), ownerPubkey.toBuffer(), Buffer.from(agentId)],
        this.programId
      );

      const rawPromiseId = intent.intentId || `prm_${Date.now()}`;
      const promiseId = rawPromiseId.length > 28 ? rawPromiseId.slice(-28) : rawPromiseId;
      const [promisePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
        this.programId
      );

      const program = this.getProgram(activeSigner);
      const tx = new Transaction();

      // Check if promise exists, otherwise build create_promise instruction via Anchor IDL
      const promiseAccountInfo = await this.connection.getAccountInfo(promisePda);
      if (!promiseAccountInfo) {
        let mintPubkey: PublicKey;
        try {
          mintPubkey = new PublicKey(intent.assetMint);
        } catch {
          mintPubkey = PublicKey.default;
        }

        const intentHashBytes = to32Bytes(authorization.intentHash);

        const createPromiseIx = await program.methods
          .createPromise(
            promiseId,
            intentHashBytes,
            mintPubkey,
            intent.direction === 'BUY' ? 0 : 1,
            new BN(Math.round(intent.tradeAmountUsd))
          )
          .accountsPartial({
            promise: promisePda,
            agent: agentPda,
            policy: policyPda,
            vault: vaultPda,
            authority: authorityPubkey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        tx.add(createPromiseIx);
      }

      // Pyth price update account
      const priceUpdatePubkey = options?.priceUpdateAccount || (intent as any).priceUpdateAccount || Keypair.generate().publicKey;

      // Build execute_guarded_trade instruction via Anchor IDL typed method builder
      const tradeAmountCents = new BN(Math.round(intent.tradeAmountUsd * 100));
      const executionPriceCents = new BN(Math.round(intent.referencePriceUsd * 100));
      const quotedPriceCents = new BN(Math.round(intent.referencePriceUsd * 100));

      const executeTradeIx = await program.methods
        .executeGuardedTrade(
          tradeAmountCents,
          executionPriceCents,
          quotedPriceCents
        )
        .accountsPartial({
          promise: promisePda,
          vault: vaultPda,
          agent: agentPda,
          policy: policyPda,
          priceUpdate: priceUpdatePubkey,
          authority: authorityPubkey,
        })
        .instruction();

      tx.add(executeTradeIx);

      // On success, record evidence (result=3: Settled)
      const [evidencePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('evidence'), promisePda.toBuffer()],
        this.programId
      );
      const evidenceAccountInfo = await this.connection.getAccountInfo(evidencePda);
      if (!evidenceAccountInfo) {
        const rawEvidenceId = `ev_${promiseId}`;
        const evidenceId = rawEvidenceId.slice(0, 28);
        const preStateHashBytes = to32Bytes(authorization.preStateHash || hashTradeIntent(intent));
        const postStateHashBytes = to32Bytes(authorization.intentHash || authorization.preStateHash || hashTradeIntent(intent));

        const recordEvidenceIx = await program.methods
          .recordEvidence(
            evidenceId,
            preStateHashBytes,
            postStateHashBytes,
            3, // 3 = Settled
            0  // 0 = Success
          )
          .accountsPartial({
            evidence: evidencePda,
            promise: promisePda,
            agent: agentPda,
            authority: authorityPubkey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        tx.add(recordEvidenceIx);
      }

      const txSignature = await this.sendTransactionWithSigner(tx, activeSigner, []);

      const clusterParam = this.cluster === 'mainnet' ? '' : `?cluster=${this.cluster}`;
      const explorerUrl = `https://explorer.solana.com/tx/${txSignature}${clusterParam}`;

      const route = isBuy
        ? `USDC ATA ➔ Sentinel Program ➔ ${intent.assetSymbol} ATA`
        : `${intent.assetSymbol} ATA ➔ Sentinel Program ➔ USDC ATA`;

      return {
        success: true,
        transactionSignature: txSignature,
        inputAsset,
        outputAsset,
        inputAmount: Math.round(inputAmount * 100) / 100,
        outputAmount: Math.round(outputAmount * 10_000) / 10_000,
        executionPrice: intent.referencePriceUsd,
        isSimulation: false,
        timestamp: Date.now(),
        venueType: this.venueType,
        venueName: this.venueName,
        cluster: this.cluster,
        explorerUrl,
        poolAddress: vaultPda.toBase58(),
        route,
        executionDurationMs: Math.max(1, Date.now() - startTime),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const failureCode = extractErrorCode(err);
      try {
        await this.rejectTrade(intent, _preState, failureCode, authorization);
      } catch (rejectErr) {
        console.error('[LiveExecutionAdapter] Warning: failed to anchor on-chain rejection:', rejectErr);
      }
      throw new Error(`Live on-chain execution failed: ${message}`);
    }
  }

  /**
   * Executes an on-chain rejection flow:
   * Ensures the promise exists on-chain, calls reject_promise(failure_code), and records evidence (status = 4).
   */
  async rejectTrade(
    intent: TradeIntent,
    _preState: PortfolioSnapshot,
    failureCode: number = 6000,
    authorization?: SentinelAuthorizationTicket
  ): Promise<{ rejectionTxSignature: string; promisePda: string; evidencePda: string }> {
    const activeSigner = this.agentSigner || this.signer;
    if (!activeSigner) {
      throw new Error('Live rejection requires an authorized Solana signer keypair or connected wallet.');
    }

    const authorityPubkey = activeSigner.publicKey;
    const ownerPubkey = _preState?.owner
      ? new PublicKey(_preState.owner)
      : (this.ownerSigner?.publicKey || authorityPubkey);

    const rawAgentId = intent.agentId === 'sentinel-robo-01' ? 'robo-01' : (intent.agentId || 'robo-01');
    const agentId = rawAgentId.slice(0, 28);
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), ownerPubkey.toBuffer(), Buffer.from(agentId)],
      this.programId
    );

    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), ownerPubkey.toBuffer()],
      this.programId
    );

    const rawPromiseId = intent.intentId || `prm_${Date.now()}`;
    const promiseId = rawPromiseId.length > 28 ? rawPromiseId.slice(-28) : rawPromiseId;
    const [promisePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('promise'), agentPda.toBuffer(), Buffer.from(promiseId)],
      this.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), ownerPubkey.toBuffer()],
      this.programId
    );

    const [evidencePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('evidence'), promisePda.toBuffer()],
      this.programId
    );

    const program = this.getProgram(activeSigner);

    // 1. Ensure promise exists on-chain
    const promiseAccountInfo = await this.connection.getAccountInfo(promisePda);
    if (!promiseAccountInfo) {
      let mintPubkey: PublicKey;
      try {
        mintPubkey = new PublicKey(intent.assetMint);
      } catch {
        mintPubkey = PublicKey.default;
      }

      const intentHashStr = authorization?.intentHash || hashTradeIntent(intent);
      const intentHashBytes = to32Bytes(intentHashStr);

      const createPromiseTx = new Transaction();
      const createPromiseIx = await program.methods
        .createPromise(
          promiseId,
          intentHashBytes,
          mintPubkey,
          intent.direction === 'BUY' ? 0 : 1,
          new BN(Math.round(intent.tradeAmountUsd))
        )
        .accountsPartial({
          promise: promisePda,
          agent: agentPda,
          policy: policyPda,
          vault: vaultPda,
          authority: authorityPubkey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      createPromiseTx.add(createPromiseIx);
      await this.sendTransactionWithSigner(createPromiseTx, activeSigner);
    }

    // 2. Reject promise and record evidence (status 4)
    const rejectTx = new Transaction();
    const rejectIx = await program.methods
      .rejectPromise(failureCode)
      .accountsPartial({
        promise: promisePda,
        agent: agentPda,
        authority: authorityPubkey,
      })
      .instruction();
    rejectTx.add(rejectIx);

    const evidenceAccountInfo = await this.connection.getAccountInfo(evidencePda);
    if (!evidenceAccountInfo) {
      const rawEvidenceId = `ev_rej_${promiseId}`;
      const evidenceId = rawEvidenceId.slice(0, 28);
      const preStateHashBytes = to32Bytes(authorization?.preStateHash || hashTradeIntent(intent));
      const postStateHashBytes = to32Bytes(authorization?.intentHash || authorization?.preStateHash || hashTradeIntent(intent));

      const recordEvidenceIx = await program.methods
        .recordEvidence(
          evidenceId,
          preStateHashBytes,
          postStateHashBytes,
          4, // 4 = Rejected
          failureCode
        )
        .accountsPartial({
          evidence: evidencePda,
          promise: promisePda,
          agent: agentPda,
          authority: authorityPubkey,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      rejectTx.add(recordEvidenceIx);
    }

    const rejectionTxSignature = await this.sendTransactionWithSigner(rejectTx, activeSigner);
    return {
      rejectionTxSignature,
      promisePda: promisePda.toBase58(),
      evidencePda: evidencePda.toBase58(),
    };
  }

  /**
   * Synchronizes an existing PortfolioVault account with owner-verified positions.
   * STRICT ACCESS CONTROL: Must be signed by the Vault Owner key.
   * If an agent key attempts to call this, the on-chain instruction will fail with ConstraintHasOne or ConstraintSeeds.
   */
  async syncVault(
    usdcBalanceCents: number | BN,
    positions: Array<{
      mint: PublicKey | string;
      symbol: string | number[];
      amountUnits: number | BN;
      priceCents: number | BN;
      isIndex: boolean;
      feedId?: number[] | Uint8Array | string;
    }>,
    signerOverride?: Keypair | WalletSigner,
    vaultOwnerPubkey?: PublicKey
  ): Promise<string> {
    const activeSigner = signerOverride || this.ownerSigner || this.signer;
    if (!activeSigner) {
      throw new Error('syncVault requires an authorized owner signer keypair or connected wallet.');
    }

    const ownerPubkey = activeSigner.publicKey;
    const targetOwner = vaultOwnerPubkey || ownerPubkey;
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), targetOwner.toBuffer()],
      this.programId
    );

    const formattedPositions = positions.map((p) => ({
      mint: p.mint instanceof PublicKey ? p.mint : new PublicKey(p.mint),
      symbol: Array.isArray(p.symbol) ? p.symbol : encodeSymbol8(p.symbol),
      amountUnits: BN.isBN(p.amountUnits) ? p.amountUnits : new BN(Math.round(Number(p.amountUnits))),
      priceCents: BN.isBN(p.priceCents) ? p.priceCents : new BN(Math.round(Number(p.priceCents))),
      isIndex: Boolean(p.isIndex),
      feedId: p.feedId ? (Array.isArray(p.feedId) ? p.feedId : Array.from(to32Bytes(p.feedId as string))) : Array(32).fill(0),
    }));

    const program = this.getProgram(activeSigner);
    const tx = new Transaction();
    const syncIx = await program.methods
      .syncVault(
        BN.isBN(usdcBalanceCents) ? usdcBalanceCents : new BN(Math.round(Number(usdcBalanceCents))),
        formattedPositions
      )
      .accountsPartial({
        vault: vaultPda,
        owner: ownerPubkey,
      })
      .instruction();

    tx.add(syncIx);
    return await this.sendTransactionWithSigner(tx, activeSigner);
  }

  /**
   * Permissionless flag_violation: re-evaluates policy exposure and reserve using Pyth oracle price.
   * Can be signed by any arbitrary signer wallet.
   */
  async flagViolation(options: {
    vaultOwner: PublicKey | string;
    priceUpdateAccount: PublicKey | string;
    signerOverride?: Keypair | WalletSigner;
  }): Promise<{ signature: string }> {
    const activeSigner = options.signerOverride || this.signer;
    if (!activeSigner) {
      throw new Error('flagViolation requires a signer keypair or connected wallet.');
    }

    const ownerPubkey = typeof options.vaultOwner === 'string'
      ? new PublicKey(options.vaultOwner)
      : options.vaultOwner;

    const priceUpdatePubkey = typeof options.priceUpdateAccount === 'string'
      ? new PublicKey(options.priceUpdateAccount)
      : options.priceUpdateAccount;

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), ownerPubkey.toBuffer()],
      this.programId
    );

    const [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('policy'), ownerPubkey.toBuffer()],
      this.programId
    );

    const program = this.getProgram(activeSigner);
    const tx = new Transaction();
    const flagIx = await program.methods
      .flagViolation()
      .accountsPartial({
        vault: vaultPda,
        policy: policyPda,
        priceUpdate: priceUpdatePubkey,
        signer: activeSigner.publicKey,
      })
      .instruction();

    tx.add(flagIx);
    const signature = await this.sendTransactionWithSigner(tx, activeSigner);
    return { signature };
  }

  /**
   * owner_release: releases vault from any status back to Active.
   * STRICT ACCESS CONTROL: Must be signed by the Vault Owner key.
   */
  async ownerRelease(options?: {
    ownerSigner?: Keypair | WalletSigner;
    vaultOwner?: PublicKey | string;
  }): Promise<{ signature: string }> {
    const activeSigner = options?.ownerSigner || this.ownerSigner || this.signer;
    if (!activeSigner) {
      throw new Error('ownerRelease requires an authorized owner signer keypair or connected wallet.');
    }

    const ownerPubkey = options?.vaultOwner
      ? (typeof options.vaultOwner === 'string' ? new PublicKey(options.vaultOwner) : options.vaultOwner)
      : activeSigner.publicKey;

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), ownerPubkey.toBuffer()],
      this.programId
    );

    const program = this.getProgram(activeSigner);
    const tx = new Transaction();
    const releaseIx = await program.methods
      .ownerRelease()
      .accountsPartial({
        vault: vaultPda,
        owner: activeSigner.publicKey,
      })
      .instruction();

    tx.add(releaseIx);
    const signature = await this.sendTransactionWithSigner(tx, activeSigner);
    return { signature };
  }

  /**
   * Permissionless expire_quarantine: marks quarantine as expired if recovery window has passed.
   * Can be signed by any arbitrary signer wallet.
   */
  async expireQuarantine(options: {
    vaultOwner: PublicKey | string;
    signerOverride?: Keypair | WalletSigner;
  }): Promise<{ signature: string }> {
    const activeSigner = options.signerOverride || this.signer;
    if (!activeSigner) {
      throw new Error('expireQuarantine requires a signer keypair or connected wallet.');
    }

    const ownerPubkey = typeof options.vaultOwner === 'string'
      ? new PublicKey(options.vaultOwner)
      : options.vaultOwner;

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), ownerPubkey.toBuffer()],
      this.programId
    );

    const program = this.getProgram(activeSigner);
    const tx = new Transaction();
    const expireIx = await program.methods
      .expireQuarantine()
      .accountsPartial({
        vault: vaultPda,
        signer: activeSigner.publicKey,
      })
      .instruction();

    tx.add(expireIx);
    const signature = await this.sendTransactionWithSigner(tx, activeSigner);
    return { signature };
  }

  /**
   * readVaultStatus: authoritatively reads on-chain PortfolioVault account state.
   * No cached or simulated values.
   */
  async readVaultStatus(vaultOwner: PublicKey | string): Promise<OnChainVaultStatus> {
    const ownerPubkey = typeof vaultOwner === 'string' ? new PublicKey(vaultOwner) : vaultOwner;
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), ownerPubkey.toBuffer()],
      this.programId
    );
    const program = this.getProgram();
    const vaultAccount = await (program.account as any).portfolioVault.fetch(vaultPda);
    return formatVaultAccount(vaultAccount, vaultPda);
  }

  private async sendTransactionWithSigner(
    tx: Transaction,
    explicitSigner?: Keypair | WalletSigner,
    additionalSigners: Keypair[] = []
  ): Promise<string> {
    const signer = explicitSigner || this.signer;
    if (!signer) throw new Error('Signer required');
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = signer.publicKey;

    if (additionalSigners.length > 0) {
      tx.partialSign(...additionalSigners);
    }

    if ('secretKey' in signer) {
      return await sendAndConfirmTransaction(this.connection, tx, [signer, ...additionalSigners]);
    } else if (signer.signTransaction) {
      const signedTx = await signer.signTransaction(tx);
      const sig = await this.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
      await this.connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );
      return sig;
    } else if (signer.sendTransaction) {
      const sig = await signer.sendTransaction(tx, this.connection);
      const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
      await this.connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );
      return sig;
    } else {
      throw new Error('Signer cannot sign or send transaction');
    }
  }
}

function formatVaultAccount(vaultAccount: any, vaultPda: PublicKey): OnChainVaultStatus {
  let statusStr: VaultStatusType = 'Active';
  if (vaultAccount.status) {
    if (typeof vaultAccount.status === 'string') {
      statusStr = vaultAccount.status as VaultStatusType;
    } else if (vaultAccount.status.active !== undefined) {
      statusStr = 'Active';
    } else if (vaultAccount.status.quarantined !== undefined) {
      statusStr = 'Quarantined';
    } else if (vaultAccount.status.recoveryExpired !== undefined) {
      statusStr = 'RecoveryExpired';
    }
  }

  return {
    vaultPda: vaultPda.toBase58(),
    owner: vaultAccount.owner.toBase58(),
    policy: vaultAccount.policy.toBase58(),
    status: statusStr,
    pendingViolationSlot: Number(vaultAccount.pendingViolationSlot ?? 0),
    quarantineSlot: Number(vaultAccount.quarantineSlot ?? 0),
    recoveryExpiresSlot: Number(vaultAccount.recoveryExpiresSlot ?? 0),
    recoveryNonce: Number(vaultAccount.recoveryNonce ?? 0),
    usdcBalanceCents: Number(vaultAccount.usdcBalanceCents ?? 0),
    totalValueCents: Number(vaultAccount.totalValueCents ?? 0),
  };
}

/**
 * readVaultStatus: authoritatively reads on-chain PortfolioVault account state.
 * No cached or simulated values.
 */
export async function readVaultStatus(
  connection: Connection,
  vaultOwner: PublicKey | string,
  programId: PublicKey | string = '3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH'
): Promise<OnChainVaultStatus> {
  const ownerPubkey = typeof vaultOwner === 'string' ? new PublicKey(vaultOwner) : vaultOwner;
  const progId = typeof programId === 'string' ? new PublicKey(programId) : programId;

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), ownerPubkey.toBuffer()],
    progId
  );

  const dummyWallet = {
    publicKey: ownerPubkey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
  const program = new Program<Sentinel>(SENTINEL_IDL as unknown as Idl as Sentinel, provider);

  const vaultAccount = await (program.account as any).portfolioVault.fetch(vaultPda);
  return formatVaultAccount(vaultAccount, vaultPda);
}
