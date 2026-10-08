import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { SpeechProvider, TranscriptResult, TranscriptSegment } from '@/lib/types';

export interface LocalWhisperProgressEvent {
  stage: 'DETECTING_HARDWARE' | 'HARDWARE_DETECTED' | 'DOWNLOADING_MODEL' | 'MODEL_READY' | 'TRANSCRIBING' | 'FALLBACK_TO_CPU' | 'COMPLETE' | 'FAILED';
  progress?: number;
  device?: string;
  computeType?: string;
  gpuName?: string | null;
  model?: string;
  currentTime?: number;
  totalDuration?: number;
  warning?: string;
  error?: string;
}

export interface LocalWhisperStatus {
  installed: boolean;
  cuda_available: boolean;
  device: 'cuda' | 'cpu' | string;
  compute_type: string;
  gpu_name?: string | null;
  model_cached: boolean;
  model: string;
  cache_dir: string;
  stage: 'MODEL_NOT_INSTALLED' | 'DOWNLOADING_MODEL' | 'MODEL_READY' | 'TRANSCRIBING' | 'COMPLETE' | 'FAILED';
  error?: string | null;
}

export interface ExtendedTranscriptResult extends TranscriptResult {
  coveragePercentage?: number;
  audioDurationSec?: number;
  device?: string;
  computeType?: string;
  gpuName?: string | null;
  model?: string;
  stage?: string;
  error?: string;
}

export class LocalWhisperTranscriptionProvider implements SpeechProvider {
  readonly id = 'local-whisper';
  readonly name = 'Local Faster-Whisper (CUDA / Quantized CPU)';

  private pythonPath: string;
  private scriptPath: string;
  private modelName: string;
  private cacheDir: string;

  constructor(options?: {
    pythonPath?: string;
    modelName?: string;
    cacheDir?: string;
  }) {
    const cwd = process.cwd();
    // Prefer project virtual environment
    const venvPythonWin = path.join(cwd, '.venv', 'Scripts', 'python.exe');
    const venvPythonUnix = path.join(cwd, '.venv', 'bin', 'python');

    if (options?.pythonPath) {
      this.pythonPath = options.pythonPath;
    } else if (fs.existsSync(venvPythonWin)) {
      this.pythonPath = venvPythonWin;
    } else if (fs.existsSync(venvPythonUnix)) {
      this.pythonPath = venvPythonUnix;
    } else {
      this.pythonPath = 'python';
    }

    this.scriptPath = path.join(cwd, 'scripts', 'transcribe_whisper.py');
    this.modelName = options?.modelName || process.env.WHISPER_MODEL || 'small';
    this.cacheDir = options?.cacheDir || process.env.WHISPER_CACHE_DIR || path.join(cwd, 'storage', 'models', 'whisper');
  }

