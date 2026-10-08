import { NextRequest, NextResponse } from 'next/server';
import { ActiveLearningEngine } from '@/lib/cognitive/ActiveLearningEngine';

export async function GET() {
  try {
    const questions = await ActiveLearningEngine.getPendingQuestions();
    return NextResponse.json({ success: true, questions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch active learning questions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId, response, teacherNotes } = body;

    if (!questionId || !response) {
      return NextResponse.json(
        { error: 'questionId and response (YES|NO|EDIT|IGNORE) are required' },
        { status: 400 }
      );
    }

    const success = await ActiveLearningEngine.answerQuestion({
      questionId,
      response,
      teacherNotes,
    });

    if (!success) {
      return NextResponse.json({ error: 'Question not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error('Failed to answer active learning question:', error);
    return NextResponse.json(
      { error: 'Failed to process answer' },
      { status: 500 }
    );
  }
}
