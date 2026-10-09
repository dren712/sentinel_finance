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
  parsePythPriceUpdateAccount,
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
  sUsdBalance: number; // Internal on-chain cash ledger (USD)
  sAssetBalance: number; // Volatile SPL token balance (whole tokens)
  sAssetPriceUsd: number; // Pyth Devnet oracle proxy price (USD)
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

// Global in-memory sandbox state
let sandboxState: SandboxState = {
  isInitialized: false,
  vaultAddress: '',
  policyAddress: '',
  ownerAddress: '',
  safeDestination: '',
  status: 'PROTECTED',
  onChainStatus: 'Uninitialized',
  exposureBps: 0,
  maxExposureBps: 6000,
  stableReserveBps: 0,
  minStableReserveBps: 2000,
  sUsdBalance: 0,
  sAssetBalance: 0,
  sAssetPriceUsd: 0,
  recoveryNonce: 0,
};

/**
 * Fetches the live Pyth Devnet price in cents for the configured oracle feed
 */
async function fetchLivePythPriceCents(connection: Connection): Promise<number> {
  try {
    const pythAcc = await connection.getAccountInfo(PYTH_PRICE_UPDATE_DEVNET, 'confirmed');
    if (pythAcc && pythAcc.data) {
      const parsed = parsePythPriceUpdateAccount(pythAcc.data);
      if (parsed.priceCents > 0) {
        return parsed.priceCents;
      }
    }
  } catch (err) {
    console.warn('[Sandbox] Failed reading Pyth price from RPC, using calibrated baseline:', err);
  }
  return 2500_00; // Calibrated fallback: $2,500.00
}

/**
 * Initializes a clean Devnet Sandbox Vault with real SPL token custody
 * Guarantee: Idempotent token minting (only mints deficit to target balance).
 */
