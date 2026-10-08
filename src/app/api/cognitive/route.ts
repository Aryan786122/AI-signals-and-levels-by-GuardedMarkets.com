import { NextResponse } from 'next/server';
import { CognitiveEngine } from '@/lib/cognitive/CognitiveEngine';
import { WorldModelEngine } from '@/lib/cognitive/WorldModelEngine';
import { HypothesisEngine } from '@/lib/cognitive/HypothesisEngine';
import { CounterfactualEngine } from '@/lib/cognitive/CounterfactualEngine';
import { AbstractionEngine } from '@/lib/cognitive/AbstractionEngine';
import { ActiveLearningEngine } from '@/lib/cognitive/ActiveLearningEngine';
import { ExperienceMemory } from '@/lib/cognitive/ExperienceMemory';
import { KnowledgeEngine } from '@/lib/knowledge/engine';
import { Candle } from '@/lib/types';

// Sample synthesized 5M candle series for current state
function generateRecentCandles(): Candle[] {
  const candles: Candle[] = [];
  const basePrice = 2640.0;
  const now = Date.now();

  for (let i = 20; i >= 0; i--) {
    const timestamp = now - i * 5 * 60 * 1000;
    const progress = (20 - i) / 20;
    const open = basePrice + progress * 8 + (Math.sin(i) * 2);
    const close = open + (i === 0 ? 3.5 : (i % 2 === 0 ? 1.2 : -0.8));
    const high = Math.max(open, close) + 1.5;
    const low = Math.min(open, close) - 1.2;

    candles.push({
      timestamp,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 1200 + Math.floor(Math.random() * 500),
    });
  }
  return candles;
}

export async function GET() {
  try {
    const candles = generateRecentCandles();
    const context = await KnowledgeEngine.getActiveContext();

    const [decision, questions, principles, experiences] = await Promise.all([
      CognitiveEngine.evaluateMarket({ candles, context }),
      ActiveLearningEngine.getPendingQuestions(),
      AbstractionEngine.proposeGeneralizations(),
      ExperienceMemory.getRecentExperiences(6),
    ]);

    const worldState = await WorldModelEngine.updateWorldState(candles);

    return NextResponse.json({
      success: true,
      decision,
      worldState,
      competingHypotheses: decision.competingHypotheses,
      whatWouldChangeMyMind: decision.whatWouldChangeMyMind,
      questions,
      principles,
      experiences,
    });
  } catch (error) {
    console.error('Failed to run cognitive evaluation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cognitive evaluation failed' },
      { status: 500 }
    );
  }
}
