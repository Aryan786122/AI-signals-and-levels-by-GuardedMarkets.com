// Adaptive Learning & Canonical Brain Domain Types (Phase 3 & Phase 3.5 Grounded Overlay)

import { TeachingClaim, StateTransitionSequence, SemanticRelationship } from './cognitive';
import { LearnedProcedure } from './screenPerception';

export type KnowledgeSourceType =
  | 'TEACHER_TAUGHT'
  | 'AI_INFERRED'
  | 'MARKET_OBSERVATION'
  | 'SYSTEM_KNOWLEDGE';

export interface GroundedProvenance {
  sourceType: KnowledgeSourceType;
  sourceLessonTitle?: string;
  sourceLessonId?: string;
  sourceTimestampSec?: number;
  sourceTimestampFormatted?: string;
  sourceEvidenceQuotes: string[];
  teacherApproved: boolean;
  knowledgeVersion: string;
  whyThisAnalysis: {
    teacherTaughtQuote: string;
    laterTeachingQuote?: string;
    currentObservation: string;
    conclusion: string;
    notTaught: string[];
  };
}

export interface LearnedLevel {
  id: string;
  name: string;
  type: 'SUPPORT' | 'RESISTANCE' | 'SWING_HIGH' | 'SWING_LOW' | 'KEY_ZONE';
  priceMin: number;
  priceMax: number;
  priceZoneStr: string;
  whatItIs: string;
  whyRelevant: string;
  sourceLessonTitle: string;
  sourceLessonId: string;
  sourceTimestampSec?: number;
  sourceQuote?: string;
  learnedConditions: string[];
  expectedBehavior: string;
  missingConfirmation: string;
  invalidation: string;
  sourceType: KnowledgeSourceType;
}

export type AdaptiveQuestionType =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'SCENARIO'
  | 'VISUAL_CHART'
  | 'EXCEPTION'
  | 'WHAT_WOULD_YOU_DO'
  | 'COUNTEREXAMPLE';

export interface AdaptiveQuestionItem {
  id: string;
  type: AdaptiveQuestionType;
  prompt: string;
  scenarioContext?: string;
  chartImageUrl?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  knowledgeType: string; // CONCEPT, HYPOTHESIS, RULE, EXCEPTION, STATE_SEQUENCE, PREFERENCE
  knowledgeId: string;
  sourceLessonId?: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isFollowUp: boolean;
  parentQuestionId?: string;
  targetedMisconception?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export interface QuestionEvaluationResult {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  expectedAnswer: string;
  userAnswer: string;
  explanation: string;
  reasoningError?: string;
  misconception?: string;
  teacherCorrection?: string;
  conceptName?: string;
  newMasteryScore: number;
  followUpQuestion?: AdaptiveQuestionItem;
}

export interface ConceptMasterySummary {
  conceptName: string;
  masteryScore: number; // 0.0 - 1.0
  totalAttempts: number;
  correctAttempts: number;
  status: 'STRONG' | 'ADEQUATE' | 'WEAK' | 'UNTESTED';
  knownMisconceptions: string[];
  lastTestedAt?: string;
}

export interface BrainSnapshot {
  version: number;
  versionTag: string;
  lastUpdated: string;
  isSynced: boolean;
  itemCounts: {
    concepts: number;
    rules: number;
    hypotheses: number;
    observations: number;
    stateTransitions: number;
    levels: number;
    procedures: number;
    scenarios: number;
    questions: number;
    exceptions: number;
  };
  concepts: Array<{
    id: string;
    name: string;
    category: string;
    definition: string;
    importance: number;
    sourceLesson?: string;
  }>;
  claims: TeachingClaim[];
  rules: any[];
  stateTransitions: StateTransitionSequence[];
  learnedLevels: LearnedLevel[];
  procedures: LearnedProcedure[];
  relationships: SemanticRelationship[];
  scenarios: any[];
  mastery: ConceptMasterySummary[];
}

export interface MarketEvaluationState {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  state: 'NO_SETUP' | 'WATCH' | 'SETUP_FORMING' | 'CONFIRMED' | 'INVALIDATED' | 'WAIT';
  bias: 'UNDEFINED' | 'NEUTRAL' | 'LONG' | 'SHORT';
  sourceType: KnowledgeSourceType;
  matchedLevel?: LearnedLevel;
  activeHypothesis?: TeachingClaim;
  conditionsPresent: string[];
  missingConditions: string[];
  expectedBehavior: string;
  entry: string; // e.g. "NOT DEFINED BY TEACHER KNOWLEDGE" or specific formula if taught
  stopLoss: string; // "NOT DEFINED BY TEACHER KNOWLEDGE" or level
  takeProfit: string[];
  isExecutable: boolean;
  reasoning: string[];
  invalidation: string[];
  notTaught: string[];
  provenance: GroundedProvenance;
  discoveredPatterns?: string[];
  lastUpdated: string;
}
