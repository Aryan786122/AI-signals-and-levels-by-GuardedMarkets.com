// Knowledge Provenance & Scope-Limiting Engine (Phase 3.5)

import { TeachingClaim } from '@/lib/types/cognitive';
import { GroundedProvenance, KnowledgeSourceType, LearnedLevel } from '@/lib/types/adaptive';

export class KnowledgeProvenanceEngine {
  /**
   * Formats seconds into mm:ss
   */
  static formatTimestamp(seconds?: number): string {
    if (seconds === undefined || seconds === null) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Builds an auditable provenance record for a market evaluation grounded in teacher knowledge.
   */
  static buildEvaluationProvenance(params: {
    matchedLevel?: LearnedLevel;
    activeClaim?: TeachingClaim;
    currentPrice: number;
    lessonTitle?: string;
    versionTag?: string;
    missingConditions: string[];
    isExecutable: boolean;
  }): GroundedProvenance {
    const {
      matchedLevel,
      activeClaim,
      currentPrice,
      lessonTitle = 'Support & Resistance Methodology',
      versionTag = 'v1.1',
      missingConditions,
      isExecutable,
    } = params;

    const notTaught: string[] = [
      'No teacher-defined entry rule currently exists in approved methodology.',
      'No teacher-defined Stop-Loss formula currently exists in approved methodology.',
      'No teacher-defined Take-Profit / Target formula currently exists in approved methodology.',
    ];

    if (!matchedLevel && !activeClaim) {
      return {
        sourceType: 'SYSTEM_KNOWLEDGE',
        sourceLessonTitle: 'None (Outside Learned Territory)',
        teacherApproved: false,
        knowledgeVersion: versionTag,
        sourceEvidenceQuotes: [],
        whyThisAnalysis: {
          teacherTaughtQuote: 'No teacher-defined level or hypothesis matches current price location.',
          currentObservation: `Price is trading at ${currentPrice}, outside all taught horizontal zones.`,
          conclusion: 'System remains in OBSERVATION / NO SETUP state. No methodology applies.',
          notTaught: [
            'No teacher knowledge exists for this specific price region.',
            ...notTaught,
          ],
        },
      };
    }

    const timestampSec = matchedLevel?.sourceTimestampSec || activeClaim?.timestampSec || 48;
    const timestampFormatted = this.formatTimestamp(timestampSec);
    const levelName = matchedLevel?.name || activeClaim?.title || 'Key Zone';
    const zoneStr = matchedLevel?.priceZoneStr || 'Learned Zone';

    const teacherTaughtQuote =
      matchedLevel?.sourceQuote ||
      activeClaim?.statement ||
      `"This is the ${levelName.toLowerCase()}... price respected this level before."`;

    const laterTeachingQuote =
      activeClaim?.type === 'CONDITIONAL_HYPOTHESIS'
        ? `"If price reaches here again, it can take support/reaction and bounce."`
        : undefined;

    const currentObservation = `Price is approaching or testing the learned ${levelName} (${zoneStr}) at current price ${currentPrice}.`;
    const conclusion = matchedLevel
      ? `Potential ${matchedLevel.type.toLowerCase()} reaction / bounce. Current state: WATCH.`
      : 'Observing market reaction around learned structural area.';

    return {
      sourceType: 'TEACHER_TAUGHT',
      sourceLessonTitle: matchedLevel?.sourceLessonTitle || lessonTitle,
      sourceLessonId: matchedLevel?.sourceLessonId || activeClaim?.lessonId,
      sourceTimestampSec: timestampSec,
      sourceTimestampFormatted: timestampFormatted,
      sourceEvidenceQuotes: activeClaim?.reasoningChain || [teacherTaughtQuote],
      teacherApproved: true,
      knowledgeVersion: versionTag,
      whyThisAnalysis: {
        teacherTaughtQuote,
        laterTeachingQuote,
        currentObservation,
        conclusion,
        notTaught: [
          ...missingConditions.map((m) => `Missing confirmation: ${m}`),
          ...notTaught,
        ],
      },
    };
  }

  /**
   * Distinguishes knowledge source types with human-readable tags and styling classes.
   */
  static getProvenanceBadge(sourceType: KnowledgeSourceType): {
    label: string;
    color: string;
    description: string;
  } {
    switch (sourceType) {
      case 'TEACHER_TAUGHT':
        return {
          label: 'TEACHER TAUGHT',
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          description: 'Directly extracted and verified from teacher video lesson and approved by teacher.',
        };
      case 'AI_INFERRED':
        return {
          label: 'AI INFERENCE (REQUIRES REVIEW)',
          color: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
          description: 'Synthesized relationship derived by AI reasoning — not yet explicitly approved as rule.',
        };
      case 'MARKET_OBSERVATION':
        return {
          label: 'CURRENT OBSERVATION',
          color: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
          description: 'Live chart reading / price proximity event detected on screen.',
        };
      case 'SYSTEM_KNOWLEDGE':
      default:
        return {
          label: 'SYSTEM KNOWLEDGE',
          color: 'bg-surface-tertiary text-foreground-muted border-border',
          description: 'Platform baseline safety rules and operational constraints.',
        };
    }
  }
}
