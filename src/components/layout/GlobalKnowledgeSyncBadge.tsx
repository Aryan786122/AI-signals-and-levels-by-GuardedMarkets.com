'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalKnowledgeSyncBadge({ className }: { className?: string }) {
  const [syncState, setSyncState] = useState<{
    version: number;
    versionTag: string;
    lastUpdated: string;
    isSynced: boolean;
    itemCounts?: {
      concepts: number;
      rules: number;
      hypotheses: number;
      stateTransitions: number;
      questions: number;
    };
  } | null>(null);

  const [localVersionTag, setLocalVersionTag] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const checkSync = async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    try {
      const res = await fetch('/api/brain/sync');
      if (res.ok) {
        const data = await res.json();
        setSyncState(data);
        if (!localVersionTag) {
          setLocalVersionTag(data.versionTag);
        }
      }
    } catch {
      // ignore transient network hiccups
    }
  };

  useEffect(() => {
    checkSync();
    const interval = setInterval(checkSync, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/brain/sync');
      await checkSync();
      if (syncState) {
        setLocalVersionTag(syncState.versionTag);
      }
      // Notify active page via custom event
      window.dispatchEvent(new CustomEvent('knowledge-synced', { detail: syncState }));
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const isStale = localVersionTag && syncState && localVersionTag !== syncState.versionTag;

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!syncState) return null;

  return (
    <div className={cn('relative flex items-center', className)}>
      {isStale ? (
        <button
          onClick={handleManualSync}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold animate-pulse hover:bg-amber-500/25 transition-colors shadow-sm"
          title="Remote knowledge brain was updated. Click to refresh local workspace."
        >
          <AlertTriangle className="w-3 h-3" />
          <span>SYNC REQUIRED</span>
          <RefreshCw className={cn('w-2.5 h-2.5 ml-0.5', isRefreshing && 'animate-spin')} />
        </button>
      ) : (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-medium hover:bg-emerald-500/15 transition-colors"
          title="Click to view canonical knowledge brain status"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
          <span className="font-bold">KNOWLEDGE {syncState.versionTag}</span>
          <span className="text-emerald-500/60">•</span>
          <span>SYNCED</span>
          {syncState.lastUpdated && (
            <span className="text-foreground-muted text-[9px] hidden sm:inline">
              ({formatTime(syncState.lastUpdated)})
            </span>
          )}
        </button>
      )}

      {/* Popover Details */}
      {showDetails && (
        <div className="absolute right-0 top-8 z-50 w-64 p-3 rounded-xl bg-surface-primary border border-border shadow-2xl space-y-2 text-xs font-mono select-none">
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <div className="flex items-center space-x-1.5 text-foreground font-bold text-[11px]">
              <Database className="w-3.5 h-3.5 text-accent" />
              <span>Canonical Brain Store</span>
            </div>
            <span className="text-[10px] text-accent font-bold">{syncState.versionTag}</span>
          </div>

          <div className="space-y-1 text-[10px] text-foreground-secondary">
            <div className="flex justify-between">
              <span>Concepts:</span>
              <span className="font-bold text-foreground">{syncState.itemCounts?.concepts ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Hypotheses:</span>
              <span className="font-bold text-foreground">{syncState.itemCounts?.hypotheses ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>State Sequences:</span>
              <span className="font-bold text-foreground">{syncState.itemCounts?.stateTransitions ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Candidate Rules:</span>
              <span className="font-bold text-foreground">{syncState.itemCounts?.rules ?? 0} (Honest)</span>
            </div>
            <div className="flex justify-between">
              <span>Adaptive Questions:</span>
              <span className="font-bold text-foreground">{syncState.itemCounts?.questions ?? 0}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-[9px] text-foreground-muted">Last sync: {formatTime(syncState.lastUpdated)}</span>
            <button
              onClick={handleManualSync}
              disabled={isRefreshing}
              className="px-2 py-0.5 rounded bg-surface-secondary hover:bg-surface-secondary/80 border border-border text-[9px] font-bold text-foreground flex items-center space-x-1"
            >
              <RefreshCw className={cn('w-2.5 h-2.5', isRefreshing && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
