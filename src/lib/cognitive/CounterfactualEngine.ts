import { CounterfactualItem, MarketWorldState } from '@/lib/types';

/**
 * Counterfactual Engine (Section 12):
 * Explicitly reasons about: "What would make my current interpretation wrong?"
 * Generates conditional IF/THEN triggers that invalidate or strengthen hypotheses.
 */
export class CounterfactualEngine {
  /**
   * Derives counterfactual conditions for a given hypothesis and current market structure.
   */
  static deriveCounterfactuals(
    hypothesisTitle: string,
    bias: 'LONG' | 'SHORT' | 'NEUTRAL',
    worldState: MarketWorldState
  ): {
    counterfactuals: CounterfactualItem[];
    invalidationCondition: string;
    expectedFutureBehavior: string;
  } {
    const counterfactuals: CounterfactualItem[] = [];
    const nearestResistance = worldState.resistanceLevels[0] || (worldState.currentPrice * 1.002);
    const nearestSupport = worldState.supportLevels[0] || (worldState.currentPrice * 0.998);

    let invalidationCondition = '';
    let expectedFutureBehavior = '';

    if (bias === 'LONG' || hypothesisTitle.toLowerCase().includes('breakout')) {
      invalidationCondition = `Price prints a 5M candle body closing back below key level (${nearestResistance.toFixed(2)}).`;
      expectedFutureBehavior = `Price holds above ${nearestResistance.toFixed(2)} with a low-volume retest, followed by bullish continuation.`;

      counterfactuals.push({
        condition: `IF price closes back below ${nearestResistance.toFixed(2)}`,
        consequence: `THEN the Breakout Continuation thesis is completely invalidated, and Breakout Failure / Fakeout becomes the dominant hypothesis.`,
      });

      counterfactuals.push({
        condition: `IF price prints a controlled, low-range retest of ${nearestResistance.toFixed(2)} and prints a rejection wick`,
        consequence: `THEN the continuation hypothesis is strongly confirmed and a structured Trade Candidate may be triggered.`,
      });

      counterfactuals.push({
        condition: `IF high-volume bearish displacement penetrates ${nearestSupport.toFixed(2)}`,
        consequence: `THEN market structure shifts from Bullish Bias to Bearish Trend.`,
      });
    } else if (bias === 'SHORT' || hypothesisTitle.toLowerCase().includes('failure') || hypothesisTitle.toLowerCase().includes('reversal')) {
      invalidationCondition = `Price maintains sustained acceptance and closes strongly above ${nearestResistance.toFixed(2)}.`;
      expectedFutureBehavior = `Price produces bearish follow-through, breaking back toward lower support at ${nearestSupport.toFixed(2)}.`;

      counterfactuals.push({
        condition: `IF buyers absorb selling and hold price above ${nearestResistance.toFixed(2)} for 2 consecutive candles`,
        consequence: `THEN the Breakout Failure thesis is invalidated, confirming genuine institutional acceptance.`,
      });

      counterfactuals.push({
        condition: `IF a deep sweep of sell-side liquidity at ${nearestSupport.toFixed(2)} occurs with instant buyback`,
        consequence: `THEN lower boundary liquidity has been cleared, neutralizing immediate short targets.`,
      });
    } else {
      // Neutral / Observation
      invalidationCondition = `Price breaks out of current range (${nearestSupport.toFixed(2)} - ${nearestResistance.toFixed(2)}).`;
      expectedFutureBehavior = `Price remains within range boundaries awaiting institutional order flow catalyst.`;

      counterfactuals.push({
        condition: `IF price closes with solid body outside ${nearestSupport.toFixed(2)} - ${nearestResistance.toFixed(2)}`,
        consequence: `THEN the neutral consolidation thesis terminates and directional evaluation is activated.`,
      });
    }

    return {
      counterfactuals,
      invalidationCondition,
      expectedFutureBehavior,
    };
  }
}
