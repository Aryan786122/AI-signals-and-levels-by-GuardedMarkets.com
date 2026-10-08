// Domain Types for GuardedMarketsAI

export type LessonStatus = 'DRAFT' | 'EXTRACTED' | 'REVIEW_PENDING' | 'APPROVED' | 'REJECTED';

export type KnowledgeItemType =
  | 'CONCEPT'
  | 'DEFINITION'
  | 'PRINCIPLE'
  | 'RULE'
  | 'CONDITION'
  | 'EXCEPTION'
  | 'SETUP'
  | 'SCENARIO'
  | 'EXAMPLE'
  | 'COUNTEREXAMPLE'
  | 'INVALIDATION'
  | 'ENTRY_RULE'
  | 'SL_RULE'
  | 'TP_RULE'
  | 'CONTEXT_RULE'
  | 'PREFERENCE'
  | 'OBSERVATION'
  | 'CORRECTION';

export type RulePriority =
  | 'CORE_RULE'
  | 'STRONG_RULE'
  | 'CONDITIONAL_RULE'
  | 'PREFERENCE'
  | 'OBSERVATION'
  | 'EXAMPLE';

export type RuleStatus = 'ACTIVE' | 'SUPERSEDED' | 'UNDER_REVIEW' | 'DEPRECATED' | 'ARCHIVED' | 'PENDING_REVIEW';

// 12 Typed Knowledge Relationships (Section 3)
export type RelationType =
  | 'REQUIRES'
  | 'CONDITIONED_BY'
  | 'INVALIDATED_BY'
  | 'EXCEPTION_TO'
  | 'OVERRIDES'
  | 'STRENGTHENED_BY'
  | 'WEAKENED_BY'
  | 'CONFIRMS'
  | 'CONFLICTS_WITH'
  | 'SUPERSEDES'
  | 'DERIVED_FROM'
  | 'RELATED_TO'
  | 'CORRELATES_WITH';

export type RuleScope =
  | 'GLOBAL'
  | 'ASSET_SPECIFIC'
  | 'TIMEFRAME_SPECIFIC'
  | 'SESSION_SPECIFIC'
  | 'SCENARIO_SPECIFIC';

export type TradePhase =
  | 'SETUP_RECOGNITION'
  | 'ENTRY'
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'INVALIDATION'
  | 'TRADE_MANAGEMENT'
  | 'RISK_MANAGEMENT';

export type CorrectionType =
  | 'WRONG_SETUP'
  | 'MISSING_CONDITION'
  | 'EXCEPTION_IGNORED'
  | 'WRONG_ENTRY'
  | 'WRONG_SL'
  | 'WRONG_TP'
  | 'CONTEXT_MISUNDERSTOOD'
  | 'OTHER';

export type LessonAnalysisState =
  | 'TEXT_ONLY'
  | 'VOICE_ANALYZED'
  | 'VIDEO_ANALYZED'
  | 'MULTIMODAL_COMPLETE';

export type ConflictStatus = 'UNRESOLVED' | 'RESOLVED' | 'DISMISSED';

export type TradeDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export type SetupStatus =
  | 'OBSERVATION'
  | 'SETUP_FORMING'
  | 'SETUP_CONFIRMED'
  | 'TRADE_CANDIDATE'
  | 'INVALID_SETUP'
  | 'WAIT'
  | 'NO_TRADE';

export type ExamResultStatus = 'CORRECT' | 'PARTIALLY_CORRECT' | 'WRONG';

// Structured AI Market Reasoning Output (Section 18)
export interface StructuredAIResponse {
  market_state: string;
  active_concepts: string[];
  detected_scenarios: string[];
  setup_status: SetupStatus;
  direction: TradeDirection;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number[];
  invalidation: string[];
  supporting_rules: Array<{
    rule_id?: string;
    title: string;
    statement: string;
    priority: RulePriority;
  }>;
  conflicting_rules: Array<{
    rule_id?: string;
    title: string;
    reason: string;
  }>;
  reasoning: string[];
  missing_conditions: string[];
  confidence: number | null;
  timestamp?: string;
  what_changed?: {
    previous_state: string;
    new_information: string;
    new_state: string;
  };
}

// Extracted Lesson Knowledge Structure (Section 8, 9, 10)
export interface ExtractedLessonData {
  lesson_title: string;
  summary: string;
  primary_concept: string;
  related_concepts: string[];
  rules: Array<{
    title: string;
    statement: string;
    rationale?: string;
    priority: RulePriority;
    conditions: Array<{
      field: string;
      operator: string;
      threshold?: string;
      is_mandatory: boolean;
    }>;
    exceptions: Array<{
      name: string;
      description: string;
      override_behavior: string;
      condition_logic: string;
    }>;
  }>;
  positive_examples: Array<{
    context: string;
    market?: string;
    timeframe?: string;
    teacher_decision: string;
    teacher_explanation: string;
  }>;
  counterexamples: Array<{
    context: string;
    market?: string;
    timeframe?: string;
    why_invalid: string;
    teacher_explanation: string;
  }>;
  detected_conflicts: Array<{
    existing_rule_title: string;
    existing_rule_id?: string;
    conflict_type: 'DIRECT_CONTRADICTION' | 'REFINEMENT' | 'EXCEPTION';
    ai_interpretation: string;
    suggested_action: 'EXCEPTION' | 'SUPERSEDE' | 'SEPARATE';
  }>;
  confidence: number;
}

