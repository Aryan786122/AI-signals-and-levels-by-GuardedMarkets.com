import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const events = await db.teachingEvent.findMany({
      where: { lessonId: params.id },
      orderBy: { timestampSec: 'asc' },
    });

    const parsedEvents = events.map(e => ({
      ...e,
      visualState: e.visualState ? JSON.parse(e.visualState) : null,
      cursorState: e.cursorState ? JSON.parse(e.cursorState) : null,
      annotationState: e.annotationState ? JSON.parse(e.annotationState) : null,
      detectedMarketObjects: e.detectedMarketObjects ? JSON.parse(e.detectedMarketObjects) : [],
      conceptsReferenced: e.conceptsReferenced ? JSON.parse(e.conceptsReferenced) : [],
    }));

    return NextResponse.json({ success: true, events: parsedEvents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
