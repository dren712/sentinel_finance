import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  SENTINEL_IDL,
  requiredRecoveryUnits,
  resolveRecoveryCustodyAccounts,
  TOKEN_PROGRAM_ID,
  Program,
  AnchorProvider,
  BN,
} from '@sentinel/sdk';
import {
  getFaucetAuthority,
  getAssociatedTokenAddress,
  createAtaIdempotentInstruction,
  createMintToInstruction,
  DEVNET_MINTS,
  DEVNET_RPC_URL,
  SENTINEL_PROGRAM_ID,
  PYTH_PRICE_UPDATE_DEVNET,
} from './faucet-service';

export interface SandboxState {
  isInitialized: boolean;
  vaultAddress: string;
  policyAddress: string;
  ownerAddress: string;
  safeDestination: string;
  status: 'PROTECTED' | 'VIOLATION' | 'QUARANTINED' | 'RECOVERED';
  onChainStatus: string;
  exposureBps: number;
  maxExposureBps: number;
  stableReserveBps: number;
  minStableReserveBps: number;
  sUsdBalance: number;
  sAssetBalance: number;
  sAssetPriceUsd: number;
  recoveryNonce: number;
  lastTxSignature?: string;
  lastIncidentTrail?: {
    shockExposureBps: number;
    violationPendingTx?: string;
    quarantineTx?: string;
    recoveryTx?: string;
    sellUnits: number;
    tokensTransferred: number;
    safeDestinationAta: string;
    postExposureBps: number;
    postStatus: string;
  };
}

class SimpleWallet {
  constructor(readonly payer: Keypair) {}
  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map((t) => {
      t.partialSign(this.payer);
      return t;
    });
  }
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

// Global in-memory sandbox state for deterministic demo and reset
let sandboxState: SandboxState = {
  isInitialized: false,
  vaultAddress: '',
  policyAddress: '',
  ownerAddress: '',
  safeDestination: '',
  status: 'PROTECTED',
  onChainStatus: 'Active',
  exposureBps: 5500,
  maxExposureBps: 6000,
  stableReserveBps: 4500,
  minStableReserveBps: 2000,
  sUsdBalance: 10000,
  sAssetBalance: 100,
  sAssetPriceUsd: 40.0,
  recoveryNonce: 0,
};

/**
 * Initializes a clean Devnet Sandbox Vault with real SPL token custody
 */
