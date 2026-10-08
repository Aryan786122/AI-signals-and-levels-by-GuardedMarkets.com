import { Candle, SetupStatus, TradeDirection, TradePhase } from '@/lib/types';
import { EnrichedRule } from '@/lib/knowledge/engine';

export interface TradeProposalInput {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  marketState: string;
  activeSetup?: string;
  direction?: TradeDirection;
  candles: Candle[];
  approvedRules: EnrichedRule[];
  identifiedLevels?: {
    resistance?: number;
    support?: number;
    liquiditySweep?: number;
  };
}

export interface TradeProposalResult {
  setup: string;
  direction: TradeDirection;
  setupStatus: SetupStatus;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number[];
  invalidation: string[];
  riskReward: number | null;
  supportingRules: Array<{ id: string; title: string; phase: TradePhase }>;
  blockedRules: Array<{ id: string; title: string; reason: string }>;
  missingConditions: string[];
  isExecutable: boolean;
  reasoning: string[];
}

/**
 * TradeProposalEngine:
 * Decouples Setup Recognition from Entry, Stop Loss, Take Profit, and Invalidation.
 * Performs deterministic calculations for numerical relationships while adhering
 * strictly to teachable methodology rules (never asking an LLM to hallucinate prices).
 */
export class TradeProposalEngine {
  static evaluate(input: TradeProposalInput): TradeProposalResult {
    const {
      symbol,
      timeframe,
      currentPrice,
      marketState,
      candles,
      approvedRules,
      identifiedLevels = {},
    } = input;

    const supportingRules: Array<{ id: string; title: string; phase: TradePhase }> = [];
    const blockedRules: Array<{ id: string; title: string; reason: string }> = [];
    const missingConditions: string[] = [];
    const reasoning: string[] = [];

    // Phase 1: Insufficient Data check
    if (!candles || candles.length < 3) {
      return {
        setup: 'None',
        direction: 'NEUTRAL',
        setupStatus: 'WAIT',
        entry: null,
        stopLoss: null,
        takeProfit: [],
        invalidation: ['Insufficient candle history.'],
        riskReward: null,
        supportingRules: [],
        blockedRules: [],
        missingConditions: ['Minimum 3 historical candles required'],
        isExecutable: false,
        reasoning: ['System is in WAIT: Awaiting sufficient market data.'],
      };
    }

    const latest = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const resistance = identifiedLevels.resistance || (prev.high > latest.high ? prev.high : latest.high);
    const support = identifiedLevels.support || (prev.low < latest.low ? prev.low : latest.low);

    // Filter rules by trade phase
    const setupRules = approvedRules.filter(r => r.tradePhase === 'SETUP_RECOGNITION');
    const entryRules = approvedRules.filter(r => r.tradePhase === 'ENTRY');
    const slRules = approvedRules.filter(r => r.tradePhase === 'STOP_LOSS');
    const tpRules = approvedRules.filter(r => r.tradePhase === 'TAKE_PROFIT');

    // If no approved rules exist, evaluate strictly as Observation of Learned Levels / Structure
    if (approvedRules.length === 0) {
      const isNearSupport = latest.close <= support * 1.005 && latest.close >= support * 0.995;
      const isNearResistance = latest.close >= resistance * 0.995 && latest.close <= resistance * 1.005;

      return {
        setup: isNearSupport ? 'Support Revisit' : isNearResistance ? 'Resistance Revisit' : 'Structural Observation',
        direction: 'NEUTRAL',
        setupStatus: isNearSupport || isNearResistance ? 'WAIT' : 'OBSERVATION',
        entry: null,
        stopLoss: null,
        takeProfit: [],
        invalidation: ['Price action outside of teacher-defined levels.'],
        riskReward: null,
        supportingRules: [],
        blockedRules: [],
        missingConditions: [
          'No teacher-defined entry execution rules approved in knowledge base.',
          'Awaiting confirmed teacher setup criteria.',
        ],
        isExecutable: false,
        reasoning: [
          isNearSupport
            ? `Price (${latest.close}) is approaching learned support zone (${support.toFixed(2)}). Teacher expectation: Potential bounce.`
            : isNearResistance
            ? `Price (${latest.close}) is approaching learned resistance zone (${resistance.toFixed(2)}). Teacher expectation: Potential rejection.`
            : `Price is trading at ${latest.close} between support (${support.toFixed(2)}) and resistance (${resistance.toFixed(2)}).`,
          'No execution rule has been approved. The system does not guess trade parameters.',
        ],
      };
    }

    // Setup Recognition: Only check rules that actually exist in approvedRules
    const breakoutRule = setupRules.find(r => r.title.toLowerCase().includes('breakout') || r.statement.toLowerCase().includes('breakout'));
    const isBullishCloseAbove = breakoutRule && latest.close > resistance;
    const isBearishCloseBelow = breakoutRule && latest.close < support;

    let setupName = 'Structural Observation';
    let direction: TradeDirection = 'NEUTRAL';
    let setupStatus: SetupStatus = 'OBSERVATION';

    if (isBullishCloseAbove && breakoutRule) {
      setupName = breakoutRule.title;
      direction = 'LONG';
      setupStatus = 'SETUP_FORMING';
      supportingRules.push({ id: breakoutRule.id, title: breakoutRule.title, phase: 'SETUP_RECOGNITION' });
      reasoning.push(`Setup recognized: Candle body closed at ${latest.close} above resistance ${resistance}.`);
    } else if (isBearishCloseBelow && breakoutRule) {
      setupName = 'Bearish Support Breakdown';
      direction = 'SHORT';
      setupStatus = 'SETUP_FORMING';
      reasoning.push(`Setup recognized: Candle body closed at ${latest.close} below support ${support}.`);
    } else {
      setupStatus = 'OBSERVATION';
      missingConditions.push(`Awaiting verified rule condition triggers.`);
      reasoning.push(`Observation: Price trading at ${latest.close}. No execution rules triggered.`);
      return {
        setup: 'Structure Observation',
        direction: 'NEUTRAL',
        setupStatus: 'OBSERVATION',
        entry: null,
        stopLoss: null,
        takeProfit: [],
        invalidation: ['Price remains within boundary.'],
        riskReward: null,
        supportingRules: [],
        blockedRules: [],
        missingConditions,
        isExecutable: false,
        reasoning,
      };
    }

    // Check Exceptions: Extension Check
    const candleRange = latest.high - latest.low;
    const avgRange = (prev.high - prev.low) || 1;
    const isExtended = candleRange > avgRange * 2.2;

    const extensionRule = approvedRules.find(r =>
      r.exceptions.some(e => e.overrideBehavior.includes('AVOID') || e.description.toLowerCase().includes('extend'))
    );

    if (isExtended && extensionRule) {
      const exc = extensionRule.exceptions[0];
      // Check if nested exception-to-exception exists (e.g. liquidity sweep)
      const hasSweep = identifiedLevels.liquiditySweep !== undefined;
      const nestedException = exc.childExceptions && exc.childExceptions.length > 0 ? exc.childExceptions[0] : null;

      if (hasSweep && nestedException) {
        reasoning.push(
          `Candle is extended, but nested exception applied (Score 3): "${nestedException.description}". Entry permitted under sweep condition.`
        );
        supportingRules.push({ id: extensionRule.id, title: nestedException.description, phase: 'ENTRY' });
      } else {
        setupStatus = 'WAIT';
        blockedRules.push({
          id: extensionRule.id,
          title: extensionRule.title,
          reason: `Exception active: "${exc.description}" -> Avoid chase entry. Wait for retest.`,
        });
        missingConditions.push('Retest of broken level holding as acceptance', 'Normal range consolidation');
        reasoning.push(`Trade blocked by exception: Breakout candle range (${candleRange.toFixed(2)}) is excessively extended.`);
      }
    }

    // Phase 2: Deterministic Entry, SL, TP calculation (ONLY if taught by teacher)
    const hasTaughtEntry = entryRules.length > 0;
    const hasTaughtSL = slRules.length > 0;
    const hasTaughtTP = tpRules.length > 0;

    let entry: number | null = null;
    let stopLoss: number | null = null;
    const takeProfit: number[] = [];
    const invalidation: string[] = [];

    if (direction === 'LONG') {
      invalidation.push(`Candle close accepted below support / invalidation level: ${support}`);
      if (hasTaughtEntry) {
        entry = Number(latest.close.toFixed(2));
      }
      if (hasTaughtSL) {
        stopLoss = Number(Math.min(latest.low, resistance - (latest.close - resistance) * 0.5).toFixed(2));
      }
      if (hasTaughtTP && entry && stopLoss) {
        const risk = entry - stopLoss;
        if (risk > 0) {
          takeProfit.push(Number((entry + risk * 2).toFixed(2)));
        }
      }
    } else if (direction === 'SHORT') {
      invalidation.push(`Candle close accepted above resistance / invalidation level: ${resistance}`);
      if (hasTaughtEntry) {
        entry = Number(latest.close.toFixed(2));
      }
      if (hasTaughtSL) {
        stopLoss = Number(Math.max(latest.high, support + (support - latest.close) * 0.5).toFixed(2));
      }
      if (hasTaughtTP && entry && stopLoss) {
        const risk = stopLoss - entry;
        if (risk > 0) {
          takeProfit.push(Number((entry - risk * 2).toFixed(2)));
        }
      }
    }

    if (!hasTaughtEntry || !hasTaughtSL) {
      reasoning.push(
        'Entry, Stop-Loss, or Target methodology NOT DEFINED BY TEACHER KNOWLEDGE. The system does not invent arbitrary trading parameters.'
      );
    }

    // Phase 3: Risk Management & R:R Verification
    let riskReward: number | null = null;
    let isExecutable = false;

    if (hasTaughtEntry && hasTaughtSL && entry && stopLoss && takeProfit.length > 0) {
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit[0] - entry);
      riskReward = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;

      if ((setupStatus as string) !== 'WAIT' && (setupStatus as string) !== 'NO_TRADE' && riskReward >= 2.0) {
        setupStatus = 'SETUP_CONFIRMED';
        isExecutable = true;
        reasoning.push(`Calculated Trade Proposal: Entry ${entry}, SL ${stopLoss}, TP1 ${takeProfit[0]} (R:R ${riskReward}:1).`);
      } else if (riskReward < 2.0) {
        blockedRules.push({
          id: 'risk-rule-1',
          title: 'Risk Management Minimum R:R',
          reason: `Calculated R:R of ${riskReward}:1 is below required 2:1 ratio.`,
        });
      }
    }

    return {
      setup: setupName,
      direction,
      setupStatus,
      entry,
      stopLoss,
      takeProfit,
      invalidation,
      riskReward,
      supportingRules,
      blockedRules,
      missingConditions,
      isExecutable,
      reasoning,
    };
  }
}
