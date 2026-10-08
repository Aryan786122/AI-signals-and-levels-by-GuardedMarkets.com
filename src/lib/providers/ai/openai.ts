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

export class OpenAIAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI (GPT-4o / GPT-4o-mini)';
  private apiKey: string;
  private modelName: string;
  private fallbackValidator: LocalRuleValidator;

  constructor(apiKey?: string, modelName: string = 'gpt-4o') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = modelName;
    this.fallbackValidator = new LocalRuleValidator();
  }

  private hasKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async analyze(params: AnalysisParams): Promise<StructuredAIResponse> {
    if (!this.hasKey()) {
      return this.fallbackValidator.analyze(params);
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

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are an AI trading student strictly applying teacher rules.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`OpenAI API error ${res.status}. Falling back to rule validator.`);
        return this.fallbackValidator.analyze(params);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return this.fallbackValidator.analyze(params);

      const parsed = JSON.parse(content);
      return StructuredAIResponseSchema.parse(parsed) as StructuredAIResponse;
    } catch (err) {
      console.warn('OpenAI analysis error, reverting to rule validator:', err);
      return this.fallbackValidator.analyze(params);
    }
  }

  async extractLesson(params: ExtractLessonParams): Promise<ExtractedLessonData> {
    if (!this.hasKey()) {
      return this.fallbackValidator.extractLesson(params);
    }

    try {
      const prompt = `Analyze this trading lesson transcript. Extract structured trading concepts, rules, conditions, exceptions, and examples.
Return valid JSON matching the schema with fields: lesson_title, summary, primary_concept, related_concepts, rules, positive_examples, counterexamples, detected_conflicts, confidence.

TRANSCRIPT:
${params.transcriptText}
`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are an AI trading student extracting trading methodology.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) return this.fallbackValidator.extractLesson(params);

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return this.fallbackValidator.extractLesson(params);

      const parsed = JSON.parse(content);
      return ExtractedLessonDataSchema.parse(parsed) as ExtractedLessonData;
    } catch (err) {
      console.warn('OpenAI extraction error, reverting to rule validator:', err);
      return this.fallbackValidator.extractLesson(params);
    }
  }

  async resolveConflict(params: ConflictResolutionParams): Promise<ConflictResolutionSuggestion> {
    if (!this.hasKey()) {
      return this.fallbackValidator.resolveConflict(params);
    }

    try {
      const prompt = `Compare Rule A ("${params.ruleA.title}") and Rule B ("${params.ruleB.title}").
Output JSON with: rule_a_id, rule_b_id, relationship ("EXCEPTION"|"SUPERSEDES"|"SEPARATE"|"REFINE"), ai_interpretation, question, recommended_action.`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) return this.fallbackValidator.resolveConflict(params);
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return this.fallbackValidator.resolveConflict(params);

      return JSON.parse(content) as ConflictResolutionSuggestion;
    } catch {
      return this.fallbackValidator.resolveConflict(params);
    }
  }

  async evaluateScenario(params: ScenarioEvalParams): Promise<ScenarioEvaluationResult> {
    return this.fallbackValidator.evaluateScenario(params);
  }

  async chat(messages: ChatMessage[], context: KnowledgeContext): Promise<string> {
    if (!this.hasKey()) {
      return this.fallbackValidator.chat(messages, context);
    }

    try {
      const systemPrompt = `You are a personal AI trading student learning strictly from your teacher.
When answering, reference actual stored rules, exceptions, and concepts.
Active Concepts: ${context.concepts.map(c => c.name).join(', ')}
Active Rules: ${context.rules.map(r => `[#${r.id.slice(-4)}] ${r.title}: ${r.statement}`).join('; ')}
Exceptions: ${context.exceptions.map(e => e.description).join('; ')}
`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (!res.ok) return this.fallbackValidator.chat(messages, context);
      const json = await res.json();
      return json.choices?.[0]?.message?.content || this.fallbackValidator.chat(messages, context);
    } catch {
      return this.fallbackValidator.chat(messages, context);
    }
  }
}
