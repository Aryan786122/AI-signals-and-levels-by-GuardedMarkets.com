import { CognitiveHypothesis, MarketWorldState, KnowledgeContext } from '@/lib/types';
import { EvidenceEngine } from './EvidenceEngine';
import { CounterfactualEngine } from './CounterfactualEngine';

/**
 * Hypothesis Engine (Section 10):
 * For ambiguous market states, generates multiple plausible hypotheses (H1, H2, H3).
 * Each hypothesis contains supporting, contradicting, and missing evidence,
 * expected future behavior, invalidation conditions, and counterfactuals.
 */
export class HypothesisEngine {
  /**
   * Generates competing hypotheses for the current market state and active knowledge base.
   */
  static generateHypotheses(
    worldState: MarketWorldState,
    context: KnowledgeContext
  ): CognitiveHypothesis[] {
    const candidates: Array<{ title: string; bias: 'LONG' | 'SHORT' | 'NEUTRAL' }> = [
      { title: 'H1: Valid Breakout & Trend Continuation', bias: 'LONG' },
      { title: 'H2: Breakout Failure & Mean Reversion', bias: 'SHORT' },
      { title: 'H3: Liquidity Sweep & Range Continuation', bias: 'NEUTRAL' },
    ];

    const hypotheses: CognitiveHypothesis[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const { title, bias } = candidates[i];

      // 1. Evaluate Evidence
      const { supporting, contradicting, missing } = EvidenceEngine.evaluateEvidence(
        title,
        bias,
        worldState,
        context
      );

      // 2. Derive Counterfactuals & Invalidation
      const { counterfactuals, invalidationCondition, expectedFutureBehavior } =
        CounterfactualEngine.deriveCounterfactuals(title, bias, worldState);

      // 3. Compute Grounded Probability Score based on evidence weights
      const supportWeight = supporting.reduce((sum, item) => sum + item.weight, 0);
      const contradictWeight = contradicting.reduce((sum, item) => sum + item.weight, 0);
      const netWeight = Math.max(0, supportWeight - contradictWeight * 0.8);

      hypotheses.push({
        id: `hyp_${i + 1}`,
        title,
        probability: netWeight, // will normalize below
        bias,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing,
        expectedFutureBehavior,
        invalidationCondition,
        counterfactuals,
      });
    }

    // Normalize probabilities across hypotheses so sum <= 1.0
    const totalScore = hypotheses.reduce((sum, h) => sum + h.probability, 0) || 1;
    for (const h of hypotheses) {
      h.probability = Number((Math.max(0.1, h.probability / totalScore)).toFixed(2));
    }

    // Sort by descending probability
    return hypotheses.sort((a, b) => b.probability - a.probability);
  }
}
