import { NextRequest, NextResponse } from 'next/server';
import { requestSolAirdrop } from '@/lib/faucet-service';
import { checkRateLimit, getClientIdentifier, isValidSolanaAddress } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const clientId = getClientIdentifier(req, 'devnet:airdrop');
    const rateCheck = checkRateLimit(clientId, { limit: 5, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before requesting SOL.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { wallet, amount = 1 } = body;

    if (!wallet || !isValidSolanaAddress(wallet)) {
      return NextResponse.json({ success: false, error: 'Valid Solana wallet address is required.' }, { status: 400 });
    }

    const boundedAmount = Math.min(2, Math.max(1, Number(amount) || 1));
    const result = await requestSolAirdrop(wallet, boundedAmount);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/devnet/airdrop error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to request Devnet SOL',
        faucetUrl: 'https://faucet.solana.com',
      },
      { status: 500 }
    );
  }
}
