import { AIProvider } from '@/lib/types';
import { LocalRuleValidator } from './local';
import { GeminiAIProvider } from './gemini';
import { OpenAIAIProvider } from './openai';
import { OllamaAIProvider } from './ollama';

export class AIProviderFactory {
  private static providers: Map<string, AIProvider> = new Map();

  static getProvider(providerId?: string): AIProvider {
    const selected = providerId || process.env.DEFAULT_AI_PROVIDER || 'gemini';

    if (this.providers.has(selected)) {
      return this.providers.get(selected)!;
    }

    let provider: AIProvider;
    switch (selected) {
      case 'gemini':
        provider = new GeminiAIProvider(process.env.GEMINI_API_KEY, process.env.DEFAULT_AI_MODEL || 'gemini-2.0-flash');
        break;
      case 'openai':
        provider = new OpenAIAIProvider(process.env.OPENAI_API_KEY, process.env.DEFAULT_AI_MODEL || 'gpt-4o');
        break;
      case 'ollama':
        provider = new OllamaAIProvider(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL || 'llama3.2');
        break;
      case 'local':
      default:
        provider = new LocalRuleValidator();
        break;
    }

    this.providers.set(selected, provider);
    return provider;
  }

  static listAvailableProviders(): Array<{ id: string; name: string; isConfigured: boolean }> {
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 0);
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0);
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0);

    return [
      { id: 'gemini', name: 'Google Gemini (2.0 Flash / Pro)', isConfigured: hasGemini },
      { id: 'openai', name: 'OpenAI GPT-4o / Mini', isConfigured: hasOpenAI },
      { id: 'anthropic', name: 'Anthropic Claude 3.5 Sonnet', isConfigured: hasAnthropic },
      { id: 'ollama', name: 'Ollama (Local Offline LLMs)', isConfigured: true },
      { id: 'local', name: 'Local Fallback / Rule Validator (Offline)', isConfigured: true },
    ];
  }
}
