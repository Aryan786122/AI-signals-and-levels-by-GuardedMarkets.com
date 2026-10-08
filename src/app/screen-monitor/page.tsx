'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MonitorPlay,
  Play,
  Pause,
  Square,
  Activity,
  AlertCircle,
  Eye,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ScreenReasoningOutput, ObservedScreenFact } from '@/lib/types/screenPerception';
import { WhyProvenanceModal } from '@/components/overlay/WhyProvenanceModal';
import { cn } from '@/lib/utils';

export default function ScreenMonitorPage() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [diffThreshold, setDiffThreshold] = useState(8); // 8% pixel difference
  const [intervalSec, setIntervalSec] = useState(3);
  const [latestDiff, setLatestDiff] = useState<number>(0);
  const [screenReasoning, setScreenReasoning] = useState<ScreenReasoningOutput | null>(null);
  const [observedFact, setObservedFact] = useState<ObservedScreenFact | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [totalCaptures, setTotalCaptures] = useState(0);
  const [meaningfulChanges, setMeaningfulChanges] = useState(0);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [eventLogs, setEventLogs] = useState<
    Array<{ id: string; time: string; type: string; diff: number; description: string }>
  >([]);

  // Manual test override controls
  const [testSymbol, setTestSymbol] = useState('BTCUSD');
  const [testTimeframe, setTestTimeframe] = useState('5M');
  const [testPrice, setTestPrice] = useState('80265.0');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevImageDataRef = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCapturing(true);
      setIsPaused(false);

      stream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

      startIntervalLoop();
    } catch (err) {
      console.warn('Screen capture cancelled or not allowed:', err);
    }
  };

  const stopCapture = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
    setIsPaused(false);
    prevImageDataRef.current = null;
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const startIntervalLoop = () => {
    if (intervalIdRef.current) clearInterval(intervalIdRef.current);

    intervalIdRef.current = setInterval(async () => {
      if (!isCapturing || isPaused) return;
      await processFrame();
    }, intervalSec * 1000);
  };

  // Run screen perception with active frame or manual context
  const runPerception = async (imageBase64?: string) => {
    setIsAnalyzing(true);
    try {
      const payload: any = {};
      if (imageBase64) {
        payload.imageBase64 = imageBase64;
      } else {
        payload.manualContext = {
          symbol: testSymbol,
          timeframe: testTimeframe,
          price: parseFloat(testPrice) || 80265.0,
        };
      }

      const res = await fetch('/api/screen/perceive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.reasoning) setScreenReasoning(json.reasoning);
        if (json.observation) setObservedFact(json.observation);
      }
    } catch (err) {
      console.error('Screen perception failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Change Detection Algorithm (Pixel diff without expensive calls)
  const processFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sample down to 160x90 for fast local pixel diffing
    canvas.width = 160;
    canvas.height = 90;
    ctx.drawImage(video, 0, 0, 160, 90);

    const currentImg = ctx.getImageData(0, 0, 160, 90);
    const currData = currentImg.data;
    setTotalCaptures((c) => c + 1);

    if (!prevImageDataRef.current) {
      prevImageDataRef.current = new Uint8ClampedArray(currData);
      // Run initial perception on start
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = video.videoWidth || 1280;
      snapCanvas.height = video.videoHeight || 720;
      const snapCtx = snapCanvas.getContext('2d');
      if (snapCtx) {
        snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
        const b64 = snapCanvas.toDataURL('image/jpeg', 0.75);
        runPerception(b64);
      }
      return;
    }

    let diffCount = 0;
    const totalPixels = currData.length / 4;
    const prevData = prevImageDataRef.current;

    for (let i = 0; i < currData.length; i += 4) {
      const rDiff = Math.abs(currData[i] - prevData[i]);
      const gDiff = Math.abs(currData[i + 1] - prevData[i + 1]);
      const bDiff = Math.abs(currData[i + 2] - prevData[i + 2]);
      if (rDiff + gDiff + bDiff > 45) {
        diffCount++;
      }
    }

    const diffPercent = Number(((diffCount / totalPixels) * 100).toFixed(1));
    setLatestDiff(diffPercent);
    prevImageDataRef.current = new Uint8ClampedArray(currData);

    // If change exceeds threshold, trigger frame perception
    if (diffPercent >= diffThreshold) {
      setMeaningfulChanges((m) => m + 1);

      const nowStr = new Date().toLocaleTimeString();
      setEventLogs((prev) => [
        {
          id: `ev_${Date.now()}`,
          time: nowStr,
          type: 'CHART_UPDATE',
          diff: diffPercent,
          description: `Visual update detected (${diffPercent}% pixel difference). Reasoned over screen context.`,
        },
        ...prev.slice(0, 19),
      ]);

      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = video.videoWidth || 1280;
      snapCanvas.height = video.videoHeight || 720;
      const snapCtx = snapCanvas.getContext('2d');
      if (snapCtx) {
        snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
        const b64 = snapCanvas.toDataURL('image/jpeg', 0.75);
        runPerception(b64);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background font-mono text-xs">
      <Header
        title="Screen Monitor & Continuous Visual Analyzer"
        subtitle="Live desktop frame perception with top-down procedure reasoning"
        actions={
          <div className="flex items-center space-x-2">
            {!isCapturing ? (
              <button
                onClick={startCapture}
                className="px-3 py-1.5 rounded font-semibold bg-accent text-background hover:bg-accent-hover transition-colors flex items-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Screen Capture</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).electronAPI?.openOverlay) {
                      (window as any).electronAPI.openOverlay();
                    } else if (typeof window !== 'undefined' && (window as any).electron?.send) {
                      (window as any).electron.send('open-overlay');
                    } else {
                      alert(
                        'Trading AI Screen Overlay is a native Windows application.\n\n' +
                        'Press Ctrl + Shift + A to display the transparent floating AI HUD directly over TradingView.'
                      );
                    }
                  }}
                  className="px-3 py-1.5 rounded font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors flex items-center space-x-1.5 shadow-sm"
                  title="Launch native floating HUD over TradingView (Ctrl+Shift+A)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-pulse" />
                  <span>Desktop HUD (Ctrl+Shift+A)</span>
                </button>
                <button
                  onClick={togglePause}
                  className="px-3 py-1.5 rounded font-medium bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  onClick={stopCapture}
                  className="px-3 py-1.5 rounded font-medium bg-signal-red/20 text-signal-red hover:bg-signal-red/30 border border-signal-red/30 transition-colors flex items-center space-x-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop Monitoring</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Column: Live Screen Capture View (7 cols) */}
        <div className="col-span-7 border-r border-border bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-6 space-y-6">
          {/* Active Status Bar */}
          <div className="flex items-center justify-between p-3 rounded bg-surface-secondary border border-border">
            <div className="flex items-center space-x-2">
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full inline-block',
                  isCapturing && !isPaused
                    ? 'bg-signal-green animate-pulse'
                    : isPaused
                    ? 'bg-signal-amber'
                    : 'bg-foreground-muted'
                )}
              />
              <span className="font-semibold text-foreground">
                {isCapturing
                  ? isPaused
                    ? 'CAPTURE PAUSED'
                    : 'LIVE SCREEN MONITORING'
                  : 'READY TO OBSERVE'}
              </span>
            </div>

            <div className="flex items-center space-x-4 text-foreground-secondary text-[11px]">
              <span>Frames: {totalCaptures}</span>
              <span>Events: {meaningfulChanges}</span>
            </div>
          </div>

          {/* Screen Video Container */}
          <div className="relative aspect-video rounded-xl border border-border bg-background overflow-hidden flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn('w-full h-full object-contain', !isCapturing && 'hidden')}
            />

            {!isCapturing && (
              <div className="text-center space-y-3 p-8">
                <MonitorPlay className="w-12 h-12 text-foreground-muted mx-auto" />
                <p className="font-semibold text-foreground">
                  Select your TradingView chart window or screen region
                </p>
                <p className="text-[11px] text-foreground-muted max-w-sm">
                  Trading AI observes your screen as a student, detects your active timeframe & drawings, and reasons using teacher-taught procedures.
                </p>
                <button
                  onClick={startCapture}
                  className="px-4 py-2 rounded bg-accent text-background font-semibold hover:bg-accent-hover transition-colors inline-block"
                >
                  Select Screen Region
                </button>
              </div>
            )}

            {/* Hidden canvas for pixel diffing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Analyzing overlay */}
            {isAnalyzing && (
              <div className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-background/90 border border-accent text-accent text-[10px] flex items-center space-x-1.5 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Perceiving Screen...</span>
              </div>
            )}
          </div>

          {/* Controls: Change Sensitivity & Manual Context Tester */}
          <div className="p-4 rounded-xl border border-border bg-surface-secondary space-y-4">
            <div className="flex items-center justify-between text-foreground font-semibold uppercase text-[11px] border-b border-border pb-2">
              <div className="flex items-center space-x-2">
                <Sliders className="w-3.5 h-3.5 text-accent" />
                <span>Screen Context & Perception Simulator</span>
              </div>
              <button
                onClick={() => runPerception()}
                className="px-2.5 py-1 rounded bg-accent text-background font-bold text-[10px] hover:bg-accent-hover transition-colors"
              >
                Evaluate Context
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-foreground-muted text-[10px] mb-1">Symbol:</label>
                <select
                  value={testSymbol}
                  onChange={(e) => setTestSymbol(e.target.value)}
                  className="w-full bg-surface-primary border border-border rounded px-2 py-1 text-foreground font-bold focus:outline-none"
                >
                  <option value="BTCUSD">BTCUSD</option>
                  <option value="XAUUSD">XAUUSD</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground-muted text-[10px] mb-1">Timeframe:</label>
                <select
                  value={testTimeframe}
                  onChange={(e) => setTestTimeframe(e.target.value)}
                  className="w-full bg-surface-primary border border-border rounded px-2 py-1 text-foreground font-bold focus:outline-none"
                >
                  <option value="5M">5M (Procedure Active)</option>
                  <option value="30M">30M (Observing Mode)</option>
                  <option value="4H">4H (HTF Level)</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground-muted text-[10px] mb-1">Price:</label>
                <input
                  type="text"
                  value={testPrice}
                  onChange={(e) => setTestPrice(e.target.value)}
                  className="w-full bg-surface-primary border border-border rounded px-2 py-1 text-foreground font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div>
                <label className="block text-foreground-muted text-[11px] mb-1">
                  Change Diff Threshold: <strong className="text-foreground">{diffThreshold}%</strong>
                </label>
                <input
                  type="range"
                  min="2"
                  max="25"
                  value={diffThreshold}
                  onChange={(e) => setDiffThreshold(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              <div>
                <label className="block text-foreground-muted text-[11px] mb-1">
                  Sampling Frequency: <strong className="text-foreground">{intervalSec}s</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={intervalSec}
                  onChange={(e) => {
                    setIntervalSec(Number(e.target.value));
                    if (isCapturing) startIntervalLoop();
                  }}
                  className="w-full accent-accent"
                />
              </div>
            </div>
          </div>

          {/* Event Stream Log */}
          <div className="p-4 rounded-xl border border-border bg-surface-secondary space-y-2">
            <div className="flex items-center justify-between text-foreground font-semibold text-[11px] uppercase border-b border-border pb-1.5">
              <span>Perception Event Stream</span>
              <span className="text-[10px] text-foreground-muted">{eventLogs.length} events</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {eventLogs.length > 0 ? (
                eventLogs.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2 rounded bg-surface-primary border border-border/60 flex items-start justify-between text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-accent font-semibold">{ev.type}</span>
                        <span className="text-foreground-muted text-[10px]">({ev.diff}% diff)</span>
                      </div>
                      <p className="text-foreground-secondary text-[10px]">{ev.description}</p>
                    </div>
                    <span className="text-foreground-muted text-[10px]">{ev.time}</span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-foreground-muted text-[11px]">
                  No frame change events triggered yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live AI Reasoner Feedback (5 cols) */}
        <div className="col-span-5 bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-6 space-y-6">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Screen-First Teaching AI Reasoner
              </h3>
              <p className="text-[10px] text-foreground-muted">
                Student sitting beside the teacher watching the screen
              </p>
            </div>
            {screenReasoning && (
              <button
                onClick={() => setShowWhyModal(true)}
                className="px-2 py-1 rounded bg-accent text-background font-bold text-[10px] hover:bg-accent-hover transition-colors flex items-center space-x-1"
              >
                <HelpCircle className="w-3 h-3" />
                <span>[WHY?]</span>
              </button>
            )}
          </div>

          {screenReasoning ? (
            <div className="space-y-4">
              {/* Observed Screen Facts Strip */}
              <div className="p-3.5 rounded-xl bg-surface-secondary border border-border space-y-2">
                <span className="text-[10px] text-foreground-muted uppercase font-bold tracking-wider">
                  Observed Screen Context
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-foreground-muted">Symbol: </span>
                    <strong className="text-foreground">
                      {observedFact?.symbol || testSymbol}
                    </strong>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Timeframe: </span>
                    <strong className="text-foreground">
                      {observedFact?.timeframe || testTimeframe}
                    </strong>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Price: </span>
                    <strong className="text-foreground">
                      ${observedFact?.currentPrice ? observedFact.currentPrice.toFixed(1) : testPrice}
                    </strong>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Methodology: </span>
                    <strong
                      className={cn(
                        screenReasoning.methodologyState === 'TAUGHT'
                          ? 'text-signal-green'
                          : 'text-sky-400'
                      )}
                    >
                      {screenReasoning.methodologyState === 'TAUGHT' ? 'TEACHER TAUGHT' : 'NONE TAUGHT'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* CASE 1: Procedure Active */}
              {screenReasoning.status === 'PROCEDURE_ACTIVE' && screenReasoning.activeProcedure && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Teacher Procedure Triggered
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      STEP {screenReasoning.activeProcedure.stepOrder}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-foreground">
                    {screenReasoning.activeProcedure.title}
                  </div>

                  <div className="p-3 rounded-lg bg-accent/15 border border-accent/40 space-y-1">
                    <span className="text-[9px] text-accent font-bold uppercase tracking-wider block">
                      Prescribed Next Action
                    </span>
                    <div className="flex items-center space-x-2 text-foreground font-bold text-sm">
                      <ArrowRight className="w-4 h-4 text-accent animate-pulse flex-shrink-0" />
                      <span>{screenReasoning.nextAction}</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
                      Rationale & Rule:
                    </span>
                    <p className="text-foreground-secondary text-xs font-sans leading-relaxed">
                      {screenReasoning.actionReason}
                    </p>
                  </div>
                </div>
              )}

              {/* CASE 2: Untaught / Observing Mode */}
              {screenReasoning.status === 'OBSERVING' && (
                <div className="p-4 rounded-xl bg-surface-secondary border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                      Status: Observing (Empty-by-Default)
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30">
                      UNTAUGHT
                    </span>
                  </div>

                  <p className="text-foreground-secondary text-xs font-sans leading-relaxed">
                    No teacher methodology or procedure defined for this chart timeframe or setup yet.
                  </p>

                  <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Student Question to Teacher</span>
                    </div>
                    <p className="text-xs font-sans font-semibold text-foreground">
                      {screenReasoning.teacherPromptQuestion}
                    </p>
                  </div>
                </div>
              )}

              {/* CASE 3: Level Proximity Monitoring */}
              {screenReasoning.status === 'LEVEL_MONITORING' && screenReasoning.matchedLevel && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-sm">
                      {screenReasoning.matchedLevel.name}
                    </span>
                    <span className="text-xs text-amber-400 font-bold px-2 py-0.5 rounded bg-surface-tertiary">
                      {screenReasoning.matchedLevel.priceZoneStr}
                    </span>
                  </div>

                  <p className="text-xs text-foreground-secondary font-sans leading-relaxed">
                    {screenReasoning.matchedLevel.whyRelevant}
                  </p>

                  <div className="p-2 rounded bg-accent/10 border border-accent/30 flex items-center justify-between text-[11px]">
                    <span className="text-accent font-bold uppercase">Expected Behavior:</span>
                    <span className="font-semibold text-foreground text-right">
                      {screenReasoning.expectedBehavior}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {screenReasoning.conditionsPresent.map((c, i) => (
                      <div key={i} className="flex items-center space-x-1.5 text-signal-green">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-sans text-foreground-secondary">{c}</span>
                      </div>
                    ))}
                    {screenReasoning.missingConditions.map((m, i) => (
                      <div key={i} className="flex items-center space-x-1.5 text-signal-amber">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-sans text-foreground-secondary">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Has NOT Been Taught (Honest Scope Limits) */}
              <div className="p-3.5 rounded-xl bg-surface-secondary/70 border border-border/70 space-y-2">
                <span className="text-[10px] text-foreground-muted uppercase font-bold tracking-wider">
                  Honest Scope Boundaries (Not Taught)
                </span>
                <ul className="space-y-1 text-foreground-secondary text-[11px] font-sans">
                  {screenReasoning.notTaught.map((nt, i) => (
                    <li key={i} className="flex items-start space-x-1.5 text-foreground-muted">
                      <span>&bull;</span>
                      <span>{nt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-foreground-muted space-y-3">
              <Eye className="w-8 h-8 mx-auto text-foreground-muted" />
              <p>Start screen capture or click &quot;Evaluate Context&quot; to inspect screen perception.</p>
            </div>
          )}
        </div>
      </div>

      {/* Why Modal */}
      {screenReasoning && (
        <WhyProvenanceModal
          isOpen={showWhyModal}
          onClose={() => setShowWhyModal(false)}
          provenance={screenReasoning.provenance}
          currentPrice={observedFact?.currentPrice || parseFloat(testPrice)}
          matchedLevelName={screenReasoning.matchedLevel?.name}
          expectedBehavior={screenReasoning.expectedBehavior}
          state={screenReasoning.status as any}
          bias="UNDEFINED"
        />
      )}
    </div>
  );
}
