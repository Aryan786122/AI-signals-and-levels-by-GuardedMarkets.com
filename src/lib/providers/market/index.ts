import { MarketDataProvider, Candle, SymbolInfo } from '@/lib/types';

export class LocalMarketDataProvider implements MarketDataProvider {
  readonly id = 'local-market-feed';
  readonly name = 'Simulated Historical & Live Market Feed';

  private generateMockCandles(basePrice: number, count: number, timeframeSec: number = 300): Candle[] {
    const candles: Candle[] = [];
    let currentPrice = basePrice;
    const now = Date.now();
    const startTime = now - count * timeframeSec * 1000;

    for (let i = 0; i < count; i++) {
      const open = currentPrice;
      // Realistic random walk with trend bias
      const changePercent = (Math.sin(i / 5) * 0.4 + (Math.random() - 0.48)) * 0.003;
      const close = Math.round((open * (1 + changePercent)) * 100) / 100;
      const high = Math.round((Math.max(open, close) + Math.random() * (open * 0.0015)) * 100) / 100;
      const low = Math.round((Math.min(open, close) - Math.random() * (open * 0.0015)) * 100) / 100;
      const volume = Math.floor(500 + Math.random() * 2000);

      candles.push({
        timestamp: startTime + i * timeframeSec * 1000,
        open,
        high,
        low,
        close,
        volume,
      });
      currentPrice = close;
    }
    return candles;
  }

  async getSymbol(symbol: string): Promise<SymbolInfo> {
    const defaultPrices: Record<string, number> = {
      XAUUSD: 2650.50,
      EURUSD: 1.0850,
      NQ: 19850.00,
      BTCUSDT: 64200.00,
    };
    const currentPrice = defaultPrices[symbol.toUpperCase()] || 100.0;

    return {
      symbol: symbol.toUpperCase(),
      description: `${symbol.toUpperCase()} Spot / Futures Market Feed`,
      timeframes: ['1M', '5M', '15M', '1H', '4H', '1D'],
      currentPrice,
    };
  }

  async getHistoricalCandles(symbol: string, _timeframe: string, limit: number = 60): Promise<Candle[]> {
    const info = await this.getSymbol(symbol);
    return this.generateMockCandles(info.currentPrice, limit);
  }

  async getLatestCandle(symbol: string, timeframe: string): Promise<Candle> {
    const candles = await this.getHistoricalCandles(symbol, timeframe, 1);
    return candles[0];
  }

  subscribeToUpdates(
    symbol: string,
    timeframe: string,
    callback: (c: Candle) => void
  ): () => void {
    const interval = setInterval(async () => {
      const candle = await this.getLatestCandle(symbol, timeframe);
      callback(candle);
    }, 5000);

    return () => clearInterval(interval);
  }
}

export const marketDataProvider: MarketDataProvider = new LocalMarketDataProvider();
