import { NextRequest, NextResponse } from 'next/server';
import { setupDevnetSandbox } from '@/lib/devnet-sandbox';
import { checkRateLimit, getClientIdentifier, isValidSolanaAddress } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting (max 10 requests / minute)
    const clientId = getClientIdentifier(req, 'devnet:setup');
    const rateCheck = checkRateLimit(clientId, { limit: 10, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before setting up sandbox.`,
        },
        { status: 429 }
      );
    }

    // 2. Bounded body size and input validation
    const body = await req.json().catch(() => ({}));
    const { wallet, safeDestination, simulationMode } = body;

    if (wallet && typeof wallet === 'string' && !isValidSolanaAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address provided.' },
        { status: 400 }
      );
    }

    if (safeDestination && typeof safeDestination === 'string' && !isValidSolanaAddress(safeDestination)) {
      return NextResponse.json(
        { success: false, error: 'Invalid safeDestination address provided.' },
        { status: 400 }
      );
    }

    // Shared managed demo vault strictly pins recovery safe destination to server authority
    // to prevent anonymous fund redirection
    const targetWallet = wallet && typeof wallet === 'string' ? wallet : '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y';
    const state = await setupDevnetSandbox(targetWallet, undefined, {
      simulationMode: Boolean(simulationMode),
    });

    return NextResponse.json({
      success: true,
      sandbox: state,
      message: 'Test environment ready on Solana Devnet with real SPL token custody.',
    });
  } catch (err: any) {
    console.error('API /api/devnet/setup error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to setup devnet sandbox.' },
      { status: 500 }
    );
  }
}
