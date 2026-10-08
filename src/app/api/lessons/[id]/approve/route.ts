import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { approvedData, candidateKnowledge, teacherNotes } = body;

    const lesson = await db.lesson.findUnique({ where: { id: params.id } });
    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Call CanonicalBrainService to promote claims, concepts, rules, state sequences, and auto-generate questions
    const promotionResult = await CanonicalBrainService.approveLessonAndPromote({
      lessonId: params.id,
      candidateKnowledge: candidateKnowledge || approvedData,
      teacherNotes,
    });

    return NextResponse.json({
      success: true,
      message: `Lesson approved and promoted to Canonical Brain ${promotionResult.versionTag}.`,
      version: promotionResult.version,
      versionTag: promotionResult.versionTag,
      approvedClaimsCount: promotionResult.approvedClaimsCount,
      questionsGeneratedCount: promotionResult.questionsGeneratedCount,
      scenariosCreatedCount: promotionResult.scenariosCreatedCount,
    });
  } catch (error) {
    console.error('[Lesson Approval] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    );
  }
}
