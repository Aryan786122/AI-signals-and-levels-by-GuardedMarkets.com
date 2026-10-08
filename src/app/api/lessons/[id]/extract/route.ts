import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProcessingJobManager } from '@/lib/services/processingJob';
import { TeachingIngestionService } from '@/lib/services/teachingIngestion';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const lesson = await db.lesson.findUnique({
      where: { id },
      include: {
        assets: true,
        transcripts: {
          include: { segments: { orderBy: { startTimeSec: 'asc' } } },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sync = searchParams.get('sync') === 'true';

    if (sync) {
      // Synchronous execution for immediate return
      const candidateKnowledge = await TeachingIngestionService.executeFullPipeline(id);
      const updatedLesson = await db.lesson.findUnique({
        where: { id },
        include: {
          assets: true,
          transcripts: { include: { segments: { orderBy: { startTimeSec: 'asc' } } } },
          teachingEvents: { orderBy: { timestampSec: 'asc' } },
        },
      });

      return NextResponse.json({
        success: true,
        lesson: updatedLesson,
        candidateKnowledge,
      });
    }

    // Start background processing job
    ProcessingJobManager.startProcessing(id);

    return NextResponse.json({
      success: true,
      message: 'Processing job started in background',
      lessonId: id,
      processingStage: 'EXTRACTING_AUDIO',
      processingProgress: 10,
    });
  } catch (error) {
    console.error('[Extract Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI extraction failed' },
      { status: 500 }
    );
  }
}
