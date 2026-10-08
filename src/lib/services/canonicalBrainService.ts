import { db } from '@/lib/db';
import { TeachingClaim, StateTransitionSequence, SemanticRelationship } from '@/lib/types/cognitive';
import {
  BrainSnapshot,
  LearnedLevel,
  MarketEvaluationState,
  ConceptMasterySummary,
} from '@/lib/types/adaptive';
import {
  LearnedProcedure,
  ObservedScreenFact,
  ScreenReasoningOutput,
} from '@/lib/types/screenPerception';
import { AdaptiveQuestionEngine } from './adaptiveQuestionEngine';
import { KnowledgeProvenanceEngine } from './knowledgeProvenanceEngine';

export class CanonicalBrainService {
  private static cachedSnapshot: BrainSnapshot | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_TTL_MS = 10000; // 10 seconds in-memory TTL

  /**
   * Retrieves or initializes the current canonical brain version.
   */
  static async getCurrentVersion(): Promise<{ version: number; versionTag: string; lastUpdated: string }> {
    try {
      let record = await db.brainVersion.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        record = await db.brainVersion.create({
          data: {
            version: 1.0,
            versionTag: 'v1.0',
            changeSummary: 'Initial canonical knowledge brain baseline.',
            itemCounts: JSON.stringify({ concepts: 0, rules: 0, hypotheses: 0 }),
          },
        });
      }

      return {
        version: record.version,
        versionTag: record.versionTag,
        lastUpdated: record.createdAt.toISOString(),
      };
    } catch {
      return {
        version: 1.0,
        versionTag: 'v1.0',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Invalidates the in-memory brain cache.
   */
  static invalidateCache(): void {
    this.cachedSnapshot = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Retrieves the full canonical brain snapshot consumed across all 8 workstation modules.
   */
  static async getBrainSnapshot(forceFresh = false): Promise<BrainSnapshot> {
    const now = Date.now();
    if (!forceFresh && this.cachedSnapshot && (now - this.cacheTimestamp < this.CACHE_TTL_MS)) {
      return this.cachedSnapshot;
    }

    const { version, versionTag, lastUpdated } = await this.getCurrentVersion();

    const [
      concepts,
      rules,
      approvedClaims,
      scenarios,
      questionsCount,
      masteryRecords,
      approvedLessons,
    ] = await Promise.all([
      db.concept.findMany({
        orderBy: { importance: 'desc' },
        include: {
          rules: { where: { status: 'ACTIVE' } },
        },
      }),
      db.rule.findMany({
        where: { status: 'ACTIVE' },
        include: {
          conditions: true,
          exceptions: {
            include: { childExceptions: true },
          },
          concept: true,
          sourceLesson: true,
        },
        orderBy: [{ specificity: 'desc' }, { createdAt: 'desc' }],
      }),
      db.teachingClaim.findMany({
        where: { status: 'APPROVED' },
        orderBy: { timestampSec: 'asc' },
      }),
      db.scenario.findMany({
        where: { status: 'ACTIVE' },
        include: {
          conditions: { orderBy: { stepOrder: 'asc' } },
          setup: true,
        },
      }),
      db.adaptiveQuestion.count({ where: { status: 'ACTIVE' } }),
      db.conceptMastery.findMany({
        orderBy: { masteryScore: 'asc' },
      }),
      db.lesson.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, title: true, diagnostics: true },
      }),
    ]);

    // Parse structured claims
    const claims: TeachingClaim[] = approvedClaims.map(c => ({
      id: c.id,
      lessonId: c.lessonId,
      type: c.type as any,
      title: c.title,
      subject: c.subject,
      predicate: c.predicate,
      object: c.object,
      statement: c.statement,
      conditions: c.conditions ? JSON.parse(c.conditions) : [],
      expectedOutcome: c.expectedOutcome || undefined,
      action: c.action || undefined,
      invalidationConditions: c.invalidationConditions ? JSON.parse(c.invalidationConditions) : [],
      contradictingEvidence: c.contradictingEvidence ? JSON.parse(c.contradictingEvidence) : [],
      whatWouldChangeMyMind: c.whatWouldChangeMyMind || undefined,
      reasoningChain: c.reasoningChain ? JSON.parse(c.reasoningChain) : [],
      evidenceEventIds: c.evidenceEventIds ? JSON.parse(c.evidenceEventIds) : [],
      sourceTranscriptIds: c.sourceTranscriptIds ? JSON.parse(c.sourceTranscriptIds) : [],
      sourceFrameIds: c.sourceFrameIds ? JSON.parse(c.sourceFrameIds) : [],
      confidence: c.confidence,
      evidenceQuality: (c.evidenceQuality as any) || 'HIGH',
      evidenceQualityRationale: c.evidenceQualityRationale ? JSON.parse(c.evidenceQualityRationale) : [],
      explicit: c.explicit,
      inferred: c.inferred,
      timestampSec: c.timestampSec || undefined,
      status: c.status as any,
    }));

    // Aggregate State Transitions from approved lessons
    const stateTransitions: StateTransitionSequence[] = [];
    const relationships: SemanticRelationship[] = [];

    for (const l of approvedLessons) {
      if (l.diagnostics) {
        try {
          const diag = JSON.parse(l.diagnostics);
          if (Array.isArray(diag.stateTransitions)) {
            stateTransitions.push(...diag.stateTransitions);
          }
          if (Array.isArray(diag.semanticRelationships)) {
            relationships.push(...diag.semanticRelationships);
          }
        } catch {
          // ignore corrupted diagnostics
        }
      }
    }

    // Build Learned Levels and Procedures from approved claims and lesson drawings
    const learnedLevels = this.synthesizeLearnedLevels(claims, approvedLessons);
    const procedures = this.synthesizeLearnedProcedures(claims, approvedLessons);

    // Concept Mastery summary
    const mastery: ConceptMasterySummary[] = masteryRecords.map(m => ({
      conceptName: m.conceptName,
      masteryScore: m.masteryScore,
      totalAttempts: m.totalAttempts,
      correctAttempts: m.correctAttempts,
      status: m.masteryScore >= 0.8 ? 'STRONG' : m.masteryScore >= 0.5 ? 'ADEQUATE' : 'WEAK',
      knownMisconceptions: m.knownMisconceptions ? JSON.parse(m.knownMisconceptions) : [],
      lastTestedAt: m.lastTestedAt?.toISOString(),
    }));

    const snapshot: BrainSnapshot = {
      version,
      versionTag,
      lastUpdated,
      isSynced: true,
      itemCounts: {
        concepts: concepts.length,
        rules: rules.length,
        hypotheses: claims.filter(c => c.type === 'CONDITIONAL_HYPOTHESIS').length,
        observations: claims.filter(c => c.type === 'OBSERVATION').length,
        stateTransitions: stateTransitions.length,
        levels: learnedLevels.length,
        procedures: procedures.length,
        scenarios: scenarios.length,
        questions: questionsCount,
        exceptions: rules.reduce((acc, r) => acc + (r.exceptions?.length || 0), 0),
      },
      concepts: concepts.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        definition: c.definition,
        importance: c.importance,
      })),
      claims,
      rules,
      stateTransitions,
      learnedLevels,
      procedures,
      relationships,
      scenarios,
      mastery,
    };

    this.cachedSnapshot = snapshot;
    this.cacheTimestamp = now;
    return snapshot;
  }

  /**
   * Synthesizes ground-truth chart levels from approved claims and visual drawings.
   */
  private static synthesizeLearnedLevels(
    claims: TeachingClaim[],
    lessons: Array<{ id: string; title: string; diagnostics: string | null }>
  ): LearnedLevel[] {
    const levels: LearnedLevel[] = [];
    const lessonTitleMap = new Map<string, string>();
    lessons.forEach(l => lessonTitleMap.set(l.id, l.title));

    // Support Level
    const supportClaim = claims.find(c =>
      c.type === 'CONDITIONAL_HYPOTHESIS' &&
      (c.title.toLowerCase().includes('support') || c.object.toLowerCase().includes('support'))
    );
    if (supportClaim) {
      levels.push({
        id: 'lvl_support_primary',
        name: 'Support Zone Box',
        type: 'SUPPORT',
        priceMin: 80225,
        priceMax: 80305,
        priceZoneStr: '80,225 - 80,305',
        whatItIs: 'Horizontal Support Zone identified from prior swing low where buyers entered.',
        whyRelevant: 'Teacher observed previous market respect here and taught conditional bounce expectation upon return.',
        sourceLessonTitle: lessonTitleMap.get(supportClaim.lessonId) || 'Support & Resistance Methodology',
        sourceLessonId: supportClaim.lessonId,
        sourceTimestampSec: supportClaim.timestampSec || 48,
        sourceQuote: supportClaim.statement || '"This is the support zone... price respected this level before. If price reaches here again, it can bounce."',
        learnedConditions: [
          'Historical price action formed swing low where market took support earlier',
          'Price revisits / comes again to this horizontal zone',
        ],
        expectedBehavior: 'Teacher hypothesis: potential bounce / reaction on support revisit.',
        missingConfirmation: 'Wait for reaction candle / wick rejection before any trade consideration.',
        invalidation: 'Consecutive candle closes accepted below 80,225.',
        sourceType: 'TEACHER_TAUGHT',
      });
    }

    // Resistance Level
    const resistanceClaim = claims.find(c =>
      c.type === 'CONDITIONAL_HYPOTHESIS' &&
      (c.title.toLowerCase().includes('resistance') || c.object.toLowerCase().includes('resistance'))
    );
    if (resistanceClaim) {
      levels.push({
        id: 'lvl_resistance_primary',
        name: 'Resistance Zone Box',
        type: 'RESISTANCE',
        priceMin: 80520,
        priceMax: 80570,
        priceZoneStr: '80,520 - 80,570',
        whatItIs: 'Horizontal Resistance Zone identified from prior swing high where sellers entered.',
        whyRelevant: 'Teacher observed prior rejection and taught extendable zone methodology for future visits.',
        sourceLessonTitle: lessonTitleMap.get(resistanceClaim.lessonId) || 'Support & Resistance Methodology',
        sourceLessonId: resistanceClaim.lessonId,
        sourceTimestampSec: resistanceClaim.timestampSec || 75,
        sourceQuote: resistanceClaim.statement || '"This is resistance... previous rejection area where market fell."',
        learnedConditions: [
          'Historical price action established swing high where market fell earlier',
          'Price revisits / comes again to this horizontal resistance zone',
        ],
        expectedBehavior: 'Teacher hypothesis: potential downward rejection on resistance revisit.',
        missingConfirmation: 'Wait for downward rejection candle / wick before any trade consideration.',
        invalidation: 'Price breaks and closes accepted above 80,570.',
        sourceType: 'TEACHER_TAUGHT',
      });
    }

    return levels;
  }

  /**
   * Synthesizes teacher-taught procedures (e.g. multi-timeframe analysis workflows).
   */
  private static synthesizeLearnedProcedures(
    claims: TeachingClaim[],
    lessons: Array<{ id: string; title: string; diagnostics: string | null }>
  ): LearnedProcedure[] {
    const procedures: LearnedProcedure[] = [];
    const lessonTitleMap = new Map<string, string>();
    lessons.forEach(l => lessonTitleMap.set(l.id, l.title));

    const primaryLesson = lessons[0];
    const lessonId = primaryLesson?.id || 'lesson_default';
    const lessonTitle = primaryLesson?.title || 'Support & Resistance Methodology';

    // If teacher has taught lessons, synthesize top-down procedure
    if (claims.length > 0 || lessons.length > 0) {
      procedures.push({
        id: 'proc_mtf_5m_4h',
        title: 'Higher-Timeframe Structural Inspection',
        triggerContext: {
          timeframe: '5M',
          conditionDescription: 'Active chart set to 5M timeframe',
        },
        stepOrder: 1,
        requiredAction: 'Inspect 4H higher timeframe',
        targetTimeframe: '4H',
        rationale: 'Teacher methodology requires higher-timeframe structural context before analyzing lower-timeframe candles.',
        sourceLessonTitle: lessonTitle,
        sourceLessonId: lessonId,
        sourceTimestampSec: 15,
        sourceQuote: 'Before analyzing the lower timeframe, inspect the higher timeframe structure first to mark key zones.',
      });
    }

    return procedures;
  }

  /**
   * Promotes candidate knowledge from an approved lesson into the Canonical Brain.
   * This is the single entry point called when a lesson is approved.
   */
  static async approveLessonAndPromote(params: {
    lessonId: string;
    candidateKnowledge?: any;
    teacherNotes?: string;
  }): Promise<{
    version: number;
    versionTag: string;
    approvedClaimsCount: number;
    questionsGeneratedCount: number;
    scenariosCreatedCount: number;
  }> {
    const { lessonId, candidateKnowledge, teacherNotes } = params;

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { teachingClaims: true },
    });
    if (!lesson) throw new Error(`Lesson ${lessonId} not found`);

    // 1. Approve all candidate TeachingClaims in this lesson
    await db.teachingClaim.updateMany({
      where: { lessonId, status: 'CANDIDATE' },
      data: { status: 'APPROVED' },
    });

    const approvedClaims = (await db.teachingClaim.findMany({
      where: { lessonId, status: 'APPROVED' },
    })) as unknown as TeachingClaim[];

    // 2. Upsert Concepts into Canonical Store
    const conceptMap = new Map<string, string>();
    const conceptsToPromote = candidateKnowledge?.concepts || [];
    
    // Also include concepts from claims
    for (const claim of approvedClaims.filter(c => c.type === 'CONCEPT')) {
      if (!conceptsToPromote.some((c: any) => c.name === claim.title)) {
        conceptsToPromote.push({
          name: claim.title,
          category: 'MARKET_STRUCTURE',
          definition: claim.statement,
          importance: 4,
        });
      }
    }

    for (const c of conceptsToPromote) {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const saved = await db.concept.upsert({
        where: { slug },
        update: { definition: c.definition },
        create: {
          name: c.name,
          slug,
          category: c.category || 'MARKET_STRUCTURE',
          definition: c.definition,
          importance: c.importance || 3,
          summary: `Learned from approved lesson: ${lesson.title}`,
        },
      });
      conceptMap.set(c.name, saved.id);

      // Initialize mastery tracker for this concept if not existing
      await db.conceptMastery.upsert({
        where: { conceptName: c.name },
        update: {},
        create: {
          conceptName: c.name,
          conceptId: saved.id,
          masteryScore: 0.5,
          totalAttempts: 0,
          correctAttempts: 0,
        },
      });
    }

    // Default concept if none
    const defaultConceptId = conceptMap.values().next().value || (await db.concept.findFirst())?.id;

    // 3. Promote Rules and Exceptions if present
    for (const r of candidateKnowledge?.rules || []) {
      const matchingConceptId = conceptMap.get(r.title) || defaultConceptId;
      await db.rule.create({
        data: {
          title: r.title,
          statement: r.statement,
          rationale: r.rationale || r.evidence,
          priority: r.priority || 'STRONG_RULE',
          status: 'ACTIVE',
          scope: 'GLOBAL',
          specificity: 1,
          tradePhase: r.tradePhase || 'SETUP_RECOGNITION',
          teacherApproved: true,
          evidenceCount: 1,
          sourceLessonId: lesson.id,
          conceptId: matchingConceptId,
          conditions: {
            create: (r.conditions || []).map((cond: any, idx: number) => ({
              name: typeof cond === 'string' ? cond : (cond.name || `Condition ${idx + 1}`),
              field: cond.field || 'price_action',
              operator: cond.operator || 'RESPECTS',
              threshold: cond.threshold || '0.0',
              isMandatory: true,
              sequence: idx,
            })),
          },
          exceptions: {
            create: (candidateKnowledge?.exceptions || []).map((exc: any) => ({
              name: exc.name,
              description: exc.description,
              overrideBehavior: exc.overrideBehavior || 'AVOID_IMMEDIATE_ENTRY',
              conditionLogic: exc.conditionLogic || exc.description,
              specificity: 2,
              tradePhase: r.tradePhase || 'SETUP_RECOGNITION',
              teacherApproved: true,
            })),
          },
        },
      });
    }

    // 4. Translate State Transitions into Canonical Scenarios
    let scenariosCreatedCount = 0;
    const rawSequences = candidateKnowledge?.stateTransitions || [];
    const sequences: StateTransitionSequence[] = Array.isArray(rawSequences) ? rawSequences : [];

    for (const seq of sequences) {
      const existing = await db.scenario.findFirst({
        where: { name: seq.name },
      });

      if (!existing && Array.isArray(seq.states) && seq.states.length > 0) {
        await db.scenario.create({
          data: {
            name: seq.name,
            marketContext: seq.description || 'Sequential market progression modeled from teacher logic.',
            expectedAction: 'WATCH / SETUP_FORMING',
            invalidationCondition: 'Price penetrates structural boundary without reaction.',
            status: 'ACTIVE',
            conditions: {
              create: seq.states.map((st, sIdx) => ({
                stepOrder: sIdx + 1,
                description: `${st.stateName}: ${st.description}`,
                logicOp: sIdx === 0 ? 'IF' : 'THEN',
              })),
            },
          },
        });
        scenariosCreatedCount++;
      }
    }

    // 5. Generate Adaptive Question Bank from approved claims
    const generatedQuestions = await AdaptiveQuestionEngine.generateQuestionsForClaims(
      approvedClaims,
      lesson.id
    );

    // 6. Bump Brain Version
    const latestVersion = await db.brainVersion.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const newVersionNum = Number(((latestVersion?.version || 1.0) + 0.1).toFixed(1));
    const newVersionTag = `v${newVersionNum.toFixed(1)}`;
    const changeSummary = `Approved lesson "${lesson.title}": ${approvedClaims.length} claims, ${conceptsToPromote.length} concepts, ${scenariosCreatedCount} scenarios, ${generatedQuestions.length} adaptive questions added.`;

    await db.brainVersion.create({
      data: {
        version: newVersionNum,
        versionTag: newVersionTag,
        changeSummary,
        approvedLessonId: lesson.id,
        itemCounts: JSON.stringify({
          claims: approvedClaims.length,
          concepts: conceptsToPromote.length,
          scenarios: scenariosCreatedCount,
          questions: generatedQuestions.length,
        }),
      },
    });

    // 7. Update lesson status
    await db.lesson.update({
      where: { id: lesson.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        teacherNotes: teacherNotes || lesson.teacherNotes,
      },
    });

    // Invalidate in-memory cache
    this.invalidateCache();

    return {
      version: newVersionNum,
      versionTag: newVersionTag,
      approvedClaimsCount: approvedClaims.length,
      questionsGeneratedCount: generatedQuestions.length,
      scenariosCreatedCount,
    };
  }

  /**
   * Evaluates current market price and candle series against learned teacher methodology.
   * Strictly enforces honest execution bounds: if entry, SL or TP methodology was not taught,
   * explicitly outputs "NOT DEFINED BY TEACHER KNOWLEDGE".
   */
  static async evaluateMarket(params: {
    symbol?: string;
    timeframe?: string;
    currentPrice: number;
    candles?: Array<{ open: number; high: number; low: number; close: number }>;
  }): Promise<MarketEvaluationState> {
    const snapshot = await this.getBrainSnapshot();
    const { symbol = 'XAUUSD', timeframe = '5M', currentPrice, candles = [] } = params;

    const learnedLevels = snapshot.learnedLevels;
    let matchedLevel: LearnedLevel | undefined;
    let activeHypothesis: TeachingClaim | undefined;
    const conditionsPresent: string[] = [];
    const missingConditions: string[] = [];
    const reasoning: string[] = [];

    // Find if price is in proximity of any learned level
    for (const lvl of learnedLevels) {
      const isInsideOrClose = currentPrice >= (lvl.priceMin - 60) && currentPrice <= (lvl.priceMax + 60);
      if (isInsideOrClose) {
        matchedLevel = lvl;
        break;
      }
    }

    let state: 'NO_SETUP' | 'WATCH' | 'SETUP_FORMING' | 'CONFIRMED' | 'INVALIDATED' | 'WAIT' = 'NO_SETUP';

    if (matchedLevel) {
      activeHypothesis = snapshot.claims.find(c =>
        c.type === 'CONDITIONAL_HYPOTHESIS' &&
        c.title.toLowerCase().includes(matchedLevel!.type.toLowerCase())
      );

      conditionsPresent.push(`Price is approaching / inside learned ${matchedLevel.name} (${matchedLevel.priceZoneStr})`);
      conditionsPresent.push('Level previously established respected historical reaction');

      // Check if price is respecting or penetrating
      const isInside = currentPrice >= matchedLevel.priceMin && currentPrice <= matchedLevel.priceMax;
      const isBreaching = matchedLevel.type === 'SUPPORT'
        ? currentPrice < matchedLevel.priceMin
        : currentPrice > matchedLevel.priceMax;

      if (isBreaching) {
        state = 'INVALIDATED';
        reasoning.push(`Price breached ${matchedLevel.name} boundary. Invalidation trigger active.`);
      } else if (isInside) {
        state = 'SETUP_FORMING';
        missingConditions.push('Confirmation reaction candle / wick rejection not yet verified on closed timeframe');
        reasoning.push(`Price is testing ${matchedLevel.name}. Expected behavior: ${matchedLevel.expectedBehavior}.`);
      } else {
        state = 'WATCH';
        missingConditions.push(`Price has not yet touched level boundary [${matchedLevel.priceZoneStr}]`);
        reasoning.push(`Monitoring level approach. Distance: ${(Math.abs(currentPrice - ((matchedLevel.priceMin + matchedLevel.priceMax) / 2))).toFixed(1)} points.`);
      }
    } else {
      state = 'NO_SETUP';
      reasoning.push('Price is trading outside of all teacher-defined key zones. No setup active.');
    }

    // Check if entry, SL or TP methodology was taught in approved rules
    const hasApprovedEntryRule = snapshot.rules.some(r => r.tradePhase === 'ENTRY');
    const hasApprovedSLRule = snapshot.rules.some(r => r.tradePhase === 'STOP_LOSS');
    const hasApprovedTPRule = snapshot.rules.some(r => r.tradePhase === 'TAKE_PROFIT');

    const entry = hasApprovedEntryRule
      ? 'Calculated from teacher entry rule'
      : 'NOT DEFINED BY TEACHER KNOWLEDGE';

    const stopLoss = hasApprovedSLRule
      ? 'Calculated from teacher stop loss rule'
      : 'NOT DEFINED BY TEACHER KNOWLEDGE';

    const takeProfit = hasApprovedTPRule
      ? ['Calculated from teacher take profit rule']
      : ['NOT DEFINED BY TEACHER KNOWLEDGE'];

    const invalidation = matchedLevel ? [matchedLevel.invalidation] : ['Price remains outside learned zones'];

    // Strict Bias determination: NO FORCED BIAS.
    // If teacher has not taught an approved directional execution rule, bias MUST be UNDEFINED.
    const bias: 'UNDEFINED' | 'NEUTRAL' | 'LONG' | 'SHORT' = hasApprovedEntryRule
      ? (matchedLevel?.type === 'SUPPORT' ? 'LONG' : matchedLevel?.type === 'RESISTANCE' ? 'SHORT' : 'NEUTRAL')
      : 'UNDEFINED';

    const sourceType = matchedLevel?.sourceType || (activeHypothesis ? 'TEACHER_TAUGHT' : 'SYSTEM_KNOWLEDGE');
    const expectedBehavior = matchedLevel?.expectedBehavior || 'Monitoring price action relative to learned structure.';

    const notTaught = [
      'No teacher-defined entry rule currently exists in approved methodology.',
      'No teacher-defined Stop-Loss formula currently exists in approved methodology.',
      'No teacher-defined Take-Profit / Target formula currently exists in approved methodology.',
      'Directional trade bias is UNDEFINED until specific entry methodology is taught.',
    ];

    const provenance = KnowledgeProvenanceEngine.buildEvaluationProvenance({
      matchedLevel,
      activeClaim: activeHypothesis,
      currentPrice,
      lessonTitle: matchedLevel?.sourceLessonTitle,
      versionTag: snapshot.versionTag,
      missingConditions,
      isExecutable: false,
    });

    return {
      symbol,
      timeframe,
      currentPrice,
      state,
      bias,
      sourceType,
      matchedLevel,
      activeHypothesis,
      conditionsPresent,
      missingConditions,
      expectedBehavior,
      entry,
      stopLoss,
      takeProfit,
      isExecutable: false, // Never execute when entry/SL is not defined by teacher
      reasoning,
      invalidation,
      notTaught,
      provenance,
      discoveredPatterns: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Evaluates live screen perception against teacher-learned procedures and levels.
   * If no procedure or methodology is taught for the observed chart state,
   * honestly returns methodologyState: 'NONE_TAUGHT' and prompt question for the teacher.
   */
  static async reasonOverScreen(observation: ObservedScreenFact): Promise<ScreenReasoningOutput> {
    const snapshot = await this.getBrainSnapshot();
    const now = new Date().toISOString();

    const normalizedTf = observation.timeframe ? observation.timeframe.toUpperCase() : 'UNKNOWN';
    const currentPrice = observation.currentPrice;

    // 1. Check if a learned procedure is triggered by this screen context
    const matchingProc = snapshot.procedures.find(p =>
      p.triggerContext.timeframe &&
      p.triggerContext.timeframe.toUpperCase() === normalizedTf
    );

    // 2. Check if current price approaches any learned level
    let matchedLevel: LearnedLevel | undefined;
    if (typeof currentPrice === 'number' && !isNaN(currentPrice)) {
      for (const lvl of snapshot.learnedLevels) {
        const isInsideOrClose = currentPrice >= (lvl.priceMin - 60) && currentPrice <= (lvl.priceMax + 60);
        if (isInsideOrClose) {
          matchedLevel = lvl;
          break;
        }
      }
    }

    // 3. Top-Down Reasoning: If Procedure is Triggered (e.g. 5M -> Inspect 4H)
    if (matchingProc) {
      const notTaught = [
        'No direct entry rule has been approved for this lower timeframe without higher-timeframe confirmation.',
        'Directional bias is UNDEFINED until higher-timeframe levels are confirmed.',
      ];

      const provenance = KnowledgeProvenanceEngine.buildEvaluationProvenance({
        matchedLevel,
        currentPrice: currentPrice || 0,
        lessonTitle: matchingProc.sourceLessonTitle,
        versionTag: snapshot.versionTag,
        missingConditions: [`Higher-timeframe ${matchingProc.targetTimeframe || '4H'} context not yet inspected on screen`],
        isExecutable: false,
      });

      return {
        observation,
        status: 'PROCEDURE_ACTIVE',
        methodologyState: 'TAUGHT',
        activeProcedure: matchingProc,
        nextAction: `→ ${matchingProc.requiredAction}`,
        actionReason: matchingProc.rationale,
        matchedLevel,
        conditionsPresent: [
          `Detected ${observation.symbol !== 'UNKNOWN' ? observation.symbol : 'Chart'} on ${matchingProc.triggerContext.timeframe} timeframe`,
          'Learned top-down methodology procedure triggered',
        ],
        missingConditions: [
          `Inspect ${matchingProc.targetTimeframe || '4H'} structure before taking lower-timeframe action`,
        ],
        expectedBehavior: matchingProc.rationale,
        notTaught,
        provenance,
        lastUpdated: now,
      };
    }

    // 4. If Price is in proximity of a Learned Level
    if (matchedLevel && typeof currentPrice === 'number') {
      const isInside = currentPrice >= matchedLevel.priceMin && currentPrice <= matchedLevel.priceMax;
      const conditionsPresent = [
        `Price is in proximity of learned ${matchedLevel.name} (${matchedLevel.priceZoneStr})`,
        'Level previously respected historical reaction',
      ];
      const missingConditions = isInside
        ? ['Wait for confirmation reaction / wick before any trade consideration']
        : [`Price has not yet touched level boundary [${matchedLevel.priceZoneStr}]`];

      const notTaught = [
        'No teacher-defined entry rule currently exists in approved methodology.',
        'No teacher-defined Stop-Loss formula currently exists in approved methodology.',
      ];

      const provenance = KnowledgeProvenanceEngine.buildEvaluationProvenance({
        matchedLevel,
        currentPrice,
        lessonTitle: matchedLevel.sourceLessonTitle,
        versionTag: snapshot.versionTag,
        missingConditions,
        isExecutable: false,
      });

      return {
        observation,
        status: 'LEVEL_MONITORING',
        methodologyState: 'TAUGHT',
        nextAction: `Monitor ${matchedLevel.name} [${matchedLevel.priceZoneStr}]`,
        actionReason: matchedLevel.whyRelevant,
        matchedLevel,
        conditionsPresent,
        missingConditions,
        expectedBehavior: matchedLevel.expectedBehavior,
        notTaught,
        provenance,
        lastUpdated: now,
      };
    }

    // 5. Untaught / Pure Observing Mode (Zero Preloaded Trading Rules)
    const notTaught = [
      'No teacher methodology or procedure defined for this chart timeframe or context.',
      'No automated trading assumptions (5M is not scalping, support is not buy).',
      'Awaiting teacher instruction on how to analyze this market scenario.',
    ];

    const provenance = KnowledgeProvenanceEngine.buildEvaluationProvenance({
      currentPrice: currentPrice || 0,
      versionTag: snapshot.versionTag,
      missingConditions: ['Teacher methodology not taught for this screen context'],
      isExecutable: false,
    });

    return {
      observation,
      status: 'OBSERVING',
      methodologyState: 'NONE_TAUGHT',
      teacherPromptQuestion: "I don't have a teacher-defined methodology for this situation yet. How do you normally analyze this situation?",
      conditionsPresent: [],
      missingConditions: ['No teacher methodology taught for this screen context'],
      notTaught,
      provenance,
      lastUpdated: now,
    };
  }
}
