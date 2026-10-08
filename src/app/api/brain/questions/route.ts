import { NextRequest, NextResponse } from 'next/server';
import { AdaptiveQuestionEngine } from '@/lib/services/adaptiveQuestionEngine';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const questions = await AdaptiveQuestionEngine.getPrioritizedQuestions(limit);
    const snapshot = await CanonicalBrainService.getBrainSnapshot();

    return NextResponse.json({
      questions,
      mastery: snapshot.mastery,
      versionTag: snapshot.versionTag,
    });
  } catch (error) {
    console.error('Failed to get adaptive questions:', error);
    return NextResponse.json({ error: 'Failed to get adaptive questions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId, selectedIndex, teacherCorrection } = body;

    if (!questionId || selectedIndex === undefined) {
      return NextResponse.json({ error: 'questionId and selectedIndex are required' }, { status: 400 });
    }

    const result = await AdaptiveQuestionEngine.evaluateAnswer({
      questionId,
      selectedIndex: Number(selectedIndex),
      teacherCorrection,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Failed to evaluate question answer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Evaluation failed' },
      { status: 500 }
    );
  }
}
