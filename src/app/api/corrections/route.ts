import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AIProviderFactory } from '@/lib/providers/ai';
import { CorrectionType } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const corrections = await db.correction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { concept: true },
      take: 50,
    });
    return NextResponse.json({ corrections });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      previousAiDecision,
      correctedDecision,
      explanation,
      correctionType,
      conceptName,
      ruleId,
      lessonId,
    } = body as {
      previousAiDecision: string;
      correctedDecision: string;
      explanation: string;
      correctionType: CorrectionType;
      conceptName?: string;
      ruleId?: string;
      lessonId?: string;
    };

    if (!explanation) {
      return NextResponse.json({ error: 'Teacher explanation is required' }, { status: 400 });
    }

    // Extract structured pedagogical components (Section 18)
    let condition = 'Contextual condition specified by teacher';
    let action = correctedDecision;
    let alternative = 'Wait for confirmation';
    let reason = explanation;

    // Simple heuristic parser if offline or use AI provider
    const expLower = explanation.toLowerCase();
    if (expLower.includes('too extended') || expLower.includes('extension')) {
      condition = 'Excessive candle extension';
      action = 'Do not enter immediately';
      alternative = 'Wait for retest of broken structure';
      reason = 'Entry and Stop Loss unfavorable';
    } else if (expLower.includes('wick') || expLower.includes('body')) {
      condition = 'Candle body closed below boundary';
      action = 'Invalidate breakout';
      alternative = 'Observe for true close';
      reason = 'Wick rejection does not qualify as acceptance';
    } else if (expLower.includes('sweep') || expLower.includes('liquidity')) {
      condition = 'Liquidity swept without acceptance';
      action = 'Look for reversal or sweep confirmation';
      alternative = 'Avoid continuation entry';
      reason = 'Liquidity run rather than sustained momentum';
    }

    // Connect or find concept
    let resolvedConceptId: string | null = null;
    if (conceptName) {
      const slug = conceptName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const concept = await db.concept.findUnique({ where: { slug } });
      if (concept) resolvedConceptId = concept.id;
    }

    const correction = await db.correction.create({
      data: {
        previousAiDecision: previousAiDecision || 'UNKNOWN',
        correctedDecision: correctedDecision || 'WAIT',
        explanation,
        correctionType: correctionType || 'WRONG_SETUP',
        conceptName: conceptName || 'General Methodology',
        condition,
        action,
        alternative,
        reason,
        ruleId,
        lessonId,
        conceptId: resolvedConceptId,
      },
    });

    // If ruleId provided, update evidence count or attach note
    if (ruleId) {
      await db.rule.update({
        where: { id: ruleId },
        data: { evidenceCount: { increment: 1 } },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      correction,
      structuredData: {
        concept: conceptName || 'General',
        condition,
        action,
        alternative,
        reason,
      },
    });
  } catch (error) {
    console.error('Failed to save correction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Correction creation failed' },
      { status: 500 }
    );
  }
}
