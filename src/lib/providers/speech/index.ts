import { SpeechProvider } from '@/lib/types';
import {
  LocalWhisperTranscriptionProvider,
  ExtendedTranscriptResult,
  LocalWhisperStatus,
  LocalWhisperProgressEvent,
} from './localWhisper';
import { OpenAITranscriptionProvider } from './openaiWhisper';

export type TranscriptionProvider = SpeechProvider;
export { LocalWhisperTranscriptionProvider, OpenAITranscriptionProvider };
export type { ExtendedTranscriptResult, LocalWhisperStatus, LocalWhisperProgressEvent };

export class TranscriptionProviderFactory {
  private static localProvider: LocalWhisperTranscriptionProvider | null = null;
  private static openAIProvider: OpenAITranscriptionProvider | null = null;

  /**
   * Returns the designated transcription provider.
   * Default: Local Whisper (NVIDIA CUDA / Quantized CPU via faster-whisper)
   * Optional: OpenAI Whisper Cloud API
   */
  static getProvider(type?: 'local' | 'openai' | string): SpeechProvider {
    const selected = type || process.env.DEFAULT_TRANSCRIPTION_PROVIDER || 'local';

    if (selected === 'openai') {
      if (!this.openAIProvider) {
        this.openAIProvider = new OpenAITranscriptionProvider();
      }
      return this.openAIProvider;
    }

    // Default: Local Whisper
    if (!this.localProvider) {
      this.localProvider = new LocalWhisperTranscriptionProvider();
    }
    return this.localProvider;
  }

  static getLocalProvider(): LocalWhisperTranscriptionProvider {
    if (!this.localProvider) {
      this.localProvider = new LocalWhisperTranscriptionProvider();
    }
    return this.localProvider;
  }
}

// Default provider is LocalWhisperTranscriptionProvider
export const localWhisperProvider = TranscriptionProviderFactory.getLocalProvider();
export const speechProvider: SpeechProvider = TranscriptionProviderFactory.getProvider();
export default speechProvider;
