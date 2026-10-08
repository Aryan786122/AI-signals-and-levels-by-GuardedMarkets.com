// Cognitive Architecture Domain Types (Sections 2, 5, 6, 8, 9, 10, 11, 12, 13)

export type MarketRegime =
  | 'TRENDING_BULLISH'
  | 'TRENDING_BEARISH'
  | 'RANGE_BOUND'
  | 'VOLATILITY_EXPANSION'
  | 'UNCLEAR';

export type MomentumState = 'ACCELERATING' | 'DECELERATING' | 'NEUTRAL';
export type VolatilityState = 'NORMAL' | 'COMPRESSED' | 'EXPANDED';

export type MarketEventType =
  | 'NEW_CANDLE'
  | 'LEVEL_APPROACH'
  | 'LEVEL_TOUCH'
  | 'LIQUIDITY_SWEEP'
  | 'BREAKOUT'
  | 'BREAKOUT_FAILURE'
  | 'RETEST'
  | 'STRUCTURE_BREAK'
  | 'REJECTION'
  | 'EXPANSION'
  | 'VOLATILITY_CHANGE'
  | 'SETUP_INVALIDATION'
  | 'TRADE_TRIGGER';

export interface MarketEventItem {
  id: string;
  eventType: MarketEventType;
  price: number;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MarketWorldState {
  instrument: string;
  timeframe: string;
  currentPrice: number;
  marketRegime: MarketRegime;
  momentum: MomentumState;
  volatility: VolatilityState;
  swingHighs: number[];
  swingLows: number[];
  supportLevels: number[];
  resistanceLevels: number[];
  liquidityZones: string[];
  activeScenario: string | null;
  recentEvents: MarketEventItem[];
  uncertaintyScore: number; // 0.0 (certain) to 1.0 (highly uncertain)
  lastUpdated: string;
}

export type EvidenceType =
  | 'OBSERVATION'
  | 'RULE'
  | 'EXCEPTION'
  | 'EXPERIENCE'
  | 'TEACHER_INSTRUCTION';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  description: string;
  sourceId?: string;
  weight: number; // 1 to 5
}

export interface CounterfactualItem {
  condition: string; // e.g. "IF price closes below 2640.00"
  consequence: string; // e.g. "THEN H1 invalidated and H2 (Failure) becomes dominant"
}

export interface CognitiveHypothesis {
  id: string;
  title: string; // e.g. "H1: Valid Breakout Continuation"
  probability: number; // 0 to 1
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  supportingEvidence: EvidenceItem[];
  contradictingEvidence: EvidenceItem[];
  missingEvidence: string[];
  expectedFutureBehavior: string;
  invalidationCondition: string;
  counterfactuals: CounterfactualItem[];
}

export type CognitiveDecisionState =
  | 'OBSERVE'
  | 'WAIT'
  | 'SETUP_FORMING'
  | 'WAIT_FOR_CONFIRMATION'
  | 'NO_TRADE'
  | 'INVALIDATED'
  | 'TRADE_CANDIDATE';

export interface NovelScenarioAnalysis {
  isExactMatchFound: boolean;
  closestExperienceId?: string;
  structuralSimilarities: string[];
  structuralDifferences: string[];
  applicablePrinciples: string[];
  uncertainties: string[];
}

export interface CognitiveDecision {
  state: CognitiveDecisionState;
  primaryHypothesis: CognitiveHypothesis;
  competingHypotheses: CognitiveHypothesis[];
  currentAction: string;
  whyThisAction: string[];
  whatWouldChangeMyMind: string[];
  novelScenarioAnalysis: NovelScenarioAnalysis;
  tradeProposal?: {
    setupName: string;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    entry: number | null;
    stopLoss: number | null;
    takeProfit: number[];
    riskRewardRatio: number | null;
    invalidation: string[];
  } | null;
  timestamp: string;
}

