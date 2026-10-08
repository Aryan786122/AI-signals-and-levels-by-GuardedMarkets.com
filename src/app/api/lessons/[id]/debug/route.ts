import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const lesson = await db.lesson.findUnique({
      where: { id },
      include: {
        assets: true,
        transcripts: {
          include: {
            segments: { orderBy: { startTimeSec: 'asc' } },
          },
        },
        videoFrames: { orderBy: { timestampSec: 'asc' } },
        teachingEvents: { orderBy: { timestampSec: 'asc' } },
        teachingSegments: { orderBy: { startTimeSec: 'asc' } },
        teachingClaims: { orderBy: { timestampSec: 'asc' } },
        rules: {
          include: { conditions: true, exceptions: true },
        },
        knowledgeItems: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const parsedMediaInspection = lesson.mediaInspection ? JSON.parse(lesson.mediaInspection) : null;
    const parsedDiagnostics = lesson.diagnostics ? JSON.parse(lesson.diagnostics) : null;

    const visualObservations = lesson.videoFrames.map(f => {
      let analysis = null;
      try {
        if (f.analysis) analysis = JSON.parse(f.analysis);
      } catch {}
      return {
        id: f.id,
        timestampSec: f.timestampSec,
        filePath: f.filePath,
        screenType: f.screenType,
        analysis,
      };
    });

    const timelineEvents = lesson.teachingEvents.map(e => {
      let visualState = null;
      try {
        if (e.visualState) visualState = JSON.parse(e.visualState);
      } catch {}
      return {
        id: e.id,
        timestampSec: e.timestampSec,
        durationSec: e.durationSec,
        source: e.statementClassification,
        audioSegment: e.audioSegment,
        visualState,
        evidence: e.evidence,
        confidence: e.confidence,
      };
    });

    const cursorEvents = timelineEvents.filter(e => e.source === 'CURSOR');
    const drawingEvents = timelineEvents.filter(e => e.source === 'DRAWING');
    const screenEvents = timelineEvents.filter(e => e.source === 'SCREEN');
    const audioEvents = timelineEvents.filter(e => e.source === 'AUDIO');

    const teachingSegments = lesson.teachingSegments.map(s => {
      let concepts = [];
      try {
        if (s.concepts) concepts = JSON.parse(s.concepts);
      } catch {}
      return {
        id: s.id,
        startTimeSec: s.startTimeSec,
        endTimeSec: s.endTimeSec,
        title: s.title,
        transcript: s.transcript,
        visualSummary: s.visualSummary,
        concepts,
      };
    });

    return NextResponse.json({
      success: true,
      lessonId: id,
      title: lesson.title,
      status: lesson.status,
      processingStage: lesson.processingStage,
      processingProgress: lesson.processingProgress,
      processingError: lesson.processingError,
      layers: {
        1: {
          name: 'Media Inspection (Layer A)',
          data: parsedMediaInspection,
        },
        2: {
          name: 'Transcription & Spoken Words (Layer B)',
          segmentCount: lesson.transcripts[0]?.segments?.length || 0,
          coverage: lesson.transcriptCoverage,
          data: lesson.transcripts[0]?.segments || [],
        },
        3: {
          name: 'Sampled Keyframes (Layer B)',
          frameCount: lesson.videoFrames.length,
          data: visualObservations.map(v => ({
            id: v.id,
            timestampSec: v.timestampSec,
            filePath: v.filePath,
            screenType: v.screenType,
          })),
        },
        4: {
          name: 'Visual Observations & Perceptions (Layer B)',
          observationCount: visualObservations.length,
          data: visualObservations.map(v => v.analysis).filter(Boolean),
        },
        5: {
          name: 'Cursor Attention Events (Layer B)',
          count: cursorEvents.length,
          data: cursorEvents,
        },
        6: {
          name: 'Drawing & Annotation Events (Layer B)',
          count: drawingEvents.length,
          data: drawingEvents,
        },
        7: {
          name: 'Ground-Truth Synchronized Timeline (Layer B)',
          eventCount: timelineEvents.length,
          breakdown: {
            audio: audioEvents.length,
            screen: screenEvents.length,
            cursor: cursorEvents.length,
            drawing: drawingEvents.length,
          },
          data: timelineEvents,
        },
        8: {
          name: 'Teaching Segments & Intervals (Layer C)',
          segmentCount: teachingSegments.length,
          data: teachingSegments,
        },
        9: {
          name: 'Teaching Logic Engine & Claims (Layer C)',
          claimsCount: (lesson.teachingClaims || []).length,
          rulesCount: lesson.rules.length,
          claimsBreakdown: {
            concepts: (lesson.teachingClaims || []).filter(c => c.type === 'CONCEPT').length,
            observations: (lesson.teachingClaims || []).filter(c => c.type === 'OBSERVATION').length,
            hypotheses: (lesson.teachingClaims || []).filter(c => c.type === 'CONDITIONAL_HYPOTHESIS').length,
            rules: (lesson.teachingClaims || []).filter(c => c.type === 'RULE_CANDIDATE').length,
            preferences: (lesson.teachingClaims || []).filter(c => c.type === 'PREFERENCE').length,
          },
          claims: (lesson.teachingClaims || []).map(c => ({
            id: c.id,
            type: c.type,
            title: c.title,
            subject: c.subject,
            predicate: c.predicate,
            object: c.object,
            statement: c.statement,
            conditions: c.conditions ? JSON.parse(c.conditions) : [],
            invalidationConditions: c.invalidationConditions ? JSON.parse(c.invalidationConditions) : [],
            whatWouldChangeMyMind: c.whatWouldChangeMyMind,
            reasoningChain: c.reasoningChain ? JSON.parse(c.reasoningChain) : [],
            evidenceQuality: c.evidenceQuality,
            evidenceQualityRationale: c.evidenceQualityRationale ? JSON.parse(c.evidenceQualityRationale) : [],
            explicit: c.explicit,
            inferred: c.inferred,
            timestampSec: c.timestampSec,
            status: c.status,
          })),
          diagnostics: parsedDiagnostics,
          activeRules: lesson.rules,
        },
      },
    });
  } catch (error) {
    console.error('[Debug Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
}
