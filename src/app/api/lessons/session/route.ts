import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { ProcessingJobManager } from '@/lib/services/processingJob';
import { MediaProcessor } from '@/lib/services/mediaProcessor';

/**
 * Unified Teaching Session Ingestion Endpoint:
 * Handles live browser screen/voice recordings as well as desktop screen capture streams.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let title = '';
    let mediaBuffer: Buffer | undefined = undefined;
    let mimeType = 'video/webm';
    let rawAudioText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = (formData.get('media') || formData.get('file')) as File | null;
      title = (formData.get('title') as string) || '';
      rawAudioText = (formData.get('transcript') as string) || '';

      if (file && file.size > 0) {
        mediaBuffer = Buffer.from(await file.arrayBuffer());
        mimeType = file.type || 'video/webm';
      }
    } else {
      const json = await req.json();
      title = json.title || '';
      rawAudioText = json.transcript || '';
      if (json.audioBase64) {
        mediaBuffer = Buffer.from(json.audioBase64, 'base64');
        mimeType = json.mimeType || 'audio/wav';
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const sessionTitle = title.trim() || `Live Teaching Session — ${timeStr}`;

    let assetData = null;
    let videoUrl = null;
    let videoPath = null;
    let fileSizeBytes = null;
    let mediaInspection: any = null;
    let durationSeconds: number | null = null;

    if (mediaBuffer && mediaBuffer.length > 0) {
      const isAudio = mimeType.startsWith('audio');
      const category = isAudio ? 'audio' : 'videos';
      const fileName = `teaching_session_${Date.now()}.${isAudio ? 'wav' : 'webm'}`;

      const saved = await storage.save(category, fileName, mediaBuffer);
      videoUrl = saved.publicUrl;
      videoPath = saved.filePath;
      fileSizeBytes = saved.fileSize;

      // Inspect media facts immediately using FFprobe (Layer A)
      try {
        mediaInspection = await MediaProcessor.inspectMedia(saved.filePath);
        durationSeconds = mediaInspection.durationSeconds;
      } catch (err) {
        console.warn('[Session Ingestion] FFprobe inspection warning:', err);
      }

      assetData = {
        assetType: isAudio ? 'AUDIO' : 'VIDEO',
        filePath: saved.filePath,
        fileName,
        fileSize: saved.fileSize,
        mimeType,
        durationSec: durationSeconds,
        hasAudio: mediaInspection?.hasAudio || false,
        hasVideo: mediaInspection?.hasVideo || false,
      };
    }

    // Create Lesson Record with Layer A facts
    const lesson = await db.lesson.create({
      data: {
        title: sessionTitle,
        videoUrl,
        videoPath,
        mimeType,
        fileSizeBytes,
        durationSec: durationSeconds ? Math.round(durationSeconds) : null,
        videoDurationSec: durationSeconds,
        mediaInspection: mediaInspection ? JSON.stringify(mediaInspection) : null,
        status: 'DRAFT',
        analysisState: 'TEXT_ONLY',
        processingStage: mediaInspection ? 'INSPECTED' : 'UPLOADED',
        processingProgress: mediaInspection ? 10 : 0,
        assets: assetData ? { create: [assetData] } : undefined,
        transcripts: rawAudioText.trim().length > 0 ? {
          create: [{
            fullText: rawAudioText.trim(),
            language: 'en',
            provider: 'live_session_input',
            segments: {
              create: [{
                startTimeSec: 0,
                endTimeSec: durationSeconds || 0,
                text: rawAudioText.trim(),
                confidence: 1.0,
              }],
            },
          }],
        } : undefined,
      },
      include: {
        assets: true,
      },
    });

    if (lesson.assets.length > 0) {
      await db.lesson.update({
        where: { id: lesson.id },
        data: { mediaAssetId: lesson.assets[0].id },
      });
    }

    // Launch background processing pipeline
    ProcessingJobManager.startProcessing(lesson.id);

    return NextResponse.json({
      success: true,
      lesson,
      mediaInspection,
      processingStage: mediaInspection ? 'INSPECTED' : 'UPLOADED',
      processingProgress: mediaInspection ? 10 : 0,
      message: 'Teaching session recorded & inspected. Multimodal ingestion started.',
    });
  } catch (error) {
    console.error('[Session Ingestion] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Session ingestion failed' },
      { status: 500 }
    );
  }
}
