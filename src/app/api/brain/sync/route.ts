import { NextResponse } from 'next/server';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function GET() {
  try {
    const snapshot = await CanonicalBrainService.getBrainSnapshot();
    return NextResponse.json({
      version: snapshot.version,
      versionTag: snapshot.versionTag,
      lastUpdated: snapshot.lastUpdated,
      isSynced: true,
      itemCounts: snapshot.itemCounts,
    });
  } catch (error) {
    console.error('Failed to get brain sync status:', error);
    return NextResponse.json({ error: 'Failed to get brain sync status' }, { status: 500 });
  }
}
