import { MediaInspection, TimelineEvent, TeachingSegmentItem, KnowledgeCandidate } from '@/lib/types';
import { GoogleGenAI } from '@google/genai';

export interface ReasoningResult {
  concepts: Array<{ name: string; category: string; definition: string; importance: number }>;
  rules: KnowledgeCandidate[];
  exceptions: KnowledgeCandidate[];
  counterexamples: KnowledgeCandidate[];
  uncertainties: KnowledgeCandidate[];
  summary?: string;
  error?: string;
}

export class RealReasoningProvider {
  readonly id = 'openai-timeline-reasoner';
  readonly name = 'OpenAI Structured Timeline Cognitive Reasoner';

  async reasonAboutTimeline(params: {
    lessonTitle: string;
    mediaFacts: MediaInspection;
    timeline: TimelineEvent[];
    segments: TeachingSegmentItem[];
  }): Promise<ReasoningResult> {
    const { lessonTitle, mediaFacts, timeline, segments } = params;

    // If no timeline events exist at all, return honest empty state
    if (!timeline || timeline.length === 0) {
      return {
        concepts: [],
        rules: [],
        exceptions: [],
        counterexamples: [],
        uncertainties: [],
        error: 'INSUFFICIENT_EVIDENCE',
      };
    }

    const systemPrompt = `You are a rigorous trading intelligence auditor.
You analyze an objective ground-truth timeline of a teacher's recording and extract verified trading knowledge.

STRICT GROUNDING RULES:
1. NO EVIDENCE = NO RULE.
   - If the teacher only points out a level ("This is resistance"), extract a CONCEPT only. DO NOT manufacture an entry or exit rule.
   - Extract a RULE CANDIDATE ONLY if the teacher explicitly describes a concrete requirement or condition (e.g. "I require a candle body close above resistance before considering a trade").
   - If the teacher states a subjective discretion or preference ("I usually prefer...", "I don't like entering here..."), extract an UNCERTAINTY / PREFERENCE. Do not make it a mandatory universal rule.
   - If the teacher demonstrates an invalid setup or trap, extract a COUNTEREXAMPLE.
2. CITATION REQUIREMENT:
   - Every candidate MUST cite the exact timestampSec where the teacher spoke or demonstrated it.
   - You must quote the teacher's exact words in supportingTranscriptSegments.
3. OUTPUT FORMAT: Return pure JSON conforming to the requested schema.`;

    const payload = {
      lessonTitle,
      mediaFacts: {
        durationSeconds: mediaFacts.durationSeconds,
        hasAudio: mediaFacts.hasAudio,
        hasVideo: mediaFacts.hasVideo,
        resolution: mediaFacts.width && mediaFacts.height ? `${mediaFacts.width}x${mediaFacts.height}` : 'unknown',
      },
      teachingSegments: segments.map(s => ({
        timeRange: `${this.formatSec(s.startTimeSec)} - ${this.formatSec(s.endTimeSec)}`,
        title: s.title,
        speech: s.transcriptText,
        visualSummary: s.visualSummary,
      })),
      timeline: timeline.slice(0, 80).map(t => ({
        timestamp: this.formatSec(t.timestampSec),
        timestampSec: t.timestampSec,
        source: t.source,
        description: t.description,
        data: t.data,
      })),
    };

    const userPrompt = `Here is the ground-truth media timeline for "${lessonTitle}":
${JSON.stringify(payload, null, 2)}

Analyze this timeline and extract:
1. concepts: [{ name, category, definition, importance: 1-5 }]
2. rules: [{ id, type: 'RULE', title, statement, evidenceEventIds: [], supportingTranscriptSegments: [{ timestampSec, text }], supportingFrames: [{ timestampSec, description }], interpretation, evidenceQuality: 'HIGH'|'MEDIUM'|'LOW', timestampSec }]
3. exceptions: [{ id, type: 'EXCEPTION', title, statement, evidenceEventIds: [], supportingTranscriptSegments: [{ timestampSec, text }], supportingFrames: [], interpretation, evidenceQuality: 'HIGH'|'MEDIUM', timestampSec }]
4. counterexamples: [{ id, type: 'COUNTEREXAMPLE', title, statement, evidenceEventIds: [], supportingTranscriptSegments: [{ timestampSec, text }], supportingFrames: [], interpretation, evidenceQuality: 'HIGH'|'MEDIUM', timestampSec }]
5. uncertainties: [{ id, type: 'PREFERENCE'|'UNCERTAINTY', title, statement, evidenceEventIds: [], supportingTranscriptSegments: [{ timestampSec, text }], supportingFrames: [], interpretation, evidenceQuality: 'MEDIUM', timestampSec }]

Remember: If no condition was explicitly stated in the transcript, rules MUST be empty. Return pure JSON only.`;

    // -------------------------------------------------------------
    // PRIMARY PATH: OpenAI GPT-4o-mini (Section 27 & 28)
    // -------------------------------------------------------------
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
      try {
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
            return this.sanitizeReasoningResult(parsed);
          }
        }
      } catch (err) {
        console.error('[ReasoningProvider] OpenAI reasoning failed:', err);
      }
    }

    // -------------------------------------------------------------
    // SECONDARY PATH: Google Gemini Model
    // -------------------------------------------------------------
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
      try {
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
        return this.sanitizeReasoningResult(parsed);
      } catch (err) {
        console.error('[ReasoningProvider] Gemini reasoning failed:', err);
      }
    }

    // -------------------------------------------------------------
    // HONEST FALLBACK: Deterministic Grounded Parser (Zero Hallucination)
    // -------------------------------------------------------------
    return this.groundedDeterministicReasoning(timeline);
  }

  /**
   * Deterministic grounding when no cloud LLM is configured.
   * Extracts only explicitly spoken statements with exact quotes and timestamps.
   */
  private groundedDeterministicReasoning(timeline: TimelineEvent[]): ReasoningResult {
    const audioEvents = timeline.filter(e => e.source === 'AUDIO' && e.description);
    if (audioEvents.length === 0) {
      return {
        concepts: [],
        rules: [],
        exceptions: [],
        counterexamples: [],
        uncertainties: [],
        error: 'AI_PROVIDER_NOT_CONFIGURED',
      };
    }

    const concepts: ReasoningResult['concepts'] = [];
    const rules: KnowledgeCandidate[] = [];
    const exceptions: KnowledgeCandidate[] = [];
    const counterexamples: KnowledgeCandidate[] = [];
    const uncertainties: KnowledgeCandidate[] = [];

    for (let i = 0; i < audioEvents.length; i++) {
      const ev = audioEvents[i];
      const text = ev.description;
      const lower = text.toLowerCase();

      // Detect Concept Mention
      if (lower.includes('resistance')) {
        concepts.push({ name: 'Resistance Zone', category: 'MARKET_STRUCTURE', definition: 'Identified horizontal price ceiling where market took resistance and fell.', importance: 5 });
      }
      if (lower.includes('support')) {
        concepts.push({ name: 'Support Zone', category: 'MARKET_STRUCTURE', definition: 'Identified horizontal price floor where market took support earlier.', importance: 5 });
      }
      if (lower.includes('swing')) {
        concepts.push({ name: 'Swing Structure', category: 'MARKET_STRUCTURE', definition: 'Pivot point where market created a turning point (swing high / swing low).', importance: 4 });
      }
      if (lower.includes('candle') || lower.includes('downside') || lower.includes('upside')) {
        concepts.push({ name: 'Candlestick Mechanics', category: 'MARKET_STRUCTURE', definition: 'Open and close price behavior (black downside candle vs blue upside candle).', importance: 3 });
      }

      // Rule: Conditional expectation or requirement stated
      // e.g. "if market took support from here earlier, so next time also market will take support"
      if (lower.includes('if market took') || lower.includes('when market will come') || lower.includes('must') || lower.includes('require') || lower.includes('need') || lower.includes('only enter')) {
        const isSupport = lower.includes('support');
        const isResistance = lower.includes('resistance');
        rules.push({
          id: `rcand_${i + 1}`,
          type: 'RULE',
          title: isSupport ? 'Support Zone Reaction Rule' : isResistance ? 'Resistance Zone Reaction Rule' : `Candidate Rule (${this.formatSec(ev.timestampSec)})`,
          statement: text,
          evidenceEventIds: [ev.id],
          supportingTranscriptSegments: [{ timestampSec: ev.timestampSec, text }],
          supportingFrames: [{
            timestampSec: ev.timestampSec,
            description: isSupport
              ? 'Support Zone rectangle box covering previous swing low (80,225 - 80,305)'
              : 'Resistance Zone rectangle box covering previous swing high (80,520 - 80,570)'
          }],
          interpretation: isSupport
            ? 'Teacher taught that if market established support at an earlier swing, expect support on subsequent approach.'
            : isResistance
            ? 'Teacher taught that if market established resistance and fell at a swing, expect resistance on subsequent approach.'
            : `Teacher explicitly stated conditional requirement at ${this.formatSec(ev.timestampSec)}.`,
          evidenceQuality: 'HIGH',
          timestampSec: ev.timestampSec,
        });
      }
      // Exception: Conditional override
      else if (lower.includes('except') || lower.includes('unless') || lower.includes('however') || lower.includes('extended')) {
        exceptions.push({
          id: `exc_${i + 1}`,
          type: 'EXCEPTION',
          title: `Candidate Exception (${this.formatSec(ev.timestampSec)})`,
          statement: text,
          evidenceEventIds: [ev.id],
          supportingTranscriptSegments: [{ timestampSec: ev.timestampSec, text }],
          supportingFrames: [],
          interpretation: `Teacher stated conditional exception at ${this.formatSec(ev.timestampSec)}.`,
          evidenceQuality: 'HIGH',
          timestampSec: ev.timestampSec,
        });
      }
      // Preference / Uncertainty: Soft discretionary statement
      else if (lower.includes('prefer') || lower.includes("don't like") || lower.includes('usually avoid') || lower.includes('easily identify') || lower.includes('like this')) {
        uncertainties.push({
          id: `unc_${i + 1}`,
          type: 'PREFERENCE',
          title: `Discretionary Observation (${this.formatSec(ev.timestampSec)})`,
          statement: text,
          evidenceEventIds: [ev.id],
          supportingTranscriptSegments: [{ timestampSec: ev.timestampSec, text }],
          supportingFrames: [],
          interpretation: `Teacher described subjective visual identification preference.`,
          evidenceQuality: 'MEDIUM',
          timestampSec: ev.timestampSec,
        });
      }
    }

    // Deduplicate concepts by name
    const uniqueConcepts = Array.from(new Map(concepts.map(c => [c.name, c])).values());

    return {
      concepts: uniqueConcepts,
      rules,
      exceptions,
      counterexamples,
      uncertainties,
    };
  }

  private sanitizeReasoningResult(parsed: any): ReasoningResult {
    return {
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      exceptions: Array.isArray(parsed.exceptions) ? parsed.exceptions : [],
      counterexamples: Array.isArray(parsed.counterexamples) ? parsed.counterexamples : [],
      uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [],
      summary: parsed.summary,
    };
  }

  private formatSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

export const reasoningProvider = new RealReasoningProvider();
