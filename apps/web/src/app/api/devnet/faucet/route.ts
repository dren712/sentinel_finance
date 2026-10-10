import { NextRequest, NextResponse } from 'next/server';
import { mintTestTokens, DEVNET_MINTS } from '@/lib/faucet-service';
import { checkRateLimit, getClientIdentifier, isValidSolanaAddress } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const clientId = getClientIdentifier(req, 'devnet:faucet');
    const rateCheck = checkRateLimit(clientId, { limit: 10, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before minting test tokens.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { wallet, asset, amount } = body;

    if (!wallet || !isValidSolanaAddress(wallet)) {
      return NextResponse.json({ success: false, error: 'Valid Solana wallet address is required.' }, { status: 400 });
    }

    if (!asset || (asset !== 'sUSD' && asset !== 'sASSET')) {
      return NextResponse.json(
        { success: false, error: 'Invalid asset. Must be sUSD or sASSET.' },
        { status: 400 }
      );
    }

    const maxAllowed = asset === 'sUSD' ? 50_000 : 500;
    const defaultAmount = asset === 'sUSD' ? 10_000 : 100;
    const mintAmount = typeof amount === 'number' && amount > 0 ? Math.min(amount, maxAllowed) : defaultAmount;

    const result = await mintTestTokens(wallet, asset, mintAmount);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/devnet/faucet error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to mint test tokens.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mints: DEVNET_MINTS,
    notice: 'Devnet SPL test assets for Sentinel CWF demonstrations only. No real-world monetary value.',
  });
}
