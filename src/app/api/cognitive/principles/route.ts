import { NextRequest, NextResponse } from 'next/server';
import { AbstractionEngine } from '@/lib/cognitive/AbstractionEngine';

export async function GET() {
  try {
    const principles = await AbstractionEngine.proposeGeneralizations();
    return NextResponse.json({ success: true, principles });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve principles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { principleId, action, teacherNotes } = body;

    if (!principleId || !action || (action !== 'APPROVED' && action !== 'REJECTED')) {
      return NextResponse.json(
        { error: 'principleId and action (APPROVED|REJECTED) are required' },
        { status: 400 }
      );
    }

    const success = await AbstractionEngine.reviewPrinciple(
      principleId,
      action,
      teacherNotes
    );

    if (!success) {
      return NextResponse.json({ error: 'Principle not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('Failed to review principle:', error);
    return NextResponse.json(
      { error: 'Failed to process principle review' },
      { status: 500 }
    );
  }
}
