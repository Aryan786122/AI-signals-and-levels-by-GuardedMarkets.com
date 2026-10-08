import { db } from '@/lib/db';
import { KnowledgeContext, RulePriority, RuleStatus, RelationType, RuleScope, TradePhase } from '@/lib/types';

export interface EnrichedRule {
  id: string;
  title: string;
  statement: string;
  priority: RulePriority;
  scope: RuleScope;
  specificity: number;
  tradePhase: TradePhase;
  teacherApproved: boolean;
  version: number;
  exceptions: Array<{
    id: string;
    ruleId: string;
    description: string;
    overrideBehavior: string;
    specificity: number;
    parentExceptionId?: string | null;
    childExceptions?: Array<{
      id: string;
      description: string;
      overrideBehavior: string;
      specificity: number;
    }>;
  }>;
}

export class KnowledgeEngine {
  /**
   * Retrieves the full active knowledge context for the AI reasoning engine.
   * Supports CURRENT METHODOLOGY and optional historical versions.
   */
  static async getActiveContext(options?: {
    tradePhase?: TradePhase;
    asset?: string;
    timeframe?: string;
  }): Promise<KnowledgeContext & { enrichedRules: EnrichedRule[] }> {
    const whereRule: Record<string, unknown> = { status: 'ACTIVE' };
    if (options?.tradePhase) {
      whereRule.tradePhase = options.tradePhase;
    }

    const [concepts, rules, lessons] = await Promise.all([
      db.concept.findMany({
        select: { id: true, name: true, definition: true },
      }),
      db.rule.findMany({
        where: whereRule,
        include: {
          exceptions: {
            include: {
              childExceptions: true,
            },
          },
          conditions: true,
        },
        orderBy: [{ specificity: 'desc' }, { priority: 'asc' }],
      }),
      db.lesson.findMany({
        where: { status: 'APPROVED' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, description: true },
      }),
    ]);

    const enrichedRules: EnrichedRule[] = rules.map(r => ({
      id: r.id,
      title: r.title,
      statement: r.statement,
      priority: r.priority as RulePriority,
      scope: (r.scope || 'GLOBAL') as RuleScope,
      specificity: r.specificity || 1,
      tradePhase: (r.tradePhase || 'SETUP_RECOGNITION') as TradePhase,
      teacherApproved: r.teacherApproved ?? false,
      version: r.version,
      exceptions: r.exceptions.map(e => ({
        id: e.id,
        ruleId: e.ruleId,
        description: e.description,
        overrideBehavior: e.overrideBehavior,
        specificity: e.specificity || 2,
        parentExceptionId: e.parentExceptionId,
        childExceptions: e.childExceptions?.map(c => ({
          id: c.id,
          description: c.description,
          overrideBehavior: c.overrideBehavior,
          specificity: c.specificity || 3,
        })),
      })),
    }));

    const flatExceptions = rules.flatMap(r =>
      r.exceptions.map(e => ({
        id: e.id,
        ruleId: e.ruleId,
        description: e.description,
        overrideBehavior: e.overrideBehavior,
      }))
    );

    return {
      concepts,
      rules: rules.map(r => ({
        id: r.id,
        title: r.title,
        statement: r.statement,
        priority: r.priority as RulePriority,
      })),
      exceptions: flatExceptions,
      recentLessons: lessons.map(l => ({
        id: l.id,
        title: l.title,
        summary: l.description || undefined,
      })),
      enrichedRules,
    };
  }

  /**
   * Calculates rule specificity based on context depth, condition count, and exception nesting.
   */
  static calculateSpecificity(params: {
    isBaseRule?: boolean;
    conditionsCount?: number;
    hasSpecificTimeframe?: boolean;
    hasSpecificAsset?: boolean;
    isException?: boolean;
    isNestedException?: boolean;
  }): number {
    let score = 1; // Base rule
    if (params.conditionsCount && params.conditionsCount > 2) score += 1;
    if (params.hasSpecificTimeframe) score += 1;
    if (params.hasSpecificAsset) score += 1;
    if (params.isException) score += 1;
    if (params.isNestedException) score += 2;
    return score;
  }

