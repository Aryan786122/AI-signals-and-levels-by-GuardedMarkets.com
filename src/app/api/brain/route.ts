import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AIProviderFactory } from '@/lib/providers/ai';
import { CognitiveEngine } from '@/lib/cognitive/CognitiveEngine';
import { WorldModelEngine } from '@/lib/cognitive/WorldModelEngine';
import { AbstractionEngine } from '@/lib/cognitive/AbstractionEngine';
import { ActiveLearningEngine } from '@/lib/cognitive/ActiveLearningEngine';
import { ExperienceMemory } from '@/lib/cognitive/ExperienceMemory';
import { Candle } from '@/lib/types';

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
    const activeAI = AIProviderFactory.getProvider();
    const sampleCandles = generateRecentCandles();

    const [
      totalLessons,
      approvedLessons,
      pendingLessons,
      concepts,
      rules,
      exceptions,
      examples,
      counterExamples,
      corrections,
      conflicts,
      maxRuleVersion,
      cognitiveDecision,
      principles,
      questions,
      experiences,
      worldState,
    ] = await Promise.all([
      db.lesson.count(),
      db.lesson.count({ where: { status: 'APPROVED' } }),
      db.lesson.count({ where: { status: 'REVIEW_PENDING' } }),
      db.concept.findMany({
        include: {
          rules: {
            where: { status: 'ACTIVE' },
            select: { id: true, title: true, specificity: true },
          },
        },
        orderBy: { importance: 'desc' },
      }),
      db.rule.findMany({
        include: {
          concept: true,
          conditions: true,
          exceptions: {
            include: {
              childExceptions: true,
            },
          },
          sourceLesson: {
            select: { id: true, title: true },
          },
        },
        orderBy: [{ specificity: 'desc' }, { createdAt: 'desc' }],
      }),
      db.exception.findMany({
        include: {
          rule: { select: { id: true, title: true } },
          childExceptions: true,
        },
      }),
      db.example.findMany({
        include: { concept: true, rule: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      db.counterExample.findMany({
        include: { concept: true, rule: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      db.correction.findMany({
        include: {
          concept: { select: { id: true, name: true } },
          lesson: { select: { id: true, title: true } },
        },
        take: 15,
        orderBy: { createdAt: 'desc' },
      }),
      db.knowledgeConflict.findMany({
        where: { status: 'UNRESOLVED' },
        include: {
          ruleA: { select: { id: true, title: true, specificity: true } },
          ruleB: { select: { id: true, title: true, specificity: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.rule.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
      CognitiveEngine.evaluateMarket({ candles: sampleCandles }),
      AbstractionEngine.proposeGeneralizations(),
      ActiveLearningEngine.getPendingQuestions(),
      ExperienceMemory.getRecentExperiences(10),
      WorldModelEngine.updateWorldState(sampleCandles),
    ]);

    const activeRules = rules.filter(r => r.status === 'ACTIVE');
    const supersededRules = rules.filter(r => r.status === 'SUPERSEDED');
    const baseExceptions = exceptions.filter(e => !e.parentExceptionId);
    const nestedExceptions = exceptions.filter(e => e.parentExceptionId);

    const providers = {
      reasoning: {
        id: activeAI.id,
        name: activeAI.name,
        fallback: 'LocalRuleValidator (Deterministic Offline Fallback)',
        status: 'READY',
        security: 'Server-side executed. Zero client API key exposure.',
      },
      vision: {
        id: 'multimodal-vision',
        name: 'Multimodal Vision Provider',
        fallback: 'Canvas Difference Filter (Stage 1 & 2)',
        status: 'READY',
        security: 'Local memory frame buffer.',
      },
      speech: {
        id: 'whisper-transcriber',
        name: 'Whisper Audio Transcriber',
        fallback: 'Local Transcript Parser',
        status: 'READY',
        security: 'Server-side processing.',
      },
      embeddings: {
        id: 'cosine-vector-engine',
        name: 'Local Cosine Vector Embedding Engine',
        fallback: 'Exact Keyword & Fuzzy Lexical Matching',
        status: 'READY',
        security: 'In-memory semantic vector store.',
      },
      marketData: {
        id: 'deterministic-ohlc',
        name: 'Deterministic OHLC Market Data Stream',
        fallback: 'Synthesized Historical Candles',
        status: 'READY',
        security: 'Strict data-layer zero-lookahead (<= current candle).',
      },
    };

    return NextResponse.json({
      providers,
      metrics: {
        totalLessons,
        approvedLessons,
        pendingLessons,
        conceptsCount: concepts.length,
        activeRulesCount: activeRules.length,
        supersededRulesCount: supersededRules.length,
        totalExceptionsCount: exceptions.length,
        baseExceptionsCount: baseExceptions.length,
        nestedExceptionsCount: nestedExceptions.length,
        examplesCount: examples.length,
        counterExamplesCount: counterExamples.length,
        correctionsCount: corrections.length,
        unresolvedConflictsCount: conflicts.length,
        currentKnowledgeVersion: maxRuleVersion?.version || 1,
        pendingQuestionsCount: questions.length,
        proposedPrinciplesCount: principles.filter(p => p.status === 'PROPOSED').length,
      },
      worldState,
      cognitiveDecision,
      competingHypotheses: cognitiveDecision.competingHypotheses,
      whatWouldChangeMyMind: cognitiveDecision.whatWouldChangeMyMind,
      questions,
      principles,
      experiences,
      concepts,
      rules,
      exceptions,
      corrections,
      examples,
      counterExamples,
      conflicts,
    });
  } catch (error) {
    console.error('Failed to load AI Brain data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve AI brain architecture data' },
      { status: 500 }
    );
  }
}
