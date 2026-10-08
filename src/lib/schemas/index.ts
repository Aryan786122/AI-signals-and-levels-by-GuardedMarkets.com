import { z } from 'zod';

export const TradeDirectionSchema = z.enum(['LONG', 'SHORT', 'NEUTRAL']);

export const SetupStatusSchema = z.enum([
  'OBSERVATION',
  'SETUP_FORMING',
  'SETUP_CONFIRMED',
  'TRADE_CANDIDATE',
  'INVALID_SETUP',
  'WAIT',
  'NO_TRADE',
]);

export const RulePrioritySchema = z.enum([
  'CORE_RULE',
  'STRONG_RULE',
  'CONDITIONAL_RULE',
  'PREFERENCE',
  'OBSERVATION',
  'EXAMPLE',
]);

export const RuleStatusSchema = z.enum(['ACTIVE', 'SUPERSEDED', 'UNDER_REVIEW', 'DEPRECATED']);

export const StructuredAIResponseSchema = z.object({
  market_state: z.string(),
  active_concepts: z.array(z.string()).default([]),
  detected_scenarios: z.array(z.string()).default([]),
  setup_status: SetupStatusSchema,
  direction: TradeDirectionSchema,
  entry: z.number().nullable().default(null),
  stop_loss: z.number().nullable().default(null),
  take_profit: z.array(z.number()).default([]),
  invalidation: z.array(z.string()).default([]),
  supporting_rules: z.array(
    z.object({
      rule_id: z.string().optional(),
      title: z.string(),
      statement: z.string(),
      priority: RulePrioritySchema,
    })
  ).default([]),
  conflicting_rules: z.array(
    z.object({
      rule_id: z.string().optional(),
      title: z.string(),
      reason: z.string(),
    })
  ).default([]),
  reasoning: z.array(z.string()).default([]),
  missing_conditions: z.array(z.string()).default([]),
  confidence: z.number().nullable().default(null),
  timestamp: z.string().optional(),
  what_changed: z
    .object({
      previous_state: z.string(),
      new_information: z.string(),
      new_state: z.string(),
    })
    .optional(),
});

export const ConditionExtractionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  threshold: z.string().optional(),
  is_mandatory: z.boolean().default(true),
});

export const ExceptionExtractionSchema = z.object({
  name: z.string(),
  description: z.string(),
  override_behavior: z.string(),
  condition_logic: z.string(),
});

export const RuleExtractionSchema = z.object({
  title: z.string(),
  statement: z.string(),
  rationale: z.string().optional(),
  priority: RulePrioritySchema.default('CONDITIONAL_RULE'),
  conditions: z.array(ConditionExtractionSchema).default([]),
  exceptions: z.array(ExceptionExtractionSchema).default([]),
});

export const ExampleExtractionSchema = z.object({
  context: z.string(),
  market: z.string().optional(),
  timeframe: z.string().optional(),
  teacher_decision: z.string(),
  teacher_explanation: z.string(),
});

export const CounterExampleExtractionSchema = z.object({
  context: z.string(),
  market: z.string().optional(),
  timeframe: z.string().optional(),
  why_invalid: z.string(),
  teacher_explanation: z.string(),
});

export const DetectedConflictSchema = z.object({
  existing_rule_title: z.string(),
  existing_rule_id: z.string().optional(),
  conflict_type: z.enum(['DIRECT_CONTRADICTION', 'REFINEMENT', 'EXCEPTION']),
  ai_interpretation: z.string(),
  suggested_action: z.enum(['EXCEPTION', 'SUPERSEDE', 'SEPARATE']),
});

export const ExtractedLessonDataSchema = z.object({
  lesson_title: z.string(),
  summary: z.string(),
  primary_concept: z.string(),
  related_concepts: z.array(z.string()).default([]),
  rules: z.array(RuleExtractionSchema).default([]),
  positive_examples: z.array(ExampleExtractionSchema).default([]),
  counterexamples: z.array(CounterExampleExtractionSchema).default([]),
  detected_conflicts: z.array(DetectedConflictSchema).default([]),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const LessonApprovalSchema = z.object({
  lessonId: z.string(),
  approvedRules: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      statement: z.string(),
      priority: RulePrioritySchema,
      conditions: z.array(ConditionExtractionSchema),
      exceptions: z.array(ExceptionExtractionSchema),
    })
  ),
  primaryConceptName: z.string(),
  teacherNotes: z.string().optional(),
});
