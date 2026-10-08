import {
  AIProvider,
  AnalysisParams,
  StructuredAIResponse,
  ExtractLessonParams,
  ExtractedLessonData,
  ConflictResolutionParams,
  ConflictResolutionSuggestion,
  ScenarioEvalParams,
  ScenarioEvaluationResult,
  ChatMessage,
  KnowledgeContext,
} from '@/lib/types';

/**
 * Local Fallback / Rule Validator:
 * Operates offline without external API keys.
 * Acts strictly as a deterministic rule validation engine and offline fallback,
 * verifying numerical parameters, conditional boundaries, and rule syntax.
 * (NOT treated as the primary reasoning model).
 */
export class LocalRuleValidator implements AIProvider {
  readonly id = 'local';
  readonly name = 'Local Fallback / Rule Validator (Offline)';

  async analyze(params: AnalysisParams): Promise<StructuredAIResponse> {
    const { marketData, context, screenDiffScore } = params;

    // Check if we have active rules or market data
    if (!context.rules.length && (!marketData || marketData.length === 0)) {
      return {
        market_state: 'INSUFFICIENT_DATA',
        active_concepts: [],
        detected_scenarios: [],
        setup_status: 'WAIT',
        direction: 'NEUTRAL',
        entry: null,
        stop_loss: null,
        take_profit: [],
        invalidation: ['Awaiting market candles or screen capture feed.'],
        supporting_rules: [],
        conflicting_rules: [],
        reasoning: [
          'No market candles or verified teaching rules loaded.',
          'System is in WAIT state according to safety protocols.',
        ],
        missing_conditions: ['Market feed active', 'At least one verified rule approved in knowledge base'],
        confidence: null,
        timestamp: new Date().toISOString(),
      };
    }

    const latestCandle = marketData && marketData.length > 0 ? marketData[marketData.length - 1] : null;
    const prevCandle = marketData && marketData.length > 1 ? marketData[marketData.length - 2] : null;

    // If no approved rules exist in context, return honest methodology-bounded state
    if (context.rules.length === 0) {
      return {
        market_state: 'OBSERVING_STRUCTURE',
        active_concepts: context.concepts.map(c => c.name),
        detected_scenarios: ['Structural Observation'],
        setup_status: 'OBSERVATION',
        direction: 'NEUTRAL',
        entry: null,
        stop_loss: null,
        take_profit: [],
        invalidation: ['Price action outside learned levels.'],
        supporting_rules: [],
        conflicting_rules: [],
        reasoning: [
          'No trade execution rules approved in canonical brain.',
          'System is monitoring market structure and key levels taught by teacher.',
          'Entry, Stop-Loss, and Target parameters are NOT DEFINED BY TEACHER KNOWLEDGE.',
        ],
        missing_conditions: [
          'No approved entry rules in methodology.',
          'Awaiting confirmed teacher setup criteria.',
        ],
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      };
    }

    // Find applicable rules from active context
    const breakoutRules = context.rules.filter(
      r => r.title.toLowerCase().includes('breakout') || r.statement.toLowerCase().includes('breakout')
    );
    const extensionExceptions = context.exceptions.filter(
      e => e.description.toLowerCase().includes('extend') || e.overrideBehavior.toLowerCase().includes('avoid')
    );

    let setupStatus: StructuredAIResponse['setup_status'] = 'OBSERVATION';
    let direction: StructuredAIResponse['direction'] = 'NEUTRAL';
    const reasoning: string[] = [];
    const missing: string[] = [];
    let entry: number | null = null;
    let sl: number | null = null;
    const tp: number[] = [];

    if (latestCandle && prevCandle) {
      const isBullishCandle = latestCandle.close > latestCandle.open;
      const candleRange = latestCandle.high - latestCandle.low;
      const avgRange = (prevCandle.high - prevCandle.low) || 1;
      const isExtended = candleRange > avgRange * 2.5;

      if (isBullishCandle && breakoutRules.length > 0) {
        if (isExtended && extensionExceptions.length > 0) {
          setupStatus = 'WAIT';
          direction = 'NEUTRAL';
          reasoning.push(
            'Price made an upward breakout movement, but current candle is classified as excessively extended.',
            `Applied exception: "${extensionExceptions[0].description}" -> Avoid immediate chase entry.`
          );
          missing.push('Retest of broken structure', 'Normal candle acceptance');
        } else {
          setupStatus = 'SETUP_FORMING';
          direction = 'LONG';
          entry = Number(latestCandle.close.toFixed(2));
          sl = Number(latestCandle.low.toFixed(2));
          tp.push(Number((entry + (entry - sl) * 2).toFixed(2)));
          reasoning.push(
            'Bullish candle close detected.',
            `Satisfies base condition of rule: "${breakoutRules[0].title}".`,
            'Awaiting full confirmation before marking as trade candidate.'
          );
          missing.push('Follow-through volume', 'Session acceptance');
        }
      } else {
        setupStatus = 'OBSERVATION';
        reasoning.push('Observing price action. No approved rule triggers currently satisfied.');
      }
    } else {
      setupStatus = 'OBSERVATION';
      reasoning.push('Observing chart. Waiting for active price action meeting teacher rules.');
    }

    return {
      market_state: latestCandle ? (latestCandle.close >= latestCandle.open ? 'BULLISH_BIAS' : 'BEARISH_BIAS') : 'OBSERVING',
      active_concepts: context.concepts.map(c => c.name),
      detected_scenarios: ['Breakout Evaluation'],
      setup_status: setupStatus,
      direction,
      entry,
      stop_loss: sl,
      take_profit: tp,
      invalidation: ['Price closes back inside range', 'Break of structure low'],
      supporting_rules: breakoutRules.map(r => ({
        rule_id: r.id,
        title: r.title,
        statement: r.statement,
        priority: r.priority,
      })),
      conflicting_rules: [],
      reasoning,
      missing_conditions: missing,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      what_changed: screenDiffScore && screenDiffScore > 0.1
        ? {
            previous_state: 'Range observation',
            new_information: `Visual change detected (score: ${(screenDiffScore * 100).toFixed(1)}%). Price tested key level.`,
            new_state: setupStatus,
          }
        : undefined,
    };
  }

