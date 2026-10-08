import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lesson = await db.lesson.findUnique({
      where: { id: params.id },
      include: {
        assets: true,
        transcripts: {
          include: {
            segments: {
              orderBy: { startTimeSec: 'asc' },
            },
          },
        },
        rules: {
          include: {
            conditions: true,
            exceptions: true,
            concept: true,
          },
        },
        examples: true,
        counterExamples: true,
        corrections: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error('Failed to get lesson:', error);
    return NextResponse.json({ error: 'Failed to get lesson' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const lesson = await db.lesson.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        teacherNotes: body.teacherNotes,
        status: body.status,
      },
    });

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    console.error('Failed to update lesson:', error);
    return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.lesson.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete lesson:', error);
    return NextResponse.json({ error: 'Failed to delete lesson' }, { status: 500 });
  }
}
