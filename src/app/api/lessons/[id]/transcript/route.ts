import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const transcript = await db.transcript.findFirst({
      where: { lessonId: id },
      include: {
        segments: {
          orderBy: { startTimeSec: 'asc' },
        },
      },
    });

    if (!transcript) {
      return NextResponse.json({
        success: true,
        fullText: '',
        segments: [],
      });
    }

    return NextResponse.json({
      success: true,
      fullText: transcript.fullText,
      language: transcript.language,
      provider: transcript.provider,
      segments: transcript.segments.map(s => ({
        id: s.id,
        startTimeSec: s.startTimeSec,
        endTimeSec: s.endTimeSec,
        text: s.text,
        confidence: s.confidence,
        speaker: s.speaker,
      })),
    });
  } catch (error) {
    console.error('[Transcript Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
