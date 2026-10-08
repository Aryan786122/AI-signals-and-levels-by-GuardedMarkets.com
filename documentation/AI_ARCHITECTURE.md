# GuardedMarketsAI — AI Architecture & Multi-Provider Abstraction

## 1. Provider Contracts

To prevent vendor lock-in and allow seamless transition between local offline models and external APIs, all AI interactions implement strict TypeScript interfaces:

### `AIProvider`
```typescript
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  analyze(params: AnalysisParams): Promise<StructuredAIResponse>;
  extractLesson(params: ExtractLessonParams): Promise<ExtractedLessonData>;
  resolveConflict(params: ConflictResolutionParams): Promise<ConflictResolutionSuggestion>;
  evaluateScenario(params: ScenarioEvalParams): Promise<ScenarioEvaluationResult>;
  chat(messages: ChatMessage[], context: KnowledgeContext): Promise<string>;
}
```

### Supported Implementations:
1. **Local Deterministic Provider (`LocalAIProvider`)**: Safe offline fallback executing real rule evaluation and pattern lookup without hallucinations or API keys.
2. **Google Gemini Provider (`GeminiAIProvider`)**: Multimodal analysis using Gemini 2.0 Flash / Pro with native JSON mode.
3. **OpenAI Provider**: GPT-4o structured reasoning and Whisper transcription.
4. **Ollama Provider**: Integration with local open-weights models (e.g. Llama 3, Mistral).

---

## 2. Layered Prompt Architecture (Section 36)

Prompts are never bundled into a monolithic blob. Instead, GuardedMarketsAI injects isolated context layers:

```
┌────────────────────────────────────────────────────────┐
│ 1. SYSTEM ROLE: Disciplined AI Trading Student         │
├────────────────────────────────────────────────────────┤
│ 2. APPROVED KNOWLEDGE: Active Rules & Exceptions       │
├────────────────────────────────────────────────────────┤
│ 3. CURRENT MARKET STATE: Price Levels, OHLC Candlestick│
├────────────────────────────────────────────────────────┤
│ 4. VISUAL CONTEXT: Keyframe or Chart Screenshot        │
├────────────────────────────────────────────────────────┤
│ 5. TASK: Evaluate Setup & Produce Strict JSON Output   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Strict Schema Validation

All AI responses are validated at runtime against `StructuredAIResponseSchema` using Zod. If a response is malformed, the system falls back safely without application crashes.