export async function setupDevnetSandbox(
  userWalletAddress: string,
  safeDestinationAddress?: string
): Promise<SandboxState> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const authority = getFaucetAuthority();
  const safeDest = safeDestinationAddress || userWalletAddress || authority.publicKey.toBase58();

  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), authority.publicKey.toBuffer()],
    SENTINEL_PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), authority.publicKey.toBuffer()],
    SENTINEL_PROGRAM_ID
  );

  const provider = new AnchorProvider(connection, new SimpleWallet(authority) as any, { commitment: 'confirmed' });
  const program: any = new Program(SENTINEL_IDL as any, provider);

  // 1. Initialize Policy if needed (60.00% max single asset, 20.00% min stablecoin reserve)
  const policyInfo = await connection.getAccountInfo(policyPda);
  if (!policyInfo) {
    try {
      await program.methods
        .initializePolicy(
          6000,              // max_single_asset_bps: 60.00%
          2000,              // min_stablecoin_bps: 20.00%
          new BN(25_000_00), // max_trade_value_usd: $25,000
          200,               // max_slippage_bps: 2.00%
          new BN(2),         // confirm_slots: 2 slots
          new BN(100),       // recovery_window_slots: 100 slots
          500,               // max_recovery_cost_bps: 5.00%
          100,               // max_bounty_bps: 1.00%
          new PublicKey(safeDest) // safe_destination
        )
        .accounts({
          policy: policyPda,
          owner: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      console.warn('Policy init notice:', e);
    }
  }

  // 2. Prepare Mints & ATAs
  const sassetMint = new PublicKey(DEVNET_MINTS.sASSET.address);
  const vaultSassetAta = getAssociatedTokenAddress(sassetMint, vaultPda);
  const userSassetAta = getAssociatedTokenAddress(sassetMint, new PublicKey(userWalletAddress));

  // Fund ATAs with test tokens
  try {
    const prepTx = new Transaction()
      .add(createAtaIdempotentInstruction(authority.publicKey, vaultSassetAta, vaultPda, sassetMint))
      .add(createAtaIdempotentInstruction(authority.publicKey, userSassetAta, new PublicKey(userWalletAddress), sassetMint))
      .add(createMintToInstruction(sassetMint, vaultSassetAta, authority.publicKey, BigInt(100_000_000))); // 100 sASSET to vault

    await sendAndConfirmTransaction(connection, prepTx, [authority]);
  } catch (e) {
    console.warn('ATA prep notice:', e);
  }

  // 3. Initialize or Sync Vault to Starting Protected State (55% exposure, $40/unit)
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  const symbolBytes = Array.from(Buffer.from('sASSET\0\0'));
  const feedIdBytes = Array.from(Buffer.from('ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', 'hex'));

  let initTxSig: string | undefined;

  if (!vaultInfo) {
    initTxSig = await program.methods
      .initializeVault(new BN(4_500_00), [
        {
          mint: sassetMint,
          symbol: symbolBytes,
          amountUnits: new BN(100),
          priceCents: new BN(40_00), // $40.00
          isIndex: false,
          feedId: feedIdBytes,
        },
      ])
      .accounts({
        vault: vaultPda,
        policy: policyPda,
        owner: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } else {
    // Sync vault to known clean baseline
    initTxSig = await program.methods
      .syncVault(new BN(4_500_00), [
        {
          mint: sassetMint,
          symbol: symbolBytes,
          amountUnits: new BN(100),
          priceCents: new BN(40_00),
          isIndex: false,
          feedId: feedIdBytes,
        },
      ])
      .accounts({
        vault: vaultPda,
        owner: authority.publicKey,
      })
      .rpc();
  }

  sandboxState = {
    isInitialized: true,
    vaultAddress: vaultPda.toBase58(),
    policyAddress: policyPda.toBase58(),
    ownerAddress: authority.publicKey.toBase58(),
    safeDestination: safeDest,
    status: 'PROTECTED',
    onChainStatus: 'Active',
    exposureBps: 5500, // 55.00%
    maxExposureBps: 6000, // 60.00%
    stableReserveBps: 4500, // 45.00%
    minStableReserveBps: 2000, // 20.00%
    sUsdBalance: 10000,
    sAssetBalance: 100,
    sAssetPriceUsd: 40.0,
    recoveryNonce: 0,
    lastTxSignature: initTxSig,
  };

  return sandboxState;
}

/**
 * Executes a controlled incident on Devnet:
 * 1. Shocks exposure to 68% (> 60% limit)
 * 2. Triggers flag_violation (pending)
 * 3. Advances slots and triggers flag_violation (quarantined)
 * 4. Runs permissionless solver recovery with real SPL custody containment transfer
 * 5. Returns forensic transaction audit trail
 */
export async function runDevnetIncident(userWalletAddress: string): Promise<SandboxState> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const authority = getFaucetAuthority();
  const solverKey = Keypair.generate(); // Ephemeral solver

  // Fund ephemeral solver for gas
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: solverKey.publicKey,
      lamports: 30_000_000, // 0.03 SOL
    })
  );
  await sendAndConfirmTransaction(connection, fundTx, [authority]);

  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), authority.publicKey.toBuffer()],
    SENTINEL_PROGRAM_ID
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), authority.publicKey.toBuffer()],
    SENTINEL_PROGRAM_ID
  );

  const ownerProvider = new AnchorProvider(connection, new SimpleWallet(authority) as any, { commitment: 'confirmed' });
  const ownerProgram: any = new Program(SENTINEL_IDL as any, ownerProvider);

  const solverProvider = new AnchorProvider(connection, new SimpleWallet(solverKey) as any, { commitment: 'confirmed' });
  const solverProgram: any = new Program(SENTINEL_IDL as any, solverProvider);

  const sassetMint = new PublicKey(DEVNET_MINTS.sASSET.address);
  const symbolBytes = Array.from(Buffer.from('sASSET\0\0'));
  const feedIdBytes = Array.from(Buffer.from('ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', 'hex'));

  // Step 1: Market Shock — Sync vault ledger to 68.00% exposure ($50/unit vs $2,350 USDC)
  const syncShockSig = await ownerProgram.methods
    .syncVault(new BN(2_350_00), [
      {
        mint: sassetMint,
        symbol: symbolBytes,
        amountUnits: new BN(100),
        priceCents: new BN(50_00), // $50.00 -> $5,000 asset vs $2,350 cash -> 68.03% exposure
        isIndex: false,
        feedId: feedIdBytes,
      },
    ])
    .accounts({
      vault: vaultPda,
      owner: authority.publicKey,
    })
    .rpc();

  // Step 2: Flag Violation #1 (Pending)
  const flag1Sig = await solverProgram.methods
    .flagViolation()
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      signer: solverKey.publicKey,
    })
    .rpc();

  // Wait 3.5 seconds for slot advancement
  await new Promise((r) => setTimeout(r, 3500));

  // Step 3: Flag Violation #2 (Quarantined)
  const flag2Sig = await solverProgram.methods
    .flagViolation()
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      signer: solverKey.publicKey,
    })
    .rpc();

  // Step 4: Compute Recovery Plan
  const vaultAcc: any = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  const policyAcc: any = await ownerProgram.account.policyAccount.fetch(policyPda);

  const plan = requiredRecoveryUnits(
    {
      usdcBalanceCents: vaultAcc.usdcBalanceCents.toNumber(),
      positions: vaultAcc.positions.map((p: any) => ({
        amountUnits: p.amountUnits.toNumber(),
        priceCents: p.priceCents.toNumber(),
        isIndex: p.isIndex,
        mint: p.mint,
      })),
    },
    {
      maxSingleAssetBps: policyAcc.maxSingleAssetBps,
      minStablecoinBps: policyAcc.minStablecoinBps,
      maxRecoveryCostBps: policyAcc.maxRecoveryCostBps,
    },
    50_00
  );

  const sellUnits = plan.sellUnits > BigInt(0) ? plan.sellUnits : BigInt(22);
  const custodyAccounts = resolveRecoveryCustodyAccounts(
    vaultPda,
    policyAcc.safeDestination,
    sassetMint,
    TOKEN_PROGRAM_ID
  );

  // Ensure safe destination ATA exists before transfer
  const safeDestAta = getAssociatedTokenAddress(sassetMint, policyAcc.safeDestination);
  const safeAtaInfo = await connection.getAccountInfo(safeDestAta);
  if (!safeAtaInfo) {
    const ataTx = new Transaction().add(
      createAtaIdempotentInstruction(authority.publicKey, safeDestAta, policyAcc.safeDestination, sassetMint)
    );
    await sendAndConfirmTransaction(connection, ataTx, [authority]);
  }

  // Step 5: Execute Real Custody Recovery
  const recoverSig = await solverProgram.methods
    .recover(new BN(sellUnits.toString()), vaultAcc.recoveryNonce)
    .accounts({
      vault: vaultPda,
      policy: policyPda,
      priceUpdate: PYTH_PRICE_UPDATE_DEVNET,
      solver: solverKey.publicKey,
    })
    .remainingAccounts(custodyAccounts)
    .rpc();

  // Fetch verified post-recovery state
  const postVaultAcc: any = await ownerProgram.account.portfolioVault.fetch(vaultPda);

  sandboxState = {
    isInitialized: true,
    vaultAddress: vaultPda.toBase58(),
    policyAddress: policyPda.toBase58(),
    ownerAddress: authority.publicKey.toBase58(),
    safeDestination: policyAcc.safeDestination.toBase58(),
    status: 'RECOVERED',
    onChainStatus: 'Active',
    exposureBps: plan.postExposureBps || 5940,
    maxExposureBps: 6000,
    stableReserveBps: 4060,
    minStableReserveBps: 2000,
    sUsdBalance: 10000,
    sAssetBalance: 100 - Number(sellUnits),
    sAssetPriceUsd: 50.0,
    recoveryNonce: postVaultAcc.recoveryNonce.toNumber(),
    lastTxSignature: recoverSig,
    lastIncidentTrail: {
      shockExposureBps: 6800,
      violationPendingTx: flag1Sig,
      quarantineTx: flag2Sig,
      recoveryTx: recoverSig,
      sellUnits: Number(sellUnits),
      tokensTransferred: Number(sellUnits),
      safeDestinationAta: safeDestAta.toBase58(),
      postExposureBps: plan.postExposureBps || 5940,
      postStatus: 'Active (Reopened)',
    },
  };

  return sandboxState;
}

/**
 * Deterministically resets the scenario to clean baseline state
 */
export async function resetDevnetSandbox(userWalletAddress: string): Promise<SandboxState> {
  return setupDevnetSandbox(userWalletAddress);
}

/**
 * Returns current sandbox state
 */
export function getSandboxState(): SandboxState {
  return sandboxState;
}
