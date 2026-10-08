import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketDataProvider } from '@/lib/providers/market';
import { CanonicalBrainService } from '@/lib/services/canonicalBrainService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbol = body.symbol || 'XAUUSD';
    const timeframe = body.timeframe || '5M';

    // 1. Get recent market candles
    const candles = await marketDataProvider.getHistoricalCandles(symbol, timeframe, 50);
    const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : 80265;

    // 2. Evaluate against Canonical Teacher Knowledge Brain (Scope-Limited Reasoning)
    const brainEval = await CanonicalBrainService.evaluateMarket({
      symbol,
      timeframe,
      currentPrice: latestPrice,
      candles,
    });

    // 3. Construct structured response strictly respecting teacher bounds
    const structuredResponse = {
      market_state: brainEval.state,
      active_concepts: brainEval.matchedLevel ? [brainEval.matchedLevel.name] : [],
      detected_scenarios: brainEval.matchedLevel ? [brainEval.matchedLevel.expectedBehavior] : ['Observing Market Structure'],
      setup_status: brainEval.state,
      direction: brainEval.bias,
      source_type: brainEval.sourceType,
      entry: brainEval.entry === 'NOT DEFINED BY TEACHER KNOWLEDGE' ? null : parseFloat(brainEval.entry) || null,
      stop_loss: brainEval.stopLoss === 'NOT DEFINED BY TEACHER KNOWLEDGE' ? null : parseFloat(brainEval.stopLoss) || null,
      take_profit: brainEval.takeProfit.map(p => parseFloat(p)).filter(p => !isNaN(p)),
      invalidation: brainEval.invalidation,
      supporting_rules: brainEval.matchedLevel ? [{
        rule_id: brainEval.matchedLevel.id,
        title: brainEval.matchedLevel.name,
        statement: brainEval.matchedLevel.whatItIs,
        priority: 'METHODOLOGY_LEVEL',
      }] : [],
      conflicting_rules: [],
      reasoning: brainEval.reasoning,
      missing_conditions: brainEval.missingConditions,
      confidence: brainEval.matchedLevel ? 0.95 : 0.5,
      timestamp: brainEval.lastUpdated,
      not_taught: brainEval.notTaught,
      provenance: brainEval.provenance,
    };

    // 4. Record Snapshot in database
    const session = await db.analysisSession.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });

    const sessionId = session ? session.id : (await db.analysisSession.create({
      data: {
        source: body.source || 'LIVE_CHART',
        symbol,
        timeframe,
        status: 'ACTIVE',
      },
    })).id;

    const snapshot = await db.analysisSnapshot.create({
      data: {
        sessionId,
        marketState: brainEval.state,
        activeScenario: brainEval.matchedLevel?.name || 'Observation',
        setupStatus: brainEval.state,
        direction: brainEval.bias,
        entryPrice: structuredResponse.entry,
        stopLossPrice: structuredResponse.stop_loss,
        takeProfitPrices: JSON.stringify(structuredResponse.take_profit),
        reasoning: JSON.stringify(brainEval.reasoning),
        hasVisualDiff: Boolean(body.hasVisualDiff),
        diffScore: body.diffScore || null,
      },
    });

    return NextResponse.json({
      success: true,
      analysis: structuredResponse,
      evaluation: brainEval,
      candles,
      snapshotId: snapshot.id,
    });
  } catch (error) {
    console.error('Market analysis failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
