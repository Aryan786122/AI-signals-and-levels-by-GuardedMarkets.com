import { db } from '@/lib/db';
import { MarketWorldState, NovelScenarioAnalysis } from '@/lib/types';

export interface RecordedExperienceItem {
  id: string;
  situationSummary: string;
  market: string;
  timeframe: string;
  aiDecision: string;
  aiReasoning: string;
  teacherDecision?: string | null;
  learnedInsight?: string | null;
  createdAt: string;
}

/**
 * Experience Memory (Sections 9, 14, 15, 50):
 * Episodic memory system.
 * Uses retrieved experiences as evidence to test conditions, NEVER as an automatic rote copy.
 * Evaluates whether a current situation is completely novel or shares structural principles.
 */
export class ExperienceMemory {
  /**
   * Records a complete episode into episodic memory.
   */
  static async recordExperience(data: {
    situationSummary: string;
    market?: string;
    timeframe?: string;
    worldStateSnapshot?: MarketWorldState;
    activeHypotheses?: unknown;
    aiDecision: string;
    aiReasoning: string;
    teacherDecision?: string;
    marketOutcome?: unknown;
    isSuccess?: boolean;
    correctionId?: string;
    learnedInsight?: string;
  }): Promise<string> {
    try {
      const rec = await db.experience.create({
        data: {
          situationSummary: data.situationSummary,
          market: data.market || 'XAUUSD',
          timeframe: data.timeframe || '5M',
          worldStateSnapshot: data.worldStateSnapshot ? JSON.stringify(data.worldStateSnapshot) : null,
          activeHypotheses: data.activeHypotheses ? JSON.stringify(data.activeHypotheses) : null,
          aiDecision: data.aiDecision,
          aiReasoning: data.aiReasoning,
          teacherDecision: data.teacherDecision,
          marketOutcome: data.marketOutcome ? JSON.stringify(data.marketOutcome) : null,
          isSuccess: data.isSuccess,
          correctionId: data.correctionId,
          learnedInsight: data.learnedInsight,
        },
      });
      return rec.id;
    } catch (err) {
      console.warn('Failed to persist experience memory:', err);
      return `exp_${Date.now()}`;
    }
  }

  /**
   * Retrieves recent experiences from episodic memory.
   */
  static async getRecentExperiences(limit = 10): Promise<RecordedExperienceItem[]> {
    try {
      const records = await db.experience.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return records.map(r => ({
        id: r.id,
        situationSummary: r.situationSummary,
        market: r.market,
        timeframe: r.timeframe,
        aiDecision: r.aiDecision,
        aiReasoning: r.aiReasoning,
        teacherDecision: r.teacherDecision,
        learnedInsight: r.learnedInsight,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Evaluates whether the current market situation has an exact prior match or is a novel scenario.
   * Enforces Section 14, 15, and 50:
   * "No exact prior example found. Reason from structural properties and underlying principles."
   */
  static async analyzeNovelScenario(
    worldState: MarketWorldState,
    contextSummary: string
  ): Promise<NovelScenarioAnalysis> {
    const experiences = await this.getRecentExperiences(20);

    // Look for exact matches (identical situation and price structure)
    const exactMatch = experiences.find(
      e => e.situationSummary.toLowerCase() === contextSummary.toLowerCase()
    );

    if (exactMatch) {
      return {
        isExactMatchFound: true,
        closestExperienceId: exactMatch.id,
        structuralSimilarities: ['Direct precedent found in training episode.'],
        structuralDifferences: [],
        applicablePrinciples: ['Prior verified setup execution.'],
        uncertainties: [],
      };
    }

    // Novel scenario: Derive structural similarities and differences
    const structuralSimilarities: string[] = [];
    const structuralDifferences: string[] = [];
    const applicablePrinciples: string[] = [];
    const uncertainties: string[] = [];

    // Evaluate structural properties
    if (worldState.marketRegime === 'TRENDING_BULLISH' || worldState.marketRegime === 'VOLATILITY_EXPANSION') {
      structuralSimilarities.push('Shares high-momentum expansion characteristics seen in previous breakout lessons.');
      applicablePrinciples.push('Principle: Avoid chasing extended candles far from structural invalidation.');
    }

    if (worldState.recentEvents.some(e => e.eventType === 'LIQUIDITY_SWEEP')) {
      structuralSimilarities.push('Displays liquidity sweep wick behavior at key level.');
      applicablePrinciples.push('Principle: Wick probes require structural confirmation before assuming continuation.');
    }

    if (worldState.volatility === 'EXPANDED') {
      structuralDifferences.push('Candle range is significantly larger than typical calibration examples.');
      uncertainties.push('Potential slippage and unfavorable risk-to-reward ratio on immediate entry.');
    } else {
      structuralSimilarities.push('Orderly candle ranges observed during initial level test.');
    }

    if (worldState.uncertaintyScore > 0.5) {
      uncertainties.push('Conflicting lower-timeframe signals increase probability of a false breakout.');
    }

    return {
      isExactMatchFound: false,
      closestExperienceId: experiences[0]?.id,
      structuralSimilarities: structuralSimilarities.length > 0 ? structuralSimilarities : ['Approaches key horizontal liquidity boundary.'],
      structuralDifferences: structuralDifferences.length > 0 ? structuralDifferences : ['Distinct order flow velocity compared to prior training videos.'],
      applicablePrinciples: applicablePrinciples.length > 0 ? applicablePrinciples : ['General Principle: Wait for confirmed retest and candle body acceptance.'],
      uncertainties: uncertainties.length > 0 ? uncertainties : ['Awaiting confirmation candle close before committing risk capital.'],
    };
  }
}
