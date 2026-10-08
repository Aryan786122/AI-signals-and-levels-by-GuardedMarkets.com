import {
  AIProvider,
  AnalysisParams,
  StructuredAIResponse,
  ExtractLessonParams,
  ExtractedLessonData,
  ConflictResolutionParams,
  ConflictResolutionSuggestion,
  ScenarioEvalParams,
  ScenarioEvaluationResult,
  ChatMessage,
  KnowledgeContext,
} from '@/lib/types';
import { StructuredAIResponseSchema, ExtractedLessonDataSchema } from '@/lib/schemas';
import { LocalAIProvider } from './local';

export class GeminiAIProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini (Multimodal Pro/Flash)';
  private apiKey: string;
  private modelName: string;
  private fallbackProvider: LocalAIProvider;

  constructor(apiKey?: string, modelName: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = modelName;
    this.fallbackProvider = new LocalAIProvider();
  }

  private hasKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async analyze(params: AnalysisParams): Promise<StructuredAIResponse> {
    if (!this.hasKey()) {
      return this.fallbackProvider.analyze(params);
    }

    try {
      const prompt = `You are a disciplined personal AI trading student and market analyst.
You must strictly follow the teacher's approved knowledge base rules.
DO NOT fabricate setups or rush to trade. Output ONLY valid JSON matching this schema:
{
  "market_state": string,
  "active_concepts": string[],
  "detected_scenarios": string[],
  "setup_status": "OBSERVATION" | "SETUP_FORMING" | "SETUP_CONFIRMED" | "TRADE_CANDIDATE" | "INVALID_SETUP" | "WAIT" | "NO_TRADE",
  "direction": "LONG" | "SHORT" | "NEUTRAL",
  "entry": number | null,
  "stop_loss": number | null,
  "take_profit": number[],
  "invalidation": string[],
  "supporting_rules": [{"rule_id": string, "title": string, "statement": string, "priority": string}],
  "conflicting_rules": [{"title": string, "reason": string}],
  "reasoning": string[],
  "missing_conditions": string[],
  "confidence": number | null
}

TEACHER'S RULES:
${params.context.rules.map(r => `- [${r.priority}] ${r.title}: ${r.statement}`).join('\n')}

TEACHER'S EXCEPTIONS:
${params.context.exceptions.map(e => `- Exception: ${e.description} (Override: ${e.overrideBehavior})`).join('\n')}

CURRENT SITUATION:
${params.promptOverride || 'Analyze the latest market situation based on the rules.'}
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (!response.ok) {
        console.warn(`Gemini API error ${response.status}. Using fallback local engine.`);
        return this.fallbackProvider.analyze(params);
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return this.fallbackProvider.analyze(params);

      const parsed = JSON.parse(rawText);
      return StructuredAIResponseSchema.parse(parsed) as StructuredAIResponse;
    } catch (err) {
      console.warn('Gemini analysis failed, reverting to local engine:', err);
      return this.fallbackProvider.analyze(params);
    }
  }

  async extractLesson(params: ExtractLessonParams): Promise<ExtractedLessonData> {
    if (!this.hasKey()) {
      return this.fallbackProvider.extractLesson(params);
    }

    try {
      const prompt = `You are an expert AI trading student analyzing a teaching lesson from your teacher.
Convert the following speech transcript into structured, hierarchical trading knowledge.
Distinguish carefully between base conditions and exceptions (e.g. "Take breakout IF body closes above resistance EXCEPT IF excessively extended").
Output ONLY JSON matching the ExtractedLessonData schema.

EXISTING RULES CONTEXT (check for refinements or exceptions):
${params.existingKnowledgeContext.rules.map(r => `- ${r.title}: ${r.statement}`).join('\n')}

LESSON TRANSCRIPT:
"${params.transcriptText}"
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (!response.ok) return this.fallbackProvider.extractLesson(params);
      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return this.fallbackProvider.extractLesson(params);

      const parsed = JSON.parse(rawText);
      return ExtractedLessonDataSchema.parse(parsed) as ExtractedLessonData;
    } catch (err) {
      console.warn('Gemini lesson extraction failed, reverting to local engine:', err);
      return this.fallbackProvider.extractLesson(params);
    }
  }

  async resolveConflict(params: ConflictResolutionParams): Promise<ConflictResolutionSuggestion> {
    return this.fallbackProvider.resolveConflict(params);
  }

  async evaluateScenario(params: ScenarioEvalParams): Promise<ScenarioEvaluationResult> {
    return this.fallbackProvider.evaluateScenario(params);
  }

  async chat(messages: ChatMessage[], context: KnowledgeContext): Promise<string> {
    if (!this.hasKey()) {
      return this.fallbackProvider.chat(messages, context);
    }

    try {
      const systemInstruction = `You are a personal trading AI student taught directly by the user.
You learn strictly from their rules, exceptions, and chart examples.
Do NOT give generic retail advice. Rely on their approved knowledge:
RULES: ${context.rules.map(r => r.title + ': ' + r.statement).join('; ')}
EXCEPTIONS: ${context.exceptions.map(e => e.description).join('; ')}`;

      const formattedContents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: formattedContents,
          }),
        }
      );

      if (!response.ok) return this.fallbackProvider.chat(messages, context);
      const json = await response.json();
      return json?.candidates?.[0]?.content?.parts?.[0]?.text || this.fallbackProvider.chat(messages, context);
    } catch {
      return this.fallbackProvider.chat(messages, context);
    }
  }
}
