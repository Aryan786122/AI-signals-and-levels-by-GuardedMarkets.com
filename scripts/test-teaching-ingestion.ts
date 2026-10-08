import * as path from 'path';
import * as fs from 'fs';
import { MediaProcessor } from '../src/lib/services/mediaProcessor';
import { speechProvider } from '../src/lib/providers/speech';
import { visionProvider } from '../src/lib/providers/vision';
import { reasoningProvider } from '../src/lib/providers/reasoning';
import { TimelineEvent, TeachingSegmentItem, VisualObservation } from '../src/lib/types';

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || 'storage/videos/1789895310049_2026-09-20_14-17-05.mp4';
  const resolvedVideoPath = path.resolve(process.cwd(), inputPath);

  console.log('\n======================================================');
  console.log('  GROUND-TRUTH TEACHING INGESTION TEST HARNESS');
  console.log('======================================================');
  console.log(`Target Video: ${resolvedVideoPath}`);

  if (!fs.existsSync(resolvedVideoPath)) {
    console.error(`ERROR: Video file not found: ${resolvedVideoPath}`);
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), 'output', 'test-teaching');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // -------------------------------------------------------------
  // PHASE 1: Media Inspection (Layer A Facts)
  // -------------------------------------------------------------
  console.log('\n[1/6] Inspecting Media Facts via FFprobe...');
  const mediaReport = await MediaProcessor.inspectMedia(resolvedVideoPath);
  fs.writeFileSync(path.join(outDir, 'media-report.json'), JSON.stringify(mediaReport, null, 2));
  console.log(`  ✓ Duration: ${mediaReport.durationSeconds.toFixed(2)}s`);
  console.log(`  ✓ Video: ${mediaReport.width}x${mediaReport.height} @ ${mediaReport.fps} fps (${mediaReport.videoCodec})`);
  console.log(`  ✓ Audio: ${mediaReport.hasAudio ? `Detected (${mediaReport.audioCodec})` : 'None'}`);
  console.log(`  ✓ File Size: ${(mediaReport.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`);

  // -------------------------------------------------------------
  // PHASE 2: Audio Extraction & Transcription (Layer B)
  // -------------------------------------------------------------
  let transcriptData: any = { fullText: '', segments: [], coveragePercentage: 0 };
  if (mediaReport.hasAudio) {
    console.log('\n[2/6] Extracting Audio Track via FFmpeg...');
    const audioDir = path.join(outDir, 'audio');
    const { audioPath, durationSec, fileSize } = await MediaProcessor.extractAudio(resolvedVideoPath, audioDir);
    console.log(`  ✓ Extracted WAV: ${audioPath} (${(fileSize / 1024).toFixed(1)} KB, ${durationSec.toFixed(2)}s)`);

    console.log('\n[3/6] Transcribing Speech & Calculating Coverage...');
    const transcript = await speechProvider.transcribe(audioPath, { audioDurationSec: durationSec } as any);
    transcriptData = transcript;
    fs.writeFileSync(path.join(outDir, 'transcript.json'), JSON.stringify(transcript, null, 2));

    if (transcript.error) {
      console.log(`  ⚠️ Transcription Status: ${transcript.error}`);
    } else {
      console.log(`  ✓ Segments: ${transcript.segments.length}`);
      console.log(`  ✓ Audio Coverage: ${transcript.coveragePercentage}%`);
      console.log(`  ✓ Full Words Spoken: ${transcript.fullText.split(/\s+/).filter(Boolean).length} words`);
      if (transcript.segments.length > 0) {
        console.log(`  ✓ First segment: [${transcript.segments[0].startTimeSec}s] "${transcript.segments[0].text}"`);
        const last = transcript.segments[transcript.segments.length - 1];
        console.log(`  ✓ Last segment:  [${last.startTimeSec}s] "${last.text}"`);
      }
    }
  } else {
    console.log('\n[2/6 & 3/6] Skipping audio extraction (No audio stream detected).');
  }

  // -------------------------------------------------------------
  // PHASE 3: Keyframe Extraction & Visual Observations
  // -------------------------------------------------------------
  console.log('\n[4/6] Extracting Keyframes across Full Duration...');
  const framesDir = path.join(outDir, 'frames');
  const frames = await MediaProcessor.extractFrames(resolvedVideoPath, framesDir, { maxFrames: 30 });
  fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify(frames, null, 2));
  console.log(`  ✓ Extracted ${frames.length} keyframes spanning 0.0s to ${frames[frames.length - 1]?.timestampSec || 0}s`);

  console.log('\n[5/6] Generating Visual Observations & Screen Classification...');
  const visualObservations: any[] = [];
  const hasAIKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  const sampleStride = hasAIKey ? Math.max(1, Math.floor(frames.length / 6)) : frames.length + 1;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    let analysis: any = null;

    if (hasAIKey && i % sampleStride === 0 && fs.existsSync(frame.filePath)) {
      const buffer = fs.readFileSync(frame.filePath);
      analysis = await visionProvider.analyzeChart(buffer);
    }

    const obs: any = {
      timestampSec: frame.timestampSec,
      imagePath: frame.filePath,
      screenType: analysis?.screen_type || 'UNKNOWN',
      visibleApplications: analysis?.visible_applications || [],
      chartDetected: Boolean(analysis?.chart_detected),
      instrument: analysis?.instrument || null,
      timeframe: analysis?.timeframe || null,
      visibleText: analysis?.visible_text || [],
      chartObjects: analysis?.identified_levels || [],
      drawings: analysis?.detected_annotations || [],
      cursorVisible: false,
      cursorPosition: null,
    };
    visualObservations.push(obs);
  }
  fs.writeFileSync(path.join(outDir, 'visual-observations.json'), JSON.stringify(visualObservations, null, 2));
  console.log(`  ✓ Recorded ${visualObservations.length} visual observations`);
  const classified = visualObservations.filter(v => v.screenType !== 'UNKNOWN');
  console.log(`  ✓ Classified screen types: ${classified.length > 0 ? classified.map(c => `${c.timestampSec}s:${c.screenType}`).join(', ') : 'None (No vision provider)'}`);

  // -------------------------------------------------------------
  // PHASE 4: Unified Timeline & Segmentation
  // -------------------------------------------------------------
  console.log('\n[6/6] Synchronizing Ground-Truth Timeline & Reasoning...');
  const timeline: TimelineEvent[] = [];

  // Audio events
  for (let i = 0; i < (transcriptData.segments || []).length; i++) {
    const seg = transcriptData.segments[i];
    timeline.push({
      id: `audio_${i + 1}`,
      timestampSec: seg.startTimeSec,
      durationSec: Math.max(0.5, seg.endTimeSec - seg.startTimeSec),
      type: 'SPEECH',
      source: 'AUDIO',
      description: seg.text,
      data: seg,
    });
  }

  // Visual events
  for (let i = 0; i < visualObservations.length; i++) {
    const obs = visualObservations[i];
    if (obs.screenType !== 'UNKNOWN' || obs.chartObjects.length > 0) {
      timeline.push({
        id: `screen_${i + 1}`,
        timestampSec: obs.timestampSec,
        durationSec: 2.0,
        type: 'SCREEN',
        source: 'SCREEN',
        description: `Screen: ${obs.screenType} ${obs.instrument ? `(${obs.instrument})` : ''}`,
        data: obs,
      });
    }
  }

  timeline.sort((a, b) => a.timestampSec - b.timestampSec);
  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
  console.log(`  ✓ Generated ${timeline.length} time-aligned events`);

  // Teaching Segments
  const teachingSegments: TeachingSegmentItem[] = [];
  const targetSec = Math.max(20, Math.floor(mediaReport.durationSeconds / 4));
  let curStart = 0;
  let curSpeech: string[] = [];
  let curEvents: TimelineEvent[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const ev = timeline[i];
    curEvents.push(ev);
    if (ev.source === 'AUDIO') curSpeech.push(ev.description);

    const isLast = i === timeline.length - 1;
    if (ev.timestampSec - curStart >= targetSec || isLast) {
      const segEnd = isLast ? mediaReport.durationSeconds : ev.timestampSec;
      teachingSegments.push({
        id: `seg_${teachingSegments.length + 1}`,
        startTimeSec: curStart,
        endTimeSec: segEnd,
        title: `Interval (${curStart.toFixed(0)}s - ${segEnd.toFixed(0)}s)`,
        transcriptText: curSpeech.join(' '),
        visualSummary: `Interval spanning ${Math.round(segEnd - curStart)}s`,
        concepts: [],
        events: curEvents,
      });
      curStart = segEnd;
      curSpeech = [];
      curEvents = [];
    }
  }

  // Reasoning
  const reasoning = await reasoningProvider.reasonAboutTimeline({
    lessonTitle: path.basename(resolvedVideoPath),
    mediaFacts: mediaReport,
    timeline,
    segments: teachingSegments,
  });

  fs.writeFileSync(path.join(outDir, 'knowledge-candidates.json'), JSON.stringify(reasoning, null, 2));

  console.log('\n======================================================');
  console.log('  TEST RESULTS & ARTIFACTS GENERATED');
  console.log('======================================================');
  console.log(`Output Directory: ${outDir}`);
  console.log(`- media-report.json           ✓ Generated`);
  console.log(`- transcript.json             ✓ Generated (${transcriptData.segments?.length || 0} segments)`);
  console.log(`- frames.json                 ✓ Generated (${frames.length} frames)`);
  console.log(`- visual-observations.json    ✓ Generated (${visualObservations.length} observations)`);
  console.log(`- timeline.json               ✓ Generated (${timeline.length} events)`);
  console.log(`- knowledge-candidates.json   ✓ Generated (${reasoning.rules.length} rules, ${reasoning.concepts.length} concepts)`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\nHARNESS FAILURE:', err);
  process.exit(1);
});
