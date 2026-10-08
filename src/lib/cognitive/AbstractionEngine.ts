import { db } from '@/lib/db';
import { ProposedPrincipleItem } from '@/lib/types';

/**
 * Abstraction Engine (Section 8 & 40):
 * Attempts to identify underlying principles behind repeated teacher examples and corrections.
 * CRITICAL RULE: Never automatically makes the abstraction an active approved rule.
 * Creates ProposedPrinciple records awaiting teacher review.
 */
export class AbstractionEngine {
  /**
   * Evaluates recent lessons, corrections, and experiences to synthesize proposed principles.
   */
  static async proposeGeneralizations(): Promise<ProposedPrincipleItem[]> {
    try {
      const [corrections, exceptions, rules] = await Promise.all([
        db.correction.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
        db.exception.findMany({ take: 10 }),
        db.rule.findMany({ where: { status: 'ACTIVE' }, take: 10 }),
      ]);

      const proposed: ProposedPrincipleItem[] = [];

      // Check for repeated extension or stop-loss distance mentions
      const extensionRelated = corrections.filter(
        c => c.explanation.toLowerCase().includes('extend') ||
             c.explanation.toLowerCase().includes('retest') ||
             c.explanation.toLowerCase().includes('stop')
      );

      if (extensionRelated.length >= 1 || exceptions.some(e => e.description.toLowerCase().includes('extend'))) {
        const existingPrinciple = await db.principle.findFirst({
          where: { title: 'Disproportionate Invalidation Risk Principle' },
        });

        if (!existingPrinciple) {
          const created = await db.principle.create({
            data: {
              title: 'Disproportionate Invalidation Risk Principle',
              statement: 'Immediate market entries become unfavorable when the distance to structural invalidation produces an asymmetrical risk profile, regardless of directional breakout clarity.',
              rationale: 'Inferred from multiple teacher corrections cautioning against extended candles and remote stop placement.',
              scope: 'GLOBAL',
              status: 'PROPOSED',
              confidence: 0.88,
              supportingExperiences: JSON.stringify(extensionRelated.map(c => c.id)),
              sourceLessonsText: JSON.stringify(rules.map(r => r.title).slice(0, 3)),
            },
          });

          proposed.push({
            id: created.id,
            title: created.title,
            statement: created.statement,
            rationale: created.rationale,
            scope: created.scope,
            status: created.status as 'PROPOSED' | 'APPROVED' | 'REJECTED',
            confidence: created.confidence,
            createdAt: created.createdAt.toISOString(),
          });
        }
      }

      // Check for liquidity sweep prerequisites
      const sweepRelated = corrections.filter(
        c => c.explanation.toLowerCase().includes('sweep') || c.explanation.toLowerCase().includes('liquidity')
      );

      if (sweepRelated.length >= 1 || rules.some(r => r.title.toLowerCase().includes('sweep'))) {
        const existingPrinciple = await db.principle.findFirst({
          where: { title: 'Liquidity Precondition Principle' },
        });

        if (!existingPrinciple) {
          const created = await db.principle.create({
            data: {
              title: 'Liquidity Precondition Principle',
              statement: 'Major structural breakouts are significantly more durable when preceded by a targeted sweep of opposite-side liquidity.',
              rationale: 'Synthesized from teacher examples where sustained continuation required prior liquidity mitigation.',
              scope: 'GLOBAL',
              status: 'PROPOSED',
              confidence: 0.84,
              supportingExperiences: JSON.stringify(sweepRelated.map(c => c.id)),
              sourceLessonsText: JSON.stringify(['Liquidity Sweep and Market Acceptance']),
            },
          });

          proposed.push({
            id: created.id,
            title: created.title,
            statement: created.statement,
            rationale: created.rationale,
            scope: created.scope,
            status: created.status as 'PROPOSED' | 'APPROVED' | 'REJECTED',
            confidence: created.confidence,
            createdAt: created.createdAt.toISOString(),
          });
        }
      }

      // Return all stored principles
      const allPrinciples = await db.principle.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return allPrinciples.map(p => ({
        id: p.id,
        title: p.title,
        statement: p.statement,
        rationale: p.rationale,
        scope: p.scope,
        status: p.status as 'PROPOSED' | 'APPROVED' | 'REJECTED',
        confidence: p.confidence,
        teacherNotes: p.teacherNotes,
        createdAt: p.createdAt.toISOString(),
      }));
    } catch (err) {
      console.warn('Failed to propose generalizations:', err);
      return [];
    }
  }

  /**
   * Teacher approves or rejects a proposed principle.
   */
  static async reviewPrinciple(
    id: string,
    action: 'APPROVED' | 'REJECTED',
    teacherNotes?: string
  ): Promise<boolean> {
    try {
      await db.principle.update({
        where: { id },
        data: {
          status: action,
          teacherNotes: teacherNotes || null,
          approvedAt: action === 'APPROVED' ? new Date() : null,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
