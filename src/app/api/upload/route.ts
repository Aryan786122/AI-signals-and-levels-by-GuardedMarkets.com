import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { db } from '@/lib/db';
import { ProcessingJobManager } from '@/lib/services/processingJob';
import { MediaProcessor } from '@/lib/services/mediaProcessor';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const providedTitle = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const rawTranscript = (formData.get('transcript') as string) || '';

    // Generate descriptive title if left blank
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const title = providedTitle.trim() || `Teaching Session — ${timeStr}`;

    let assetData = null;
    let videoUrl: string | null = null;
    let videoPath: string | null = null;
    let mimeType: string | null = null;
    let fileSizeBytes: number | null = null;
    let mediaInspection: any = null;
    let durationSeconds: number | null = null;

    if (file && file.size > 0) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const isAudio = file.type.startsWith('audio') || file.name.endsWith('.wav') || file.name.endsWith('.mp3');
      const category = isAudio ? 'audio' : 'videos';

      const fileName = file.name || `recording_${Date.now()}.${isAudio ? 'wav' : 'webm'}`;
      const saved = await storage.save(category, fileName, fileBuffer);
      videoUrl = saved.publicUrl;
      videoPath = saved.filePath;
      mimeType = file.type || (isAudio ? 'audio/webm' : 'video/webm');
      fileSizeBytes = saved.fileSize;

      // Inspect media facts immediately using FFprobe (Layer A)
      try {
        mediaInspection = await MediaProcessor.inspectMedia(saved.filePath);
        durationSeconds = mediaInspection.durationSeconds;
      } catch (err) {
        console.warn('[Upload Route] FFprobe inspection warning:', err);
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

    // Create the Lesson record with Layer A facts
    const lesson = await db.lesson.create({
      data: {
        title,
        description,
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
        transcripts: rawTranscript.trim().length > 0 ? {
          create: [{
            fullText: rawTranscript.trim(),
            language: 'en',
            provider: 'teacher_manual_transcript',
            segments: {
              create: [{
                startTimeSec: 0,
                endTimeSec: durationSeconds || 0,
                text: rawTranscript.trim(),
                confidence: 1.0,
              }],
            },
          }],
        } : undefined,
      },
      include: {
        assets: true,
        transcripts: {
          include: {
            segments: true,
          },
        },
      },
    });

    // Link canonical media asset ID
    if (lesson.assets.length > 0) {
      await db.lesson.update({
        where: { id: lesson.id },
        data: { mediaAssetId: lesson.assets[0].id },
      });
    }

    // Launch background multimodal processing job
    ProcessingJobManager.startProcessing(lesson.id);

    return NextResponse.json({
      success: true,
      lesson,
      mediaInspection,
      processingStage: mediaInspection ? 'INSPECTED' : 'UPLOADED',
      processingProgress: mediaInspection ? 10 : 0,
      message: 'Teaching session uploaded & inspected. Processing pipeline started.',
    });
  } catch (error) {
    console.error('[Upload Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
