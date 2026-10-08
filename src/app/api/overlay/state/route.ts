import { NextRequest, NextResponse } from 'next/server';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';
import { ObservedScreenFact } from '@/lib/types/screenPerception';
import { marketDataProvider } from '@/lib/providers/market';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'UNKNOWN';
    const timeframe = searchParams.get('timeframe') || 'UNKNOWN';
    const priceParam = searchParams.get('price');

    // Get candles if available for known symbols
    let candles: any[] = [];
    if (symbol !== 'UNKNOWN') {
      try {
        candles = await marketDataProvider.getHistoricalCandles(symbol, timeframe !== 'UNKNOWN' ? timeframe : '5M', 30);
      } catch {
        // fallback
      }
    }

    let currentPrice = priceParam ? parseFloat(priceParam) : (candles.length > 0 ? candles[candles.length - 1].close : 80265.0);

    const observation: ObservedScreenFact = {
      symbol,
      timeframe,
      currentPrice,
      priceScaleVisible: typeof currentPrice === 'number',
      chartDetected: symbol !== 'UNKNOWN' || timeframe !== 'UNKNOWN',
      appName: 'TradingView',
      screenType: 'TRADINGVIEW',
      visibleLevels: [],
      timestamp: new Date().toISOString(),
      confidence: symbol !== 'UNKNOWN' ? 0.95 : 0.0,
    };

    const [evaluation, screenReasoning] = await Promise.all([
      CanonicalBrainService.evaluateMarket({
        symbol,
        timeframe,
        currentPrice,
        candles,
      }),
      CanonicalBrainService.reasonOverScreen(observation),
    ]);

    return NextResponse.json({
      success: true,
      observation,
      evaluation,
      screenReasoning,
      candles: candles.slice(-20),
    });
  } catch (error) {
    console.error('Failed to get overlay state:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get overlay state' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbol = body.symbol || 'UNKNOWN';
    const timeframe = body.timeframe || 'UNKNOWN';
    const currentPrice = typeof body.currentPrice === 'number' ? body.currentPrice : (typeof body.price === 'number' ? body.price : 80265.0);

    const observation: ObservedScreenFact = {
      symbol,
      timeframe,
      currentPrice,
      priceScaleVisible: typeof currentPrice === 'number',
      chartDetected: true,
      appName: body.appName || 'TradingView',
      screenType: 'TRADINGVIEW',
      visibleLevels: body.visibleLevels || [],
      timestamp: new Date().toISOString(),
      confidence: 0.9,
    };

    const [evaluation, screenReasoning] = await Promise.all([
      CanonicalBrainService.evaluateMarket({
        symbol,
        timeframe,
        currentPrice,
        candles: body.candles || [],
      }),
      CanonicalBrainService.reasonOverScreen(observation),
    ]);

    return NextResponse.json({
      success: true,
      observation,
      evaluation,
      screenReasoning,
    });
  } catch (error) {
    console.error('Failed to post overlay state:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post overlay state' },
      { status: 500 }
    );
  }
}