  /**
   * Detects potential contradictions, refinements, or exceptions when a new rule is proposed.
   * Understands rule specificity so a specific contextual rule does not trigger false contradiction.
   */
  static async detectConflicts(
    newRuleTitle: string,
    newRuleStatement: string,
    newRuleScope: RuleScope = 'GLOBAL',
    newRulePhase: TradePhase = 'SETUP_RECOGNITION'
  ): Promise<
    Array<{
      existingRuleId: string;
      existingRuleTitle: string;
      conflictType: 'DIRECT_CONTRADICTION' | 'REFINEMENT' | 'EXCEPTION';
      detectedReason: string;
      possibleRelationships: string[];
      scopeA: string;
      scopeB: string;
      specificityA: number;
      specificityB: number;
      aiInterpretation: string;
      suggestedAction: 'EXCEPTION' | 'SUPERSEDE' | 'SEPARATE' | 'MERGE';
    }>
  > {
    const existingRules = await db.rule.findMany({
      where: { status: 'ACTIVE' },
      include: { exceptions: true, conditions: true },
    });

    const conflicts: Array<{
      existingRuleId: string;
      existingRuleTitle: string;
      conflictType: 'DIRECT_CONTRADICTION' | 'REFINEMENT' | 'EXCEPTION';
      detectedReason: string;
      possibleRelationships: string[];
      scopeA: string;
      scopeB: string;
      specificityA: number;
      specificityB: number;
      aiInterpretation: string;
      suggestedAction: 'EXCEPTION' | 'SUPERSEDE' | 'SEPARATE' | 'MERGE';
    }> = [];

    const newLower = (newRuleTitle + ' ' + newRuleStatement).toLowerCase();
    const newSpecificity = this.calculateSpecificity({
      isException: newLower.includes('except') || newLower.includes('unless') || newLower.includes('avoid'),
      isNestedException: newLower.includes('exception to') || (newLower.includes('sweep') && newLower.includes('extended')),
      conditionsCount: (newLower.match(/and|if|when/g) || []).length,
      hasSpecificAsset: newRuleScope === 'ASSET_SPECIFIC',
      hasSpecificTimeframe: newRuleScope === 'TIMEFRAME_SPECIFIC',
    });

    for (const rule of existingRules) {
      const existingLower = (rule.title + ' ' + rule.statement).toLowerCase();

      // Check common domain keywords
      const keywords = ['breakout', 'resistance', 'support', 'liquidity', 'sweep', 'retest', 'candle', 'extension', 'close', 'entry', 'stop'];
      const sharedKeywords = keywords.filter(k => newLower.includes(k) && existingLower.includes(k));

      if (sharedKeywords.length >= 2) {
        const specA = rule.specificity || 1;
        const specB = newSpecificity;

        if (newLower.includes('never') || newLower.includes('no longer') || newLower.includes('always false') || newLower.includes('superseded')) {
          conflicts.push({
            existingRuleId: rule.id,
            existingRuleTitle: rule.title,
            conflictType: 'DIRECT_CONTRADICTION',
            detectedReason: `New statement directly negates or claims to supersede "${rule.title}".`,
            possibleRelationships: ['SUPERSEDES', 'INVALIDATED_BY'],
            scopeA: rule.scope,
            scopeB: newRuleScope,
            specificityA: specA,
            specificityB: specB,
            aiInterpretation: `New statement appears to modify or replace older teaching in "${rule.title}".`,
            suggestedAction: 'SUPERSEDE',
          });
        } else if (
          newLower.includes('if') ||
          newLower.includes('except') ||
          newLower.includes('avoid') ||
          newLower.includes('extended') ||
          newLower.includes('unless') ||
          newLower.includes('sweep')
        ) {
          // If new statement is more specific, recognize it as a contextual exception rather than contradiction
          const isContextualRefinement = specB > specA;
          conflicts.push({
            existingRuleId: rule.id,
            existingRuleTitle: rule.title,
            conflictType: 'EXCEPTION',
            detectedReason: isContextualRefinement
              ? `New rule has higher specificity (${specB} vs ${specA}) and specifies contextual conditions for "${rule.title}".`
              : `New statement adds conditional exceptions to "${rule.title}".`,
            possibleRelationships: ['EXCEPTION_TO', 'CONDITIONED_BY', 'REFINES'],
            scopeA: rule.scope,
            scopeB: newRuleScope,
            specificityA: specA,
            specificityB: specB,
            aiInterpretation: `New statement adds contextual filtering to "${rule.title}". Rather than a contradiction, it defines when to override or permit entries.`,
            suggestedAction: 'EXCEPTION',
          });
        } else {
          conflicts.push({
            existingRuleId: rule.id,
            existingRuleTitle: rule.title,
            conflictType: 'REFINEMENT',
            detectedReason: `Rules share domain concepts (${sharedKeywords.join(', ')}) in ${newRulePhase}.`,
            possibleRelationships: ['RELATED_TO', 'STRENGTHENED_BY', 'CONFIRMS'],
            scopeA: rule.scope,
            scopeB: newRuleScope,
            specificityA: specA,
            specificityB: specB,
            aiInterpretation: `New rule shares key concepts with "${rule.title}".`,
            suggestedAction: 'SEPARATE',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Applies teacher's resolution to supersede an older rule with a newer one.
   * Preserves version history (Section 15: "Never destroy historical knowledge").
   */
  static async supersedeRule(
    oldRuleId: string,
    newRuleId: string,
    reason: string,
    lessonId?: string
  ): Promise<void> {
    const oldRule = await db.rule.findUnique({ where: { id: oldRuleId } });
    if (!oldRule) throw new Error('Rule not found');

    await db.$transaction([
      // Archive old rule version
      db.knowledgeVersion.create({
        data: {
          ruleId: oldRuleId,
          version: oldRule.version,
          statement: oldRule.statement,
          changeReason: reason,
          lessonId,
        },
      }),
      // Mark old rule as superseded
      db.rule.update({
        where: { id: oldRuleId },
        data: {
          status: 'SUPERSEDED',
          supersededById: newRuleId,
        },
      }),
      // Bump version of active rule
      db.rule.update({
        where: { id: newRuleId },
        data: {
          status: 'ACTIVE',
          version: oldRule.version + 1,
          teacherApproved: true,
        },
      }),
    ]);
  }

  /**
   * Links a new condition as an explicit Exception to an existing Rule,
   * supporting nested exceptions (Base -> Exception -> Exception to Exception).
   */
  static async addExceptionToRule(
    ruleId: string,
    exception: {
      name: string;
      description: string;
      overrideBehavior: string;
      conditionLogic: string;
      exampleContext?: string;
      parentExceptionId?: string;
      specificity?: number;
      tradePhase?: TradePhase;
    }
  ): Promise<void> {
    let computedSpecificity = exception.specificity || 2;
    if (exception.parentExceptionId) {
      const parent = await db.exception.findUnique({ where: { id: exception.parentExceptionId } });
      if (parent) {
        computedSpecificity = (parent.specificity || 2) + 1;
      }
    }

    await db.exception.create({
      data: {
        ruleId,
        name: exception.name,
        description: exception.description,
        overrideBehavior: exception.overrideBehavior,
        conditionLogic: exception.conditionLogic,
        exampleContext: exception.exampleContext,
        parentExceptionId: exception.parentExceptionId,
        specificity: computedSpecificity,
        tradePhase: exception.tradePhase || 'SETUP_RECOGNITION',
        teacherApproved: true,
      },
    });
  }
}
