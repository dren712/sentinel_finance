import { NextRequest, NextResponse } from 'next/server';
import { resetDevnetSandbox } from '@/lib/devnet-sandbox';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { wallet } = body;

    const targetWallet = wallet && typeof wallet === 'string' ? wallet : '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y';
    const state = await resetDevnetSandbox(targetWallet);

    return NextResponse.json({
      success: true,
      sandbox: state,
      message: 'Devnet scenario successfully reset to clean protected state.',
    });
  } catch (err: any) {
    console.error('API /api/devnet/reset error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to reset devnet scenario.' },
      { status: 500 }
    );
  }
}
