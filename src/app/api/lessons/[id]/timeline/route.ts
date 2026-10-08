import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const [events, frames, segments, transcript, claims, lesson] = await Promise.all([
      db.teachingEvent.findMany({
        where: { lessonId: id },
        orderBy: { timestampSec: 'asc' },
      }),
      db.videoFrame.findMany({
        where: { lessonId: id },
        orderBy: { timestampSec: 'asc' },
      }),
      db.teachingSegment.findMany({
        where: { lessonId: id },
        orderBy: { startTimeSec: 'asc' },
      }),
      db.transcript.findFirst({
        where: { lessonId: id },
        include: { segments: { orderBy: { startTimeSec: 'asc' } } },
      }),
      db.teachingClaim.findMany({
        where: { lessonId: id },
        orderBy: { timestampSec: 'asc' },
      }),
      db.lesson.findUnique({
        where: { id },
        select: { diagnostics: true },
      }),
    ]);

    const parsedEvents = events.map(e => ({
      id: e.id,
      timestampSec: e.timestampSec,
      durationSec: e.durationSec,
      audioSegment: e.audioSegment,
      visualState: e.visualState ? JSON.parse(e.visualState) : null,
      cursorState: e.cursorState ? JSON.parse(e.cursorState) : null,
      annotationState: e.annotationState ? JSON.parse(e.annotationState) : null,
      detectedMarketObjects: e.detectedMarketObjects ? JSON.parse(e.detectedMarketObjects) : [],
      teacherIntent: e.teacherIntent,
      statementClassification: e.statementClassification,
      conceptsReferenced: e.conceptsReferenced ? JSON.parse(e.conceptsReferenced) : [],
      candidateRule: e.candidateRule,
      candidateException: e.candidateException,
      confidence: e.confidence,
      evidence: e.evidence,
    }));

    const parsedFrames = frames.map(f => ({
      id: f.id,
      timestampSec: f.timestampSec,
      filePath: f.filePath.startsWith('/') || f.filePath.startsWith('http')
        ? f.filePath
        : `/api/${f.filePath.replace(/\\/g, '/')}`,
      screenType: f.screenType,
      analysis: f.analysis ? JSON.parse(f.analysis) : null,
    }));

    const parsedClaims = claims.map(c => ({
      id: c.id,
      lessonId: c.lessonId,
      type: c.type,
      title: c.title,
      subject: c.subject,
      predicate: c.predicate,
      object: c.object,
      statement: c.statement,
      conditions: c.conditions ? JSON.parse(c.conditions) : [],
      expectedOutcome: c.expectedOutcome,
      action: c.action,
      invalidationConditions: c.invalidationConditions ? JSON.parse(c.invalidationConditions) : [],
      contradictingEvidence: c.contradictingEvidence ? JSON.parse(c.contradictingEvidence) : [],
      whatWouldChangeMyMind: c.whatWouldChangeMyMind,
      reasoningChain: c.reasoningChain ? JSON.parse(c.reasoningChain) : [],
      evidenceEventIds: c.evidenceEventIds ? JSON.parse(c.evidenceEventIds) : [],
      sourceTranscriptIds: c.sourceTranscriptIds ? JSON.parse(c.sourceTranscriptIds) : [],
      sourceFrameIds: c.sourceFrameIds ? JSON.parse(c.sourceFrameIds) : [],
      confidence: c.confidence,
      evidenceQuality: c.evidenceQuality,
      evidenceQualityRationale: c.evidenceQualityRationale ? JSON.parse(c.evidenceQualityRationale) : [],
      explicit: c.explicit,
      inferred: c.inferred,
      timestampSec: c.timestampSec,
      status: c.status,
    }));

    let diagnosticsData: any = {};
    if (lesson?.diagnostics) {
      try {
        diagnosticsData = JSON.parse(lesson.diagnostics);
      } catch (err) {
        // ignore
      }
    }

    const stateTransitions = Array.isArray(diagnosticsData.stateTransitions)
      ? diagnosticsData.stateTransitions
      : [];
    const semanticRelationships = Array.isArray(diagnosticsData.semanticRelationships)
      ? diagnosticsData.semanticRelationships
      : [];

    return NextResponse.json({
      success: true,
      events: parsedEvents,
      frames: parsedFrames,
      segments,
      transcriptSegments: transcript?.segments || [],
      claims: parsedClaims,
      stateTransitions,
      semanticRelationships,
      diagnostics: diagnosticsData,
    });
  } catch (error) {
    console.error('[Timeline Route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}
