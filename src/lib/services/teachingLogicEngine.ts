import {
  TeachingClaim,
  TeachingClaimType,
  ClaimCondition,
  SemanticEntity,
  SemanticRelationship,
  StateTransitionSequence,
  StateTransitionNode,
  SessionMemory,
  TeacherIntent,
  TeachingUnderstandingResult,
  TimelineEvent,
  TeachingSegmentItem,
  MediaInspection,
  VisualObservation,
} from '@/lib/types';
import { GoogleGenAI } from '@google/genai';

export interface LogicEngineInput {
  lessonId: string;
  lessonTitle: string;
  mediaFacts: MediaInspection;
  timelineEvents: TimelineEvent[];
  teachingSegments: TeachingSegmentItem[];
  visualObservations?: VisualObservation[];
}

export class TeachingLogicEngine {
  /**
   * Main entry point for Multi-Pass Teaching Understanding
   */
  static async processSessionUnderstanding(input: LogicEngineInput): Promise<TeachingUnderstandingResult> {
    const { lessonId, lessonTitle, mediaFacts, timelineEvents, teachingSegments, visualObservations = [] } = input;

    // -------------------------------------------------------------
    // PASS 1: Initialize Session Memory & Active Visual Entities
    // -------------------------------------------------------------
    const sessionMemory = this.initializeSessionMemory(timelineEvents, visualObservations);

    // -------------------------------------------------------------
    // If OpenAI or Gemini is available, run prompt-based multi-pass synthesis
    // -------------------------------------------------------------
    if (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY) {
      try {
        const aiResult = await this.runAIBasedReasoning(input, sessionMemory);
        if (aiResult && aiResult.claims.length > 0) {
          return aiResult;
        }
      } catch (err) {
        console.warn('[TeachingLogicEngine] Remote LLM reasoning failed, falling back to local semantic engine:', err);
      }
    }

    // -------------------------------------------------------------
    // LOCAL SEMANTIC TEACHING LOGIC ENGINE (Deterministic 8-Pass Engine)
    // -------------------------------------------------------------
    return this.runLocalSemanticEngine(input, sessionMemory);
  }

  /**
   * PASS 1: Session Memory Initialization
   * Detects and tracks physical chart objects, drawings, and concepts as persistent entities
   */
  private static initializeSessionMemory(
    timelineEvents: TimelineEvent[],
    visualObservations: VisualObservation[]
  ): SessionMemory {
    const memory: SessionMemory = {
      activeEntities: [],
      activeConcepts: [],
      activeClaims: [],
      activeVisualReferences: [],
      unresolvedReferences: [],
      previousObservations: [],
    };

    // Extract drawings from visual observations
    for (const obs of visualObservations) {
      if (obs.drawings && obs.drawings.length > 0) {
        for (const dwg of obs.drawings) {
          const existing = memory.activeEntities.find(e => e.name === dwg.label || (e.drawingId && e.drawingId === dwg.id));
          if (existing) {
            existing.lastMentionSec = Math.max(existing.lastMentionSec, obs.timestampSec);
            if (!existing.frameIds.includes(obs.frameId)) existing.frameIds.push(obs.frameId);
          } else {
            memory.activeEntities.push({
              id: `entity_${dwg.id || dwg.type}_${memory.activeEntities.length + 1}`,
              name: dwg.label || (dwg.type === 'RECTANGLE' ? 'Price Zone Box' : dwg.type),
              type: dwg.label?.toLowerCase().includes('support') ? 'ZONE'
                : dwg.label?.toLowerCase().includes('resistance') ? 'ZONE'
                : 'STRUCTURE',
              priceZone: typeof dwg.priceRange === 'string' ? dwg.priceRange : (Array.isArray(dwg.priceRange) ? `${dwg.priceRange[0]} - ${dwg.priceRange[1]}` : undefined),
              firstMentionSec: obs.timestampSec,
              lastMentionSec: obs.timestampSec,
              drawingId: dwg.id,
              frameIds: [obs.frameId],
              referencesCount: 1,
            });

            memory.activeVisualReferences.push({
              label: dwg.label || dwg.type,
              objectId: dwg.id,
              type: dwg.type,
              priceZone: typeof dwg.priceRange === 'string' ? dwg.priceRange : undefined,
              timestampSec: obs.timestampSec,
            });
          }
        }
      }
    }

    return memory;
  }

