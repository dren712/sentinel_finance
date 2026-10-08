import { NextRequest, NextResponse } from 'next/server';
import { requestSolAirdrop } from '@/lib/faucet-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, amount = 1 } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid wallet address is required.' }, { status: 400 });
    }

    const result = await requestSolAirdrop(wallet, amount);
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
