import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { KnowledgeEngine } from '@/lib/knowledge/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { action, notes, customRelation } = body as {
      action: 'ACCEPT_EXCEPTION' | 'MARK_SUPERSEDING' | 'KEEP_SEPARATE' | 'MERGE' | 'EDIT_RELATIONSHIP';
      notes?: string;
      customRelation?: string;
    };

    const conflict = await db.knowledgeConflict.findUnique({
      where: { id: params.id },
      include: {
        ruleA: true,
        ruleB: true,
      },
    });

    if (!conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    if (action === 'ACCEPT_EXCEPTION') {
      // Add Rule B as an explicit exception to Rule A
      await KnowledgeEngine.addExceptionToRule(conflict.ruleAId, {
        name: `Exception from ${conflict.ruleB.title}`,
        description: conflict.ruleB.statement,
        overrideBehavior: 'AVOID_IMMEDIATE_ENTRY',
        conditionLogic: 'Contextual filter applied by teacher',
        exampleContext: notes,
        specificity: (conflict.ruleA.specificity || 1) + 1,
      });

      await db.knowledgeConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          teacherStatus: 'RESOLVED',
          resolutionNotes: notes || 'Resolved as contextual exception to Rule A',
          resolvedAt: new Date(),
        },
      });
    } else if (action === 'MARK_SUPERSEDING') {
      // Supersede Rule A with Rule B
      await KnowledgeEngine.supersedeRule(
        conflict.ruleAId,
        conflict.ruleBId,
        notes || 'Superseded by newer teacher instruction'
      );

      await db.knowledgeConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          teacherStatus: 'RESOLVED',
          resolutionNotes: notes || 'Rule B marked as newer superseding rule',
          resolvedAt: new Date(),
        },
      });
    } else if (action === 'MERGE') {
      // Merge: Update Rule A statement with synthesis and mark Rule B superseded
      await db.rule.update({
        where: { id: conflict.ruleAId },
        data: {
          statement: `${conflict.ruleA.statement} [Merged condition: ${conflict.ruleB.statement}]`,
          version: conflict.ruleA.version + 1,
        },
      });
      await KnowledgeEngine.supersedeRule(
        conflict.ruleBId,
        conflict.ruleAId,
        notes || 'Merged into Rule A'
      );

      await db.knowledgeConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          teacherStatus: 'RESOLVED',
          resolutionNotes: notes || 'Rules merged into unified rule definition',
          resolvedAt: new Date(),
        },
      });
    } else if (action === 'EDIT_RELATIONSHIP') {
      await db.knowledgeConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          teacherStatus: 'RESOLVED',
          possibleRelationships: JSON.stringify([customRelation || 'CONDITIONED_BY']),
          resolutionNotes: notes || `Custom relationship established: ${customRelation || 'CONDITIONED_BY'}`,
          resolvedAt: new Date(),
        },
      });
    } else if (action === 'KEEP_SEPARATE') {
      await db.knowledgeConflict.update({
        where: { id: conflict.id },
        data: {
          status: 'RESOLVED',
          teacherStatus: 'RESOLVED',
          resolutionNotes: notes || 'Kept separate as distinct contextual setups',
          resolvedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Conflict successfully resolved via action: ${action}`,
    });
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Resolution failed' },
      { status: 500 }
    );
  }
}
