import { NextRequest, NextResponse } from 'next/server';
import { getUserBalances } from '@/lib/faucet-service';
import { getSandboxState } from '@/lib/devnet-sandbox';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet address required' }, { status: 400 });
    }

    const balances = await getUserBalances(wallet);
    const sandbox = getSandboxState();

    return NextResponse.json({
      success: true,
      wallet,
      balances,
      sandbox,
    });
  } catch (err: any) {
    console.error('API /api/devnet/balances error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch balances.' },
      { status: 500 }
    );
  }
}
