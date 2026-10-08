import { NextRequest, NextResponse } from 'next/server';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'XAUUSD';
    const snapshot = await CanonicalBrainService.getBrainSnapshot();

    return NextResponse.json({
      levels: snapshot.learnedLevels,
      mastery: snapshot.mastery,
      versionTag: snapshot.versionTag,
      symbol,
    });
  } catch (error) {
    console.error('Failed to get learned levels:', error);
    return NextResponse.json({ error: 'Failed to get learned levels' }, { status: 500 });
  }
}
