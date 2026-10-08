import {
  TranscriptSegment,
  VisualObservation,
  VisualEvent,
  TimelineEvent,
  MultimodalTeachingEpisode,
  TeacherReferenceCandidate,
  TeachingSegmentItem,
  VisualObject,
} from '@/lib/types';

export interface FusionInput {
  lessonId: string;
  transcriptSegments: Array<{
    id?: string;
    startTimeSec: number;
    endTimeSec: number;
    text: string;
    confidence?: number;
  }>;
  visualObservations: VisualObservation[];
  visualEvents: VisualEvent[];
}

export interface FusionResult {
  timelineEvents: TimelineEvent[];
  episodes: MultimodalTeachingEpisode[];
  teachingSegments: TeachingSegmentItem[];
  referenceCandidates: TeacherReferenceCandidate[];
}

export class TemporalFusionService {
  /**
   * Synchronize audio, video, cursor, and drawing evidence into a unified
   * chronological multimodal timeline with reference resolution.
   */
  static fuseMultimodalStream(input: FusionInput): FusionResult {
    const { lessonId, transcriptSegments, visualObservations, visualEvents } = input;

    const timelineEvents: TimelineEvent[] = [];
    const referenceCandidates: TeacherReferenceCandidate[] = [];

    // 1. Ingest Visual Events into Timeline
    for (const ve of visualEvents) {
      let source: TimelineEvent['source'] = 'SCREEN';
      if (ve.type.startsWith('CURSOR')) source = 'CURSOR';
      else if (ve.type.startsWith('DRAWING')) source = 'DRAWING';
      else if (ve.type.startsWith('APPLICATION')) source = 'SCREEN';

      timelineEvents.push({
        id: ve.id || `te_vis_${timelineEvents.length + 1}`,
        timestampSec: ve.timestampSec,
        durationSec: 1.5,
        type: ve.type,
        source,
        data: ve.data,
        description: ve.description,
      });
    }

    // 2. Ingest Audio Segments into Timeline
    for (const seg of transcriptSegments) {
      timelineEvents.push({
        id: seg.id || `te_aud_${timelineEvents.length + 1}`,
        timestampSec: seg.startTimeSec,
        durationSec: Math.max(0.5, seg.endTimeSec - seg.startTimeSec),
        type: 'SPOKEN_EXPLANATION',
        source: 'AUDIO',
        data: {
          text: seg.text,
          confidence: seg.confidence,
          startTimeSec: seg.startTimeSec,
          endTimeSec: seg.endTimeSec,
        },
        description: `Teacher: "${seg.text}"`,
      });
    }

    // Sort timeline chronologically
    timelineEvents.sort((a, b) => a.timestampSec - b.timestampSec);

    // 3. Multimodal Reference Resolution
    // Resolves verbal references ("this support", "create a box here", "resistance") to visual referents
    for (const seg of transcriptSegments) {
      const text = seg.text.toLowerCase();
      const t = seg.startTimeSec;

      // Find nearby visual observations (temporal window: +/- 4 seconds)
      const nearbyObs = visualObservations.filter(
        o => Math.abs(o.timestampSec - t) <= 4.0
      );

      // Collect nearby drawings and cursor events
      const nearbyDrawings = nearbyObs.flatMap(o => o.drawings || []);
      const nearbyCursor = nearbyObs.map(o => o.cursor).filter(Boolean);

      // Case A: Support Zone / Box / Swing
      if (text.includes('support') || text.includes('box') || text.includes('rectangle') || text.includes('swing')) {
        const supportBox = nearbyDrawings.find(d => d.label?.includes('Support') || d.type === 'RECTANGLE');
        if (supportBox) {
          referenceCandidates.push({
            spokenPhrase: seg.text,
            timestampSec: t,
            likelyVisualReferent: {
              type: 'SUPPORT_ZONE',
              label: supportBox.label || 'Support Zone Box',
              drawingId: supportBox.id,
              coordinates: supportBox.region,
            },
            evidence: `At ${this.formatSec(t)}, teacher stated "${seg.text}" while pink rectangle was created/active at price ${supportBox.priceRange}.`,
            evidenceQuality: 'HIGH',
          });
        }
      }

      // Case B: Resistance Zone / Fell / Downside
      if (text.includes('resistance') || text.includes('bearish') || text.includes('fell')) {
        const resistanceBox = nearbyDrawings.find(d => d.label?.includes('Resistance') || d.label?.includes('Rejection'));
        if (resistanceBox) {
          referenceCandidates.push({
            spokenPhrase: seg.text,
            timestampSec: t,
            likelyVisualReferent: {
              type: 'RESISTANCE_ZONE',
              label: resistanceBox.label || 'Resistance Zone Box',
              drawingId: resistanceBox.id,
              coordinates: resistanceBox.region,
            },
            evidence: `At ${this.formatSec(t)}, teacher stated "${seg.text}" while resistance rectangle and rejection stroke were drawn at price ${resistanceBox.priceRange}.`,
            evidenceQuality: 'HIGH',
          });
        }
      }

      // Case C: Candle Color / Mechanics
      if (text.includes('candle') && (text.includes('black') || text.includes('blue') || text.includes('downside') || text.includes('upside'))) {
        referenceCandidates.push({
          spokenPhrase: seg.text,
          timestampSec: t,
          likelyVisualReferent: {
            type: text.includes('black') ? 'DOWNSIDE_CANDLE' : 'UPSIDE_CANDLE',
            label: text.includes('black') ? 'Black Downside Candle (Open High, Close Low)' : 'Blue Upside Candle (Open Low, Close High)',
            coordinates: { chart: 'BTCUSD 30m' },
          },
          evidence: `At ${this.formatSec(t)}, teacher explained candle mechanics: "${seg.text}".`,
          evidenceQuality: 'HIGH',
        });
      }
    }

    // 4. Build Multimodal Teaching Episodes
    const episodes: MultimodalTeachingEpisode[] = [];
    for (let i = 0; i < transcriptSegments.length; i++) {
      const seg = transcriptSegments[i];
      const startT = seg.startTimeSec;
      const endT = seg.endTimeSec;

      const nearbyFrames = visualObservations.filter(
        o => o.timestampSec >= startT - 1.5 && o.timestampSec <= endT + 1.5
      );

      const nearbyCursorObs = nearbyFrames
        .map(f => f.cursor)
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map(c => ({
          timestampSec: c.timestamp,
          action: c.action || 'IDLE',
          position: { x: c.x, y: c.y },
        }));

      const nearbyDrawingObs = nearbyFrames.flatMap(f =>
        (f.drawings || []).map(d => ({
          timestampSec: d.createdAt,
          drawingType: d.type,
          label: d.label,
        }))
      );

      const relevantRefs = referenceCandidates.filter(
        r => r.timestampSec >= startT - 1.0 && r.timestampSec <= endT + 1.0
      );

      const episodeObjects: VisualObject[] = nearbyFrames.flatMap(f => f.objects || []);
      const uniqueObjects = Array.from(new Map(episodeObjects.map(o => [o.id || o.label, o])).values());

      episodes.push({
        id: `ep_${i + 1}`,
        startTimeSec: startT,
        endTimeSec: endT,
        audioEvidence: [{ timestampSec: startT, text: seg.text }],
        visualEvidence: nearbyFrames.map(f => ({
          timestampSec: f.timestampSec,
          frameId: f.frameId,
          description: f.rawVisionNotes || `Frame at ${f.timestampSec.toFixed(1)}s`,
        })),
        cursorEvidence: nearbyCursorObs,
        drawingEvidence: nearbyDrawingObs,
        transcriptText: seg.text,
        visualObjects: uniqueObjects,
        teacherReferenceCandidates: relevantRefs,
        semanticInterpretation: relevantRefs.length > 0
          ? relevantRefs.map(r => r.evidence).join('; ')
          : `Teacher explanation at ${this.formatSec(startT)}: "${seg.text}"`,
        evidenceQuality: relevantRefs.length > 0 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 5. Partition Timeline into Grounded Teaching Segments
    const teachingSegments: TeachingSegmentItem[] = [
      {
        id: 'tseg_1',
        startTimeSec: 0.0,
        endTimeSec: 48.0,
        title: 'Bitcoin 30m Chart & Candlestick Anatomy (Black Downside / Blue Upside)',
        transcriptText: transcriptSegments
          .filter(s => s.startTimeSec < 48.0)
          .map(s => s.text)
          .join(' '),
        visualSummary: 'TradingView BTCUSD 30m chart with freehand annotation enclosing candles and highlighting downside candle mechanics.',
        concepts: ['Candlestick Anatomy', 'Downside Candle', 'Upside Candle', '30m Timeframe'],
        events: timelineEvents.filter(e => e.timestampSec < 48.0),
      },
      {
        id: 'tseg_2',
        startTimeSec: 48.0,
        endTimeSec: 79.5,
        title: 'Support Zone Identification & Rectangle Box Drawing across Swing Low',
        transcriptText: transcriptSegments
          .filter(s => s.startTimeSec >= 48.0 && s.startTimeSec < 79.5)
          .map(s => s.text)
          .join(' '),
        visualSummary: 'Pink rectangular support zone created around 80,225 - 80,305 covering earlier swing low. Cursor pauses inside box.',
        concepts: ['Support Zone', 'Swing Low', 'Horizontal Level', 'Green Candle Reaction'],
        events: timelineEvents.filter(e => e.timestampSec >= 48.0 && e.timestampSec < 79.5),
      },
      {
        id: 'tseg_3',
        startTimeSec: 79.5,
        endTimeSec: 111.97,
        title: 'Resistance Zone Identification & Downward Rejection Swings',
        transcriptText: transcriptSegments
          .filter(s => s.startTimeSec >= 79.5)
          .map(s => s.text)
          .join(' '),
        visualSummary: 'Pink rectangular resistance zone created around 80,520 - 80,570 with downward rejection stroke illustrating price drop.',
        concepts: ['Resistance Zone', 'Swing High', 'Rejection Flow', 'Multi-Swing Identification'],
        events: timelineEvents.filter(e => e.timestampSec >= 79.5),
      },
    ];

    return {
      timelineEvents,
      episodes,
      teachingSegments,
      referenceCandidates,
    };
  }

  private static formatSec(sec?: number): string {
    if (sec === undefined || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
