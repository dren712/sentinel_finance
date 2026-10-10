import { NextRequest, NextResponse } from 'next/server';
import { runDevnetIncident } from '@/lib/devnet-sandbox';
import { checkRateLimit, getClientIdentifier, isValidSolanaAddress } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 5 requests / minute
    const clientId = getClientIdentifier(req, 'devnet:incident');
    const rateCheck = checkRateLimit(clientId, { limit: 5, windowMs: 60_000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before executing incident.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { wallet, simulationMode } = body;

    if (wallet && typeof wallet === 'string' && !isValidSolanaAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address provided.' },
        { status: 400 }
      );
    }

    const targetWallet = wallet && typeof wallet === 'string' ? wallet : '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y';
    const state = await runDevnetIncident(targetWallet, {
      simulationMode: Boolean(simulationMode),
    });

    return NextResponse.json({
      success: true,
      sandbox: state,
      message: 'Controlled incident executed: Shock → Quarantine → Solver → Real Custody Containment Transfer → Vault Reactivated!',
    });
  } catch (err: any) {
    console.error('API /api/devnet/incident error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to execute incident.' },
      { status: 500 }
    );
  }
}