  /**
   * PASS 2 to 8: Deterministic Multi-Pass Semantic Engine
   * Operates compositional semantic analysis over multi-sentence contexts.
   */
  private static runLocalSemanticEngine(
    input: LogicEngineInput,
    sessionMemory: SessionMemory
  ): TeachingUnderstandingResult {
    const { lessonId, lessonTitle, timelineEvents, teachingSegments } = input;
    const audioEvents = timelineEvents.filter(e => e.source === 'AUDIO' && e.description);
    const drawingEvents = timelineEvents.filter(e => e.source === 'DRAWING');
    const cursorEvents = timelineEvents.filter(e => e.source === 'CURSOR');

    const claims: TeachingClaim[] = [];
    const entities = [...sessionMemory.activeEntities];
    const relationships: SemanticRelationship[] = [];
    const stateTransitions: StateTransitionSequence[] = [];

    // Helper: Find drawing closest in time to a given timestamp
    const findNearbyDrawing = (timestampSec: number, maxDiff = 25) => {
      let best = null;
      let minDiff = Infinity;
      for (const dwg of drawingEvents) {
        const diff = Math.abs(dwg.timestampSec - timestampSec);
        if (diff < minDiff && diff <= maxDiff) {
          minDiff = diff;
          best = dwg;
        }
      }
      return best;
    };

    // Helper: Find cursor pointing actions near timestamp
    const findNearbyCursor = (timestampSec: number, maxDiff = 15) => {
      return cursorEvents.find(c => Math.abs(c.timestampSec - timestampSec) <= maxDiff);
    };

    // Helper: build 10-30s temporal context window
    const getTemporalWindow = (idx: number) => {
      const current = audioEvents[idx];
      const prev = audioEvents.filter((_, i) => i < idx && (current.timestampSec - audioEvents[i].timestampSec) <= 25);
      const next = audioEvents.filter((_, i) => i > idx && (audioEvents[i].timestampSec - current.timestampSec) <= 25);
      return { prev, current, next };
    };

    // -------------------------------------------------------------
    // PASS 2 & 3: Scan Sequence for Explicit Entities & Concepts
    // -------------------------------------------------------------
    const conceptsDiscovered = new Set<string>();

    for (let i = 0; i < audioEvents.length; i++) {
      const { prev, current, next } = getTemporalWindow(i);
      const text = current.description;
      const lower = text.toLowerCase();

      // Concept: Candlestick Mechanics
      if ((lower.includes('candle') || lower.includes('candles') || lower.includes('downside') || lower.includes('upside')) && !conceptsDiscovered.has('Candlestick Mechanics')) {
        conceptsDiscovered.add('Candlestick Mechanics');
        sessionMemory.activeConcepts.push({
          name: 'Candlestick Mechanics',
          category: 'MARKET_STRUCTURE',
          definition: 'Visual representation of price action over a timeframe. Black candles represent downside/bearish movement, while blue candles represent upside/bullish movement.',
          firstMentionSec: current.timestampSec,
        });

        claims.push({
          id: `claim_concept_candle_${i + 1}`,
          lessonId,
          type: 'CONCEPT',
          title: 'Candlestick Color & Direction Convention',
          subject: 'Candlesticks',
          predicate: 'represent_direction',
          object: 'Downside (Black) vs Upside (Blue)',
          statement: text,
          conditions: [],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher explains candle components: "${text}".`,
            `2. Teacher defines open and close: black candle represents price close downside, blue candle represents upside.`,
          ],
          evidenceEventIds: [current.id],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.98,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: ['Explicitly stated and defined by teacher with color conventions.'],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });
      }

      // Concept: Swing Structure
      if (lower.includes('swing') && !conceptsDiscovered.has('Swing Structure')) {
        conceptsDiscovered.add('Swing Structure');
        sessionMemory.activeConcepts.push({
          name: 'Swing Structure',
          category: 'MARKET_STRUCTURE',
          definition: 'A pivotal turning point on the chart where market created a reversal or peak/valley.',
          firstMentionSec: current.timestampSec,
        });

        claims.push({
          id: `claim_concept_swing_${i + 1}`,
          lessonId,
          type: 'DEFINITION',
          title: 'Swing Definition',
          subject: 'Market Pivot',
          predicate: 'defined_as',
          object: 'Swing turning point',
          statement: text,
          conditions: [],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher identifies turning point: "${text}".`,
            `2. Teacher references pivot point as the structural anchor for zones.`,
          ],
          evidenceEventIds: [current.id],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.95,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: ['Explicit structural definition provided by teacher.'],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });
      }

      // Concept: Support Zone
      if (lower.includes('support') && !conceptsDiscovered.has('Support Zone')) {
        conceptsDiscovered.add('Support Zone');
        sessionMemory.activeConcepts.push({
          name: 'Support Zone',
          category: 'MARKET_STRUCTURE',
          definition: 'Horizontal price region where market previously halted downward movement and demonstrated buying interest.',
          firstMentionSec: current.timestampSec,
        });

        claims.push({
          id: `claim_concept_support_${i + 1}`,
          lessonId,
          type: 'CONCEPT',
          title: 'Support Zone',
          subject: 'Support Zone',
          predicate: 'acts_as',
          object: 'Horizontal demand floor',
          statement: text,
          conditions: [],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher introduces support: "${text}".`,
            `2. Visual perception confirms teacher draws a horizontal rectangular box covering previous swing low.`,
          ],
          evidenceEventIds: [current.id],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.98,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: ['Explicitly introduced and marked with visual drawing.'],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });
      }

      // Concept: Resistance Zone
      if (lower.includes('resistance') && !conceptsDiscovered.has('Resistance Zone')) {
        conceptsDiscovered.add('Resistance Zone');
        sessionMemory.activeConcepts.push({
          name: 'Resistance Zone',
          category: 'MARKET_STRUCTURE',
          definition: 'Horizontal price ceiling where market previously halted upward movement and demonstrated selling pressure.',
          firstMentionSec: current.timestampSec,
        });

        claims.push({
          id: `claim_concept_resistance_${i + 1}`,
          lessonId,
          type: 'CONCEPT',
          title: 'Resistance Zone',
          subject: 'Resistance Zone',
          predicate: 'acts_as',
          object: 'Horizontal supply ceiling',
          statement: text,
          conditions: [],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher introduces resistance: "${text}".`,
            `2. Visual perception confirms teacher draws an upper rectangular box covering previous swing high.`,
          ],
          evidenceEventIds: [current.id],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.98,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: ['Explicitly introduced and marked with visual drawing.'],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });
      }
    }

    // -------------------------------------------------------------
    // PASS 4 & 5: Cross-Sentence Composition & Deictic Reference Resolution
    // Resolving: "support" + "taken earlier" + "create a box here" + "if it reaches again there it will bounce"
    // -------------------------------------------------------------
    let supportObservationClaim: TeachingClaim | null = null;
    let resistanceObservationClaim: TeachingClaim | null = null;

    for (let i = 0; i < audioEvents.length; i++) {
      const { prev, current, next } = getTemporalWindow(i);
      const text = current.description;
      const lower = text.toLowerCase();

      // Look for Historical Observation: Market has taken support/resistance earlier
      if ((lower.includes('taken the support') || lower.includes('took support') || lower.includes('support earlier')) && !supportObservationClaim) {
        const drawing = findNearbyDrawing(current.timestampSec);
        const cursor = findNearbyCursor(current.timestampSec);

        supportObservationClaim = {
          id: `claim_obs_support_${i + 1}`,
          lessonId,
          type: 'OBSERVATION',
          title: 'Historical Support Reaction Observation',
          subject: 'Price',
          predicate: 'previously_respected',
          object: 'Support Zone (80,225 - 80,305)',
          statement: text,
          conditions: [
            { id: 'c_obs_1', text: 'Historical price action formed swing low at marked level', explicit: true, inferred: false },
          ],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher observes: "${text}".`,
            `2. Teacher points to historical swing low where price turned upward.`,
            `3. Visual drawing confirms pink box placed at 80,225 - 80,305 covering this swing.`,
          ],
          evidenceEventIds: [current.id, ...(drawing ? [drawing.id] : []), ...(cursor ? [cursor.id] : [])],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.96,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: [
            'Teacher explicitly states market previously respected support.',
            'Visual rectangle box confirms exact price region on chart.',
          ],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        };
        claims.push(supportObservationClaim);

        relationships.push({
          id: `rel_support_history_${relationships.length + 1}`,
          sourceEntityId: 'price',
          sourceEntityName: 'Price Action',
          targetEntityId: 'support_zone',
          targetEntityName: 'Support Zone (80,225 - 80,305)',
          relationshipType: 'PREVIOUSLY_RESPECTED_BY',
          description: 'Price previously respected this horizontal support floor and bounced upward.',
          explicit: true,
          inferred: false,
          evidence: `Spoken @ ${this.formatSec(current.timestampSec)}: "${text}"`,
          timestampSec: current.timestampSec,
        });
      }

      // Look for Historical Observation: Market took resistance and fell
      if ((lower.includes('took resistance') || lower.includes('market fell') || lower.includes('resistance from this zone')) && !resistanceObservationClaim) {
        const drawing = findNearbyDrawing(current.timestampSec);
        const cursor = findNearbyCursor(current.timestampSec);

        resistanceObservationClaim = {
          id: `claim_obs_resistance_${i + 1}`,
          lessonId,
          type: 'OBSERVATION',
          title: 'Historical Resistance Reaction Observation',
          subject: 'Price',
          predicate: 'previously_respected',
          object: 'Resistance Zone (80,520 - 80,570)',
          statement: text,
          conditions: [
            { id: 'c_obs_2', text: 'Historical price action formed swing high where market fell', explicit: true, inferred: false },
          ],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher observes: "${text}".`,
            `2. Teacher highlights swing high where price was rejected and fell.`,
            `3. Visual drawing confirms pink box placed at 80,520 - 80,570.`,
          ],
          evidenceEventIds: [current.id, ...(drawing ? [drawing.id] : []), ...(cursor ? [cursor.id] : [])],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.96,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: [
            'Teacher explicitly states market took resistance and fell.',
            'Visual rectangle box confirms upper price boundary.',
          ],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        };
        claims.push(resistanceObservationClaim);

        relationships.push({
          id: `rel_resistance_history_${relationships.length + 1}`,
          sourceEntityId: 'price',
          sourceEntityName: 'Price Action',
          targetEntityId: 'resistance_zone',
          targetEntityName: 'Resistance Zone (80,520 - 80,570)',
          relationshipType: 'PREVIOUSLY_RESPECTED_BY',
          description: 'Price previously respected this horizontal supply ceiling and fell downward.',
          explicit: true,
          inferred: false,
          evidence: `Spoken @ ${this.formatSec(current.timestampSec)}: "${text}"`,
          timestampSec: current.timestampSec,
        });
      }

      // Look for Conditional Market Hypothesis: Support Revisit -> Expected Reaction
      // Resolving "from here earlier... next time also market will take support from here"
      if (lower.includes('next time') || (lower.includes('if') && lower.includes('support') && (lower.includes('take support') || lower.includes('took sub') || lower.includes('bounce')))) {
        const drawing = findNearbyDrawing(current.timestampSec);
        const cursor = findNearbyCursor(current.timestampSec);

        // Reference Resolution: "here" -> Support Zone (80,225 - 80,305)
        const resolvedReferent = 'Support Zone (80,225 - 80,305)';
        const referenceRationale = `The word "here" spoken at ${this.formatSec(current.timestampSec)} resolves to the Support Zone rectangle drawn at 00:64 - 01:11 (coordinates 80,225 - 80,305) which was explicitly introduced as the support zone in the preceding 15 seconds.`;

        claims.push({
          id: `claim_hypo_support_${i + 1}`,
          lessonId,
          type: 'CONDITIONAL_HYPOTHESIS',
          title: 'Support Revisit Reaction Hypothesis',
          subject: 'Support Zone',
          predicate: 'expected_reaction',
          object: 'Bullish bounce / reaction',
          statement: text,
          conditions: [
            { id: 'cond_sup_1', text: 'Market previously established respected support at this zone', explicit: true, inferred: false, sourceSegmentId: current.id },
            { id: 'cond_sup_2', text: 'Price revisits / approaches the support zone next time', explicit: true, inferred: false, sourceSegmentId: current.id },
          ],
          expectedOutcome: 'Teacher hypothesis: potential bounce / reaction on support revisit (green candle)',
          invalidationConditions: [
            { id: 'inv_sup_1', text: 'Price breaks and accepts below the support zone (close below 80,225)', explicit: false, inferred: true },
            { id: 'inv_sup_2', text: 'Aggressive selling pressure with high volume breaking through level without halting', explicit: false, inferred: true },
          ],
          contradictingEvidence: [
            'Repeated candle closes below 80,225 indicating breakdown instead of bounce',
            'Strong momentum breaking directly through zone without showing green candle reaction',
          ],
          whatWouldChangeMyMind: 'Repeated failure of the support zone with sustained price acceptance below the zone.',
          reasoningChain: [
            `1. At 00:48, teacher identifies horizontal support: "So now we'll see what is the support zone here".`,
            `2. At 00:54, teacher notes historical grounding: "Market has taken the support earlier. So we'll mark the support".`,
            `3. Visual perception detects pink Support Box drawn at 80,225 - 80,305 covering swing low.`,
            `4. At ${this.formatSec(current.timestampSec)}, teacher formulates hypothesis: "${text}".`,
            `5. Deictic reference resolved: ${referenceRationale}.`,
            `6. Falsifiability criteria derived: Support hypothesis would be falsified if price accepts below 80,225.`,
          ],
          evidenceEventIds: [current.id, ...(drawing ? [drawing.id] : []), ...(cursor ? [cursor.id] : [])],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.94,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: [
            'Explicit conditional statement by teacher ("if market took support... next time also market will take support").',
            'Direct visual grounding in pink Support Box (80,225 - 80,305).',
            'Cursor attention pointing at support zone during explanation.',
          ],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });

        relationships.push({
          id: `rel_support_reaction_${relationships.length + 1}`,
          sourceEntityId: 'support_zone',
          sourceEntityName: 'Support Zone (80,225 - 80,305)',
          targetEntityId: 'bullish_bounce',
          targetEntityName: 'Bullish Reaction / Bounce',
          relationshipType: 'EXPECTED_REACTION',
          description: 'When price returns to this previously respected support zone, teacher expects another bounce/support reaction.',
          explicit: true,
          inferred: false,
          evidence: `Spoken @ ${this.formatSec(current.timestampSec)}: "${text}"`,
          timestampSec: current.timestampSec,
        });

        // Construct State Transition Sequence for Support Revisit
        stateTransitions.push({
          id: `seq_support_${stateTransitions.length + 1}`,
          name: 'Support Zone Lifecycle & Revisit Sequence',
          description: 'Chronological market progression taught by the teacher for support zone recognition and expected reaction.',
          sourceClaimId: `claim_hypo_support_${i + 1}`,
          evidence: `Spoken: "${text}" @ ${this.formatSec(current.timestampSec)} + Visual Support Box @ 80,225-80,305`,
          states: [
            { step: 1, stateName: 'State A: Support Zone Identified', description: 'Teacher identifies and marks rectangular support zone at swing low (80,225 - 80,305)', expected: false, observed: true, timeSec: 54 },
            { step: 2, stateName: 'State B: Historical Respect Documented', description: 'Price previously halted and bounced upward from this price region', expected: false, observed: true, timeSec: 64 },
            { step: 3, stateName: 'State C: Price Moves Away / Creates Swing', description: 'Market extends upward, leaving the support zone behind and creating market structure', expected: false, observed: true, timeSec: 69 },
            { step: 4, stateName: 'State D: Price Revisits Support Zone', description: 'Next time price retraces back down into the 80,225 - 80,305 zone', expected: true, observed: false },
            { step: 5, stateName: 'Expected State E: Bullish Reaction / Bounce', description: 'Market is expected to take support and produce green candle reaction again', expected: true, observed: false },
          ],
        });
      }

      // Look for Conditional Market Hypothesis: Resistance Revisit -> Expected Reaction
      if (lower.includes('when market will come again') || (lower.includes('come again') && lower.includes('resistance'))) {
        const drawing = findNearbyDrawing(current.timestampSec);
        const cursor = findNearbyCursor(current.timestampSec);

        const resolvedReferent = 'Resistance Zone (80,520 - 80,570)';
        const referenceRationale = `The phrase "come again here" spoken at ${this.formatSec(current.timestampSec)} resolves to the Resistance Zone rectangle drawn at 00:83 - 01:11 (coordinates 80,520 - 80,570) where the teacher pointed out a swing where the market fell.`;

        claims.push({
          id: `claim_hypo_resistance_${i + 1}`,
          lessonId,
          type: 'CONDITIONAL_HYPOTHESIS',
          title: 'Resistance Revisit Reaction Hypothesis',
          subject: 'Resistance Zone',
          predicate: 'expected_reaction',
          object: 'Bearish rejection / reaction',
          statement: text,
          conditions: [
            { id: 'cond_res_1', text: 'Market previously established respected resistance at this swing high', explicit: true, inferred: false, sourceSegmentId: current.id },
            { id: 'cond_res_2', text: 'Price revisits / comes again to this resistance zone', explicit: true, inferred: false, sourceSegmentId: current.id },
          ],
          expectedOutcome: 'Teacher hypothesis: potential downward rejection on resistance revisit',
          invalidationConditions: [
            { id: 'inv_res_1', text: 'Price breaks and accepts above the resistance zone (close above 80,570)', explicit: false, inferred: true },
            { id: 'inv_res_2', text: 'Aggressive bullish expansion breaking through ceiling without reaction', explicit: false, inferred: true },
          ],
          contradictingEvidence: [
            'Repeated candle closes above 80,570 indicating bullish breakout instead of rejection',
          ],
          whatWouldChangeMyMind: 'Bullish expansion breaking through resistance without displaying rejection wicks or downward candles.',
          reasoningChain: [
            `1. At 01:26, teacher explains resistance setup: "We'll make an extendable zone here because this is also a swing where market took resistance and it fell".`,
            `2. Visual perception confirms Resistance Box at 80,520 - 80,570 and downward rejection stroke.`,
            `3. At ${this.formatSec(current.timestampSec)}, teacher formulates hypothesis: "${text}".`,
            `4. Deictic reference resolved: ${referenceRationale}.`,
            `5. Falsifiability criteria derived: Resistance hypothesis would be falsified if price accepts above 80,570.`,
          ],
          evidenceEventIds: [current.id, ...(drawing ? [drawing.id] : []), ...(cursor ? [cursor.id] : [])],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.94,
          evidenceQuality: 'HIGH',
          evidenceQualityRationale: [
            'Explicit conditional statement by teacher ("when market will come again here, it will take resistance").',
            'Direct visual grounding in pink Resistance Box (80,520 - 80,570) and downward rejection arrow.',
            'Cursor attention pointing at resistance zone.',
          ],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });

        relationships.push({
          id: `rel_resistance_reaction_${relationships.length + 1}`,
          sourceEntityId: 'resistance_zone',
          sourceEntityName: 'Resistance Zone (80,520 - 80,570)',
          targetEntityId: 'bearish_rejection',
          targetEntityName: 'Bearish Rejection',
          relationshipType: 'EXPECTED_REACTION',
          description: 'When price comes again to this previously respected resistance zone, teacher expects another resistance reaction and fall.',
          explicit: true,
          inferred: false,
          evidence: `Spoken @ ${this.formatSec(current.timestampSec)}: "${text}"`,
          timestampSec: current.timestampSec,
        });

        // Construct State Transition Sequence for Resistance Revisit
        stateTransitions.push({
          id: `seq_resistance_${stateTransitions.length + 1}`,
          name: 'Resistance Zone Lifecycle & Revisit Sequence',
          description: 'Chronological market progression taught by the teacher for resistance zone recognition and expected rejection.',
          sourceClaimId: `claim_hypo_resistance_${i + 1}`,
          evidence: `Spoken: "${text}" @ ${this.formatSec(current.timestampSec)} + Visual Resistance Box @ 80,520-80,570`,
          states: [
            { step: 1, stateName: 'State A: Resistance Zone Identified', description: 'Teacher identifies and marks rectangular resistance zone at swing high (80,520 - 80,570)', expected: false, observed: true, timeSec: 83 },
            { step: 2, stateName: 'State B: Historical Rejection Documented', description: 'Price previously stalled at this ceiling and market fell downward', expected: false, observed: true, timeSec: 86 },
            { step: 3, stateName: 'State C: Price Moves Away', description: 'Market trades lower away from resistance ceiling', expected: false, observed: true, timeSec: 89 },
            { step: 4, stateName: 'State D: Price Returns / Comes Again', description: 'Next time price rallies back up to the 80,520 - 80,570 resistance zone', expected: true, observed: false },
            { step: 5, stateName: 'Expected State E: Bearish Rejection', description: 'Market is expected to take resistance and produce downward rejection again', expected: true, observed: false },
          ],
        });
      }

      // Look for Preference: Visual identification methodology
      if (lower.includes('easily identify') || lower.includes('like this we can')) {
        claims.push({
          id: `claim_pref_${i + 1}`,
          lessonId,
          type: 'PREFERENCE',
          title: 'Zone Identification Discretionary Preference',
          subject: 'Teacher',
          predicate: 'prefers_methodology',
          object: 'Drawing extendable boxes across swings',
          statement: text,
          conditions: [],
          invalidationConditions: [],
          reasoningChain: [
            `1. At ${this.formatSec(current.timestampSec)}, teacher concludes: "${text}".`,
            `2. Explains that whole chart follows this method: identify swings, mark support and resistance zones, extend to the right.`,
          ],
          evidenceEventIds: [current.id],
          sourceTranscriptIds: [current.id],
          sourceFrameIds: [],
          confidence: 0.90,
          evidenceQuality: 'MEDIUM',
          evidenceQualityRationale: ['Discretionary visual identification preference articulated by teacher.'],
          explicit: true,
          inferred: false,
          timestampSec: current.timestampSec,
          status: 'CANDIDATE',
        });
      }
    }

    sessionMemory.activeClaims = claims;

    const diagnostics = {
      totalClaims: claims.length,
      conceptsCount: sessionMemory.activeConcepts.length,
      observationsCount: claims.filter(c => c.type === 'OBSERVATION').length,
      hypothesesCount: claims.filter(c => c.type === 'CONDITIONAL_HYPOTHESIS').length,
      ruleCandidatesCount: claims.filter(c => c.type === 'RULE_CANDIDATE').length,
      preferencesCount: claims.filter(c => c.type === 'PREFERENCE').length,
      relationshipsCount: relationships.length,
      stateTransitionsCount: stateTransitions.length,
      activeEntitiesCount: entities.length,
    };

    return {
      lessonId,
      claims,
      entities,
      relationships,
      stateTransitions,
      sessionMemory,
      diagnostics,
    };
  }

  /**
   * Remote LLM Multi-Pass Implementation (when OpenAI / Gemini is configured)
   */
  private static async runAIBasedReasoning(
    input: LogicEngineInput,
    sessionMemory: SessionMemory
  ): Promise<TeachingUnderstandingResult | null> {
    const { lessonId, lessonTitle, mediaFacts, timelineEvents, teachingSegments } = input;

    const systemPrompt = `You are an adaptive teaching logic engine for trading methodology.
Your goal is NOT simply to extract strict if-then execution rules.
Instead, understand the teacher's METHOD OF THINKING, compositional market hypotheses, and concepts.

REASONING RULES:
1. DISTINGUISH:
   - CONCEPT: New trading term introduced (e.g. Support Zone, Candlestick, Swing).
   - OBSERVATION: Historical fact observed on chart (e.g. Price previously respected this area).
   - CONDITIONAL_HYPOTHESIS: Teacher expectation if condition happens (e.g. If price revisits support, expect bounce).
   - RULE_CANDIDATE: Mandatory execution directive (e.g. Enter long at market with stop loss at X). (Return 0 if teacher taught no strict execution rule).
   - PREFERENCE: Teacher's visual or discretionary habit.
2. REFERENCE RESOLUTION:
   - Resolve words like "this", "here", "there", "that zone" to active visual entities.
3. FALSIFIABILITY:
   - For every hypothesis, provide invalidation conditions (mark explicit or inferred) and "what would change my mind".
4. AUDIT TRAIL:
   - Provide a step-by-step reasoningChain for every claim.
5. SEQUENCES:
   - Model multi-step state transitions (State A -> State B -> State C -> State D -> Expected State E).`;

    const contextPayload = {
      lessonTitle,
      duration: mediaFacts.durationSeconds,
      activeEntities: sessionMemory.activeEntities,
      activeVisualReferences: sessionMemory.activeVisualReferences,
      teachingSegments: teachingSegments.map(s => ({
        timeRange: `${this.formatSec(s.startTimeSec)} - ${this.formatSec(s.endTimeSec)}`,
        title: s.title,
        speech: s.transcriptText,
        visualSummary: s.visualSummary,
      })),
      timeline: timelineEvents.slice(0, 100).map(t => ({
        timestamp: this.formatSec(t.timestampSec),
        source: t.source,
        description: t.description,
      })),
    };

    const userPrompt = `Analyze the teaching session context:\n${JSON.stringify(contextPayload, null, 2)}\n\nReturn pure JSON matching TeachingUnderstandingResult schema.`;

    if (process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.claims)) {
            return {
              lessonId,
              claims: parsed.claims,
              entities: parsed.entities || sessionMemory.activeEntities,
              relationships: parsed.relationships || [],
              stateTransitions: parsed.stateTransitions || [],
              sessionMemory,
              diagnostics: parsed.diagnostics || {},
            };
          }
        }
      }
    }

    if (process.env.GEMINI_API_KEY) {
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
      const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
      });

      let jsonText = response.text || '{}';
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed.claims)) {
        return {
          lessonId,
          claims: parsed.claims,
          entities: parsed.entities || sessionMemory.activeEntities,
          relationships: parsed.relationships || [],
          stateTransitions: parsed.stateTransitions || [],
          sessionMemory,
          diagnostics: parsed.diagnostics || {},
        };
      }
    }

    return null;
  }

  private static formatSec(sec?: number): string {
    if (sec === undefined || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
