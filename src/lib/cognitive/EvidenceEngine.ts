import { EvidenceItem, MarketWorldState, KnowledgeContext } from '@/lib/types';

/**
 * Evidence Engine (Section 11):
 * Classifies all reasoning elements into Supporting, Contradicting, and Missing evidence.
 * Strict Rule: Never invent evidence. Every item links back to real market observations,
 * approved rules, active exceptions, or teacher corrections.
 */
export class EvidenceEngine {
  /**
   * Evaluates evidence for a proposed market thesis against the current World State and Knowledge base.
   */
  static evaluateEvidence(
    hypothesisTitle: string,
    bias: 'LONG' | 'SHORT' | 'NEUTRAL',
    worldState: MarketWorldState,
    context: KnowledgeContext
  ): {
    supporting: EvidenceItem[];
    contradicting: EvidenceItem[];
    missing: string[];
  } {
    const supporting: EvidenceItem[] = [];
    const contradicting: EvidenceItem[] = [];
    const missing: string[] = [];

    const isLong = bias === 'LONG';
    const recentBreakout = worldState.recentEvents.find(e => e.eventType === 'BREAKOUT');
    const recentSweep = worldState.recentEvents.find(e => e.eventType === 'LIQUIDITY_SWEEP');
    const isExpanded = worldState.volatility === 'EXPANDED';

    // 1. Evaluate Breakout Continuation Hypothesis
    if (hypothesisTitle.toLowerCase().includes('continuation') || hypothesisTitle.toLowerCase().includes('breakout')) {
      if (recentBreakout) {
        supporting.push({
          id: 'ev_breakout_close',
          type: 'OBSERVATION',
          description: recentBreakout.description,
          weight: 4,
        });

        // Link to approved breakout rules
        const breakoutRule = context.rules.find(r => r.title.toLowerCase().includes('breakout'));
        if (breakoutRule) {
          supporting.push({
            id: `ev_rule_${breakoutRule.id}`,
            type: 'RULE',
            description: `Approved Rule "${breakoutRule.title}": ${breakoutRule.statement}`,
            sourceId: breakoutRule.id,
            weight: 5,
          });
        }
      } else {
        missing.push('Definitive candle body close beyond key resistance level');
      }

      // Check for Extension Exception
      if (isExpanded) {
        const extensionException = context.exceptions.find(
          e => e.description.toLowerCase().includes('extend') || e.overrideBehavior.toLowerCase().includes('avoid')
        );
        contradicting.push({
          id: 'ev_candle_extension',
          type: 'EXCEPTION',
          description: extensionException
            ? `Approved Exception: "${extensionException.description}" (Override: ${extensionException.overrideBehavior})`
            : 'Candle range is excessively expanded beyond average volatility.',
          sourceId: extensionException?.id,
          weight: 4,
        });
        missing.push('Orderly retest of broken level to normalize Risk-to-Reward');
      }

      if (recentSweep) {
        contradicting.push({
          id: 'ev_sweep_conflict',
          type: 'OBSERVATION',
          description: recentSweep.description,
          weight: 3,
        });
      }
    }

    // 2. Evaluate Breakout Failure / Fakeout Hypothesis
    else if (hypothesisTitle.toLowerCase().includes('failure') || hypothesisTitle.toLowerCase().includes('reversal')) {
      if (recentSweep) {
        supporting.push({
          id: 'ev_sweep_rejection',
          type: 'OBSERVATION',
          description: `Wick penetration followed by rejection: ${recentSweep.description}`,
          weight: 4,
        });
      }

      if (isExpanded) {
        supporting.push({
          id: 'ev_exhaustion_candidate',
          type: 'OBSERVATION',
          description: 'Elongated expansion candle at resistance often signals exhaustion rather than sustained buying.',
          weight: 3,
        });
      }

      if (recentBreakout) {
        contradicting.push({
          id: 'ev_breakout_body_support',
          type: 'OBSERVATION',
          description: `Price closed with full body above the level: ${recentBreakout.description}`,
          weight: 4,
        });
      }

      missing.push('Bearish displacement closing back inside the range to confirm failure');
    }

    // 3. Evaluate Liquidity Sweep Hypothesis
    else if (hypothesisTitle.toLowerCase().includes('sweep')) {
      if (recentSweep) {
        supporting.push({
          id: 'ev_sweep_confirmed',
          type: 'OBSERVATION',
          description: recentSweep.description,
          weight: 5,
        });
      } else {
        missing.push('Wick probing beyond swing high liquidity pools with swift rejection');
      }

      missing.push('Immediate shift in market structure on lower timeframe');
    }

    // Default missing confirmation if insufficient evidence
    if (supporting.length === 0) {
      missing.push('Clear price acceptance beyond structural boundary');
    }

    return { supporting, contradicting, missing };
  }
}
