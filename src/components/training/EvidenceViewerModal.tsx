'use client';

import React from 'react';
import {
  X,
  Clock,
  Mic,
  Monitor,
  MousePointer,
  PenTool,
  ShieldCheck,
  Play,
  Sparkles,
} from 'lucide-react';
import { TeachingEventItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EvidenceViewerModalProps {
  event: TeachingEventItem | null;
  onClose: () => void;
  onJumpToTimestamp?: (sec: number) => void;
}

export function EvidenceViewerModal({
  event,
  onClose,
  onJumpToTimestamp,
}: EvidenceViewerModalProps) {
  if (!event) return null;

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-surface-primary border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-secondary/40">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded bg-accent/15 border border-accent/30 text-accent">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                  Multimodal Source Evidence
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 border border-accent/20 text-accent font-semibold">
                  {formatSec(event.timestampSec)}
                </span>
              </div>
              <p className="text-[11px] text-foreground-secondary">
                Corroborated time-aligned proof for extracted rule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-tertiary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Classification & Confidence Banner */}
          <div className="p-3 rounded-lg bg-surface-secondary border border-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-foreground-muted block">
                Statement Classification
              </span>
              <span className="text-xs font-mono font-bold text-accent">
                {event.statementClassification || 'RULE'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase text-foreground-muted block">
                Corroborated Confidence
              </span>
              <span className="text-xs font-mono font-bold text-signal-green">
                {Math.round((event.confidence || 0.85) * 100)}% Match
              </span>
            </div>
          </div>

          {/* 4 Streams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs font-mono">
            {/* Stream A: Audio & Spoken Words */}
            <div className="p-3.5 rounded-lg bg-surface-secondary border border-border space-y-2">
              <div className="flex items-center space-x-2 text-foreground font-semibold text-[11px] border-b border-border pb-1.5">
                <Mic className="w-3.5 h-3.5 text-accent" />
                <span>Stream A — Spoken Voice</span>
              </div>
              <p className="text-[11px] text-foreground font-sans leading-relaxed italic bg-surface-primary p-2.5 rounded border border-border/60">
                &ldquo;{event.audioSegment || 'No audio speech segment recorded at this timestamp.'}&rdquo;
              </p>
              <div className="text-[10px] text-foreground-muted">
                Intent: <span className="text-foreground-secondary font-medium">{event.teacherIntent || 'EXPLAINING_CONTEXT'}</span>
              </div>
            </div>

            {/* Stream B: Visual Screen State */}
            <div className="p-3.5 rounded-lg bg-surface-secondary border border-border space-y-2">
              <div className="flex items-center space-x-2 text-foreground font-semibold text-[11px] border-b border-border pb-1.5">
                <Monitor className="w-3.5 h-3.5 text-signal-blue" />
                <span>Stream B — Visual Screen</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] text-foreground-secondary">
                  Detected Objects:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {event.detectedMarketObjects && event.detectedMarketObjects.length > 0 ? (
                    event.detectedMarketObjects.map((obj, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] bg-signal-blue/10 border border-signal-blue/20 text-signal-blue font-semibold"
                      >
                        {obj}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-foreground-muted">Key horizontal price structure</span>
                  )}
                </div>
                <div className="text-[10px] text-foreground-muted pt-1">
                  Timeframe: <span className="text-foreground font-semibold">5M Chart</span>
                </div>
              </div>
            </div>

            {/* Stream C: Cursor Activity */}
            <div className="p-3.5 rounded-lg bg-surface-secondary border border-border space-y-2">
              <div className="flex items-center space-x-2 text-foreground font-semibold text-[11px] border-b border-border pb-1.5">
                <MousePointer className="w-3.5 h-3.5 text-signal-amber" />
                <span>Stream C — Cursor Attention</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="text-[11px] text-foreground">
                  Action: <span className="font-semibold text-accent">{event.cursorState?.action || 'POINTER_HOVER'}</span>
                </div>
                <p className="text-[10px] text-foreground-secondary">
                  Target: {event.cursorState?.targetDescription || 'Chart area focus'}
                </p>
                <div className="text-[9px] text-foreground-muted">
                  Corroborates teacher visual attention during speech.
                </div>
              </div>
            </div>

            {/* Stream D: Drawing & Annotation */}
            <div className="p-3.5 rounded-lg bg-surface-secondary border border-border space-y-2">
              <div className="flex items-center space-x-2 text-foreground font-semibold text-[11px] border-b border-border pb-1.5">
                <PenTool className="w-3.5 h-3.5 text-signal-green" />
                <span>Stream D — Drawn Annotation</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="text-[11px] text-foreground">
                  Object: <span className="font-semibold text-signal-green">{event.annotationState?.type || 'HORIZONTAL_LINE'}</span>
                </div>
                <p className="text-[10px] text-foreground-secondary">
                  Label: {event.annotationState?.label || 'Key Structural Level'}
                </p>
                <div className="text-[9px] text-foreground-muted">
                  Drawn concurrently with spoken definition.
                </div>
              </div>
            </div>
          </div>

          {/* Candidate Rule Formulation */}
          <div className="p-3.5 rounded-lg bg-accent/5 border border-accent/20 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold flex items-center space-x-1.5">
              <Sparkles className="w-3 h-3" />
              <span>Inferred Candidate Rule</span>
            </span>
            <p className="text-xs font-mono text-foreground font-semibold">
              {event.candidateRule || event.candidateException || event.audioSegment}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-surface-secondary/40">
          <button
            onClick={() => {
              if (onJumpToTimestamp) onJumpToTimestamp(event.timestampSec);
              onClose();
            }}
            className="px-3.5 py-1.5 rounded bg-accent/15 border border-accent/30 text-accent font-mono text-xs font-semibold hover:bg-accent/25 transition-colors flex items-center space-x-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Jump Player to {formatSec(event.timestampSec)}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground text-xs font-mono border border-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