export interface ActiveLearningQuestionItem {
  id: string;
  question: string;
  context: string;
  proposedAction?: string | null;
  status: 'PENDING' | 'ANSWERED' | 'DISMISSED';
  teacherResponse?: 'YES' | 'NO' | 'EDIT' | 'IGNORE' | null;
  teacherNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface ProposedPrincipleItem {
  id: string;
  title: string;
  statement: string;
  rationale: string;
  scope: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  confidence: number;
  supportingExperiences?: string[];
  sourceLessonsText?: string[];
  teacherNotes?: string | null;
  createdAt: string;
}

// ===============================================
// MULTIMODAL TEACHING INGESTION & TEMPORAL FUSION
// ===============================================

export type StatementClassification =
  | 'OBSERVATION'
  | 'DEFINITION'
  | 'PRINCIPLE'
  | 'RULE'
  | 'EXCEPTION'
  | 'PREFERENCE'
  | 'EXAMPLE'
  | 'COUNTEREXAMPLE'
  | 'HYPOTHESIS'
  | 'QUESTION'
  | 'UNCERTAINTY'
  | 'CORRECTION'
  | 'AUDIO'
  | 'SCREEN'
  | 'CURSOR'
  | 'DRAWING'
  | 'TEACHING'
  | string;

export interface CursorStateEvent {
  action:
    | 'ENTER_REGION'
    | 'PAUSE_ON_LEVEL'
    | 'POINT_AT_LEVEL'
    | 'POINT_AT_CANDLE'
    | 'POINT_AT_ANNOTATION'
    | 'FOLLOW_PRICE'
    | 'POINTER_HOVER'
    | 'IDLE';
  x?: number;
  y?: number;
  targetDescription?: string;
}

export interface AnnotationStateEvent {
  type:
    | 'HORIZONTAL_LINE'
    | 'TRENDLINE'
    | 'BOX'
    | 'ARROW'
    | 'CIRCLE'
    | 'CANDLE_MARK'
    | 'NONE';
  coordinates?: Record<string, unknown>;
  label?: string;
}

export interface TeachingEventItem {
  id: string;
  lessonId: string;
  timestampSec: number;
  durationSec?: number;
  audioSegment?: string;
  visualState?: Record<string, unknown>;
  cursorState?: CursorStateEvent;
  annotationState?: AnnotationStateEvent;
  detectedMarketObjects?: string[];
  teacherIntent?: string;
  statementClassification?: StatementClassification;
  conceptsReferenced?: string[];
  candidateRule?: string;
  candidateException?: string;
  confidence: number;
  evidence?: string;
}

export interface CandidateRuleItem {
  id?: string;
  title: string;
  statement: string;
  rationale?: string;
  priority: string;
  tradePhase: string;
  conditions: Array<{ name: string; field: string; operator: string; threshold?: string }>;
  exceptions: Array<{ description: string; overrideBehavior: string }>;
  evidence: string;
  timestampSec?: number;
}

export interface CandidateExceptionItem {
  id?: string;
  name: string;
  description: string;
  overrideBehavior: string;
  conditionLogic: string;
  parentRuleTitle?: string;
  evidence: string;
  timestampSec?: number;
}

export interface CandidateCounterExampleItem {
  id?: string;
  title: string;
  market?: string;
  context: string;
  whyInvalid: string;
  teacherExplanation: string;
  evidence: string;
  timestampSec?: number;
}

export interface CandidateUncertaintyItem {
  id: string;
  quote: string;
  classification: 'PREFERENCE' | 'UNCERTAINTY' | 'OBSERVATION';
  prompt: string;
  suggestedRule?: string;
  timestampSec: number;
  status: 'PENDING' | 'CONVERTED_TO_RULE' | 'DISMISSED';
}

export interface CandidateKnowledge {
  concepts: Array<{
    id?: string;
    name: string;
    category: string;
    definition: string;
    importance: number;
  }>;
  rules: CandidateRuleItem[];
  exceptions: CandidateExceptionItem[];
  counterexamples: CandidateCounterExampleItem[];
  relationships: Array<{
    from: string;
    to: string;
    relationType: string;
    description?: string;
  }>;
  uncertainties: CandidateUncertaintyItem[];
  teachingEvents: TeachingEventItem[];
  confidence: number;
  claims?: TeachingClaim[];
  stateTransitions?: StateTransitionSequence[];
  semanticRelationships?: SemanticRelationship[];
}

// ===============================================
// GROUND-TRUTH MEDIA FACTS, PERCEPTION & TIMELINE
// ===============================================

export interface MediaInspection {
  durationSeconds: number;
  videoDurationSeconds: number | null;
  audioDurationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  fileSizeBytes: number;
}

export type ScreenType =
  | 'TRADINGVIEW'
  | 'OBS'
  | 'BROWSER'
  | 'DESKTOP'
  | 'VIDEO_PLAYER'
  | 'CHART'
  | 'OTHER'
  | 'UNKNOWN';

export type VisualObjectType =
  | 'CANDLE'
  | 'PRICE_LEVEL'
  | 'SUPPORT'
  | 'RESISTANCE'
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'TRENDLINE'
  | 'RECTANGLE'
  | 'ARROW'
  | 'CIRCLE'
  | 'LIQUIDITY_ZONE'
  | 'INDICATOR'
  | 'PRICE_LABEL'
  | 'ENTRY_MARKER'
  | 'SL_MARKER'
  | 'TP_MARKER'
  | 'CHART_REGION';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualObject {
  id?: string;
  type: VisualObjectType | string;
  confidence: number;
  label?: string;
  boundingBox?: BoundingBox;
  centerPoint?: { x: number; y: number };
  evidenceFrameId?: string;
  priceValue?: number | string;
  properties?: Record<string, any>;
}

export interface DrawingObservation {
  id: string;
  type: 'RECTANGLE' | 'HORIZONTAL_LINE' | 'TRENDLINE' | 'ARROW' | 'CIRCLE' | 'FREEHAND' | string;
  label?: string;
  createdAt: number;
  removedAt?: number | null;
  region?: BoundingBox;
  priceRange?: [number, number] | string;
  color?: string;
  evidenceFrames: string[];
}

export interface CursorObservation {
  timestamp: number;
  x: number;
  y: number;
  chartRelativeX?: number;
  chartRelativeY?: number;
  state?: 'ENTER_REGION' | 'HOVER' | 'PAUSE' | 'MOVE' | 'LEAVE_REGION';
  action?: 'POINTING_AT_LEVEL' | 'DRAWING' | 'FOLLOWING_PRICE' | 'IDLE';
  hoverTarget?: string;
}

export interface OCRText {
  text: string;
  confidence: number;
  boundingBox?: BoundingBox;
  timestamp: number;
}

export interface VisualChange {
  type: 'DRAWING_APPEARED' | 'DRAWING_REMOVED' | 'CURSOR_MOVED' | 'APPLICATION_SHIFT' | 'PRICE_TICK' | 'MAJOR_CHANGE';
  description: string;
  diffScore: number;
  region?: BoundingBox;
}

export interface VisualObservation {
  frameId: string;
  timestamp: number;
  timestampSec: number;
  imagePath: string;

