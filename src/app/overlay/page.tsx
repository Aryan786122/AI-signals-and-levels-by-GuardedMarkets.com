'use client';

import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  ExternalLink,
  X,
  ArrowRight,
  Eye,
  GraduationCap,
  Settings,
  Minimize2,
  Maximize2,
  CheckCircle2,
  XCircle,
  Radio,
} from 'lucide-react';
import { MarketEvaluationState } from '@/lib/types/adaptive';
import { ScreenReasoningOutput, ObservedScreenFact } from '@/lib/types/screenPerception';
import { WhyProvenanceModal } from '@/components/overlay/WhyProvenanceModal';
import { cn } from '@/lib/utils';

export default function DesktopOverlayHUD() {
  const [isAiActive, setIsAiActive] = useState(true);
  const [isTeachingMode, setIsTeachingMode] = useState(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);

  // Perceived context & reasoning
  const [symbol, setSymbol] = useState('BTCUSD');
  const [timeframe, setTimeframe] = useState('5M');
  const [simulatedPrice, setSimulatedPrice] = useState<number>(80265.0);
  const [screenReasoning, setScreenReasoning] = useState<ScreenReasoningOutput | null>(null);
  const [observedFact, setObservedFact] = useState<ObservedScreenFact | null>(null);
  const [evaluation, setEvaluation] = useState<MarketEvaluationState | null>(null);

  // 1. Electron IPC Listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const api = (window as any).electronAPI;

      // Real-time background perception update
      const unsubPerception = api.onScreenPerceptionUpdate?.((data: any) => {
        if (data.reasoning) setScreenReasoning(data.reasoning);
        if (data.observation) {
          setObservedFact(data.observation);
          if (data.observation.symbol && data.observation.symbol !== 'UNKNOWN') {
            setSymbol(data.observation.symbol);
          }
          if (data.observation.timeframe && data.observation.timeframe !== 'UNKNOWN') {
            setTimeframe(data.observation.timeframe);
          }
          if (typeof data.observation.currentPrice === 'number') {
            setSimulatedPrice(data.observation.currentPrice);
          }
        }
      });

      // Global hotkey: Teaching mode toggle (Ctrl+Shift+T)
      const unsubTeaching = api.onTeachingModeToggle?.((data: any) => {
        setIsTeachingMode(Boolean(data.isTeachingMode));
      });

      // Global hotkey: HUD visibility toggle (Ctrl+Shift+H)
      const unsubHud = api.onHudVisibilityToggle?.(() => {
        setIsHudCollapsed((prev) => !prev);
      });

      return () => {
        if (unsubPerception) unsubPerception();
        if (unsubTeaching) unsubTeaching();
        if (unsubHud) unsubHud();
      };
    }
  }, []);

  // 2. Poll fallback for state & levels
  const fetchOverlayState = async () => {
    try {
      const res = await fetch(
        `/api/overlay/state?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&price=${simulatedPrice}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.evaluation) setEvaluation(json.evaluation);
        if (json.screenReasoning && !observedFact) setScreenReasoning(json.screenReasoning);
        if (json.observation && !observedFact) setObservedFact(json.observation);
      }
    } catch (err) {
      console.warn('Overlay state fetch failed:', err);
    }
  };

  useEffect(() => {
    fetchOverlayState();
    const interval = setInterval(fetchOverlayState, 2500);
    return () => clearInterval(interval);
  }, [symbol, timeframe, simulatedPrice]);

  // Controls actions
  const handleOpenWorkstation = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI?.openMainWindow) {
        (window as any).electronAPI.openMainWindow('/');
      } else {
        window.open('/', '_blank');
      }
    }
  };

  const handleOpenSourceLesson = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI?.openMainWindow) {
        (window as any).electronAPI.openMainWindow('/training');
      } else {
        window.open('/training', '_blank');
      }
    }
  };

  const handleToggleTeaching = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleTeachingSession) {
      (window as any).electronAPI.toggleTeachingSession();
    } else {
      setIsTeachingMode(!isTeachingMode);
    }
  };

  const handleHideOverlay = () => {
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI?.hideOverlay) {
        (window as any).electronAPI.hideOverlay();
      } else if ((window as any).electronAPI?.closeOverlay) {
        (window as any).electronAPI.closeOverlay();
      }
    }
  };

  return (
    <div
      className="w-full h-screen bg-[#090B0F] select-none overflow-hidden flex flex-col font-mono text-xs border border-white/20 shadow-2xl"
    >
      {/* Native Draggable Window Header */}
      <div
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="px-3.5 py-2.5 bg-[#121824] border-b border-white/10 flex items-center justify-between cursor-move select-none flex-shrink-0"
        >
          <div className="flex items-center space-x-2">
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full inline-block flex-shrink-0',
                isAiActive
                  ? screenReasoning?.status === 'PROCEDURE_ACTIVE'
                    ? 'bg-signal-green shadow-[0_0_8px_rgba(34,197,94,0.7)] animate-pulse'
                    : screenReasoning?.status === 'LEVEL_MONITORING'
                    ? 'bg-signal-amber shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse'
                    : 'bg-accent shadow-[0_0_8px_rgba(56,189,248,0.7)] animate-pulse'
                  : 'bg-foreground-muted'
              )}
            />
            <span className="font-bold text-foreground text-xs tracking-wider uppercase">
              Guarded AI
            </span>
            <span
              className={cn(
                'text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider',
                screenReasoning?.status === 'PROCEDURE_ACTIVE'
                  ? 'bg-signal-green/10 text-signal-green border-signal-green/30'
                  : screenReasoning?.status === 'LEVEL_MONITORING'
                  ? 'bg-signal-amber/10 text-signal-amber border-signal-amber/30'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              )}
            >
              {screenReasoning?.status === 'PROCEDURE_ACTIVE'
                ? 'PROCEDURE'
                : screenReasoning?.status === 'LEVEL_MONITORING'
                ? 'ZONE'
                : 'OBSERVING'}
            </span>
          </div>

          {/* Action Controls (no-drag) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center space-x-1"
          >
            {/* AI Toggle */}
            <button
              onClick={() => setIsAiActive(!isAiActive)}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center space-x-1',
                isAiActive
                  ? 'bg-signal-green/15 text-signal-green border-signal-green/30 hover:bg-signal-green/25'
                  : 'bg-surface-secondary text-foreground-muted border-border hover:text-foreground'
              )}
              title={isAiActive ? 'Click to Pause AI' : 'Click to Activate AI'}
            >
              <span>{isAiActive ? 'ON' : 'PAUSED'}</span>
            </button>

            {/* Quick Observe */}
            <button
              onClick={() => fetchOverlayState()}
              className="p-1.5 rounded-md hover:bg-white/10 text-foreground-muted hover:text-foreground transition-colors"
              title="Scan Active Screen Now"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {/* Teaching Mode Toggle */}
            <button
              onClick={handleToggleTeaching}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isTeachingMode
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  : 'hover:bg-white/10 text-foreground-muted hover:text-foreground'
              )}
              title="Toggle Teaching Mode (Ctrl+Shift+T)"
            >
              <GraduationCap className="w-3.5 h-3.5" />
            </button>

            {/* Teacher Workstation */}
            <button
              onClick={handleOpenWorkstation}
              className="p-1.5 rounded-md hover:bg-white/10 text-foreground-muted hover:text-foreground transition-colors"
              title="Open Teacher Workstation Window"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Collapse/Expand */}
            <button
              onClick={() => setIsHudCollapsed(!isHudCollapsed)}
              className="p-1.5 rounded-md hover:bg-white/10 text-foreground-muted hover:text-foreground transition-colors"
              title={isHudCollapsed ? 'Expand Assistant Card (Ctrl+Shift+H)' : 'Collapse Assistant Card (Ctrl+Shift+H)'}
            >
              {isHudCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close / Hide Window */}
            <button
              onClick={handleHideOverlay}
              className="p-1.5 rounded-md hover:bg-rose-500/20 text-foreground-muted hover:text-rose-400 transition-colors"
              title="Hide Assistant (Press Ctrl+Shift+A to restore)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Teaching Mode Active Banner */}
        {isTeachingMode && (
          <div className="px-3 py-2 bg-rose-950/80 border-b border-rose-500/50 flex items-center justify-between text-rose-300 text-[11px] font-bold flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-ping flex-shrink-0" />
              <span>TEACHING MODE ACTIVE</span>
            </div>
            <button
              onClick={handleToggleTeaching}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="px-2 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50 text-white text-[10px] transition-colors"
            >
              Finish & Save
            </button>
          </div>
        )}

        {/* Level Proximity Alert Banner */}
        {screenReasoning?.status === 'LEVEL_MONITORING' && screenReasoning.matchedLevel && (
          <div className="px-3 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-amber-300 text-[11px] font-bold flex-shrink-0">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="truncate">LEVEL: {screenReasoning.matchedLevel.name}</span>
            </div>
            <span className="font-mono text-white text-[10px] ml-2 flex-shrink-0">
              [{screenReasoning.matchedLevel.priceZoneStr}]
            </span>
          </div>
        )}

        {/* Collapsed Mode */}
        {isHudCollapsed ? (
          <div className="p-3 text-center text-foreground-muted flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-signal-green animate-pulse" />
              <span className="text-foreground text-xs font-semibold">Guarded AI Floating</span>
            </div>
            <button
              onClick={() => setIsHudCollapsed(false)}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="text-xs text-accent hover:underline flex items-center space-x-1"
            >
              <span>Expand</span>
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          /* Assistant Body (Scrollable) */
          <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-3">
            {/* Screen Observation Context Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span className="text-[9px] text-foreground-muted uppercase font-bold">Observed:</span>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-surface-secondary border border-border/80 rounded px-1.5 py-0.5 text-foreground font-bold focus:outline-none text-[11px]"
                >
                  <option value="BTCUSD">BTCUSD</option>
                  <option value="XAUUSD">XAUUSD</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>

                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="bg-surface-secondary border border-border/80 rounded px-1.5 py-0.5 text-foreground font-semibold focus:outline-none text-[11px]"
                >
                  <option value="5M">5M</option>
                  <option value="30M">30M</option>
                  <option value="4H">4H</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </div>

              <div className="text-right">
                <span className="font-bold text-foreground text-xs">
                  ${evaluation?.currentPrice ? evaluation.currentPrice.toFixed(1) : simulatedPrice.toFixed(1)}
                </span>
              </div>
            </div>

            {/* CASE 1: Procedure Active */}
            {screenReasoning?.status === 'PROCEDURE_ACTIVE' && screenReasoning.activeProcedure && (
              <div className="space-y-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                      TEACHER PROCEDURE
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      TAUGHT
                    </span>
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {screenReasoning.activeProcedure.title}
                  </div>
                </div>

                {/* NEXT ACTION */}
                <div className="p-3 rounded-xl bg-accent/15 border border-accent/40 space-y-1">
                  <span className="text-[9px] text-accent font-bold uppercase tracking-wider block">
                    NEXT ACTION
                  </span>
                  <div className="flex items-center space-x-1.5 text-foreground font-bold text-xs">
                    <ArrowRight className="w-4 h-4 text-accent flex-shrink-0 animate-pulse" />
                    <span>{screenReasoning.nextAction}</span>
                  </div>
                </div>

                {/* REASON */}
                <div className="p-2.5 rounded-xl bg-surface-secondary/70 border border-border/70 space-y-1">
                  <span className="text-[9px] text-foreground-muted uppercase tracking-wider block">
                    REASON
                  </span>
                  <p className="text-[11px] text-foreground-secondary font-sans leading-relaxed">
                    {screenReasoning.actionReason}
                  </p>
                </div>
              </div>
            )}

            {/* CASE 2: Untaught Context (Observing Mode) */}
            {(!screenReasoning || screenReasoning.status === 'OBSERVING') && (
              <div className="space-y-2.5">
                <div className="p-2.5 rounded-xl bg-surface-secondary/80 border border-border/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider">
                      STATUS: OBSERVING
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30">
                      EMPTY
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-secondary font-sans">
                    No teacher methodology defined for this timeframe or setup yet.
                  </p>
                </div>

                {/* QUESTION TO TEACHER */}
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>STUDENT QUESTION</span>
                  </div>
                  <p className="text-[11px] font-sans font-semibold text-foreground leading-snug">
                    {screenReasoning?.teacherPromptQuestion ||
                      'How do you normally analyze this situation?'}
                  </p>
                </div>
              </div>
            )}

            {/* CASE 3: Level Proximity Monitoring */}
            {screenReasoning?.status === 'LEVEL_MONITORING' && screenReasoning.matchedLevel && (
              <div className="space-y-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-xs">
                      {screenReasoning.matchedLevel.name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-surface-tertiary">
                      {screenReasoning.matchedLevel.priceZoneStr}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground-secondary font-sans leading-relaxed">
                    {screenReasoning.matchedLevel.whyRelevant}
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between text-[10px]">
                  <span className="text-accent font-bold uppercase">EXPECTED:</span>
                  <span className="font-semibold text-foreground text-right text-[11px]">
                    {screenReasoning.expectedBehavior || 'POTENTIAL REACTION'}
                  </span>
                </div>

                <div className="space-y-1 text-[10px]">
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

                <div className="p-2 rounded bg-surface-secondary/60 border border-border/70 space-y-0.5 text-[9px]">
                  <div className="flex items-center justify-between text-foreground-muted">
                    <span>ENTRY:</span>
                    <span className="text-foreground font-semibold">NOT DEFINED</span>
                  </div>
                  <div className="flex items-center justify-between text-foreground-muted">
                    <span>STOP:</span>
                    <span className="text-foreground font-semibold">NOT DEFINED</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons: [WHY?] & [SOURCE] */}
            <div className="pt-1 flex items-center space-x-2">
              <button
                onClick={() => setShowWhyModal(true)}
                className="flex-1 py-2 rounded-lg bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>[WHY]</span>
              </button>

              <button
                onClick={handleOpenSourceLesson}
                className="flex-1 py-2 rounded-lg bg-surface-secondary border border-border text-foreground hover:bg-surface-tertiary text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                title="Open teaching lesson in main workstation"
              >
                <span>[SOURCE]</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

      {/* Auditable Why Provenance Modal */}
      <WhyProvenanceModal
        isOpen={showWhyModal}
        onClose={() => setShowWhyModal(false)}
        provenance={screenReasoning?.provenance || evaluation?.provenance}
        currentPrice={evaluation?.currentPrice}
        matchedLevelName={screenReasoning?.matchedLevel?.name || evaluation?.matchedLevel?.name}
        expectedBehavior={screenReasoning?.expectedBehavior || evaluation?.expectedBehavior}
        state={evaluation?.state}
        bias={evaluation?.bias}
      />
    </div>
  );
}
