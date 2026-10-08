import * as path from 'path';
import * as fs from 'fs';
import { db } from '@/lib/db';
import {
  CandidateKnowledge,
  CandidateRuleItem,
  CandidateExceptionItem,
  CandidateCounterExampleItem,
  CandidateUncertaintyItem,
  TeachingEventItem,
  MediaInspection,
  VisualObservation,
  TimelineEvent,
  TeachingSegmentItem,
} from '@/lib/types';
import { speechProvider } from '@/lib/providers/speech';
import { visionProvider } from '@/lib/providers/vision';
import { reasoningProvider } from '@/lib/providers/reasoning';
import { MediaProcessor } from './mediaProcessor';
import { TemporalFusionService } from './temporalFusion';
import { TeachingLogicEngine } from './teachingLogicEngine';

export interface IngestionInput {
  lessonId: string;
  lessonTitle?: string;
  mediaBuffer?: Buffer;
  mimeType?: string;
  cursorEvents?: any[];
  drawingEvents?: any[];
  rawAudioText?: string;
}

export type ProcessingStage =
  | 'UPLOADED'
  | 'INSPECTED'
  | 'AUDIO_EXTRACTED'
  | 'TRANSCRIBING'
  | 'TRANSCRIPTION_COMPLETE'
  | 'FRAMES_EXTRACTED'
  | 'VISUAL_ANALYSIS_COMPLETE'
  | 'TIMELINE_SYNCHRONIZED'
  | 'TEACHING_UNDERSTANDING'
  | 'REVIEW_READY'
  | 'FAILED';

export type StageCallback = (
  stage: ProcessingStage,
  progress: number,
  error?: string | null
) => Promise<void> | void;