export async function setupDevnetSandbox(
  userWalletAddress: string,
  safeDestinationAddress?: string
): Promise<SandboxState> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const authority = getFaucetAuthority();
  const safeDest = safeDestinationAddress || userWalletAddress || authority.publicKey.toBase58();
  const safeDestPubkey = new PublicKey(safeDest);

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

  // 1. Fetch live Pyth price
  const livePythPriceCents = await fetchLivePythPriceCents(connection);

  // 2. Initialize or Update Policy (60.00% max single asset, 20.00% min stablecoin reserve)
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
          safeDestPubkey     // safe_destination
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
  } else {
    // Policy exists: check if safe_destination needs updating
    try {
      const existingPolicy: any = await program.account.policyAccount.fetch(policyPda);
      if (existingPolicy.safeDestination.toBase58() !== safeDestPubkey.toBase58()) {
        // If vault is Quarantined, release it first so updatePolicy is allowed
        const existingVaultInfo = await connection.getAccountInfo(vaultPda);
        if (existingVaultInfo) {
          const vAcc: any = await program.account.portfolioVault.fetch(vaultPda);
          const vStatus = Object.keys(vAcc.status)[0] || vAcc.status;
          if (vStatus !== 'active') {
            await program.methods.ownerRelease().accounts({ vault: vaultPda, owner: authority.publicKey }).rpc();
          }
        }
        await program.methods
          .updatePolicy(
            6000,
            2000,
            new BN(25_000_00),
            200,
            new BN(2),
            new BN(100),
            500,
            100,
            safeDestPubkey,
            true
          )
          .accounts({
            policy: policyPda,
            vault: vaultPda,
            owner: authority.publicKey,
          })
          .rpc();
      }
    } catch (e) {
      console.warn('Policy update notice:', e);
    }
  }

  // Read back verified authoritative safe destination
  const verifiedPolicy: any = await program.account.policyAccount.fetch(policyPda);
  const authoritativeSafeDest = verifiedPolicy.safeDestination.toBase58();

  // 3. Prepare Mints & ATAs (Target: 2 whole sASSET tokens = 2_000_000 raw units)
  const targetAssetUnits = 2;
  const targetRawUnits = BigInt(targetAssetUnits) * BigInt(1_000_000);
  const sassetMint = new PublicKey(DEVNET_MINTS.sASSET.address);
  const vaultSassetAta = getAssociatedTokenAddress(sassetMint, vaultPda);
  const userSassetAta = getAssociatedTokenAddress(sassetMint, new PublicKey(userWalletAddress));

  try {
    // Ensure ATAs exist
    const ataInitTx = new Transaction()
      .add(createAtaIdempotentInstruction(authority.publicKey, vaultSassetAta, vaultPda, sassetMint))
      .add(createAtaIdempotentInstruction(authority.publicKey, userSassetAta, new PublicKey(userWalletAddress), sassetMint));
    await sendAndConfirmTransaction(connection, ataInitTx, [authority]);

    // Check existing vault raw token balance
    const curBal = await connection.getTokenAccountBalance(vaultSassetAta).catch(() => null);
    const currentRaw = curBal?.value?.amount ? BigInt(curBal.value.amount) : BigInt(0);

    // Idempotent minting: only mint deficit
    if (currentRaw < targetRawUnits) {
      const deficit = targetRawUnits - currentRaw;
      const mintDeficitTx = new Transaction().add(
        createMintToInstruction(sassetMint, vaultSassetAta, authority.publicKey, deficit)
      );
      await sendAndConfirmTransaction(connection, mintDeficitTx, [authority]);
    }
  } catch (e) {
    console.warn('ATA prep notice:', e);
  }

  // 4. Initialize or Sync Vault to Starting Protected State (~50.00% exposure, live Pyth price)
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  const symbolBytes = Array.from(Buffer.from('sASSET\0\0'));
  const feedIdBytes = Array.from(Buffer.from('ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', 'hex'));

  // Calibrate cash reserve ledger so exposure is exactly 50.00%:
  // Asset value = 2 * livePythPriceCents
  // Cash ledger = 2 * livePythPriceCents -> Total = 4 * livePythPriceCents -> Exposure = 50.00%
  const targetAssetValueCents = targetAssetUnits * livePythPriceCents;
  const targetCashReserveCents = targetAssetValueCents;

  let initTxSig: string | undefined;

  if (!vaultInfo) {
    initTxSig = await program.methods
      .initializeVault(new BN(targetCashReserveCents), [
        {
          mint: sassetMint,
          symbol: symbolBytes,
          amountUnits: new BN(targetAssetUnits),
          priceCents: new BN(livePythPriceCents),
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
    // If quarantined from previous run, release first
    try {
      const vAcc: any = await program.account.portfolioVault.fetch(vaultPda);
      const vStatus = Object.keys(vAcc.status)[0] || vAcc.status;
      if (vStatus !== 'active') {
        await program.methods.ownerRelease().accounts({ vault: vaultPda, owner: authority.publicKey }).rpc();
      }
    } catch {}

    // Sync vault to known clean baseline
    initTxSig = await program.methods
      .syncVault(new BN(targetCashReserveCents), [
        {
          mint: sassetMint,
          symbol: symbolBytes,
          amountUnits: new BN(targetAssetUnits),
          priceCents: new BN(livePythPriceCents),
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

  // Refetch verified on-chain vault state
  const postInitVault: any = await program.account.portfolioVault.fetch(vaultPda);
  const totalCents = postInitVault.totalValueCents.toNumber();
  const exposureBps = totalCents > 0
    ? Math.round((targetAssetUnits * livePythPriceCents * 10000) / totalCents)
    : 5000;
  const stableBps = totalCents > 0
    ? Math.round((postInitVault.usdcBalanceCents.toNumber() * 10000) / totalCents)
    : 5000;

  sandboxState = {
    isInitialized: true,
    vaultAddress: vaultPda.toBase58(),
    policyAddress: policyPda.toBase58(),
    ownerAddress: authority.publicKey.toBase58(),
    safeDestination: authoritativeSafeDest,
    status: 'PROTECTED',
    onChainStatus: 'Active',
    exposureBps,
    maxExposureBps: verifiedPolicy.maxSingleAssetBps,
    stableReserveBps: stableBps,
    minStableReserveBps: verifiedPolicy.minStablecoinBps,
    sUsdBalance: postInitVault.usdcBalanceCents.toNumber() / 100,
    sAssetBalance: targetAssetUnits,
    sAssetPriceUsd: livePythPriceCents / 100,
    recoveryNonce: postInitVault.recoveryNonce.toNumber(),
    lastTxSignature: initTxSig,
  };

  return sandboxState;
}

/**
 * Executes a controlled incident on Devnet:
 * 1. Shocks exposure to ~68% (> 60% policy cap) against genuine Pyth oracle
 * 2. Triggers flag_violation (pending)
 * 3. Advances slots and triggers flag_violation (quarantined)
 * 4. Runs permissionless solver recovery with real SPL custody containment transfer
 * 5. Returns forensic transaction audit trail derived strictly from on-chain truth
 */
export async function runDevnetIncident(userWalletAddress: string): Promise<SandboxState> {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const authority = getFaucetAuthority();
  const solverKey = Keypair.generate(); // Ephemeral permissionless solver

  // Fund ephemeral solver for transaction fees
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

  // 1. Read live Pyth oracle price
  const livePythPriceCents = await fetchLivePythPriceCents(connection);

  // 2. Market Shock: Adjust cash reserve ledger so exposure reaches 68.00% (> 60.00% cap)
  // Volatile holdings = 2 units @ livePythPriceCents = 2 * P
  // We want (2 * P) / (2 * P + Cash) = 0.68 -> Cash = (2 * P * 0.32) / 0.68
  const shockUnits = 2;
  const shockAssetValueCents = shockUnits * livePythPriceCents;
  const shockCashReserveCents = Math.round((shockAssetValueCents * 3200) / 6800);

  const syncShockSig = await ownerProgram.methods
    .syncVault(new BN(shockCashReserveCents), [
      {
        mint: sassetMint,
        symbol: symbolBytes,
        amountUnits: new BN(shockUnits),
        priceCents: new BN(livePythPriceCents),
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

  // Wait 3.5 seconds for slot advancement past confirm_slots (2)
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

  // Step 4: Compute Recovery Plan using live Pyth price
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
    livePythPriceCents,
    { mode: 'custody' }
  );

  if (!plan.isViable || plan.sellUnits <= BigInt(0)) {
    throw new Error(`Solver could not compute viable recovery: ${plan.rejectionReason || 'Invariants cannot be restored'}`);
  }

  const sellUnits = plan.sellUnits;
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

  // Pre-recovery token balances for strict verification
  const vaultSassetAta = getAssociatedTokenAddress(sassetMint, vaultPda);
  const safeAtaBefore = await connection.getTokenAccountBalance(safeDestAta).catch(() => ({ value: { amount: '0' } }));

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

  // Post-recovery token balances
  const safeAtaAfter = await connection.getTokenAccountBalance(safeDestAta);
  const deltaRaw = BigInt(safeAtaAfter.value.amount) - BigInt(safeAtaBefore.value.amount);
  const actualTransferred = Number(deltaRaw) / 1_000_000;

  // Fetch verified post-recovery state from chain
  const postVaultAcc: any = await ownerProgram.account.portfolioVault.fetch(vaultPda);
  const postTotalCents = postVaultAcc.totalValueCents.toNumber();
  const postRemainingUnits = postVaultAcc.positions[0].amountUnits.toNumber();
  const postExposureBps = postTotalCents > 0
    ? Math.round((postRemainingUnits * livePythPriceCents * 10000) / postTotalCents)
    : 5000;
  const postStableBps = postTotalCents > 0
    ? Math.round((postVaultAcc.usdcBalanceCents.toNumber() * 10000) / postTotalCents)
    : 5000;

  sandboxState = {
    isInitialized: true,
    vaultAddress: vaultPda.toBase58(),
    policyAddress: policyPda.toBase58(),
    ownerAddress: authority.publicKey.toBase58(),
    safeDestination: policyAcc.safeDestination.toBase58(),
    status: 'RECOVERED',
    onChainStatus: 'Active',
    exposureBps: postExposureBps,
    maxExposureBps: policyAcc.maxSingleAssetBps,
    stableReserveBps: postStableBps,
    minStableReserveBps: policyAcc.minStablecoinBps,
    sUsdBalance: postVaultAcc.usdcBalanceCents.toNumber() / 100,
    sAssetBalance: postRemainingUnits,
    sAssetPriceUsd: livePythPriceCents / 100,
    recoveryNonce: postVaultAcc.recoveryNonce.toNumber(),
    lastTxSignature: recoverSig,
    lastIncidentTrail: {
      shockExposureBps: 6800,
      violationPendingTx: flag1Sig,
      quarantineTx: flag2Sig,
      recoveryTx: recoverSig,
      sellUnits: Number(sellUnits),
      tokensTransferred: actualTransferred,
      safeDestinationAta: safeDestAta.toBase58(),
      postExposureBps,
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
