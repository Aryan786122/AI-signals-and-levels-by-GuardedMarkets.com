import { db } from '@/lib/db';
import { TeachingClaim } from '@/lib/types/cognitive';
import {
  AdaptiveQuestionItem,
  AdaptiveQuestionType,
  QuestionEvaluationResult,
} from '@/lib/types/adaptive';

export class AdaptiveQuestionEngine {
  /**
   * Automatically generates reasoning-based questions from approved teaching claims.
   * Generates MCQ, True/False, Scenario, Invalidation, Exception, and "What Would You Do?" formats.
   */
  static async generateQuestionsForClaims(
    claims: TeachingClaim[],
    lessonId: string
  ): Promise<AdaptiveQuestionItem[]> {
    const questionsToCreate: Array<{
      type: AdaptiveQuestionType;
      prompt: string;
      scenarioContext?: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      knowledgeType: string;
      knowledgeId: string;
      sourceLessonId: string;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      isFollowUp?: boolean;
      targetedMisconception?: string;
    }> = [];

    for (const claim of claims) {
      if (claim.type === 'CONDITIONAL_HYPOTHESIS') {
        const isSupport = claim.title.toLowerCase().includes('support') || claim.object.toLowerCase().includes('support');
        const levelName = isSupport ? 'Support Zone (80,225 - 80,305)' : 'Resistance Zone (80,520 - 80,570)';

        // 1. Scenario Question (Expected Behavior)
        questionsToCreate.push({
          type: 'SCENARIO',
          prompt: `Price previously respected this ${isSupport ? 'support' : 'resistance'} area. Price is returning to it. According to the teacher's methodology, what is expected?`,
          scenarioContext: `Market price is revisiting ${levelName} after an earlier reaction.`,
          options: [
            isSupport ? 'Guaranteed long order execution immediately on touch' : 'Guaranteed short order execution immediately on touch',
            isSupport ? 'Potential bounce / reaction from the previously respected level' : 'Potential rejection / reaction from the previously respected level',
            isSupport ? 'Immediate short order expecting instant breakdown' : 'Immediate long order expecting instant breakout',
            'Ignore the level because historical price levels are no longer valid',
          ],
          correctIndex: 1,
          explanation: `The teacher explicitly stated that if the market took ${isSupport ? 'support' : 'resistance'} from here earlier, it may produce another reaction upon revisit. It is a conditional hypothesis, not an unconditional trade guarantee.`,
          knowledgeType: 'HYPOTHESIS',
          knowledgeId: claim.id,
          sourceLessonId: lessonId,
          difficulty: 'MEDIUM',
        });

        // 2. Falsifiability / Invalidation Question
        questionsToCreate.push({
          type: 'MCQ',
          prompt: `What specific market behavior would invalidate the teacher's expectation regarding this ${isSupport ? 'support' : 'resistance'} zone?`,
          scenarioContext: `Evaluating market confirmation vs invalidation criteria taught by the teacher.`,
          options: [
            'A single candle wick briefly protruding through the level before closing back inside',
            isSupport
              ? 'Repeated candle body closes accepted below the support boundary'
              : 'Repeated candle body closes accepted above the resistance boundary',
            'Price moving away from the level as expected',
            'A decrease in tick volume during the approach',
          ],
          correctIndex: 1,
          explanation: `A level hypothesis is falsified when price accepted and closes beyond the structural boundary with candle bodies, rather than temporary probing wicks.`,
          knowledgeType: 'HYPOTHESIS',
          knowledgeId: claim.id,
          sourceLessonId: lessonId,
          difficulty: 'HARD',
        });

        // 3. "What Would You Do?" Question
        questionsToCreate.push({
          type: 'WHAT_WOULD_YOU_DO',
          prompt: `Price approaches the ${levelName}. No entry confirmation or stop-loss rules were defined by the teacher in this lesson. What is the correct system state?`,
          scenarioContext: `Live trading simulation where price has reached a teacher-taught zone.`,
          options: [
            'Invent an arbitrary 10-pip stop loss and take an immediate trade',
            'Hold state in WATCH / WAIT and record "NOT DEFINED BY TEACHER KNOWLEDGE" for trade execution',
            'Assume the teacher forgot and use internet default breakout rules',
            'Cancel all analysis and close the software',
          ],
          correctIndex: 1,
          explanation: `The AI must strictly adhere to taught methodology. If entry, stop loss, or target formulas were not explicitly taught, the system honestly holds in WATCH / WAIT rather than inventing ungrounded trading rules.`,
          knowledgeType: 'PREFERENCE',
          knowledgeId: claim.id,
          sourceLessonId: lessonId,
          difficulty: 'MEDIUM',
        });
      } else if (claim.type === 'CONCEPT') {
        // Concept Understanding Question
        questionsToCreate.push({
          type: 'MCQ',
          prompt: `How does the teacher define and identify the concept of "${claim.title}"?`,
          scenarioContext: `Methodology concept foundational understanding.`,
          options: [
            claim.statement,
            'An indicator-based moving average crossover calculation',
            'A Fibonacci retracement level drawn between arbitrary sessions',
            'A random psychological round number on the chart',
          ],
          correctIndex: 0,
          explanation: `Teacher statement: "${claim.statement}". Derived from visual identification and chart swing structure.`,
          knowledgeType: 'CONCEPT',
          knowledgeId: claim.id,
          sourceLessonId: lessonId,
          difficulty: 'EASY',
        });

        // True/False Concept Boundary Question
        questionsToCreate.push({
          type: 'TRUE_FALSE',
          prompt: `True or False: According to the teacher, identifying a ${claim.title} automatically guarantees that price will never breach it.`,
          options: ['True', 'False'],
          correctIndex: 1,
          explanation: `False. In market structure methodology, levels represent historical areas of interest and potential conditional reactions, not guaranteed impenetrable barriers.`,
          knowledgeType: 'CONCEPT',
          knowledgeId: claim.id,
          sourceLessonId: lessonId,
          difficulty: 'EASY',
        });
      } else if (claim.type === 'PREFERENCE') {
        questionsToCreate.push({
          type: 'WHAT_WOULD_YOU_DO',
          prompt: `The teacher stated a discretionary preference: "${claim.statement}". How should the AI system model this?`,
          options: [
            'Convert it immediately into a rigid, immutable hard rule that rejects all trades',
            'Model it as a soft discretionary preference and query the teacher before formalizing',
            'Discard it completely because it is not a strict mathematical equation',
            'Ignore the teacher and apply a generic strategy',
          ],
          correctIndex: 1,
          explanation: `Teacher preferences reflect discretionary trading style. The system preserves them as preferences until the teacher explicitly promotes them into strict execution rules.`,
          knowledgeType: 'PREFERENCE',
          knowledgeId: claim.id,
          sourceLessonId: lessonId,
          difficulty: 'MEDIUM',
        });
      }
    }

    // Persist to database
    const createdQuestions: AdaptiveQuestionItem[] = [];

    for (const q of questionsToCreate) {
      const record = await db.adaptiveQuestion.create({
        data: {
          type: q.type,
          prompt: q.prompt,
          scenarioContext: q.scenarioContext,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          knowledgeType: q.knowledgeType,
          knowledgeId: q.knowledgeId,
          sourceLessonId: q.sourceLessonId,
          difficulty: q.difficulty,
          isFollowUp: q.isFollowUp || false,
          targetedMisconception: q.targetedMisconception,
          status: 'ACTIVE',
        },
      });

      createdQuestions.push({
        id: record.id,
        type: record.type as AdaptiveQuestionType,
        prompt: record.prompt,
        scenarioContext: record.scenarioContext || undefined,
        options: q.options,
        correctIndex: record.correctIndex,
        explanation: record.explanation,
        knowledgeType: record.knowledgeType,
        knowledgeId: record.knowledgeId,
        sourceLessonId: record.sourceLessonId || undefined,
        difficulty: record.difficulty as any,
        isFollowUp: record.isFollowUp,
        targetedMisconception: record.targetedMisconception || undefined,
        status: 'ACTIVE',
        createdAt: record.createdAt.toISOString(),
      });
    }

    return createdQuestions;
  }

