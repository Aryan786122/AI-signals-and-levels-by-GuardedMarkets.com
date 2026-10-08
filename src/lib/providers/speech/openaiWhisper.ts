import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SpeechProvider, TranscriptResult } from '@/lib/types';
import { ExtendedTranscriptResult } from './localWhisper';

export class OpenAITranscriptionProvider implements SpeechProvider {
  readonly id = 'openai-whisper';
  readonly name = 'OpenAI Whisper Cloud API';

  async transcribe(
    audioInput: Buffer | string,
    options?: { language?: string; audioDurationSec?: number }
  ): Promise<ExtendedTranscriptResult> {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim().length === 0) {
      return {
        fullText: '',
        segments: [],
        language: 'unknown',
        stage: 'FAILED',
        error: 'OPENAI_API_KEY_NOT_CONFIGURED',
      };
    }

    let audioBuffer: Buffer;
    let audioFilePath = '';
    let isTempFile = false;

    if (Buffer.isBuffer(audioInput)) {
      audioBuffer = audioInput;
      audioFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.wav`);
      fs.writeFileSync(audioFilePath, audioInput);
      isTempFile = true;
    } else {
      audioFilePath = path.resolve(process.cwd(), audioInput);
      if (!fs.existsSync(audioFilePath)) {
        return {
          fullText: '',
          segments: [],
          language: 'unknown',
          stage: 'FAILED',
          error: `AUDIO_FILE_NOT_FOUND: ${audioFilePath}`,
        };
      }
      audioBuffer = fs.readFileSync(audioFilePath);
    }

    try {
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', blob, path.basename(audioFilePath));
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');
      if (options?.language) {
        formData.append('language', options.language);
      }

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: formData as any,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI transcription failed (${res.status}): ${errBody}`);
      }

      const data: any = await res.json();
      const segments = (data.segments || []).map((seg: any) => ({
        startTimeSec: Math.round(Number(seg.start ?? 0) * 100) / 100,
        endTimeSec: Math.round(Number(seg.end ?? 0) * 100) / 100,
        text: String(seg.text ?? '').trim(),
        confidence: 0.95,
      })).filter((s: { text: string }) => s.text.length > 0);

      const lastEndTime = segments.length > 0 ? segments[segments.length - 1].endTimeSec : 0;
      const audioDur = options?.audioDurationSec || (data.duration ? Number(data.duration) : lastEndTime);
      const coveragePercentage = audioDur > 0 ? Math.min(100, Math.round((lastEndTime / audioDur) * 1000) / 10) : 100;

      return {
        fullText: data.text || segments.map((s: { text: string }) => s.text).join(' '),
        segments,
        language: data.language || options?.language || 'en',
        coveragePercentage,
        audioDurationSec: audioDur,
        device: 'cloud-openai',
        model: 'whisper-1',
        stage: 'COMPLETE',
      };
    } catch (error) {
      return {
        fullText: '',
        segments: [],
        language: 'unknown',
        stage: 'FAILED',
        error: `OPENAI_TRANSCRIPTION_FAILED: ${(error as Error).message}`,
      };
    } finally {
      if (isTempFile && fs.existsSync(audioFilePath)) {
        try { fs.unlinkSync(audioFilePath); } catch {}
      }
    }
  }
}
