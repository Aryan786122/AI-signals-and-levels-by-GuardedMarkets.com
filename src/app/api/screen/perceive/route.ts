import { NextRequest, NextResponse } from 'next/server';
import { ScreenPerceptionEngine } from '@/lib/services/screenPerceptionEngine';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { imageBase64, manualContext } = body;

    // 1. Perceive screen facts from image or provided context
    const observation = await ScreenPerceptionEngine.perceiveFrame({
      imageBase64,
      manualContext,
    });

    // 2. Reason over observed screen context using Canonical Brain
    const reasoning = await CanonicalBrainService.reasonOverScreen(observation);

    return NextResponse.json({
      success: true,
      observation,
      reasoning,
    });
  } catch (error: any) {
    console.error('[API /screen/perceive] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Screen perception reasoning failed',
      },
      { status: 500 }
    );
  }
}
