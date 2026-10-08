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
import { LocalRuleValidator } from './local';

export class OllamaAIProvider implements AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local LLM / Vision)';
  private baseUrl: string;
  private modelName: string;
  private fallbackValidator: LocalRuleValidator;

  constructor(baseUrl: string = 'http://localhost:11434', modelName: string = 'llama3.2') {
    this.baseUrl = process.env.OLLAMA_BASE_URL || baseUrl;
    this.modelName = process.env.OLLAMA_MODEL || modelName;
    this.fallbackValidator = new LocalRuleValidator();
  }

  async analyze(params: AnalysisParams): Promise<StructuredAIResponse> {
    try {
      const prompt = `You are a disciplined personal AI trading student. Output strictly valid JSON matching this schema:
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

CURRENT SITUATION:
${params.promptOverride || 'Analyze the situation based on the rules.'}
`;

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          format: 'json',
          stream: false,
        }),
      });

      if (!res.ok) return this.fallbackValidator.analyze(params);

      const json = await res.json();
      if (!json.response) return this.fallbackValidator.analyze(params);

      const parsed = JSON.parse(json.response);
      return StructuredAIResponseSchema.parse(parsed) as StructuredAIResponse;
    } catch {
      return this.fallbackValidator.analyze(params);
    }
  }

  async extractLesson(params: ExtractLessonParams): Promise<ExtractedLessonData> {
    try {
      const prompt = `Extract structured trading concepts, rules, conditions, exceptions, and examples from this transcript.
Return JSON with fields: lesson_title, summary, primary_concept, related_concepts, rules, positive_examples, counterexamples, detected_conflicts, confidence.

TRANSCRIPT:
${params.transcriptText}
`;

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          format: 'json',
          stream: false,
        }),
      });

      if (!res.ok) return this.fallbackValidator.extractLesson(params);

      const json = await res.json();
      if (!json.response) return this.fallbackValidator.extractLesson(params);

      const parsed = JSON.parse(json.response);
      return ExtractedLessonDataSchema.parse(parsed) as ExtractedLessonData;
    } catch {
      return this.fallbackValidator.extractLesson(params);
    }
  }

  async resolveConflict(params: ConflictResolutionParams): Promise<ConflictResolutionSuggestion> {
    return this.fallbackValidator.resolveConflict(params);
  }

  async evaluateScenario(params: ScenarioEvalParams): Promise<ScenarioEvaluationResult> {
    return this.fallbackValidator.evaluateScenario(params);
  }

  async chat(messages: ChatMessage[], context: KnowledgeContext): Promise<string> {
    try {
      const systemPrompt = `You are a personal AI trading student learning strictly from your teacher.
Active Concepts: ${context.concepts.map(c => c.name).join(', ')}
Active Rules: ${context.rules.map(r => `[#${r.id.slice(-4)}] ${r.title}`).join('; ')}
Exceptions: ${context.exceptions.map(e => e.description).join('; ')}
`;

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
          stream: false,
        }),
      });

      if (!res.ok) return this.fallbackValidator.chat(messages, context);
      const json = await res.json();
      return json.message?.content || this.fallbackValidator.chat(messages, context);
    } catch {
      return this.fallbackValidator.chat(messages, context);
    }
  }
}
