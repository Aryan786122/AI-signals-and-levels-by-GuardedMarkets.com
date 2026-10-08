import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

let cachedStats: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds in-memory TTL

export async function GET() {
  try {
    const now = Date.now();
    if (cachedStats && (now - lastCacheTime < CACHE_TTL)) {
      return NextResponse.json(cachedStats);
    }
    const [
      totalLessons,
      lessonsProcessed,
      lessonsAwaitingApproval,
      conceptsCount,
      rulesCount,
      exceptionsCount,
      scenariosCount,
      examplesCount,
      correctionsCount,
      unresolvedConflicts,
      supersededRulesCount,
      pendingReviewsCount,
      evaluationsCount,
      evalResults,
      latestSnapshot,
      maxRuleVersion,
    ] = await Promise.all([
      db.lesson.count(),
      db.lesson.count({ where: { status: 'APPROVED' } }),
      db.lesson.count({ where: { status: 'REVIEW_PENDING' } }),
      db.concept.count(),
      db.rule.count({ where: { status: 'ACTIVE' } }),
      db.exception.count(),
      db.scenario.count({ where: { status: 'ACTIVE' } }),
      db.example.count(),
      db.correction.count(),
      db.knowledgeConflict.count({ where: { status: 'UNRESOLVED' } }),
      db.rule.count({ where: { status: 'SUPERSEDED' } }),
      db.lesson.count({ where: { status: 'REVIEW_PENDING' } }),
      db.evaluation.count(),
      db.evaluationResult.findMany({ select: { status: true } }),
      db.analysisSnapshot.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      db.rule.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
    ]);

    const correctDecisions = evalResults.filter(r => r.status === 'CORRECT').length;
    const incorrectDecisions = evalResults.filter(r => r.status === 'WRONG').length;
    const partialDecisions = evalResults.filter(r => r.status === 'PARTIALLY_CORRECT').length;

    const result = {
      knowledge: {
        totalLessons,
        concepts: conceptsCount,
        rules: rulesCount,
        exceptions: exceptionsCount,
        scenarios: scenariosCount,
        examples: examplesCount,
        corrections: correctionsCount,
      },
      learning: {
        lessonsProcessed,
        lessonsAwaitingApproval,
        knowledgeConflicts: unresolvedConflicts,
        unresolvedContradictions: unresolvedConflicts,
        supersededRules: supersededRulesCount,
        pendingReviews: pendingReviewsCount,
        currentKnowledgeVersion: maxRuleVersion?.version || 1,
      },
      testing: {
        scenariosTested: evalResults.length,
        correctDecisions,
        incorrectDecisions,
        needsReview: partialDecisions,
        totalEvaluations: evaluationsCount,
      },
      analysis: {
        currentMarketStatus: latestSnapshot ? latestSnapshot.marketState : 'No active session',
        currentAiState: latestSnapshot ? latestSnapshot.setupStatus : 'IDLE',
        activeScenario: latestSnapshot?.activeScenario || 'None active',
        currentSetupStatus: latestSnapshot ? latestSnapshot.setupStatus : 'NO_TRADE',
        latestUpdate: latestSnapshot?.createdAt ? new Date(latestSnapshot.createdAt).toLocaleTimeString() : null,
      },
      knowledgeCount: conceptsCount + rulesCount + exceptionsCount,
      activeRules: rulesCount,
      supersededRules: supersededRulesCount,
      currentKnowledgeVersion: maxRuleVersion?.version || 1,
      providers: {
        reasoning: { name: 'Google Gemini / Local', status: 'READY' },
        vision: { name: 'Multimodal Vision Engine', status: 'READY' },
        speech: { name: 'Whisper / Audio Parser', status: 'READY' },
        embeddings: { name: 'Local Cosine Vector Engine', status: 'READY' },
        marketData: { name: 'Local Market Data Stream', status: 'READY' },
      },
      aiProvider: process.env.DEFAULT_AI_PROVIDER
        ? process.env.DEFAULT_AI_PROVIDER.toUpperCase()
        : 'LOCAL',
      isOnline: true,
    };

    cachedStats = result;
    lastCacheTime = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    // Return honest zeroes if DB is initializing or empty
    return NextResponse.json({
      knowledge: {
        totalLessons: 0,
        concepts: 0,
        rules: 0,
        exceptions: 0,
        scenarios: 0,
        examples: 0,
        corrections: 0,
      },
      learning: {
        lessonsProcessed: 0,
        lessonsAwaitingApproval: 0,
        knowledgeConflicts: 0,
        unresolvedContradictions: 0,
      },
      testing: {
        scenariosTested: 0,
        correctDecisions: 0,
        incorrectDecisions: 0,
        needsReview: 0,
        totalEvaluations: 0,
      },
      analysis: {
        currentMarketStatus: 'No active session',
        currentAiState: 'IDLE',
        activeScenario: 'None active',
        currentSetupStatus: 'NO_TRADE',
        latestUpdate: null,
      },
      knowledgeCount: 0,
      activeRules: 0,
      aiProvider: 'LOCAL',
      isOnline: true,
    });
  }
}
