// Screen Perception & Top-Down Procedure Reasoning Domain Types

import { GroundedProvenance, LearnedLevel } from './adaptive';

export interface VisibleDrawingObject {
  id: string;
  label: string;
  type: 'ZONE' | 'RECTANGLE' | 'LINE' | 'ARROW' | 'ANNOTATION' | 'UNKNOWN';
  priceRange?: string;
  color?: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ObservedScreenFact {
  symbol: string | 'UNKNOWN';
  timeframe: string | 'UNKNOWN';
  currentPrice?: number;
  priceScaleVisible: boolean;
  chartDetected: boolean;
  appName?: string;
  screenType: 'TRADINGVIEW' | 'CHART_WINDOW' | 'DESKTOP' | 'UNKNOWN';
  visibleLevels: VisibleDrawingObject[];
  visibleCandlesCount?: number;
  timestamp: string;
  confidence: number;
  rawAnalysisText?: string;
}

export interface LearnedProcedure {
  id: string;
  title: string;
  triggerContext: {
    timeframe?: string;
    symbol?: string;
    conditionDescription: string;
  };
  stepOrder: number;
  requiredAction: string; // e.g., "Inspect 4H higher timeframe"
  targetTimeframe?: string;
  rationale: string; // e.g., "Teacher methodology requires higher-timeframe structural context before analyzing lower-timeframe candles."
  sourceLessonTitle: string;
  sourceLessonId: string;
  sourceTimestampSec?: number;
  sourceQuote: string;
}

export interface ScreenReasoningOutput {
  observation: ObservedScreenFact;
  status:
    | 'OBSERVING'
    | 'PROCEDURE_ACTIVE'
    | 'LEVEL_MONITORING'
    | 'WAITING_FOR_CONFIRMATION'
    | 'UNTAUGHT_CONTEXT';
  methodologyState: 'TAUGHT' | 'NONE_TAUGHT';
  activeProcedure?: LearnedProcedure;
  nextAction?: string;
  actionReason?: string;
  teacherPromptQuestion?: string;
  matchedLevel?: LearnedLevel;
  conditionsPresent: string[];
  missingConditions: string[];
  expectedBehavior?: string;
  notTaught: string[];
  provenance: GroundedProvenance;
  lastUpdated: string;
}
