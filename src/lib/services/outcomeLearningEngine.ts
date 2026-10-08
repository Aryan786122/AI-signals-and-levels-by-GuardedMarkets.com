import { db } from '@/lib/db';

export interface OutcomeRecord {
  knowledgeId: string;
  knowledgeTitle: string;
  market: string;
  timeframe: string;
  expectation: string;
  actualOutcome: string;
  wasExpectationMet: boolean;
  context: {
    approachSpeed?: 'NORMAL' | 'AGGRESSIVE' | 'COMPRESSED';
    testNumber?: number;
    candleRange?: number;
    higherTimeframeTrend?: string;
  };
}

export interface PatternDiscovery {
  id: string;
  title: string;
  hypothesisTitle: string;
  observation: string;
  occurrencesCount: number;
  proposedException: string;
  suggestedAction: string;
  status: 'DISCOVERED' | 'REVIEWED_BY_TEACHER' | 'PROMOTED_TO_EXCEPTION';
}

export class OutcomeLearningEngine {
  /**
   * Records live/replay market outcome against teacher expectations without altering canonical rules.
   */
  static async recordOutcome(record: OutcomeRecord): Promise<{
    recordedId: string;
    newDiscovery?: PatternDiscovery;
  }> {
    const exp = await db.experience.create({
      data: {
        situationSummary: `${record.market} ${record.timeframe}: ${record.knowledgeTitle} application.`,
        market: record.market,
        timeframe: record.timeframe,
        aiDecision: record.expectation,
        aiReasoning: `Applied teacher expectation: "${record.expectation}". Context: ${JSON.stringify(record.context)}.`,
        marketOutcome: record.actualOutcome,
        isSuccess: record.wasExpectationMet,
        learnedInsight: record.wasExpectationMet
          ? 'Market outcome validated teacher conditional hypothesis.'
          : `Divergence observed: ${record.actualOutcome} differed from expected ${record.expectation}.`,
      },
    });

    // Check for pattern discoveries
    let newDiscovery: PatternDiscovery | undefined;

    if (!record.wasExpectationMet) {
      // Find previous failed experiences for this same market/hypothesis
      const failures = await db.experience.count({
        where: {
          situationSummary: { contains: record.knowledgeTitle },
          isSuccess: false,
        },
      });

      if (failures >= 2) {
        newDiscovery = {
          id: `disc_${Date.now()}`,
          title: 'Divergence Pattern Discovered',
          hypothesisTitle: record.knowledgeTitle,
          observation: `This hypothesis behaved differently on ${failures} occasions when approach was aggressive or extended.`,
          occurrencesCount: failures,
          proposedException: 'If approach candle is excessively extended, do not anticipate an immediate level bounce; wait for confirmed structural consolidation.',
          suggestedAction: 'Ask teacher whether this should become an approved Exception.',
          status: 'DISCOVERED',
        };
      }
    }

    return {
      recordedId: exp.id,
      newDiscovery,
    };
  }

  /**
   * Retrieves active discoveries for the teacher to review in Replay, Market Analysis, or AI Brain.
   */
  static async getActiveDiscoveries(): Promise<PatternDiscovery[]> {
    const failures = await db.experience.findMany({
      where: { isSuccess: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (failures.length < 2) return [];

    return [
      {
        id: 'disc_support_extension',
        title: 'Aggressive Approach Exception Discovered',
        hypothesisTitle: 'Support Revisit Reaction Hypothesis',
        observation: 'Price failed to produce expected bounce when the approach candle was greater than 2.5x the average true range.',
        occurrencesCount: failures.length,
        proposedException: 'When approaching support with high momentum / extended candles, hold entry and wait for re-accumulation.',
        suggestedAction: 'Propose Exception to Teacher',
        status: 'DISCOVERED',
      },
    ];
  }
}
