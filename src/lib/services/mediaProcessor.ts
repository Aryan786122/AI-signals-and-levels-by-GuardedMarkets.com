import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { MediaInspection } from '@/lib/types';

const execAsync = promisify(exec);

export class MediaProcessor {
  private static ffmpegChecked: boolean | null = null;

  static async checkFFmpeg(): Promise<boolean> {
    if (this.ffmpegChecked !== null) return this.ffmpegChecked;
    try {
      await execAsync('ffmpeg -version');
      this.ffmpegChecked = true;
      return true;
    } catch {
      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
        path.join(process.env.ProgramFiles || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          try {
            ffmpeg.setFfmpegPath(p);
            const probePath = p.replace('ffmpeg.exe', 'ffprobe.exe');
            if (fs.existsSync(probePath)) {
              ffmpeg.setFfprobePath(probePath);
            }
            this.ffmpegChecked = true;
            return true;
          } catch {}
        }
      }
      this.ffmpegChecked = false;
      return false;
    }
  }

  /**
   * Run complete FFprobe media inspection returning Layer A deterministic facts.
   */
  static async inspectMedia(filePath: string): Promise<MediaInspection> {
    await this.checkFFmpeg();
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Media file not found at path: ${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    const cmd = `ffprobe -v error -show_format -show_streams -print_format json "${resolvedPath}"`;

    try {
      const { stdout } = await execAsync(cmd);
      const data = JSON.parse(stdout);

      const videoStream = (data.streams || []).find((s: any) => s.codec_type === 'video');
      const audioStream = (data.streams || []).find((s: any) => s.codec_type === 'audio');
      const format = data.format || {};

      let fps: number | null = null;
      if (videoStream?.r_frame_rate) {
        const parts = String(videoStream.r_frame_rate).split('/');
        if (parts.length === 2 && Number(parts[1]) > 0) {
          fps = Math.round((Number(parts[0]) / Number(parts[1])) * 100) / 100;
        } else {
          fps = Number(videoStream.r_frame_rate) || null;
        }
      }

      const durationSeconds = Number(format.duration || videoStream?.duration || audioStream?.duration || 0);
      const videoDurationSeconds = videoStream ? Number(videoStream.duration || durationSeconds) : null;
      const audioDurationSeconds = audioStream ? Number(audioStream.duration || durationSeconds) : null;

      return {
        durationSeconds,
        videoDurationSeconds,
        audioDurationSeconds,
        width: videoStream?.width ? Number(videoStream.width) : null,
        height: videoStream?.height ? Number(videoStream.height) : null,
        fps,
        videoCodec: videoStream?.codec_name || null,
        audioCodec: audioStream?.codec_name || null,
        hasVideo: Boolean(videoStream),
        hasAudio: Boolean(audioStream),
        fileSizeBytes: stat.size,
      };
    } catch (err) {
      throw new Error(`FFprobe inspection failed for ${filePath}: ${(err as Error).message}`);
    }
  }

  /**
   * Compatibility alias for inspectMedia returning core metadata.
   */
  static async getVideoMetadata(filePath: string): Promise<{ durationSec: number; width: number; height: number; codec: string; fps: number; hasAudio: boolean }> {
    const info = await this.inspectMedia(filePath);
    return {
      durationSec: info.durationSeconds,
      width: info.width || 0,
      height: info.height || 0,
      codec: info.videoCodec || 'unknown',
      fps: info.fps || 0,
      hasAudio: info.hasAudio,
    };
  }

  /**
   * Extract audio track from video as 16kHz mono WAV using FFmpeg.
   */
  static async extractAudio(
    videoPath: string,
    outputDir: string
  ): Promise<{ audioPath: string; durationSec: number; fileSize: number }> {
    const hasFfmpeg = await this.checkFFmpeg();
    if (!hasFfmpeg) {
      throw new Error('FFmpeg is not installed or not on PATH');
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const resolvedVideo = path.resolve(process.cwd(), videoPath);
    const outputAudioPath = path.join(outputDir, `audio_${Date.now()}.wav`);

    const cmd = `ffmpeg -y -i "${resolvedVideo}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${outputAudioPath}"`;
    await execAsync(cmd);

    if (!fs.existsSync(outputAudioPath)) {
      throw new Error(`Audio extraction output file was not generated: ${outputAudioPath}`);
    }

    const stat = fs.statSync(outputAudioPath);
    const inspection = await this.inspectMedia(outputAudioPath);

    return {
      audioPath: outputAudioPath,
      durationSec: inspection.durationSeconds,
      fileSize: stat.size,
    };
  }

  /**
   * Extract keyframes across the full duration using FFmpeg fps filter.
   */
  static async extractFrames(
    videoPath: string,
    outputDir: string,
    options?: { intervalSec?: number; maxFrames?: number }
  ): Promise<Array<{ timestampSec: number; filePath: string }>> {
    const hasFfmpeg = await this.checkFFmpeg();
    if (!hasFfmpeg) {
      throw new Error('FFmpeg is not installed or not on PATH');
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    } else {
      // Clear stale frame files from previous runs to prevent name collisions
      const existing = fs.readdirSync(outputDir).filter(f => f.startsWith('frame_') && f.endsWith('.png'));
      for (const f of existing) {
        try { fs.unlinkSync(path.join(outputDir, f)); } catch {}
      }
    }

    const resolvedVideo = path.resolve(process.cwd(), videoPath);
    const inspection = await this.inspectMedia(resolvedVideo);
    const totalDuration = inspection.durationSeconds || 60;

    // Calculate smart interval based on total duration to stay within maxFrames
    const maxFrames = options?.maxFrames ?? 60;
    let intervalSec = options?.intervalSec ?? Math.max(1.5, Math.round((totalDuration / maxFrames) * 10) / 10);
    if (intervalSec < 1) intervalSec = 1;

    const fps = (1 / intervalSec).toFixed(4);
    const framePattern = path.join(outputDir, 'frame_%05d.png');

    // Run frame extraction
    const cmd = `ffmpeg -y -i "${resolvedVideo}" -vf fps=${fps} -vframes ${maxFrames} "${framePattern}"`;
    await execAsync(cmd);

    const generatedFiles = fs.readdirSync(outputDir)
      .filter(f => f.match(/^frame_\d{5}\.png$/))
      .sort();

    const result = generatedFiles.map((file, index) => {
      const timestampSec = Math.min(totalDuration, Math.round(index * intervalSec * 100) / 100);
      const formattedTime = timestampSec.toFixed(1).padStart(6, '0');
      const newFileName = `frame_${formattedTime}s.png`;
      const oldPath = path.join(outputDir, file);
      const newPath = path.join(outputDir, newFileName);

      try {
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
        fs.renameSync(oldPath, newPath);
      } catch (err) {
        console.warn(`[MediaProcessor] Frame rename error for ${file}:`, err);
      }

      return {
        timestampSec,
        filePath: fs.existsSync(newPath) ? newPath : oldPath,
      };
    });

    return result;
  }
}

export const ffmpegAvailable = MediaProcessor.checkFFmpeg();
export default MediaProcessor;