  application: {
    primary: string | null;
    secondary: string | null;
  };

  screenType: ScreenType;

  chart: {
    detected: boolean;
    instrument: string | null;
    timeframe: string | null;
    visiblePriceRange: string | null;
    chartRegion?: BoundingBox;
  };

  objects: VisualObject[];
  drawings: DrawingObservation[];
  cursor: CursorObservation | null;
  visibleText: OCRText[];
  changesFromPreviousFrame: VisualChange[];
  rawVisionNotes?: string;
}

export type VisualEventType =
  | 'APPLICATION_DETECTED'
  | 'APPLICATION_CHANGED'
  | 'CHART_CHANGED'
  | 'TIMEFRAME_CHANGED'
  | 'ZOOM_CHANGED'
  | 'PAN_CHANGED'
  | 'DRAWING_CREATED'
  | 'DRAWING_REMOVED'
  | 'DRAWING_MODIFIED'
  | 'CURSOR_ATTENTION'
  | 'CURSOR_PAUSE'
  | 'MAJOR_VISUAL_CHANGE';

export interface VisualEvent {
  id: string;
  timestampSec: number;
  type: VisualEventType;
  sourceFrameIds: string[];
  observationIds?: string[];
  data: Record<string, any>;
  description: string;
}

export interface TimelineEvent {
  id: string;
  timestampSec: number;
  durationSec: number;
  type: string;
  source: 'AUDIO' | 'VIDEO' | 'SCREEN' | 'CURSOR' | 'DRAWING' | 'AI_OBSERVATION' | 'TEACHING';
  data: Record<string, any>;
  description: string;
}

export interface TeacherReferenceCandidate {
  spokenPhrase: string;
  timestampSec: number;
  likelyVisualReferent: {
    type: string;
    label: string;
    objectId?: string;
    drawingId?: string;
    coordinates?: Record<string, any>;
  };
  evidence: string;
  evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MultimodalTeachingEpisode {
  id: string;
  startTimeSec: number;
  endTimeSec: number;
  audioEvidence: Array<{ timestampSec: number; text: string }>;
  visualEvidence: Array<{ timestampSec: number; frameId: string; description: string }>;
  cursorEvidence: Array<{ timestampSec: number; action: string; position: { x: number; y: number } }>;
  drawingEvidence: Array<{ timestampSec: number; drawingType: string; label?: string }>;
  transcriptText: string;
  visualObjects: VisualObject[];
  teacherReferenceCandidates: TeacherReferenceCandidate[];
  semanticInterpretation: string;
  evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TeachingSegmentItem {
  id: string;
  startTimeSec: number;
  endTimeSec: number;
  title: string;
  transcriptText: string;
  visualSummary: string;
  concepts: string[];
  events: TimelineEvent[];
}

export interface KnowledgeCandidate {
  id: string;
  type: 'CONCEPT' | 'RULE' | 'EXCEPTION' | 'PREFERENCE' | 'PROCEDURE' | 'EXAMPLE' | 'COUNTEREXAMPLE' | 'UNCERTAINTY';
  title: string;
  statement: string;
  sourceSegmentId?: string;
  evidenceEventIds: string[];
  supportingTranscriptSegments: Array<{ timestampSec: number; text: string }>;
  supportingFrames: Array<{ timestampSec: number; imagePath?: string; description?: string }>;
  contradictions?: string[];
  interpretation: string;
  evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  timestampSec?: number;
}

// ===============================================
// TEACHING LOGIC ENGINE & SEMANTIC CLAIM ARCHITECTURE
// ===============================================

export type TeachingClaimType =
  | 'OBSERVATION'
  | 'CONCEPT'
  | 'DEFINITION'
  | 'RELATIONSHIP'
  | 'CONDITIONAL_HYPOTHESIS'
  | 'RULE_CANDIDATE'
  | 'EXCEPTION'
  | 'PREFERENCE'
  | 'PROCEDURE'
  | 'PREDICTION'
  | 'CAUSAL_EXPLANATION'
  | 'EXAMPLE'
  | 'COUNTEREXAMPLE'
  | 'CORRECTION'
  | 'SUMMARY'
  | 'QUESTION'
  | 'UNCERTAINTY';

export interface ClaimCondition {
  id: string;
  text: string;
  explicit: boolean;
  inferred: boolean;
  sourceSegmentId?: string;
}

export interface TeachingClaim {
  id: string;
  lessonId: string;
  type: TeachingClaimType;
  title: string;
  subject: string;
  predicate: string;
  object: string;
  statement: string;
  conditions: ClaimCondition[];
  expectedOutcome?: string;
  action?: string;
  invalidationConditions: ClaimCondition[];
  contradictingEvidence?: string[];
  whatWouldChangeMyMind?: string;
  reasoningChain: string[];
  evidenceEventIds: string[];
  sourceTranscriptIds: string[];
  sourceFrameIds: string[];
  confidence: number;
  evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceQualityRationale: string[];
  explicit: boolean;
  inferred: boolean;
  timestampSec?: number;
  status: 'CANDIDATE' | 'APPROVED' | 'REJECTED';
}

export interface SemanticEntity {
  id: string;
  name: string;
  type: 'ZONE' | 'LEVEL' | 'CANDLESTICK' | 'STRUCTURE' | 'TIMEFRAME' | 'INSTRUMENT' | 'CONCEPT';
  priceZone?: string;
  firstMentionSec: number;
  lastMentionSec: number;
  drawingId?: string;
  frameIds: string[];
  referencesCount: number;
}

export interface SemanticRelationship {
  id: string;
  sourceEntityId: string;
  sourceEntityName: string;
  targetEntityId: string;
  targetEntityName: string;
  relationshipType:
    | 'PREVIOUSLY_RESPECTED_BY'
    | 'EXPECTED_REACTION'
    | 'RETESTED_BY'
    | 'DEFINED_AS'
    | 'COMPRISES'
    | 'CONDITIONED_ON'
    | 'INVALIDATED_BY'
    | 'SUBORDINATE_TO';
  description: string;
  explicit: boolean;
  inferred: boolean;
  evidence: string;
  timestampSec: number;
}

export interface StateTransitionNode {
  step: number;
  stateName: string;
  description: string;
  expected: boolean;
  observed: boolean;
  timeSec?: number;
}

export interface StateTransitionSequence {
  id: string;
  name: string;
  description: string;
  states: StateTransitionNode[];
  sourceClaimId?: string;
  evidence: string;
}

export type TeacherIntent =
  | 'INTRODUCE_CONCEPT'
  | 'DEFINE_CONCEPT'
  | 'IDENTIFY_OBJECT'
  | 'EXPLAIN_RELATIONSHIP'
  | 'TEACH_CONDITION'
  | 'DESCRIBE_EXPECTED_BEHAVIOR'
  | 'DEMONSTRATE_PROCESS'
  | 'GIVE_RULE'
  | 'GIVE_EXCEPTION'
  | 'COMPARE'
  | 'CORRECT_MISTAKE'
  | 'SUMMARIZE';

export interface SessionMemory {
  activeEntities: SemanticEntity[];
  activeConcepts: Array<{ name: string; category: string; definition: string; firstMentionSec: number }>;
  activeClaims: TeachingClaim[];
  activeVisualReferences: Array<{ label: string; objectId: string; type: string; priceZone?: string; timestampSec: number }>;
  unresolvedReferences: Array<{ phrase: string; timestampSec: number }>;
  previousObservations: Array<{ statement: string; timestampSec: number }>;
}

export interface TeachingUnderstandingResult {
  lessonId: string;
  claims: TeachingClaim[];
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  stateTransitions: StateTransitionSequence[];
  sessionMemory: SessionMemory;
  diagnostics: Record<string, any>;
}



