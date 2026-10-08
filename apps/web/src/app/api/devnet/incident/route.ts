import { NextRequest, NextResponse } from 'next/server';
import { runDevnetIncident } from '@/lib/devnet-sandbox';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { wallet } = body;

    const targetWallet = wallet && typeof wallet === 'string' ? wallet : '7TffMKzUgVme4eod8Wh9ANAQ3YrRMzj4c2JrfKm6AY4Y';
    const state = await runDevnetIncident(targetWallet);

    return NextResponse.json({
      success: true,
      sandbox: state,
      message: 'Controlled incident executed on Devnet: Shock → Quarantine → Solver → Real Custody Transfer → Restored to Active!',
    });
  } catch (err: any) {
    console.error('API /api/devnet/incident error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to execute incident.' },
      { status: 500 }
    );
  }
}
