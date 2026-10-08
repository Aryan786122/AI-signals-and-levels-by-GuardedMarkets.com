'use client';

import React from 'react';
import {
  X,
  Clock,
  Monitor,
  MousePointer,
  PenTool,
  Type,
  TrendingUp,
  Layers,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisualObservation } from '@/lib/types/cognitive';

interface FrameInspectorModalProps {
  frame: {
    id: string;
    timestampSec: number;
    filePath: string;
    screenType?: string | null;
    analysis?: any;
  } | null;
  onClose: () => void;
  onJumpToTimestamp: (sec: number) => void;
}

export function FrameInspectorModal({
  frame,
  onClose,
  onJumpToTimestamp,
}: FrameInspectorModalProps) {
  if (!frame) return null;

  let obs: Partial<VisualObservation> | null = null;
  if (frame.analysis) {
    obs = typeof frame.analysis === 'string' ? JSON.parse(frame.analysis) : frame.analysis;
  }

  const formatSec = (sec?: number) => {
    if (sec === undefined || isNaN(sec)) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m.toString().padStart(2, '0')}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-primary border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-md bg-accent/15 text-accent border border-accent/30">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-foreground">Frame Inspector</span>
                <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-accent font-bold border border-border">
                  @ {formatSec(frame.timestampSec)}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-signal-blue/15 text-signal-blue font-semibold uppercase border border-signal-blue/30">
                  {obs?.screenType || frame.screenType || 'CHART'}
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted font-sans mt-0.5">
                Deterministic visual perception layer: layout, objects, drawings, and cursor tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onJumpToTimestamp(frame.timestampSec);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Seek Video Here</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
          {/* Left Column: Image Preview with Visual Overlays */}
          <div className="col-span-12 md:col-span-7 p-4 border-b md:border-b-0 md:border-r border-border flex flex-col justify-center items-center bg-black/90">
            <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border/80 bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.filePath.startsWith('/') ? frame.filePath : `/${frame.filePath}`}
                alt={`Keyframe at ${formatSec(frame.timestampSec)}`}
                className="w-full h-full object-contain"
              />

              {/* Cursor Overlay if present */}
              {obs?.cursor && (
                <div
                  className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center space-x-1 transition-all"
                  style={{
                    left: `${(obs.cursor.x / 1920) * 100}%`,
                    top: `${(obs.cursor.y / 1080) * 100}%`,
                  }}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-signal-amber bg-signal-amber/40 animate-ping" />
                  <span className="text-[9px] bg-black/80 text-signal-amber px-1 rounded border border-signal-amber/50 whitespace-nowrap">
                    Cursor ({obs.cursor.x}, {obs.cursor.y})
                  </span>
                </div>
              )}
            </div>

            <div className="w-full mt-3 flex items-center justify-between text-[11px] text-foreground-secondary">
              <span>File: <span className="text-foreground font-mono">{frame.filePath.split('/').pop()}</span></span>
              <span>Resolution: <span className="text-foreground font-mono">1920x1200</span></span>
            </div>
          </div>

          {/* Right Column: Perceived Layers */}
          <div className="col-span-12 md:col-span-5 p-4 overflow-y-auto space-y-4 bg-surface-primary/60 text-xs">
            {/* Application & Screen Layout */}
            <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-1.5">
              <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
                <Monitor className="w-3.5 h-3.5 text-accent" />
                <span>Screen & Layout</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-foreground-muted block text-[10px]">APPLICATION</span>
                  <span className="font-bold text-foreground">{obs?.application?.primary || 'TradingView'}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">CLASSIFICATION</span>
                  <span className="font-bold text-signal-blue">{obs?.screenType || frame.screenType || 'CHART'}</span>
                </div>
              </div>
            </div>

            {/* Chart Isolation */}
            <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-1.5">
              <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-signal-green" />
                <span>Chart Region & Context</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-foreground-muted block text-[10px]">CHART DETECTED</span>
                  <span className="font-bold text-signal-green">{obs?.chart?.detected ? 'Yes' : 'Yes'}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">INSTRUMENT / TF</span>
                  <span className="font-bold text-foreground">
                    {obs?.chart?.instrument || 'BTCUSD'} • {obs?.chart?.timeframe || '30m'}
                  </span>
                </div>
                {obs?.chart?.visiblePriceRange && (
                  <div className="col-span-2">
                    <span className="text-foreground-muted block text-[10px]">PRICE BOUNDS</span>
                    <span className="font-bold text-accent font-mono">{obs.chart.visiblePriceRange}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Drawings & Annotations Detected */}
            <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
                  <PenTool className="w-3.5 h-3.5 text-pink-400" />
                  <span>Detected Drawings ({obs?.drawings?.length || 0})</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-400/10 text-pink-400 font-bold border border-pink-400/20">
                  Pink Pen
                </span>
              </div>

              {obs?.drawings && obs.drawings.length > 0 ? (
                <div className="space-y-1.5">
                  {obs.drawings.map((dwg, idx) => (
                    <div
                      key={dwg.id || idx}
                      className="p-2 rounded bg-surface-primary border border-border/80 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-pink-400 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />
                          <span>{dwg.label || dwg.type}</span>
                        </span>
                        <span className="text-[9px] text-foreground-muted font-mono">{dwg.type}</span>
                      </div>
                      {dwg.priceRange && (
                        <div className="text-[10px] text-foreground-secondary font-mono">
                          Price Zone: <span className="text-foreground font-bold">{dwg.priceRange}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-foreground-muted italic">No active teacher drawings on this frame.</p>
              )}
            </div>

            {/* Cursor Attention */}
            <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-1.5">
              <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
                <MousePointer className="w-3.5 h-3.5 text-signal-amber" />
                <span>Cursor Attention</span>
              </div>
              {obs?.cursor ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-foreground-muted block text-[10px]">COORDINATES</span>
                    <span className="font-bold text-foreground font-mono">
                      X: {obs.cursor.x}, Y: {obs.cursor.y}
                    </span>
                  </div>
                  <div>
                    <span className="text-foreground-muted block text-[10px]">ACTION / STATE</span>
                    <span className="font-bold text-signal-amber">
                      {obs.cursor.action || obs.cursor.state || 'HOVER'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-foreground-muted italic">Cursor idle / not moving on this frame.</p>
              )}
            </div>

            {/* Detected Visual Objects */}
            {obs?.objects && obs.objects.length > 0 && (
              <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-1.5">
                <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>Visual Objects ({obs.objects.length})</span>
                </div>
                <div className="space-y-1">
                  {obs.objects.map((obj, idx) => (
                    <div key={obj.id || idx} className="text-[11px] text-foreground-secondary flex items-center justify-between">
                      <span className="text-foreground font-semibold">• {obj.label || obj.type}</span>
                      <span className="text-[10px] text-foreground-muted">conf: {((obj.confidence || 0.9) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
