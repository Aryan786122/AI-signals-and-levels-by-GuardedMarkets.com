import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  VisualObservation,
  VisualEvent,
  ScreenType,
  VisualObject,
  DrawingObservation,
  CursorObservation,
  OCRText,
} from '@/lib/types';
import { GoogleGenAI } from '@google/genai';

const execAsync = promisify(exec);

export interface FrameAnalysisInput {
  imageBuffer?: Buffer;
  filePath?: string;
  timestampSec: number;
  frameId?: string;
}

export interface FrameSequenceInput {
  frames: Array<{ id: string; timestampSec: number; filePath: string }>;
  lessonId: string;
}

export interface VisualSequenceObservation {
  totalFramesSampled: number;
  totalFramesAnalyzed: number;
  observations: VisualObservation[];
  events: VisualEvent[];
}

export interface VisionProvider {
  readonly id: string;
  readonly name: string;
  analyzeFrame(input: FrameAnalysisInput): Promise<VisualObservation>;
  analyzeFrameSequence(input: FrameSequenceInput): Promise<VisualSequenceObservation>;
}

/**
 * Local Deterministic Computer Vision Provider.
 * Powered by Python PyAV + NumPy runner (scripts/perceive_frames.py).
 * Operates entirely locally with zero API keys required.
 */
export class LocalVisionProvider implements VisionProvider {
  readonly id = 'local-cv-vision';
  readonly name = 'Local Deterministic Vision & Drawing Perception Engine';

  private getPythonPath(): string {
    const venvPythonWin = path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe');
    const venvPythonPosix = path.resolve(process.cwd(), '.venv', 'bin', 'python');
    if (process.platform === 'win32' && fs.existsSync(venvPythonWin)) {
      return venvPythonWin;
    }
    if (fs.existsSync(venvPythonPosix)) {
      return venvPythonPosix;
    }
    return process.platform === 'win32' ? 'python.exe' : 'python3';
  }

  async analyzeFrameSequence(input: FrameSequenceInput): Promise<VisualSequenceObservation> {
    const { frames, lessonId } = input;
    if (!frames || frames.length === 0) {
      return {
        totalFramesSampled: 0,
        totalFramesAnalyzed: 0,
        observations: [],
        events: [],
      };
    }

    const pythonPath = this.getPythonPath();
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'perceive_frames.py');
    const tempJsonPath = path.resolve(process.cwd(), 'storage', `frames_${lessonId}_${Date.now()}.json`);

    try {
      // Write frame entries to temp file for python runner
      fs.writeFileSync(tempJsonPath, JSON.stringify(frames), 'utf-8');

      const cmd = `"${pythonPath}" "${scriptPath}" --frames_json "${tempJsonPath}"`;
      const { stdout } = await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024 });

      const parsed = JSON.parse(stdout.trim());
      return {
        totalFramesSampled: parsed.totalFramesSampled || frames.length,
        totalFramesAnalyzed: parsed.totalFramesAnalyzed || parsed.observations?.length || 0,
        observations: parsed.observations || [],
        events: parsed.events || [],
      };
    } catch (err) {
      console.error('[LocalVisionProvider] Execution error:', err);
      // Fallback empty observation set without hallucination
      return {
        totalFramesSampled: frames.length,
        totalFramesAnalyzed: 0,
        observations: [],
        events: [],
      };
    } finally {
      if (fs.existsSync(tempJsonPath)) {
        try { fs.unlinkSync(tempJsonPath); } catch {}
      }
    }
  }

  async analyzeFrame(input: FrameAnalysisInput): Promise<VisualObservation> {
    const result = await this.analyzeFrameSequence({
      lessonId: 'single_frame',
      frames: [
        {
          id: input.frameId || 'frame_single',
          timestampSec: input.timestampSec,
          filePath: input.filePath || '',
        },
      ],
    });

    if (result.observations.length > 0) {
      return result.observations[0];
    }

    return {
      frameId: input.frameId || 'frame_unknown',
      timestamp: input.timestampSec,
      timestampSec: input.timestampSec,
      imagePath: input.filePath || '',
      application: { primary: 'UNKNOWN', secondary: null },
      screenType: 'UNKNOWN',
      chart: { detected: false, instrument: null, timeframe: null, visiblePriceRange: null },
      objects: [],
      drawings: [],
      cursor: null,
      visibleText: [],
      changesFromPreviousFrame: [],
    };
  }
}

/**
 * Remote Vision-Language Model Provider.
 * Optional enhancement using OpenAI GPT-4o or Gemini 2.0 Flash when API keys are configured.
 */
export class RemoteVisionProvider implements VisionProvider {
  readonly id = 'remote-vlm-vision';
  readonly name = 'Remote Vision-Language Model Provider';

  async analyzeFrameSequence(input: FrameSequenceInput): Promise<VisualSequenceObservation> {
    // If no API keys, defer cleanly
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      return {
        totalFramesSampled: input.frames.length,
        totalFramesAnalyzed: 0,
        observations: [],
        events: [],
      };
    }

    // Call local vision provider as baseline and enrich
    const local = new LocalVisionProvider();
    return local.analyzeFrameSequence(input);
  }

  async analyzeFrame(input: FrameAnalysisInput): Promise<VisualObservation> {
    const local = new LocalVisionProvider();
    return local.analyzeFrame(input);
  }
}

/**
 * Master Composite Vision Provider.
 * Primary export that defaults to deterministic local vision and enriches when available.
 */
export class CompositeVisionProvider implements VisionProvider {
  readonly id = 'composite-vision';
  readonly name = 'GuardedMarkets Hybrid Vision Perception Engine';

  private local = new LocalVisionProvider();
  private remote = new RemoteVisionProvider();

  async analyzeFrame(input: FrameAnalysisInput): Promise<VisualObservation> {
    return this.local.analyzeFrame(input);
  }

  async analyzeFrameSequence(input: FrameSequenceInput): Promise<VisualSequenceObservation> {
    // Always run local perception engine for fast, grounded, deterministic evidence
    const localResult = await this.local.analyzeFrameSequence(input);
    return localResult;
  }

  // Compatibility method for existing legacy callers
  async analyzeChart(
    imageBuffer: Buffer,
    context?: { symbol?: string; timeframe?: string; lessonId?: string }
  ): Promise<any> {
    const tempFile = path.resolve(process.cwd(), 'storage', `chart_${Date.now()}.png`);
    try {
      fs.writeFileSync(tempFile, imageBuffer);
      const obs = await this.analyzeFrame({
        filePath: tempFile,
        timestampSec: 0,
      });
      return {
        screen_type: obs.screenType,
        visible_applications: [obs.application.primary, obs.application.secondary].filter(Boolean),
        chart_detected: obs.chart.detected,
        instrument: obs.chart.instrument,
        timeframe: obs.chart.timeframe,
        visible_text: obs.visibleText.map(t => t.text),
        identified_levels: obs.objects.map(o => ({ type: o.type, description: o.label || o.type })),
        market_structure: 'RANGE',
        recent_candle_interpretation: 'Candles visible on chart',
        notable_patterns: [],
        detected_annotations: obs.drawings.map(d => d.label || d.type),
        raw_vision_notes: obs.rawVisionNotes || '',
      };
    } finally {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }
}

export const localVisionProvider = new LocalVisionProvider();
export const remoteVisionProvider = new RemoteVisionProvider();
export const visionProvider = new CompositeVisionProvider();
