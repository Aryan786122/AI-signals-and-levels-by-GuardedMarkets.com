'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Terminal,
  Layers,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TeachingSessionDebugPage() {
  const params = useParams();
  const lessonId = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<number>(1);
  const [copiedLayer, setCopiedLayer] = useState<number | null>(null);

  const fetchDebugData = async () => {
    if (!lessonId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/lessons/${lessonId}/debug`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch debug data`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, [lessonId]);

  const copyLayerJson = (layerNum: number) => {
    if (!data?.layers?.[layerNum]) return;
    navigator.clipboard.writeText(JSON.stringify(data.layers[layerNum], null, 2));
    setCopiedLayer(layerNum);
    setTimeout(() => setCopiedLayer(null), 2000);
  };

  const layerNames = [
    { num: 1, title: '1. Media Inspection (Layer A)' },
    { num: 2, title: '2. Transcription & Spoken Words (Layer B)' },
    { num: 3, title: '3. Sampled Keyframes (Layer B)' },
    { num: 4, title: '4. Visual Observations & Perception (Layer B)' },
    { num: 5, title: '5. Cursor Attention Events (Layer B)' },
    { num: 6, title: '6. Drawing & Annotation Events (Layer B)' },
    { num: 7, title: '7. Ground-Truth Synchronized Timeline (Layer B)' },
    { num: 8, title: '8. Teaching Segments & Intervals (Layer C)' },
    { num: 9, title: '9. Cognitive Candidates & Rules (Layer C)' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono">
      {/* Top Header */}
      <header className="h-14 border-b border-border bg-surface-primary px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            href="/training"
            className="p-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-accent" />
            <span className="font-bold text-sm text-foreground">Teaching Pipeline Debug Inspector</span>
            <span className="text-xs text-foreground-muted font-normal">/ {lessonId}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {data && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-signal-blue/15 text-signal-blue border border-signal-blue/30 font-semibold">
              Stage: {data.processingStage || 'UNKNOWN'} ({data.processingProgress || 0}%)
            </span>
          )}

          <button
            onClick={fetchDebugData}
            disabled={isLoading}
            className="px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground text-xs flex items-center space-x-1.5 border border-border"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Debug Container */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Left Column: Layer Directory */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 border-r border-border bg-surface-primary/40 overflow-y-auto p-3 space-y-1.5">
          <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold px-2 py-1">
            Pipeline Layers (1 - 9)
          </div>

          {layerNames.map((l) => {
            const layerData = data?.layers?.[l.num];
            const isSelected = activeLayer === l.num;
            return (
              <button
                key={l.num}
                onClick={() => setActiveLayer(l.num)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between border transition-all',
                  isSelected
                    ? 'bg-accent/15 border-accent text-accent font-bold'
                    : 'bg-surface-secondary/60 border-border text-foreground-secondary hover:text-foreground hover:bg-surface-secondary'
                )}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span>{l.title}</span>
                </div>
                {layerData ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 text-foreground-muted shrink-0">
                    {layerData.count ?? layerData.segmentCount ?? layerData.frameCount ?? layerData.observationCount ?? layerData.eventCount ?? 'OK'}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Right Column: Layer Inspector & Raw JSON */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 bg-surface-primary flex flex-col h-full overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between bg-surface-secondary/30">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-foreground">
                Layer {activeLayer}: {layerNames.find((l) => l.num === activeLayer)?.title}
              </span>
            </div>

            <button
              onClick={() => copyLayerJson(activeLayer)}
              className="px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground-secondary text-xs flex items-center space-x-1.5 border border-border transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedLayer === activeLayer ? 'Copied!' : 'Copy JSON'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 bg-black/60 text-xs font-mono text-signal-green">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-foreground-muted">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span>Loading layer diagnostics...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-signal-red/10 border border-signal-red/30 text-signal-red">
                <AlertTriangle className="w-5 h-5 mb-1" />
                <p className="font-bold">Error loading layer data</p>
                <p className="text-xs opacity-80 mt-1">{error}</p>
              </div>
            ) : data?.layers?.[activeLayer] ? (
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(data.layers[activeLayer], null, 2)}
              </pre>
            ) : (
              <div className="text-foreground-muted text-center p-8">
                No data available for this layer.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
