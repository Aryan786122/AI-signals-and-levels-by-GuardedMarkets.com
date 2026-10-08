import { NextRequest, NextResponse } from 'next/server';
import { AIProviderFactory } from '@/lib/providers/ai';
import { marketDataProvider } from '@/lib/providers/market';
import { KnowledgeEngine } from '@/lib/knowledge/engine';
import { TradeProposalEngine } from '@/lib/trade/TradeProposalEngine';
import { Candle } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol = 'XAUUSD', timeframe = '5M', candleIndex = 15 } = body;

    // Fetch full series (e.g. 60 candles)
    const fullSeries = await marketDataProvider.getHistoricalCandles(symbol, timeframe, 60);

    // Strictly enforce zero lookahead: Slice only up to candleIndex (candles <= N)
    const safeIndex = Math.min(candleIndex, fullSeries.length - 1);
    const visibleCandles = fullSeries.slice(0, safeIndex + 1);
    const currentCandle = visibleCandles[visibleCandles.length - 1];

    // Fetch active teacher rules with enriched context
    const activeContext = await KnowledgeEngine.getActiveContext();

    // 1. Evaluate proposal on current visible candles (strictly <= N)
    const proposal = TradeProposalEngine.evaluate({
      symbol,
      timeframe,
      currentPrice: currentCandle.close,
      marketState: currentCandle.close > currentCandle.open ? 'BULLISH_EXPANSION' : 'PULLBACK',
      candles: visibleCandles,
      approvedRules: activeContext.enrichedRules,
    });

    // 2. Evaluate previous state (candles <= N-1) to generate honest WHAT CHANGED transition
    let previousState = 'OBSERVATION';
    if (visibleCandles.length > 1) {
      const prevProposal = TradeProposalEngine.evaluate({
        symbol,
        timeframe,
        currentPrice: visibleCandles[visibleCandles.length - 2].close,
        marketState: 'OBSERVATION',
        candles: visibleCandles.slice(0, -1),
        approvedRules: activeContext.enrichedRules,
      });
      previousState = prevProposal.setupStatus;
    }

    // 3. AI Reasoning on visible slice
    const aiProvider = AIProviderFactory.getProvider();
    const analysis = await aiProvider.analyze({
      symbol,
      timeframe,
      marketData: visibleCandles,
      context: activeContext,
      promptOverride: `Replay Step ${safeIndex}: Proposal State ${proposal.setupStatus}, Direction: ${proposal.direction}.
Supporting Rules: ${proposal.supportingRules.map(r => r.title).join(', ') || 'None'}.
Missing Conditions: ${proposal.missingConditions.join(', ') || 'None'}.`,
    });

    // Merge deterministic bounds
    if (proposal.entry && proposal.stopLoss) {
      analysis.entry = proposal.entry;
      analysis.stop_loss = proposal.stopLoss;
      analysis.take_profit = proposal.takeProfit;
      analysis.setup_status = proposal.setupStatus;
      analysis.direction = proposal.direction;
      analysis.invalidation = proposal.invalidation;
    }

    analysis.what_changed = {
      previous_state: previousState,
      new_information: `Candle #${safeIndex} closed at ${currentCandle.close} (H: ${currentCandle.high}, L: ${currentCandle.low})`,
      new_state: proposal.setupStatus,
    };

    return NextResponse.json({
      success: true,
      currentCandle,
      visibleCandles,
      totalCandles: fullSeries.length,
      currentIndex: safeIndex,
      hasMore: safeIndex + 1 < fullSeries.length,
      analysis,
      proposal,
    });
  } catch (error) {
    console.error('Replay step failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replay step failed' },
      { status: 500 }
    );
  }
}
