import { Candle, MarketWorldState, MarketRegime, MomentumState, VolatilityState } from '@/lib/types';
import { db } from '@/lib/db';
import { TemporalMemory } from './TemporalMemory';

/**
 * World Model Engine (Section 5):
 * Structured representation of what the AI currently believes is happening in the market.
 * Updated incrementally over time rather than recreated from scratch.
 */
export class WorldModelEngine {
  /**
   * Computes or updates the current World State based on market candles and recent events.
   * Zero lookahead is strictly enforced by consuming only candles up to the current index.
   */
  static async updateWorldState(
    candles: Candle[],
    instrument = 'XAUUSD',
    timeframe = '5M'
  ): Promise<MarketWorldState> {
    if (!candles || candles.length === 0) {
      return this.getEmptyWorldState(instrument, timeframe);
    }

    const latest = candles[candles.length - 1];
    const currentPrice = latest.close;

    // 1. Calculate Swing Highs & Swing Lows (local fractal extrema)
    const { swingHighs, swingLows } = this.calculateSwings(candles);

    // 2. Identify Key Support & Resistance Levels
    const resistanceLevels = [...swingHighs].sort((a, b) => b - a).slice(0, 3);
    const supportLevels = [...swingLows].sort((a, b) => a - b).slice(0, 3);

    // 3. Liquidity Zones (areas above recent highs / below recent lows)
    const liquidityZones: string[] = [];
    if (resistanceLevels.length > 0) {
      liquidityZones.push(`Buy-side Liquidity Pool: ${(resistanceLevels[0] * 1.001).toFixed(2)} - ${(resistanceLevels[0] * 1.003).toFixed(2)}`);
    }
    if (supportLevels.length > 0) {
      liquidityZones.push(`Sell-side Liquidity Pool: ${(supportLevels[0] * 0.999).toFixed(2)} - ${(supportLevels[0] * 0.997).toFixed(2)}`);
    }

    // 4. Regime & Momentum Analysis
    const { regime, momentum, volatility } = this.analyzeRegime(candles);

    // 5. Derive Temporal Event Sequence
    const recentEvents = TemporalMemory.deriveEventsFromCandles(candles, {
      resistance: resistanceLevels,
      support: supportLevels,
    });

    // 6. Uncertainty Calculation
    // High uncertainty if choppy/range-bound or immediately following huge expansion
    let uncertaintyScore = 0.25;
    if (regime === 'RANGE_BOUND') uncertaintyScore += 0.25;
    if (volatility === 'EXPANDED') uncertaintyScore += 0.2;
    if (recentEvents.some(e => e.eventType === 'LIQUIDITY_SWEEP')) uncertaintyScore += 0.15;
    uncertaintyScore = Math.min(0.95, Number(uncertaintyScore.toFixed(2)));

    // 7. Active Scenario Inferred
    let activeScenario: string | null = 'Market Observation';
    const lastEvent = recentEvents[recentEvents.length - 1];
    if (lastEvent?.eventType === 'BREAKOUT') {
      activeScenario = 'Resistance Breakout Evaluation';
    } else if (lastEvent?.eventType === 'LIQUIDITY_SWEEP') {
      activeScenario = 'Liquidity Sweep & Wick Rejection';
    } else if (lastEvent?.eventType === 'EXPANSION') {
      activeScenario = 'Post-Expansion Retest Watch';
    }

    const state: MarketWorldState = {
      instrument,
      timeframe,
      currentPrice,
      marketRegime: regime,
      momentum,
      volatility,
      swingHighs,
      swingLows,
      supportLevels,
      resistanceLevels,
      liquidityZones,
      activeScenario,
      recentEvents: recentEvents.slice(-6), // keep 6 most recent transitions
      uncertaintyScore,
      lastUpdated: new Date().toISOString(),
    };

    // Persist snapshot asynchronously
    this.persistWorldState(state).catch(() => {});

    return state;
  }

  private static calculateSwings(candles: Candle[], window = 3) {
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = window; i < candles.length - window; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= window; j++) {
        if (candles[i - j].high >= current.high || candles[i + j].high >= current.high) {
          isHigh = false;
        }
        if (candles[i - j].low <= current.low || candles[i + j].low <= current.low) {
          isLow = false;
        }
      }

      if (isHigh) swingHighs.push(Number(current.high.toFixed(2)));
      if (isLow) swingLows.push(Number(current.low.toFixed(2)));
    }

    // Fallback if series is too short
    if (swingHighs.length === 0 && candles.length > 0) {
      swingHighs.push(Math.max(...candles.map(c => c.high)));
    }
    if (swingLows.length === 0 && candles.length > 0) {
      swingLows.push(Math.min(...candles.map(c => c.low)));
    }

    return { swingHighs: swingHighs.slice(-4), swingLows: swingLows.slice(-4) };
  }

  private static analyzeRegime(candles: Candle[]): {
    regime: MarketRegime;
    momentum: MomentumState;
    volatility: VolatilityState;
  } {
    if (candles.length < 5) {
      return { regime: 'UNCLEAR', momentum: 'NEUTRAL', volatility: 'NORMAL' };
    }

    const recent = candles.slice(-5);
    const firstClose = recent[0].close;
    const lastClose = recent[recent.length - 1].close;
    const priceDelta = lastClose - firstClose;

    // Average True Range proxy
    const ranges = recent.map(c => c.high - c.low);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const latestRange = ranges[ranges.length - 1];

    let volatility: VolatilityState = 'NORMAL';
    if (latestRange > avgRange * 1.8) volatility = 'EXPANDED';
    else if (latestRange < avgRange * 0.6) volatility = 'COMPRESSED';

    let regime: MarketRegime = 'RANGE_BOUND';
    let momentum: MomentumState = 'NEUTRAL';

    if (priceDelta > avgRange * 1.5) {
      regime = 'TRENDING_BULLISH';
      momentum = 'ACCELERATING';
    } else if (priceDelta < -avgRange * 1.5) {
      regime = 'TRENDING_BEARISH';
      momentum = 'ACCELERATING';
    } else if (volatility === 'EXPANDED') {
      regime = 'VOLATILITY_EXPANSION';
      momentum = 'DECELERATING';
    }

    return { regime, momentum, volatility };
  }

  private static async persistWorldState(state: MarketWorldState): Promise<void> {
    try {
      await db.worldState.create({
        data: {
          instrument: state.instrument,
          timeframe: state.timeframe,
          currentPrice: state.currentPrice,
          marketRegime: state.marketRegime,
          momentum: state.momentum,
          volatility: state.volatility,
          swingHighs: JSON.stringify(state.swingHighs),
          swingLows: JSON.stringify(state.swingLows),
          supportLevels: JSON.stringify(state.supportLevels),
          resistanceLevels: JSON.stringify(state.resistanceLevels),
          liquidityZones: JSON.stringify(state.liquidityZones),
          activeScenario: state.activeScenario,
          recentEvents: JSON.stringify(state.recentEvents),
          uncertaintyScore: state.uncertaintyScore,
        },
      });
    } catch {
      // Non-blocking in-memory continuation
    }
  }

  private static getEmptyWorldState(instrument: string, timeframe: string): MarketWorldState {
    return {
      instrument,
      timeframe,
      currentPrice: 0,
      marketRegime: 'UNCLEAR',
      momentum: 'NEUTRAL',
      volatility: 'NORMAL',
      swingHighs: [],
      swingLows: [],
      supportLevels: [],
      resistanceLevels: [],
      liquidityZones: [],
      activeScenario: 'Waiting for market data feed',
      recentEvents: [],
      uncertaintyScore: 1.0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