  /**
   * Probe the local installation, hardware capability (CUDA vs CPU), and model cache.
   */
  async checkStatus(): Promise<LocalWhisperStatus> {
    return new Promise((resolve) => {
      const args = [
        this.scriptPath,
        '--check_status',
        '--model', this.modelName,
        '--cache_dir', this.cacheDir,
      ];

      const proc = spawn(this.pythonPath, args, { cwd: process.cwd() });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        try {
          const parsed = JSON.parse(stdout.trim());
          const stage = !parsed.installed
            ? 'MODEL_NOT_INSTALLED'
            : parsed.model_cached
            ? 'MODEL_READY'
            : 'MODEL_NOT_INSTALLED';

          resolve({
            installed: Boolean(parsed.installed),
            cuda_available: Boolean(parsed.cuda_available),
            device: parsed.device || 'cpu',
            compute_type: parsed.compute_type || 'int8',
            gpu_name: parsed.gpu_name,
            model_cached: Boolean(parsed.model_cached),
            model: parsed.model || this.modelName,
            cache_dir: parsed.cache_dir || this.cacheDir,
            stage,
            error: parsed.error || null,
          });
        } catch {
          resolve({
            installed: false,
            cuda_available: false,
            device: 'cpu',
            compute_type: 'int8',
            model_cached: false,
            model: this.modelName,
            cache_dir: this.cacheDir,
            stage: 'MODEL_NOT_INSTALLED',
            error: stderr || stdout || 'Failed to probe faster-whisper environment',
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          installed: false,
          cuda_available: false,
          device: 'cpu',
          compute_type: 'int8',
          model_cached: false,
          model: this.modelName,
          cache_dir: this.cacheDir,
          stage: 'MODEL_NOT_INSTALLED',
          error: `Failed to execute python: ${err.message}`,
        });
      });
    });
  }

  /**
   * Transcribe an audio file using local faster-whisper.
   */
  async transcribe(
    audioInput: Buffer | string,
    options?: {
      language?: string;
      audioDurationSec?: number;
      onProgress?: (event: LocalWhisperProgressEvent) => void;
      onSegment?: (segment: TranscriptSegment) => void;
    }
  ): Promise<ExtendedTranscriptResult> {
    let resolvedAudioPath = '';
    let isTempFile = false;

    if (Buffer.isBuffer(audioInput)) {
      resolvedAudioPath = path.join(process.cwd(), 'storage', 'audio', `temp_${Date.now()}.wav`);
      fs.mkdirSync(path.dirname(resolvedAudioPath), { recursive: true });
      fs.writeFileSync(resolvedAudioPath, audioInput);
      isTempFile = true;
    } else {
      resolvedAudioPath = path.resolve(process.cwd(), audioInput);
    }

    if (!fs.existsSync(resolvedAudioPath)) {
      return {
        fullText: '',
        segments: [],
        language: 'unknown',
        stage: 'FAILED',
        error: `AUDIO_FILE_NOT_FOUND: ${resolvedAudioPath}`,
      };
    }

    return new Promise((resolve) => {
      const args = [
        this.scriptPath,
        '--audio', resolvedAudioPath,
        '--model', this.modelName,
        '--cache_dir', this.cacheDir,
      ];

      if (options?.language) {
        args.push('--language', options.language);
      }

      const proc = spawn(this.pythonPath, args, { cwd: process.cwd() });
      let finalResult: ExtendedTranscriptResult | null = null;
      let stderrOutput = '';
      const collectedSegments: TranscriptSegment[] = [];

      proc.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('{')) continue;

          try {
            const event = JSON.parse(trimmed);
            if (event.type === 'PROGRESS' && options?.onProgress) {
              options.onProgress(event as LocalWhisperProgressEvent);
            } else if (event.type === 'SEGMENT' && event.segment) {
              collectedSegments.push(event.segment);
              if (options?.onSegment) {
                options.onSegment(event.segment);
              }
            } else if (event.type === 'RESULT') {
              finalResult = {
                fullText: event.fullText,
                segments: event.segments,
                language: event.language,
                audioDurationSec: event.audioDurationSec,
                coveragePercentage: event.coveragePercentage,
                device: event.device,
                computeType: event.computeType,
                gpuName: event.gpuName,
                model: event.model,
                stage: 'COMPLETE',
              };
            } else if (event.type === 'ERROR') {
              finalResult = {
                fullText: '',
                segments: [],
                language: 'unknown',
                stage: event.stage || 'FAILED',
                error: event.error,
              };
            }
          } catch {
            // Ignore non-JSON lines
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      proc.on('close', (code) => {
        if (isTempFile && fs.existsSync(resolvedAudioPath)) {
          try { fs.unlinkSync(resolvedAudioPath); } catch {}
        }

        if (finalResult && finalResult.segments?.length) {
          resolve(finalResult);
          return;
        }

        if (finalResult && finalResult.error) {
          resolve(finalResult);
          return;
        }

        if (collectedSegments.length > 0) {
          const lastEndTime = collectedSegments[collectedSegments.length - 1].endTimeSec;
          const dur = options?.audioDurationSec || lastEndTime;
          const cov = dur > 0 ? Math.min(100, Math.round((lastEndTime / dur) * 1000) / 10) : 100;

          resolve({
            fullText: collectedSegments.map(s => s.text).join(' '),
            segments: collectedSegments,
            language: options?.language || 'en',
            audioDurationSec: dur,
            coveragePercentage: cov,
            stage: 'COMPLETE',
          });
          return;
        }

        resolve({
          fullText: '',
          segments: [],
          language: 'unknown',
          stage: 'FAILED',
          error: stderrOutput.trim() || `Transcription process exited with code ${code}`,
        });
      });

      proc.on('error', (err) => {
        if (isTempFile && fs.existsSync(resolvedAudioPath)) {
          try { fs.unlinkSync(resolvedAudioPath); } catch {}
        }

        resolve({
          fullText: '',
          segments: [],
          language: 'unknown',
          stage: 'FAILED',
          error: `Failed to spawn Python transcription worker: ${err.message}`,
        });
      });
    });
  }
}