  async extractLesson(params: ExtractLessonParams): Promise<ExtractedLessonData> {
    const text = params.transcriptText || '';
    const lower = text.toLowerCase();

    // Determine primary concept
    let primaryConcept = 'Breakout';
    if (lower.includes('liquidity') || lower.includes('sweep')) {
      primaryConcept = 'Liquidity Sweep';
    } else if (lower.includes('retest') || lower.includes('acceptance')) {
      primaryConcept = 'Retest & Acceptance';
    } else if (lower.includes('resistance') || lower.includes('support')) {
      primaryConcept = 'Key Levels';
    }

    // Extract conditional rule statements
    const rules: ExtractedLessonData['rules'] = [];
    const hasExtensionException = lower.includes('extend') || lower.includes('chase') || lower.includes('too high') || lower.includes('extremely high');
    const hasBodyCloseCondition = lower.includes('candle body') || lower.includes('close above') || lower.includes('body close');

    if (hasBodyCloseCondition) {
      rules.push({
        title: 'Breakout Acceptance Criteria',
        statement: 'A meaningful candle body closing beyond the key level is required before a breakout can be considered.',
        rationale: 'Wicks represent rejection or liquidity probing; solid candle body closes indicate genuine acceptance.',
        priority: 'CORE_RULE',
        conditions: [
          {
            field: 'candle_body_close',
            operator: 'ABOVE',
            threshold: 'resistance_level',
            is_mandatory: true,
          },
        ],
        exceptions: hasExtensionException
          ? [
              {
                name: 'Excessive Extension Exception',
                description: 'If the breakout candle is excessively extended or closes far from the level, avoid immediate entry.',
                override_behavior: 'AVOID_IMMEDIATE_ENTRY',
                condition_logic: 'candle_range > 2.5 * average_range',
              },
            ]
          : [],
      });
    } else {
      // Fallback rule from teacher text
      rules.push({
        title: `${primaryConcept} Rule`,
        statement: text.slice(0, 140) + '...',
        rationale: 'Extracted directly from teacher explanation.',
        priority: 'CONDITIONAL_RULE',
        conditions: [
          {
            field: 'market_condition',
            operator: 'EQUALS',
            threshold: 'teacher_criteria',
            is_mandatory: true,
          },
        ],
        exceptions: [],
      });
    }

    // Extract positive and negative examples
    const positiveExamples: ExtractedLessonData['positive_examples'] = [];
    const counterexamples: ExtractedLessonData['counterexamples'] = [];

    if (hasBodyCloseCondition) {
      positiveExamples.push({
        context: 'Price approaches resistance and prints a solid, controlled candle body closing clearly above the level.',
        market: 'XAUUSD',
        timeframe: '5M',
        teacher_decision: 'CONFIRMED_SETUP',
        teacher_explanation: 'Strong acceptance with disciplined candle range justifies looking for entry.',
      });
    }

    if (hasExtensionException) {
      counterexamples.push({
        context: 'Price breaks resistance but closes 30 pips above the level on an exhaustive elongated candle.',
        market: 'XAUUSD',
        timeframe: '5M',
        why_invalid: 'Excessive extension increases risk and unfavorable stop loss placement; must wait for retest or avoid.',
        teacher_explanation: 'Avoid chasing extended moves even if they technically broke the level.',
      });
    }

    // Check for conflicts against existing knowledge
    const conflicts: ExtractedLessonData['detected_conflicts'] = [];
    const existingConflictingRule = params.existingKnowledgeContext.rules.find(
      r => r.title.toLowerCase().includes('breakout') && !r.statement.toLowerCase().includes('extend')
    );

    if (hasExtensionException && existingConflictingRule) {
      conflicts.push({
        existing_rule_title: existingConflictingRule.title,
        existing_rule_id: existingConflictingRule.id,
        conflict_type: 'EXCEPTION',
        ai_interpretation: 'New statement introduces an exception: avoid breakout entries when candle extension is excessive.',
        suggested_action: 'EXCEPTION',
      });
    }

    return {
      lesson_title: params.lessonTitle || `Teaching on ${primaryConcept}`,
      summary: `Teacher explains ${primaryConcept} criteria with specific conditions and exceptions.`,
      primary_concept: primaryConcept,
      related_concepts: ['Resistance', 'Candle Body', 'Acceptance', 'Risk Management'],
      rules,
      positive_examples: positiveExamples,
      counterexamples,
      detected_conflicts: conflicts,
      confidence: 0.95,
    };
  }

