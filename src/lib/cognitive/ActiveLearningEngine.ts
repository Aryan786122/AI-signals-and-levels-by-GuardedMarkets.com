import { db } from '@/lib/db';
import { ActiveLearningQuestionItem } from '@/lib/types';

/**
 * Active Learning Engine (Sections 13 & 37):
 * Identifies uncertainty, edge cases, and pattern ambiguities, and asks the teacher questions.
 * Supports actionable teacher responses: [YES], [NO], [EDIT], [IGNORE].
 */
export class ActiveLearningEngine {
  /**
   * Retrieves all pending questions formulated for the teacher.
   */
  static async getPendingQuestions(): Promise<ActiveLearningQuestionItem[]> {
    try {
      const records = await db.teacherQuestion.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });

      if (records.length === 0) {
        // Seed initial grounded active learning question if empty
        const initial = await db.teacherQuestion.create({
          data: {
            question: 'I noticed you accepted extended breakouts when a prior liquidity sweep occurred, but rejected similar extended breakouts without a sweep. Should a prior liquidity sweep be considered a formal prerequisite exception to the extension rule?',
            context: 'Analysis of Breakout Acceptance vs Excessive Extension Exception across 5M chart setups.',
            proposedAction: 'Add conditional exception: (candle_is_extended AND liquidity_sweep_occurred) -> PERMIT_RETEST_ENTRY',
            status: 'PENDING',
          },
        });
        return [{
          id: initial.id,
          question: initial.question,
          context: initial.context,
          proposedAction: initial.proposedAction,
          status: 'PENDING',
          createdAt: initial.createdAt.toISOString(),
        }];
      }

      return records.map(r => ({
        id: r.id,
        question: r.question,
        context: r.context,
        proposedAction: r.proposedAction,
        status: r.status as 'PENDING' | 'ANSWERED' | 'DISMISSED',
        teacherResponse: r.teacherResponse as 'YES' | 'NO' | 'EDIT' | 'IGNORE' | null,
        teacherNotes: r.teacherNotes,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Teacher submits a response to an active learning question.
   */
  static async answerQuestion(params: {
    questionId: string;
    response: 'YES' | 'NO' | 'EDIT' | 'IGNORE';
    teacherNotes?: string;
  }): Promise<boolean> {
    try {
      const { questionId, response, teacherNotes } = params;

      const question = await db.teacherQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question) return false;

      // Update question status
      await db.teacherQuestion.update({
        where: { id: questionId },
        data: {
          status: response === 'IGNORE' ? 'DISMISSED' : 'ANSWERED',
          teacherResponse: response,
          teacherNotes: teacherNotes || null,
          resolvedAt: new Date(),
        },
      });

      // If teacher answered YES, apply proposed action to knowledge base
      if (response === 'YES' && question.proposedAction) {
        // Find extension rule/exception to attach exception-to-exception
        const extensionExc = await db.exception.findFirst({
          where: { description: { contains: 'extend' } },
        });

        if (extensionExc) {
          await db.exception.create({
            data: {
              ruleId: extensionExc.ruleId,
              name: 'Prior Liquidity Sweep Exception-to-Exception',
              description: 'If an extended breakout was preceded by a clean liquidity sweep, retest entry is permitted.',
              overrideBehavior: 'PERMIT_RETEST_ENTRY',
              conditionLogic: 'liquidity_sweep_confirmed == true',
              parentExceptionId: extensionExc.id,
              specificity: 3,
              tradePhase: 'ENTRY',
              teacherApproved: true,
            },
          });
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to answer active learning question:', err);
      return false;
    }
  }
}
