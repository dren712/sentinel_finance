import { NextRequest, NextResponse } from 'next/server';
import { setupDevnetSandbox } from '@/lib/devnet-sandbox';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { wallet, safeDestination } = body;

    const targetWallet = wallet && typeof wallet === 'string' ? wallet : '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y';
    const state = await setupDevnetSandbox(targetWallet, safeDestination);

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