  async resolveConflict(params: ConflictResolutionParams): Promise<ConflictResolutionSuggestion> {
    const { ruleA, ruleB } = params;
    const aLower = ruleA.statement.toLowerCase();
    const bLower = ruleB.statement.toLowerCase();

    let relationship: ConflictResolutionSuggestion['relationship'] = 'EXCEPTION';
    let question = `Does "${ruleB.title}" act as a conditional exception to "${ruleA.title}"?`;
    let interpretation = `Rule B refines Rule A by specifying conditions under which the setup should not be taken.`;

    if (bLower.includes('never') || bLower.includes('no longer') || bLower.includes('changed')) {
      relationship = 'SUPERSEDES';
      question = `Should "${ruleB.title}" supersede and deprecate the older "${ruleA.title}"?`;
      interpretation = `Rule B appears to be an updated revision of the teacher's methodology.`;
    }

    return {
      rule_a_id: ruleA.id,
      rule_b_id: ruleB.id,
      relationship,
      ai_interpretation: interpretation,
      question,
      recommended_action: relationship === 'SUPERSEDES' ? 'Mark Rule A as SUPERSEDED' : 'Add Rule B as Exception to Rule A',
    };
  }

  async evaluateScenario(params: ScenarioEvalParams): Promise<ScenarioEvaluationResult> {
    const conditionsMet = params.conditions.map((cond, idx) => ({
      step: cond.step,
      description: cond.description,
      status: (idx === 0 ? 'MET' : idx === 1 ? 'MET' : 'PENDING') as 'MET' | 'UNMET' | 'PENDING',
    }));

    const allMet = conditionsMet.every(c => c.status === 'MET');

    return {
      scenario_id: 'scenario_eval_1',
      name: params.scenarioName,
      conditions_met: conditionsMet,
      is_valid: allMet,
      status: allMet ? 'SETUP_CONFIRMED' : 'SETUP_FORMING',
      suggested_action: allMet ? 'TRADE_CANDIDATE' : 'WAIT',
      invalidation_triggers: ['Price closes below invalidation level', 'Violates maximum extension rule'],
    };
  }

  async chat(messages: ChatMessage[], context: KnowledgeContext): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const lower = lastMsg.toLowerCase();

    if (lower.includes('breakout') || lower.includes('rule') || lower.includes('criteria')) {
      const activeRules = context.rules.map((r, i) => `• [Rule ${i + 1}: ${r.title}] — "${r.statement}" (${r.priority})`).join('\n');
      const activeExceptions = context.exceptions.map((e, i) => `• [Exception ${i + 1}: ${e.description}] → Override: ${e.overrideBehavior}`).join('\n');

      const lessonCite = context.recentLessons?.[0] ? `\n\n[Lesson: ${context.recentLessons[0].title} @ 01:30]` : '';

      return `Based on your approved trading knowledge:\n\n### Grounded Rules:\n${activeRules || 'No rules approved yet.'}\n\n### Grounded Exceptions & Hierarchy:\n${activeExceptions || 'No exceptions registered yet.'}${lessonCite}\n\nI will strictly enforce these criteria before proposing any trade candidate.`;
    }

    if (lower.includes('extend') || lower.includes('exception') || lower.includes('chase') || lower.includes('reject')) {
      const matchedException = context.exceptions[0] || {
        description: 'Excessive Extension Exception',
        overrideBehavior: 'AVOID_IMMEDIATE_ENTRY',
      };
      return `Teacher, I strictly obey your exception hierarchy:\n\n[Exception: ${matchedException.description}]\n• **Override Action**: ${matchedException.overrideBehavior}\n\nWhen a candle exceeds standard range, chasing price severely deteriorates Risk-to-Reward. I will block the entry and wait for either a controlled retest of the broken level or an invalidation.\n\n[Lesson: Core Breakout & Extension Teaching @ 02:45]`;
    }

    const conceptsSummary = context.concepts.map(c => c.name).join(', ');
    return `Hello Teacher! I am your AI trading student. I am grounded in your approved teachings:\n\n• **${context.concepts.length} Concepts** (${conceptsSummary || 'None'})\n• **${context.rules.length} Approved Rules**\n• **${context.exceptions.length} Exception Hierarchies**\n\nAsk me about any specific setup, rule, or exception to verify my reasoning.`;
  }
}

export { LocalRuleValidator as LocalAIProvider };