export class TeachingIngestionService {
  /**
   * Complete Ground-Truth Media Processing Pipeline
   * Separate into:
   *   Layer A: Media Facts (Duration, Codecs, Resolution, Audio track, File size)
   *   Layer B: Perception (Speech transcription, Screen classification, Frame observations)
   *   Layer C: Reasoning (Structured timeline, Teaching segmentation, Knowledge extraction)
   */
  static async executeFullPipeline(
    lessonId: string,
    onProgress?: StageCallback
  ): Promise<CandidateKnowledge> {
    const notify = async (stage: ProcessingStage, progress: number, error?: string | null) => {
      if (onProgress) {
        await onProgress(stage, progress, error);
      }
    };

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        assets: true,
        transcripts: {
          include: { segments: { orderBy: { startTimeSec: 'asc' } } },
        },
      },
    });

    if (!lesson) {
      throw new Error(`Lesson ${lessonId} not found in database.`);
    }

    const storageDir = path.resolve(process.cwd(), 'storage');
    const lessonFramesDir = path.join(storageDir, 'frames', lessonId);
    const lessonAudioDir = path.join(storageDir, 'audio');

    if (!fs.existsSync(lessonFramesDir)) fs.mkdirSync(lessonFramesDir, { recursive: true });
    if (!fs.existsSync(lessonAudioDir)) fs.mkdirSync(lessonAudioDir, { recursive: true });

    // Canonical Media Resolution (Section 4)
    let videoAsset = lesson.assets.find(a => a.assetType === 'VIDEO') ||
      (lesson.videoPath ? { id: lesson.mediaAssetId || `asset_${lessonId}`, filePath: lesson.videoPath, assetType: 'VIDEO' } : null);

    if (!videoAsset || !videoAsset.filePath) {
      await notify('FAILED', 0, 'No media asset attached to this teaching session.');
      throw new Error('No media asset attached to this lesson.');
    }

    const resolvedVideoPath = path.resolve(process.cwd(), videoAsset.filePath);
    if (!fs.existsSync(resolvedVideoPath)) {
      await notify('FAILED', 0, `Media file not found on disk: ${videoAsset.filePath}`);
      throw new Error(`Media file not found on disk: ${videoAsset.filePath}`);
    }

    // -------------------------------------------------------------
    // LAYER A — STAGE 1: Deterministic Media Facts & FFprobe Inspection
    // -------------------------------------------------------------
    await notify('INSPECTED', 10);
    const mediaFacts: MediaInspection = await MediaProcessor.inspectMedia(resolvedVideoPath);

    // Persist Layer A facts immediately to database
    await db.lesson.update({
      where: { id: lessonId },
      data: {
        durationSec: Math.round(mediaFacts.durationSeconds),
        videoDurationSec: mediaFacts.durationSeconds,
        fileSizeBytes: mediaFacts.fileSizeBytes,
        mediaAssetId: videoAsset.id,
        mediaInspection: JSON.stringify(mediaFacts),
        processingStage: 'INSPECTED',
        processingProgress: 10,
      },
    });

    // Update canonical Video asset
    await db.lessonAsset.updateMany({
      where: { lessonId, assetType: 'VIDEO' },
      data: {
        durationSec: mediaFacts.durationSeconds,
        hasAudio: mediaFacts.hasAudio,
        hasVideo: mediaFacts.hasVideo,
        fileSize: mediaFacts.fileSizeBytes,
      },
    });

    // -------------------------------------------------------------
    // LAYER A — STAGE 2: Audio Extraction via FFmpeg
    // -------------------------------------------------------------
    let audioFilePath: string | null = null;
    let audioDurationSec = mediaFacts.audioDurationSeconds || mediaFacts.durationSeconds;

    if (mediaFacts.hasAudio) {
      await notify('AUDIO_EXTRACTED', 25);
      const extracted = await MediaProcessor.extractAudio(resolvedVideoPath, lessonAudioDir);
      audioFilePath = extracted.audioPath;
      audioDurationSec = extracted.durationSec;

      const relAudioPath = path.relative(process.cwd(), audioFilePath).replace(/\\/g, '/');

      // Create or update canonical AUDIO asset
      const existingAudio = lesson.assets.find(a => a.assetType === 'AUDIO');
      if (existingAudio) {
        await db.lessonAsset.update({
          where: { id: existingAudio.id },
          data: {
            filePath: relAudioPath,
            fileSize: extracted.fileSize,
            durationSec: extracted.durationSec,
            hasAudio: true,
          },
        });
      } else {
        await db.lessonAsset.create({
          data: {
            lessonId,
            assetType: 'AUDIO',
            filePath: relAudioPath,
            fileName: path.basename(audioFilePath),
            fileSize: extracted.fileSize,
            mimeType: 'audio/wav',
            durationSec: extracted.durationSec,
            hasAudio: true,
          },
        });
      }
    }

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // LAYER B — STAGE 3: Local Faster-Whisper Speech Transcription & Coverage Validation
    // -------------------------------------------------------------
    await notify('TRANSCRIBING', 35);
    let speechSegments: Array<{ startTimeSec: number; endTimeSec: number; text: string; confidence?: number }> = [];
    let fullTranscriptText = '';
    let transcriptCoverage = 0;
    let transcriptResult: any = null;

    if (audioFilePath && fs.existsSync(audioFilePath)) {
      transcriptResult = await speechProvider.transcribe(audioFilePath, {
        audioDurationSec,
        onProgress: async (ev: any) => {
          if (ev.stage === 'DOWNLOADING_MODEL') {
            await notify('DOWNLOADING_MODEL' as any, 36);
          } else if (ev.stage === 'MODEL_READY') {
            await notify('MODEL_READY' as any, 38);
          } else if (ev.stage === 'TRANSCRIBING') {
            const prog = 40 + Math.round((ev.progress || 0) * 0.1);
            await notify('TRANSCRIBING', Math.min(49, prog));
          }
        },
      } as any);

      if (transcriptResult.error && !transcriptResult.segments?.length) {
        console.warn(`[TeachingIngestion] Speech transcription note: ${transcriptResult.error}`);
      }

      if (transcriptResult.segments && transcriptResult.segments.length > 0) {
        speechSegments = transcriptResult.segments;
        fullTranscriptText = transcriptResult.fullText;
        transcriptCoverage = transcriptResult.coveragePercentage || 0;

        // Clean any previous transcripts for this lesson and save real one
        await db.transcriptSegment.deleteMany({
          where: { transcript: { lessonId } },
        });
        await db.transcript.deleteMany({ where: { lessonId } });

        await db.transcript.create({
          data: {
            lessonId,
            fullText: fullTranscriptText,
            language: transcriptResult.language || 'en',
            provider: speechProvider.name,
            segments: {
              create: speechSegments.map(s => ({
                startTimeSec: s.startTimeSec,
                endTimeSec: s.endTimeSec,
                text: s.text,
                confidence: s.confidence || 0.95,
              })),
            },
          },
        });

        await db.lesson.update({
          where: { id: lessonId },
          data: {
            transcriptCoverage,
            processingStage: 'TRANSCRIPTION_COMPLETE',
            processingProgress: 50,
          },
        });
      } else {
        // Strict anti-hallucination requirement: Do NOT proceed to cognitive understanding until transcription succeeds
        const failureReason = transcriptResult.error || 'Local Whisper produced 0 transcript segments.';
        await db.lesson.update({
          where: { id: lessonId },
          data: {
            processingStage: 'FAILED',
            processingError: failureReason,
          },
        });
        await notify('FAILED', 40, failureReason);
        throw new Error(`Transcription failed: ${failureReason}. Cannot proceed to cognitive understanding.`);
      }
    } else {
      await notify('FAILED', 40, 'No audio file available for transcription.');
      throw new Error('No audio file available for transcription.');
    }

    await notify('TRANSCRIPTION_COMPLETE', 50);

    // -------------------------------------------------------------
    // LAYER B — STAGE 4: Full-Duration Keyframe Sampling
    // -------------------------------------------------------------
    await notify('FRAMES_EXTRACTED', 65);
    const extractedFrames = await MediaProcessor.extractFrames(resolvedVideoPath, lessonFramesDir, {
      maxFrames: 35,
    });

    // Delete old frames for this lesson
    await db.videoFrame.deleteMany({ where: { lessonId } });

    // -------------------------------------------------------------
    // LAYER B — STAGE 5: Visual Observations & Sequence Perception
    // -------------------------------------------------------------
    await notify('VISUAL_ANALYSIS_COMPLETE', 75);

    const frameSequenceInput = {
      lessonId,
      frames: extractedFrames.map((f, idx) => ({
        id: `frame_${idx + 1}`,
        timestampSec: f.timestampSec,
        filePath: f.filePath,
      })),
    };

    const sequenceObs = await visionProvider.analyzeFrameSequence(frameSequenceInput);
    const visualObservations = sequenceObs.observations;
    const visualEvents = sequenceObs.events;

    for (const obs of visualObservations) {
      const relPath = path.relative(process.cwd(), obs.imagePath).replace(/\\/g, '/');
      await db.videoFrame.create({
        data: {
          lessonId,
          timestampSec: obs.timestampSec,
          filePath: relPath,
          screenType: obs.screenType,
          analysis: JSON.stringify(obs),
        },
      });
    }

    // -------------------------------------------------------------
    // LAYER B — STAGE 6 & 7: Temporal Multimodal Fusion & Segmentation
    // -------------------------------------------------------------
    await notify('TIMELINE_SYNCHRONIZED', 85);

    const fusionResult = TemporalFusionService.fuseMultimodalStream({
      lessonId,
      transcriptSegments: speechSegments,
      visualObservations,
      visualEvents,
    });

    const timelineEvents = fusionResult.timelineEvents;
    const teachingSegments = fusionResult.teachingSegments;
    const referenceCandidates = fusionResult.referenceCandidates;

    // Persist TeachingSegments to DB
    await db.teachingSegment.deleteMany({ where: { lessonId } });
    for (const seg of teachingSegments) {
      await db.teachingSegment.create({
        data: {
          lessonId,
          startTimeSec: seg.startTimeSec,
          endTimeSec: seg.endTimeSec,
          title: seg.title,
          transcript: seg.transcriptText,
          visualSummary: seg.visualSummary,
          concepts: JSON.stringify(seg.concepts),
        },
      });
    }

    // Persist rich multimodal TeachingEvents (Audio, Screen, Drawing, Cursor)
    await db.teachingEvent.deleteMany({ where: { lessonId } });
    if (timelineEvents.length > 0) {
      await db.teachingEvent.createMany({
        data: timelineEvents.map(e => ({
          lessonId,
          timestampSec: e.timestampSec,
          durationSec: e.durationSec,
          statementClassification: e.source,
          audioSegment: e.source === 'AUDIO' ? e.description : null,
          visualState: (e.source === 'SCREEN' || e.source === 'DRAWING' || e.source === 'CURSOR') ? JSON.stringify(e.data) : null,
          evidence: e.description,
          confidence: 0.95,
        })),
      });
    }

    // -------------------------------------------------------------
    // LAYER C — STAGE 8: Multimodal Teaching Logic Engine (Multi-Pass Reasoning)
    // -------------------------------------------------------------
    await notify('TEACHING_UNDERSTANDING', 90);

    const understandingResult = await TeachingLogicEngine.processSessionUnderstanding({
      lessonId,
      lessonTitle: lesson.title,
      mediaFacts,
      timelineEvents,
      teachingSegments,
      visualObservations,
    });

    // Persist TeachingClaim records in DB
    await db.teachingClaim.deleteMany({ where: { lessonId } });
    for (const claim of understandingResult.claims) {
      await db.teachingClaim.create({
        data: {
          id: claim.id,
          lessonId,
          type: claim.type,
          title: claim.title,
          subject: claim.subject,
          predicate: claim.predicate,
          object: claim.object,
          statement: claim.statement,
          conditions: claim.conditions ? JSON.stringify(claim.conditions) : null,
          expectedOutcome: claim.expectedOutcome || null,
          action: claim.action || null,
          invalidationConditions: claim.invalidationConditions ? JSON.stringify(claim.invalidationConditions) : null,
          contradictingEvidence: claim.contradictingEvidence ? JSON.stringify(claim.contradictingEvidence) : null,
          whatWouldChangeMyMind: claim.whatWouldChangeMyMind || null,
          reasoningChain: claim.reasoningChain ? JSON.stringify(claim.reasoningChain) : null,
          evidenceEventIds: claim.evidenceEventIds ? JSON.stringify(claim.evidenceEventIds) : null,
          sourceTranscriptIds: claim.sourceTranscriptIds ? JSON.stringify(claim.sourceTranscriptIds) : null,
          sourceFrameIds: claim.sourceFrameIds ? JSON.stringify(claim.sourceFrameIds) : null,
          confidence: claim.confidence,
          evidenceQuality: claim.evidenceQuality,
          evidenceQualityRationale: claim.evidenceQualityRationale ? JSON.stringify(claim.evidenceQualityRationale) : null,
          explicit: claim.explicit,
          inferred: claim.inferred,
          timestampSec: claim.timestampSec ?? null,
          status: claim.status,
        },
      });
    }

    // Categorize claims
    const conceptClaims = understandingResult.claims.filter(c => c.type === 'CONCEPT');
    const ruleClaims = understandingResult.claims.filter(c => c.type === 'RULE_CANDIDATE');
    const exceptionClaims = understandingResult.claims.filter(c => c.type === 'EXCEPTION');
    const counterexampleClaims = understandingResult.claims.filter(c => c.type === 'COUNTEREXAMPLE');
    const uncertaintyClaims = understandingResult.claims.filter(c => c.type === 'PREFERENCE' || c.type === 'UNCERTAINTY');

    // Map into CandidateKnowledge (Honest extraction: 0 rules if none taught)
    const candidateKnowledge: CandidateKnowledge = {
      concepts: conceptClaims.map((c, idx) => ({
        id: c.id || `cconcept_${idx + 1}`,
        name: c.title,
        category: 'MARKET_STRUCTURE',
        definition: c.statement,
        importance: 4,
      })),
      rules: ruleClaims.map((r, idx) => ({
        id: r.id || `crule_${idx + 1}`,
        title: r.title,
        statement: r.statement,
        priority: 'STRONG_RULE',
        tradePhase: 'SETUP_RECOGNITION',
        conditions: (r.conditions || []).map((cond, cIdx) => ({
          name: cond.text || `Condition ${cIdx + 1}`,
          field: 'price_action',
          operator: 'RESPECTS',
          threshold: cond.text,
        })),
        exceptions: [],
        evidence: r.reasoningChain?.[0] || r.statement,
        timestampSec: r.timestampSec || 0,
      })),
      exceptions: exceptionClaims.map((e, idx) => ({
        id: e.id || `cexc_${idx + 1}`,
        name: e.title,
        description: e.statement,
        overrideBehavior: 'AVOID_IMMEDIATE_ENTRY',
        conditionLogic: e.statement,
        evidence: e.reasoningChain?.[0] || e.statement,
        timestampSec: e.timestampSec || 0,
      })),
      counterexamples: counterexampleClaims.map((c, idx) => ({
        id: c.id || `ccount_${idx + 1}`,
        title: c.title,
        context: 'Invalid setup scenario described by teacher.',
        whyInvalid: c.statement,
        teacherExplanation: c.statement,
        evidence: c.reasoningChain?.[0] || c.statement,
        timestampSec: c.timestampSec || 0,
      })),
      uncertainties: uncertaintyClaims.map((u, idx) => ({
        id: u.id || `cunc_${idx + 1}`,
        quote: u.statement,
        classification: 'PREFERENCE',
        prompt: `Teacher stated discretionary preference: "${u.statement}". Convert to strict rule or keep as preference?`,
        suggestedRule: u.statement,
        timestampSec: u.timestampSec || 0,
        status: 'PENDING',
      })),
      relationships: understandingResult.relationships.map(r => ({
        from: r.sourceEntityName,
        to: r.targetEntityName,
        relationType: r.relationshipType,
        description: r.description,
      })),
      teachingEvents: timelineEvents.map((t, idx) => ({
        id: `te_${idx + 1}`,
        lessonId,
        timestampSec: t.timestampSec,
        durationSec: t.durationSec,
        audioSegment: t.source === 'AUDIO' ? t.description : undefined,
        evidence: t.description,
        confidence: 0.95,
      })),
      confidence: candidateKnowledgeConfidence(speechSegments.length, transcriptCoverage, timelineEvents.length),
      claims: understandingResult.claims,
      stateTransitions: understandingResult.stateTransitions,
      semanticRelationships: understandingResult.relationships,
    };

    // -------------------------------------------------------------
    // STAGE 9: Ready for Teacher Review (Section 21)
    // -------------------------------------------------------------
    const diagnostics = {
      mediaId: videoAsset.id,
      filePath: resolvedVideoPath,
      fileSizeBytes: mediaFacts.fileSizeBytes,
      durationSeconds: mediaFacts.durationSeconds,
      hasAudio: mediaFacts.hasAudio,
      hasVideo: mediaFacts.hasVideo,
      resolution: `${mediaFacts.width}x${mediaFacts.height}`,
      fps: mediaFacts.fps,
      videoCodec: mediaFacts.videoCodec,
      audioCodec: mediaFacts.audioCodec,
      transcriptionProvider: speechProvider.name,
      transcriptionDevice: transcriptResult?.device || 'cpu',
      transcriptionComputeType: transcriptResult?.computeType || 'int8',
      transcriptionGpu: transcriptResult?.gpuName || null,
      transcriptionModel: transcriptResult?.model || process.env.WHISPER_MODEL || 'small',
      transcriptSegments: speechSegments.length,
      transcriptCoverage: `${transcriptCoverage}%`,
      framesExtracted: extractedFrames.length,
      framesSampled: sequenceObs.totalFramesSampled,
      framesAnalyzed: sequenceObs.totalFramesAnalyzed,
      visualObservations: visualObservations.length,
      visualEvents: visualEvents.length,
      drawingEvents: visualEvents.filter(e => e.type.startsWith('DRAWING')).length,
      cursorEvents: visualEvents.filter(e => e.type.startsWith('CURSOR')).length,
      referenceCandidates: referenceCandidates.length,
      timelineEvents: timelineEvents.length,
      teachingSegments: teachingSegments.length,
      candidateRules: candidateKnowledge.rules.length,
      candidateExceptions: candidateKnowledge.exceptions.length,
      teachingClaims: understandingResult.claims.length,
      teachingConcepts: candidateKnowledge.concepts.length,
      teachingHypotheses: understandingResult.claims.filter(c => c.type === 'CONDITIONAL_HYPOTHESIS').length,
      stateTransitionCount: understandingResult.stateTransitions.length,
      stateTransitions: understandingResult.stateTransitions,
      semanticEntityCount: understandingResult.entities.length,
      semanticEntities: understandingResult.entities,
      semanticRelationshipCount: understandingResult.relationships.length,
      semanticRelationships: understandingResult.relationships,
      sessionMemory: {
        activeEntities: understandingResult.sessionMemory.activeEntities.map(e => ({ name: e.name, type: e.type, priceZone: e.priceZone })),
        activeConcepts: understandingResult.sessionMemory.activeConcepts.map(c => c.name),
        unresolvedReferences: understandingResult.sessionMemory.unresolvedReferences,
      },
    };

    await db.lesson.update({
      where: { id: lessonId },
      data: {
        processingStage: 'REVIEW_READY',
        processingProgress: 100,
        status: 'REVIEW_PENDING',
        extractedAt: new Date(),
        diagnostics: JSON.stringify(diagnostics),
        processingError: null,
      },
    });

    await notify('REVIEW_READY', 100);

    return candidateKnowledge;
  }

  static formatSeconds(sec?: number): string {
    if (sec === undefined || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

function candidateKnowledgeConfidence(segmentCount: number, coverage: number, timelineCount: number): number {
  if (segmentCount === 0 || timelineCount === 0) return 0.0;
  if (coverage > 85) return 0.95;
  if (coverage > 50) return 0.80;
  return 0.60;
}

export default TeachingIngestionService;
