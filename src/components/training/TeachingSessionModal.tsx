'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Video,
  Mic,
  Monitor,
  X,
  Play,
  Pause,
  Square,
  Sparkles,
  AlertCircle,
  HardDrive,
  PenTool,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateKnowledge } from '@/lib/types';

interface TeachingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionIngested: (data: { lesson: any; candidateKnowledge: CandidateKnowledge }) => void;
}

type TeachingSource = 'UPLOAD' | 'RECORD_SCREEN' | 'RECORD_SCREEN_VOICE';

export function TeachingSessionModal({
  isOpen,
  onClose,
  onSessionIngested,
}: TeachingSessionModalProps) {
  const [activeSource, setActiveSource] = useState<TeachingSource>('UPLOAD');
  const [title, setTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0); // 0 to 100
  const [capturedEvents, setCapturedEvents] = useState<{
    cursorEvents: Array<{ timestampSec: number; action: string; x: number; y: number; targetDescription?: string }>;
    drawingEvents: Array<{ timestampSec: number; type: string; coordinates: any; label?: string }>;
  }>({ cursorEvents: [], drawingEvents: [] });

  // Processing / Submission state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for Recording
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isDrawingRef = useRef(false);
  const activeDrawToolRef = useRef<'LINE' | 'BOX' | 'CIRCLE'>('LINE');

  const stopRecordingCleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // Clean up on unmount or close
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, [stopRecordingCleanup]);

  // Start Screen or Screen+Voice Recording
  const handleStartRecording = async (includeVoice: boolean) => {
    setErrorMessage(null);
    recordedChunksRef.current = [];
    setCapturedEvents({ cursorEvents: [], drawingEvents: [] });
    setRecordingDurationSec(0);

    try {
      // 1. Capture Display Media (Screen / Window)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: true,
      });

      let finalStream = displayStream;

      // 2. If voice requested, capture Microphone and combine audio tracks
      if (includeVoice) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });

          // Mix audio tracks using AudioContext
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;

          const destination = audioCtx.createMediaStreamDestination();
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(destination);

          // Connect analyzer for volume meter
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          micSource.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!isRecording) return;
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, v) => acc + v, 0);
            const avg = sum / dataArray.length;
            setAudioVolume(Math.min(100, Math.round((avg / 128) * 100)));
            requestAnimationFrame(updateVolume);
          };
          requestAnimationFrame(updateVolume);

          // Combine screen video track with mixed audio track
          const videoTrack = displayStream.getVideoTracks()[0];
          const mixedAudioTrack = destination.stream.getAudioTracks()[0];
          finalStream = new MediaStream([videoTrack, mixedAudioTrack]);
        } catch (micErr) {
          console.warn('Microphone permission not granted, proceeding with screen audio only:', micErr);
        }
      }

      streamRef.current = finalStream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = finalStream;
        videoPreviewRef.current.play();
      }

      // Handle user stopping stream via browser native bar
      finalStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

      // 3. Initialize MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(finalStream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);

      // Start duration counter
      timerIntervalRef.current = setInterval(() => {
        setRecordingDurationSec(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Permission denied or capture failed.');
      stopRecordingCleanup();
    }
  };

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleStopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    setIsProcessing(true);
    setProcessingStep('Finalizing recording & extracting audio stream...');

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      stopRecordingCleanup();
      await submitTeachingSession(blob, 'recorded_session.webm');
    };

    mediaRecorderRef.current.stop();
  };

  // Canvas Drawing Handler to record annotation events during teaching
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    // Record annotation event
    setCapturedEvents(prev => ({
      ...prev,
      drawingEvents: [
        ...prev.drawingEvents,
        {
          timestampSec: recordingDurationSec,
          type: activeDrawToolRef.current === 'LINE' ? 'HORIZONTAL_LINE' : 'BOX',
          coordinates: { x, y },
          label: 'Teacher Highlight',
        },
      ],
    }));
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false;
  };

  // Submit session to backend
  const submitTeachingSession = async (fileOrBlob: Blob | File, filename?: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep('Uploading session stream to local ingestion pipeline...');

    try {
      const formData = new FormData();
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      formData.append('file', fileOrBlob, filename || (fileOrBlob as File).name || 'teaching_recording.webm');
      if (capturedEvents.cursorEvents.length > 0) {
        formData.append('cursorEvents', JSON.stringify(capturedEvents.cursorEvents));
      }
      if (capturedEvents.drawingEvents.length > 0) {
        formData.append('drawingEvents', JSON.stringify(capturedEvents.drawingEvents));
      }

      setProcessingStep('Audio extraction & speech transcription...');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setProcessingStep('Temporal alignment & candidate knowledge extraction...');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Teaching ingestion failed');
      }

      setProcessingStep('Success! Opening teacher review...');
      setTimeout(() => {
        setIsProcessing(false);
        onSessionIngested(data);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Session submission error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Ingestion failed.');
      setIsProcessing(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setErrorMessage('Please select a video or audio file to ingest.');
      return;
    }
    await submitTeachingSession(uploadFile);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-surface-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* MODAL HEADER */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-secondary/40">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded bg-accent/15 border border-accent/30 text-accent">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                New Teaching Session
              </h3>
              <p className="text-[11px] text-foreground-secondary">
                AI automatically extracts rules, exceptions, and evidence from your voice and screen
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopRecordingCleanup();
              onClose();
            }}
            className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-tertiary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-signal-red/10 border border-signal-red/30 text-signal-red text-xs font-mono flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Processing Banner */}
          {isProcessing && (
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-mono space-y-2 text-center animate-pulse">
              <div className="flex items-center justify-center space-x-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span className="font-bold uppercase tracking-wider">AI Multimodal Processing</span>
              </div>
              <p className="text-[11px] text-foreground-secondary font-sans">{processingStep}</p>
            </div>
          )}

          {/* LESSON TITLE (OPTIONAL) */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <label className="text-foreground-muted text-[11px] uppercase tracking-wider">
                Lesson Title <span className="text-[10px] text-foreground-muted/60">(Optional)</span>
              </label>
              <span className="text-[10px] text-foreground-muted">Auto-titled if blank</span>
            </div>
            <input
              type="text"
              disabled={isRecording || isProcessing}
              placeholder="e.g. Breakout Acceptance vs False Breakout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-secondary border border-border rounded-lg px-3.5 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* TEACHING SOURCE TABS */}
          <div className="space-y-3 font-mono text-xs">
            <label className="text-foreground-muted text-[11px] uppercase tracking-wider block">
              Teaching Source
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Tab 1: Upload Recording */}
              <button
                type="button"
                disabled={isRecording || isProcessing}
                onClick={() => setActiveSource('UPLOAD')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all flex flex-col space-y-1.5',
                  activeSource === 'UPLOAD'
                    ? 'bg-accent/15 border-accent text-foreground shadow-md shadow-accent/5'
                    : 'bg-surface-secondary border-border text-foreground-muted hover:text-foreground hover:bg-surface-tertiary'
                )}
              >
                <div className="flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5 text-accent" />
                  <span className="font-bold text-[11px]">Upload File</span>
                </div>
                <span className="text-[10px] text-foreground-muted font-sans leading-tight">
                  MP4, MOV, WEBM, WAV
                </span>
              </button>

              {/* Tab 2: Record Screen */}
              <button
                type="button"
                disabled={isRecording || isProcessing}
                onClick={() => setActiveSource('RECORD_SCREEN')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all flex flex-col space-y-1.5',
                  activeSource === 'RECORD_SCREEN'
                    ? 'bg-accent/15 border-accent text-foreground shadow-md shadow-accent/5'
                    : 'bg-surface-secondary border-border text-foreground-muted hover:text-foreground hover:bg-surface-tertiary'
                )}
              >
                <div className="flex items-center space-x-1.5">
                  <Monitor className="w-3.5 h-3.5 text-signal-blue" />
                  <span className="font-bold text-[11px]">Record Screen</span>
                </div>
                <span className="text-[10px] text-foreground-muted font-sans leading-tight">
                  Chart window / display
                </span>
              </button>

              {/* Tab 3: Record Screen + Voice */}
              <button
                type="button"
                disabled={isRecording || isProcessing}
                onClick={() => setActiveSource('RECORD_SCREEN_VOICE')}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all flex flex-col space-y-1.5',
                  activeSource === 'RECORD_SCREEN_VOICE'
                    ? 'bg-accent/15 border-accent text-foreground shadow-md shadow-accent/5'
                    : 'bg-surface-secondary border-border text-foreground-muted hover:text-foreground hover:bg-surface-tertiary'
                )}
              >
                <div className="flex items-center space-x-1.5">
                  <Mic className="w-3.5 h-3.5 text-signal-green" />
                  <span className="font-bold text-[11px]">Screen + Voice</span>
                </div>
                <span className="text-[10px] text-foreground-muted font-sans leading-tight">
                  Chart + Mic narration
                </span>
              </button>
            </div>
          </div>

          {/* ACTIVE SOURCE INTERFACE */}
          <div className="pt-2">
            {activeSource === 'UPLOAD' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border hover:border-accent/50 rounded-xl p-6 text-center bg-surface-secondary/40 transition-colors">
                  <input
                    type="file"
                    id="teaching-file-upload"
                    accept="video/mp4,video/webm,video/quicktime,audio/wav,audio/mpeg,audio/mp4"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label
                    htmlFor="teaching-file-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <div className="p-3 rounded-full bg-surface-tertiary text-accent">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-mono text-foreground font-semibold">
                      {uploadFile ? uploadFile.name : 'Click to select teaching video or voice file'}
                    </div>
                    <p className="text-[11px] text-foreground-muted font-sans max-w-sm">
                      Supports MP4, MOV, WEBM, WAV, MP3. The AI will automatically transcribe speech and analyze visual chart events.
                    </p>
                    {uploadFile && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-signal-green/15 text-signal-green border border-signal-green/30">
                        {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB Selected
                      </span>
                    )}
                  </label>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground text-xs font-mono border border-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!uploadFile || isProcessing}
                    onClick={handleUploadSubmit}
                    className="px-5 py-2 rounded-lg bg-accent text-background font-mono text-xs font-bold hover:bg-accent-hover transition-colors disabled:opacity-40 flex items-center space-x-1.5 shadow-md shadow-accent/10"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ingest Teaching Recording</span>
                  </button>
                </div>
              </div>
            )}

            {(activeSource === 'RECORD_SCREEN' || activeSource === 'RECORD_SCREEN_VOICE') && (
              <div className="space-y-4">
                {/* Live Video Preview Box */}
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border flex items-center justify-center">
                  <video
                    ref={videoPreviewRef}
                    className={cn('w-full h-full object-contain', !isRecording && 'hidden')}
                  />

                  {/* Interactive Drawing Overlay */}
                  {isRecording && (
                    <canvas
                      ref={drawingCanvasRef}
                      width={640}
                      height={360}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      className="absolute inset-0 w-full h-full cursor-crosshair z-10"
                    />
                  )}

                  {!isRecording && (
                    <div className="text-center p-6 space-y-2">
                      <div className="p-3 rounded-full bg-surface-tertiary text-foreground-muted inline-block">
                        {activeSource === 'RECORD_SCREEN_VOICE' ? (
                          <Mic className="w-6 h-6 text-signal-green" />
                        ) : (
                          <Monitor className="w-6 h-6 text-signal-blue" />
                        )}
                      </div>
                      <div className="text-xs font-mono text-foreground font-semibold">
                        Ready to Record{' '}
                        {activeSource === 'RECORD_SCREEN_VOICE' ? 'Screen + Microphone' : 'Screen'}
                      </div>
                      <p className="text-[11px] text-foreground-muted font-sans max-w-sm">
                        Select your TradingView chart window or trading screen. Speak and mark levels freely.
                      </p>
                    </div>
                  )}

                  {/* Recording Status HUD */}
                  {isRecording && (
                    <div className="absolute top-3 left-3 z-20 flex items-center space-x-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-xs font-mono">
                      <span className="w-2.5 h-2.5 rounded-full bg-signal-red animate-pulse" />
                      <span className="text-foreground font-bold">{formatTimer(recordingDurationSec)}</span>
                      {isPaused && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-signal-amber/20 text-signal-amber font-semibold">
                          PAUSED
                        </span>
                      )}
                    </div>
                  )}

                  {/* Audio Volume Meter (for Screen + Voice) */}
                  {isRecording && activeSource === 'RECORD_SCREEN_VOICE' && (
                    <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 bg-background/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-border text-[10px] font-mono">
                      <Mic className="w-3 h-3 text-signal-green" />
                      <div className="w-16 h-2 rounded bg-surface-tertiary overflow-hidden">
                        <div
                          className="h-full bg-signal-green transition-all duration-75"
                          style={{ width: `${audioVolume}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Drawing Toolbar Overlay */}
                  {isRecording && (
                    <div className="absolute bottom-3 left-3 z-20 flex items-center space-x-1.5 bg-background/80 backdrop-blur-md p-1 rounded-lg border border-border text-xs font-mono">
                      <span className="text-[10px] text-foreground-muted px-1.5">Draw Level:</span>
                      <button
                        type="button"
                        onClick={() => (activeDrawToolRef.current = 'LINE')}
                        className="px-2 py-0.5 rounded bg-surface-tertiary text-signal-green text-[10px] font-bold hover:bg-surface-secondary"
                      >
                        Line
                      </button>
                      <button
                        type="button"
                        onClick={() => (activeDrawToolRef.current = 'BOX')}
                        className="px-2 py-0.5 rounded bg-surface-tertiary text-signal-blue text-[10px] font-bold hover:bg-surface-secondary"
                      >
                        Box
                      </button>
                    </div>
                  )}
                </div>

                {/* Recording Controls */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] font-mono text-foreground-muted">
                    {isRecording ? (
                      <span className="flex items-center space-x-1.5 text-signal-green">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Live multi-stream capturing ({capturedEvents.drawingEvents.length} annotations marked)</span>
                      </span>
                    ) : (
                      <span>Zero manual transcript required</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isRecording ? (
                      <>
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground text-xs font-mono border border-border transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartRecording(activeSource === 'RECORD_SCREEN_VOICE')}
                          className="px-5 py-2 rounded-lg bg-accent text-background font-mono text-xs font-bold hover:bg-accent-hover transition-colors flex items-center space-x-1.5 shadow-md shadow-accent/10"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Recording</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handlePauseResume}
                          className="px-3.5 py-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground text-xs font-mono border border-border transition-colors flex items-center space-x-1.5"
                        >
                          {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          <span>{isPaused ? 'Resume' : 'Pause'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="px-5 py-2 rounded-lg bg-signal-red text-white font-mono text-xs font-bold hover:bg-signal-red/90 transition-colors flex items-center space-x-1.5 shadow-md shadow-signal-red/15"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Stop & Ingest Session</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
