import { NextRequest, NextResponse } from 'next/server';
import { mintTestTokens, DEVNET_MINTS } from '@/lib/faucet-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, asset, amount } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ success: false, error: 'Valid wallet address is required.' }, { status: 400 });
    }

    if (!asset || (asset !== 'sUSD' && asset !== 'sASSET')) {
      return NextResponse.json(
        { success: false, error: 'Invalid asset. Must be sUSD or sASSET.' },
        { status: 400 }
      );
    }

    const defaultAmount = asset === 'sUSD' ? 10_000 : 100;
    const mintAmount = typeof amount === 'number' && amount > 0 ? amount : defaultAmount;

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
