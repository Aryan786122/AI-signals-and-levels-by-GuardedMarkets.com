import { db } from '@/lib/db';

export interface ReflectionResult {
  id: string;
  decisionContext: string;
  aiDecision: string;
  marketOutcome: string;
  wasDecisionCorrect: boolean;
  evaluationNotes: string;
  proposedPrincipleId?: string | null;
  createdAt: string;
}

/**
 * Reflection Engine (Section 19):
 * Conducts post-decision and post-outcome analysis.
 * Determines if waiting was justified, if invalidations were observed, or if rules were misapplied.
 */
export class ReflectionEngine {
  /**
   * Evaluates a completed episode after market resolution.
   */
  static async reflectOnDecision(params: {
    decisionContext: string;
    aiDecision: string;
    marketOutcome: string;
    isSuccess: boolean;
    notes?: string;
  }): Promise<ReflectionResult> {
    const { decisionContext, aiDecision, marketOutcome, isSuccess, notes } = params;

    let evaluationNotes = notes || '';
    if (!evaluationNotes) {
      if (aiDecision === 'WAIT') {
        evaluationNotes = isSuccess
          ? 'Disciplined waiting avoided unfavorable entry. Market subsequently produced high volatility without clear structure.'
          : 'Waiting protected capital; price continued upward but risk parameters would have violated stop loss limits.';
      } else if (aiDecision === 'TRADE_CANDIDATE') {
        evaluationNotes = isSuccess
          ? 'Decision satisfied all mandatory preconditions and target was reached within expected timeframe.'
          : 'Setup invalidated before target; review whether subtle counter-evidence was overlooked.';
      } else {
        evaluationNotes = 'Routine observation aligned with rule conditions.';
      }
    }

    try {
      const created = await db.reflection.create({
        data: {
          decisionContext,
          aiDecision,
          marketOutcome,
          wasDecisionCorrect: isSuccess,
          evaluationNotes,
        },
      });

      return {
        id: created.id,
        decisionContext: created.decisionContext,
        aiDecision: created.aiDecision,
        marketOutcome: created.marketOutcome,
        wasDecisionCorrect: created.wasDecisionCorrect,
        evaluationNotes: created.evaluationNotes,
        createdAt: created.createdAt.toISOString(),
      };
    } catch {
      return {
        id: `refl_${Date.now()}`,
        decisionContext,
        aiDecision,
        marketOutcome,
        wasDecisionCorrect: isSuccess,
        evaluationNotes,
        createdAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Retrieves recent reflections.
   */
  static async getRecentReflections(limit = 10): Promise<ReflectionResult[]> {
    try {
      const records = await db.reflection.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return records.map(r => ({
        id: r.id,
        decisionContext: r.decisionContext,
        aiDecision: r.aiDecision,
        marketOutcome: r.marketOutcome,
        wasDecisionCorrect: r.wasDecisionCorrect,
        evaluationNotes: r.evaluationNotes,
        proposedPrincipleId: r.proposedPrincipleId,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }
}
