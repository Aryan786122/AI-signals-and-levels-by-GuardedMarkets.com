import { MarketEventItem, MarketEventType, Candle } from '@/lib/types';
import { db } from '@/lib/db';

/**
 * Temporal Memory:
 * Tracks and preserves the chronological sequence of market events.
 * Meaning is fundamentally dependent on what happened before.
 * Example: 10:00 Approaching resistance -> 10:05 Liquidity sweep -> 10:10 Close above -> 10:15 Retest -> 10:20 Acceptance
 */
export class TemporalMemory {
  /**
   * Derives sequential events from an array of OHLC candles up to index N (zero lookahead).
   */
  static deriveEventsFromCandles(
    candles: Candle[],
    keyLevels: { resistance: number[]; support: number[] }
  ): MarketEventItem[] {
    if (!candles || candles.length === 0) return [];

    const events: MarketEventItem[] = [];
    const window = candles.slice(-10); // Look at last 10 candles for local sequence

    for (let i = 0; i < window.length; i++) {
      const current = window[i];
      const prev = i > 0 ? window[i - 1] : null;
      const dateStr = new Date(current.timestamp).toLocaleTimeString();

      // 1. New Candle Event
      events.push({
        id: `evt_candle_${current.timestamp}`,
        eventType: 'NEW_CANDLE',
        price: current.close,
        description: `Candle close at ${current.close.toFixed(2)} (${current.close >= current.open ? 'Bullish' : 'Bearish'})`,
        timestamp: dateStr,
      });

      // 2. Resistance / Support approach or touch
      for (const res of keyLevels.resistance) {
        if (current.high >= res && (!prev || prev.high < res)) {
          if (current.close < res && current.high > res) {
            events.push({
              id: `evt_sweep_${current.timestamp}`,
              eventType: 'LIQUIDITY_SWEEP',
              price: current.high,
              description: `Liquidity sweep above resistance (${res.toFixed(2)}) with wick rejection`,
              timestamp: dateStr,
            });
          } else if (current.close > res) {
            events.push({
              id: `evt_breakout_${current.timestamp}`,
              eventType: 'BREAKOUT',
              price: current.close,
              description: `Solid body close above resistance level (${res.toFixed(2)})`,
              timestamp: dateStr,
            });
          } else {
            events.push({
              id: `evt_touch_${current.timestamp}`,
              eventType: 'LEVEL_TOUCH',
              price: current.high,
              description: `Tested resistance level at ${res.toFixed(2)}`,
              timestamp: dateStr,
            });
          }
        }
      }

      // 3. Volatility Expansion check
      if (prev) {
        const currentRange = current.high - current.low;
        const prevRange = (prev.high - prev.low) || 1;
        if (currentRange > prevRange * 2.2) {
          events.push({
            id: `evt_expansion_${current.timestamp}`,
            eventType: 'EXPANSION',
            price: current.close,
            description: `Significant range expansion candle (${currentRange.toFixed(2)} points vs previous ${prevRange.toFixed(2)})`,
            timestamp: dateStr,
          });
        }
      }
    }

    return events;
  }

  /**
   * Retrieves recent recorded events from database.
   */
  static async getRecentEvents(instrument: string, timeframe: string, limit = 15): Promise<MarketEventItem[]> {
    try {
      const records = await db.marketEvent.findMany({
        where: { instrument, timeframe },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return records.reverse().map(r => ({
        id: r.id,
        eventType: r.eventType as MarketEventType,
        price: r.price,
        description: r.description,
        timestamp: r.timestamp.toLocaleTimeString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Records a new market event.
   */
  static async recordEvent(event: Omit<MarketEventItem, 'id'>, instrument = 'XAUUSD', timeframe = '5M'): Promise<void> {
    try {
      await db.marketEvent.create({
        data: {
          eventType: event.eventType,
          instrument,
          timeframe,
          price: event.price,
          description: event.description,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        },
      });
    } catch (err) {
      console.warn('Failed to record temporal event:', err);
    }
  }
}