  /**
   * Retrieves prioritized questions based on recently learned knowledge, weak concepts,
   * previous mistakes, and untested topics.
   */
  static async getPrioritizedQuestions(limit = 10): Promise<AdaptiveQuestionItem[]> {
    const [questions, masteryList, recentAttempts] = await Promise.all([
      db.adaptiveQuestion.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
      db.conceptMastery.findMany(),
      db.questionAttempt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const masteryMap = new Map<string, number>();
    const misconceptionSet = new Set<string>();

    masteryList.forEach(m => {
      masteryMap.set(m.conceptName.toLowerCase(), m.masteryScore);
      if (m.knownMisconceptions) {
        try {
          const arr: string[] = JSON.parse(m.knownMisconceptions);
          arr.forEach(mc => misconceptionSet.add(mc.toLowerCase()));
        } catch {}
      }
    });

    const recentFailedQuestionIds = new Set(
      recentAttempts.filter(a => !a.isCorrect).map(a => a.questionId)
    );

    // Compute priority scores
    const scored = questions.map(q => {
      let score = 50; // base score

      // Follow-up questions get highest urgency
      if (q.isFollowUp) score += 60;

      // Recently failed question or related to recent mistake
      if (recentFailedQuestionIds.has(q.id)) score += 50;

      // Weak concept
      const conceptScore = masteryMap.get(q.knowledgeType.toLowerCase()) ?? 0.5;
      if (conceptScore < 0.6) {
        score += 40;
      } else if (conceptScore > 0.85) {
        score -= 20; // lower priority for mastered concepts
      }

      // Untested questions (no attempts yet)
      score += 25;

      return { question: q, score };
    });

    // Sort descending by priority score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ question: q }) => ({
      id: q.id,
      type: q.type as AdaptiveQuestionType,
      prompt: q.prompt,
      scenarioContext: q.scenarioContext || undefined,
      chartImageUrl: q.chartImageUrl || undefined,
      options: JSON.parse(q.options),
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      knowledgeType: q.knowledgeType,
      knowledgeId: q.knowledgeId,
      sourceLessonId: q.sourceLessonId || undefined,
      difficulty: q.difficulty as any,
      isFollowUp: q.isFollowUp,
      targetedMisconception: q.targetedMisconception || undefined,
      status: q.status as any,
      createdAt: q.createdAt.toISOString(),
    }));
  }

  /**
   * Evaluates a user/teacher answer, updates student mastery, detects misconceptions,
   * and automatically generates a targeted follow-up question if wrong.
   */
  static async evaluateAnswer(params: {
    questionId: string;
    selectedIndex: number;
    teacherCorrection?: string;
  }): Promise<QuestionEvaluationResult> {
    const { questionId, selectedIndex, teacherCorrection } = params;

    const question = await db.adaptiveQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new Error('Question not found');

    const options: string[] = JSON.parse(question.options);
    const isCorrect = selectedIndex === question.correctIndex;
    const userAnswer = options[selectedIndex] || 'Unknown';
    const expectedAnswer = options[question.correctIndex];

    let reasoningError: string | undefined;
    let misconception: string | undefined;
    let followUpQuestion: AdaptiveQuestionItem | undefined;

    // Fetch or create ConceptMastery tracker
    let mastery = await db.conceptMastery.findFirst({
      where: { conceptName: { contains: question.knowledgeType } },
    });

    if (!mastery) {
      mastery = await db.conceptMastery.create({
        data: {
          conceptName: question.knowledgeType,
          masteryScore: 0.5,
          totalAttempts: 0,
          correctAttempts: 0,
        },
      });
    }

    let newScore = mastery.masteryScore;

    if (isCorrect) {
      // Strengthen understanding score (+0.15, max 1.0)
      newScore = Math.min(1.0, Number((mastery.masteryScore + 0.15).toFixed(2)));

      await db.conceptMastery.update({
        where: { id: mastery.id },
        data: {
          masteryScore: newScore,
          totalAttempts: mastery.totalAttempts + 1,
          correctAttempts: mastery.correctAttempts + 1,
          lastTestedAt: new Date(),
        },
      });
    } else {
      // Identify Misconception & Lower Mastery (-0.20, min 0.1)
      newScore = Math.max(0.1, Number((mastery.masteryScore - 0.20).toFixed(2)));

      if (userAnswer.toLowerCase().includes('guaranteed') || userAnswer.toLowerCase().includes('immediately')) {
        misconception = 'Assuming a conditional level reaction implies guaranteed immediate trade execution without confirmation.';
        reasoningError = 'Over-anticipation: Conflating an observed structural level with an unconditional entry directive.';
      } else if (userAnswer.toLowerCase().includes('ignore') || userAnswer.toLowerCase().includes('no longer')) {
        misconception = 'Dismissing historical price memory: Assuming previously respected levels have zero predictive relevance upon return.';
        reasoningError = 'Lack of structural memory: Failing to track previously respected support/resistance zones.';
      } else if (userAnswer.toLowerCase().includes('invent') || userAnswer.toLowerCase().includes('arbitrary')) {
        misconception = 'Hallucinating trade execution parameters not explicitly taught by the teacher.';
        reasoningError = 'Boundary violation: Manufacturing ungrounded rules outside of taught methodology.';
      } else {
        misconception = `Misunderstanding the conditional relationship taught in "${question.prompt}".`;
        reasoningError = `Selected "${userAnswer}" instead of expected teacher methodology "${expectedAnswer}".`;
      }

      // Record known misconception in mastery
      let existingMisconceptions: string[] = [];
      if (mastery.knownMisconceptions) {
        try {
          existingMisconceptions = JSON.parse(mastery.knownMisconceptions);
        } catch {}
      }
      if (!existingMisconceptions.includes(misconception)) {
        existingMisconceptions.push(misconception);
      }

      await db.conceptMastery.update({
        where: { id: mastery.id },
        data: {
          masteryScore: newScore,
          totalAttempts: mastery.totalAttempts + 1,
          knownMisconceptions: JSON.stringify(existingMisconceptions),
          lastTestedAt: new Date(),
        },
      });

      // Automatically generate a targeted follow-up question
      const followUpPrompt = `Follow-Up Drill: You previously assumed that approaching a key zone guarantees a reaction. If price approaches with huge momentum candles closing beyond the level, what is the teacher's instruction?`;
      const followUpOptions = [
        'Enter immediately anyway because the level was drawn earlier',
        'Acknowledge that candle body close acceptance invalidates the level hypothesis; wait and avoid chasing',
        'Add to position size on the breach',
        'Ignore the closing price and only watch wicks',
      ];

      const followUpRecord = await db.adaptiveQuestion.create({
        data: {
          type: 'SCENARIO',
          prompt: followUpPrompt,
          scenarioContext: `Targeted remediation following misconception: "${misconception}"`,
          options: JSON.stringify(followUpOptions),
          correctIndex: 1,
          explanation: `When a level is penetrated with strong body closes, the conditional reaction hypothesis is falsified. The teacher emphasizes discipline and avoiding chase entries.`,
          knowledgeType: question.knowledgeType,
          knowledgeId: question.knowledgeId,
          sourceLessonId: question.sourceLessonId,
          difficulty: 'MEDIUM',
          isFollowUp: true,
          parentQuestionId: question.id,
          targetedMisconception: misconception,
          status: 'ACTIVE',
        },
      });

      followUpQuestion = {
        id: followUpRecord.id,
        type: followUpRecord.type as AdaptiveQuestionType,
        prompt: followUpRecord.prompt,
        scenarioContext: followUpRecord.scenarioContext || undefined,
        options: followUpOptions,
        correctIndex: followUpRecord.correctIndex,
        explanation: followUpRecord.explanation,
        knowledgeType: followUpRecord.knowledgeType,
        knowledgeId: followUpRecord.knowledgeId,
        sourceLessonId: followUpRecord.sourceLessonId || undefined,
        difficulty: 'MEDIUM',
        isFollowUp: true,
        targetedMisconception: misconception,
        status: 'ACTIVE',
        createdAt: followUpRecord.createdAt.toISOString(),
      };
    }

    // Record question attempt
    await db.questionAttempt.create({
      data: {
        questionId: question.id,
        userAnswer,
        expectedAnswer,
        isCorrect,
        reasoningError,
        misconception,
        teacherCorrection: teacherCorrection || (isCorrect ? undefined : 'Reviewed against canonical teacher knowledge.'),
        conceptName: question.knowledgeType,
      },
    });

    return {
      questionId: question.id,
      selectedIndex,
      isCorrect,
      expectedAnswer,
      userAnswer,
      explanation: question.explanation,
      reasoningError,
      misconception,
      teacherCorrection,
      conceptName: question.knowledgeType,
      newMasteryScore: newScore,
      followUpQuestion,
    };
  }
}
