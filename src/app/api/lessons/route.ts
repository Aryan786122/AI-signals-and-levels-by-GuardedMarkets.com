import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const lessons = await db.lesson.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
          },
        },
        examples: true,
        counterExamples: true,
      },
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error('Failed to list lessons:', error);
    return NextResponse.json({ error: 'Failed to list lessons' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, transcriptText } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const lesson = await db.lesson.create({
      data: {
        title,
        description: description || '',
        status: transcriptText ? 'EXTRACTED' : 'DRAFT',
        transcripts: transcriptText
          ? {
              create: [
                {
                  fullText: transcriptText,
                  language: 'en',
                  provider: 'direct_input',
                  segments: {
                    create: [
                      {
                        startTimeSec: 0,
                        endTimeSec: 30,
                        text: transcriptText,
                        confidence: 1.0,
                      },
                    ],
                  },
                },
              ],
            }
          : undefined,
      },
      include: {
        transcripts: {
          include: { segments: true },
        },
        rules: true,
      },
    });

    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    console.error('Failed to create lesson:', error);
    return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 });
  }
}
