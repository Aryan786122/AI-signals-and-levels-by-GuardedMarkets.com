import { db } from '@/lib/db';
import { TeachingIngestionService } from './teachingIngestion';

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

export interface ProcessingJobStatus {
  lessonId: string;
  stage: ProcessingStage;
  progress: number;
  error?: string | null;
  videoDurationSec?: number | null;
  frameCount?: number;
  transcriptSegmentCount?: number;
  teachingEventCount?: number;
  candidateRuleCount?: number;
}

export class ProcessingJobManager {
  private static activeJobs: Map<string, Promise<void>> = new Map();

  /**
   * Update the progress and stage of a lesson job in the database.
   */
  static async updateProgress(
    lessonId: string,
    stage: ProcessingStage,
    progress: number,
    error?: string | null
  ): Promise<void> {
    try {
      await db.lesson.update({
        where: { id: lessonId },
        data: {
          processingStage: stage,
          processingProgress: Math.min(100, Math.max(0, Math.round(progress))),
          processingError: error ?? null,
          ...(stage === 'REVIEW_READY' ? { status: 'REVIEW_PENDING', extractedAt: new Date() } : {}),
          ...(stage === 'FAILED' ? { status: 'DRAFT' } : {}),
        },
      });
    } catch (err) {
      console.error(`[ProcessingJobManager] Failed to update progress for lesson ${lessonId}:`, err);
    }
  }

  /**
   * Get the live status of a lesson's processing job.
   */
  static async getStatus(lessonId: string): Promise<ProcessingJobStatus | null> {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        _count: {
          select: {
            videoFrames: true,
            teachingEvents: true,
            rules: true,
          },
        },
        transcripts: {
          include: {
            _count: {
              select: { segments: true },
            },
          },
        },
      },
    });

    if (!lesson) return null;

    const transcriptSegments = lesson.transcripts.reduce(
      (acc, t) => acc + (t._count?.segments || 0),
      0
    );

    return {
      lessonId: lesson.id,
      stage: (lesson.processingStage || 'UPLOADED') as ProcessingStage,
      progress: lesson.processingProgress || 0,
      error: lesson.processingError,
      videoDurationSec: lesson.videoDurationSec,
      frameCount: lesson._count.videoFrames,
      transcriptSegmentCount: transcriptSegments,
      teachingEventCount: lesson._count.teachingEvents,
      candidateRuleCount: lesson._count.rules,
    };
  }

  /**
   * Start or resume background processing for a lesson.
   * If a job is already in flight for this lesson, it returns the existing promise.
   */
  static startProcessing(lessonId: string): void {
    if (this.activeJobs.has(lessonId)) {
      console.log(`[ProcessingJobManager] Job already running for lesson ${lessonId}`);
      return;
    }

    const jobPromise = (async () => {
      try {
        await TeachingIngestionService.executeFullPipeline(lessonId, (stage, progress, error) => {
          this.updateProgress(lessonId, stage, progress, error);
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown processing error';
        console.error(`[ProcessingJobManager] Job failed for lesson ${lessonId}:`, err);
        await this.updateProgress(lessonId, 'FAILED', 0, errMsg);
      } finally {
        this.activeJobs.delete(lessonId);
      }
    })();

    this.activeJobs.set(lessonId, jobPromise);
  }
}