// Conflict Resolution Suggestion (Section 13)
export interface ConflictResolutionSuggestion {
  rule_a_id: string;
  rule_b_id: string;
  relationship: 'EXCEPTION' | 'SUPERSEDES' | 'SEPARATE' | 'REFINE';
  ai_interpretation: string;
  question: string;
  recommended_action: string;
}

// Scenario Evaluation
export interface ScenarioEvaluationResult {
  scenario_id: string;
  name: string;
  conditions_met: Array<{
    step: number;
    description: string;
    status: 'MET' | 'UNMET' | 'PENDING';
  }>;
  is_valid: boolean;
  status: SetupStatus;
  suggested_action: string;
  invalidation_triggers: string[];
}

// Knowledge Citations (Section 24)
export interface KnowledgeCitation {
  type: 'RULE' | 'EXCEPTION' | 'EXAMPLE' | 'COUNTEREXAMPLE' | 'LESSON';
  id?: string;
  title: string;
  detail?: string;
  timestamp?: string; // e.g., "02:15"
}

// Chat Message format
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: KnowledgeCitation[];
}

// Context passed into AI reasoning
export interface KnowledgeContext {
  concepts: Array<{ id: string; name: string; definition: string }>;
  rules: Array<{ id: string; title: string; statement: string; priority: RulePriority }>;
  exceptions: Array<{ id: string; ruleId: string; description: string; overrideBehavior: string }>;
  recentLessons: Array<{ id: string; title: string; summary?: string }>;
}

// Market Candle Data
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  description: string;
  timeframes: string[];
  currentPrice: number;
}

// Provider Interfaces
export interface AnalysisParams {
  symbol?: string;
  timeframe?: string;
  marketData?: Candle[];
  chartImageBase64?: string;
  screenDiffScore?: number;
  context: KnowledgeContext;
  promptOverride?: string;
}

export interface ExtractLessonParams {
  transcriptText: string;
  timestamps?: Array<{ start: number; end: number; text: string }>;
  lessonTitle?: string;
  existingKnowledgeContext: KnowledgeContext;
}

export interface ConflictResolutionParams {
  ruleA: { id: string; title: string; statement: string };
  ruleB: { id: string; title: string; statement: string };
}

export interface ScenarioEvalParams {
  scenarioName: string;
  conditions: Array<{ step: number; description: string }>;
  currentMarketCandles: Candle[];
  context: KnowledgeContext;
}

export interface ChartVisionAnalysis {
  identified_levels: Array<{
    type: 'SUPPORT' | 'RESISTANCE' | 'LIQUIDITY_POOL' | 'EQUILIBRIUM' | 'TRENDLINE' | 'ZONE' | 'UNKNOWN' | string;
    price_level?: number;
    description: string;
  }>;
  market_structure: 'BULLISH_TREND' | 'BEARISH_TREND' | 'RANGE' | 'CHOPPY' | 'UNCLEAR' | 'CONSOLIDATION' | 'UNKNOWN' | string;
  recent_candle_interpretation: string;
  notable_patterns: string[];
  raw_vision_notes: string;
  detected_annotations?: string[];
  screen_type?: string;
}

export interface TranscriptSegment {
  startTimeSec: number;
  endTimeSec: number;
  text: string;
  confidence?: number;
  speakerId?: string;
}

export interface TranscriptResult {
  fullText: string;
  segments: TranscriptSegment[];
  language: string;
  coveragePercentage?: number;
  error?: string;
}

// Provider Contracts
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  analyze(params: AnalysisParams): Promise<StructuredAIResponse>;
  extractLesson(params: ExtractLessonParams): Promise<ExtractedLessonData>;
  resolveConflict(params: ConflictResolutionParams): Promise<ConflictResolutionSuggestion>;
  evaluateScenario(params: ScenarioEvalParams): Promise<ScenarioEvaluationResult>;
  chat(messages: ChatMessage[], context: KnowledgeContext): Promise<string>;
}

export interface VisionProvider {
  readonly id: string;
  readonly name: string;
  analyzeChart(imageBuffer: Buffer, context?: { symbol?: string; timeframe?: string; lessonId?: string }): Promise<ChartVisionAnalysis>;
}

export interface SpeechProvider {
  readonly id: string;
  readonly name: string;
  transcribe(audioBuffer: Buffer | string, options?: { language?: string }): Promise<TranscriptResult>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly name: string;
  getSymbol(symbol: string): Promise<SymbolInfo>;
  getHistoricalCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
  getLatestCandle(symbol: string, timeframe: string): Promise<Candle>;
  subscribeToUpdates(symbol: string, timeframe: string, callback: (c: Candle) => void): () => void;
}

export interface ScreenCaptureOptions {
  fps?: number;
  cropRegion?: { x: number; y: number; width: number; height: number };
}

export interface ScreenCaptureProvider {
  readonly id: string;
  readonly name: string;
  startCapture(options?: ScreenCaptureOptions): Promise<boolean>;
  stopCapture(): Promise<void>;
  isCapturing(): boolean;
  captureFrame(): Promise<{ buffer: Buffer; timestamp: number; width: number; height: number } | null>;
}

export * from './cognitive';
