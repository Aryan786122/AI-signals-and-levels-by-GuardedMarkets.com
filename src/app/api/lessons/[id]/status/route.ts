import { NextRequest, NextResponse } from 'next/server';
import { ProcessingJobManager } from '@/lib/services/processingJob';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const status = await ProcessingJobManager.getStatus(id);

    if (!status) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Also fetch candidate knowledge counts if completed
    let candidateCounts = {
      rules: 0,
      exceptions: 0,
      events: 0,
    };

    if (status.stage === 'REVIEW_READY') {
      const counts = await db.lesson.findUnique({
        where: { id },
        select: {
          _count: {
            select: {
              rules: true,
              teachingEvents: true,
              videoFrames: true,
            },
          },
        },
      });
      if (counts) {
        candidateCounts = {
          rules: counts._count.rules,
          exceptions: 0,
          events: counts._count.teachingEvents,
        };
      }
    }

    return NextResponse.json({
      success: true,
      ...status,
      candidateCounts,
    });
  } catch (error) {
    console.error('[Status Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
