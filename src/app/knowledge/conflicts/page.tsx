'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  ArrowRight,
  ShieldCheck,
  Split,
  History,
  RotateCcw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

interface ConflictItem {
  id: string;
  ruleAId: string;
  ruleBId: string;
  conflictType: string;
  aiInterpretation: string;
  suggestedAction: string;
  status: string;
  resolutionNotes: string | null;
  ruleA: {
    id: string;
    title: string;
    statement: string;
    priority: string;
  };
  ruleB: {
    id: string;
    title: string;
    statement: string;
    priority: string;
  };
}

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchConflicts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const json = await res.json();
        setConflicts(json.conflicts || []);
      }
    } catch (err) {
      console.error('Failed to load conflicts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleResolve = async (
    conflictId: string,
    action: 'ACCEPT_EXCEPTION' | 'MARK_SUPERSEDING' | 'KEEP_SEPARATE' | 'MERGE' | 'EDIT_RELATIONSHIP',
    notes?: string
  ) => {
    setResolvingId(conflictId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/knowledge/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });

      if (res.ok) {
        setFeedback(`Conflict resolved via action: ${action}`);
        await fetchConflicts();
      } else {
        const err = await res.json();
        setFeedback(`Error: ${err.error || 'Failed to resolve'}`);
      }
    } catch (err) {
      setFeedback('Failed to resolve conflict.');
    } finally {
      setResolvingId(null);
    }
  };

  const unresolved = conflicts.filter((c) => c.status === 'UNRESOLVED');
  const resolved = conflicts.filter((c) => c.status === 'RESOLVED');

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <Header
        title="Knowledge Contradiction Manager"
        subtitle="Surfacing and adjudicating teaching evolution without destructive overwrites"
        actions={
          <Link
            href="/knowledge"
            className="px-3 py-1.5 rounded text-xs font-mono font-medium bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
          >
            <span>&larr; Back to Knowledge Base</span>
          </Link>
        }
      />

      {feedback && (
        <div className="px-6 py-2 bg-signal-green/10 border-b border-signal-green/30 text-signal-green text-xs font-mono flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="hover:underline">Dismiss</button>
        </div>
      )}

      <div className="p-6 space-y-6 flex-1 max-w-5xl">
        {/* Core Teaching Principle Callout */}
        <div className="p-4 rounded border border-border bg-surface-primary text-xs font-mono space-y-1">
          <div className="flex items-center space-x-2 text-accent font-semibold uppercase text-[11px]">
            <ShieldCheck className="w-4 h-4" />
            <span>Principle: Contradictions are Expected & Welcome</span>
          </div>
          <p className="text-foreground-secondary leading-relaxed">
            As your trading teaching deepens, new statements often refine older rules (e.g. adding candle extension filters or session context).
            The AI student will never silently delete your older rule. Instead, it asks for your explicit judgment: Is this an Exception? A newer Superseding rule? Or a Separate scenario?
          </p>
        </div>

        {/* Unresolved Conflicts Section */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-signal-amber" />
            <span>Unresolved Contradictions ({unresolved.length})</span>
          </h2>

          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-foreground-muted">
              Scanning for knowledge contradictions...
            </div>
          ) : unresolved.length === 0 ? (
            <div className="p-8 text-center rounded border border-border bg-surface-primary space-y-2">
              <CheckCircle2 className="w-8 h-8 text-signal-green mx-auto" />
              <p className="text-xs font-mono font-semibold text-foreground">
                No active knowledge conflicts detected
              </p>
              <p className="text-[11px] font-mono text-foreground-muted">
                All approved rules and exceptions are currently harmonized.
              </p>
            </div>
          ) : (
            unresolved.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded border border-signal-amber/30 bg-surface-primary space-y-4 font-mono text-xs"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-signal-amber/10 text-signal-amber font-bold text-[10px]">
                      {c.conflictType}
                    </span>
                    <span className="text-foreground font-semibold">Potential Relationship: Exception / Refinement</span>
                  </div>
                  <span className="text-[10px] text-foreground-muted">Awaiting Teacher Decision</span>
                </div>

                {/* Rule Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded bg-surface-secondary border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-foreground-muted">
                      <span>BASE TEACHING (Rule A)</span>
                      <span>{c.ruleA.priority}</span>
                    </div>
                    <div className="font-semibold text-foreground text-sm">{c.ruleA.title}</div>
                    <p className="text-foreground-secondary text-[11px] leading-relaxed">
                      "{c.ruleA.statement}"
                    </p>
                  </div>

                  <div className="p-3.5 rounded bg-surface-secondary border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-foreground-muted">
                      <span>NEW STATEMENT (Rule B)</span>
                      <span>{c.ruleB.priority}</span>
                    </div>
                    <div className="font-semibold text-foreground text-sm">{c.ruleB.title}</div>
                    <p className="text-foreground-secondary text-[11px] leading-relaxed">
                      "{c.ruleB.statement}"
                    </p>
                  </div>
                </div>

                {/* AI Interpretation */}
                <div className="p-3 rounded bg-surface-secondary/60 border border-border/60 text-foreground-secondary space-y-1">
                  <div className="text-foreground font-semibold text-[11px]">AI Interpretation:</div>
                  <p className="text-[11px] leading-relaxed">{c.aiInterpretation}</p>
                </div>

                {/* 4 Explicit Action Buttons (Section 13) */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleResolve(c.id, 'ACCEPT_EXCEPTION', 'Taught as contextual exception')}
                    disabled={resolvingId === c.id}
                    className="px-3 py-1.5 rounded bg-accent text-background font-semibold hover:bg-accent-hover transition-colors flex items-center space-x-1.5"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Accept as Exception</span>
                  </button>

                  <button
                    onClick={() => handleResolve(c.id, 'MARK_SUPERSEDING', 'Teacher superseded older rule')}
                    disabled={resolvingId === c.id}
                    className="px-3 py-1.5 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Mark as Superseding</span>
                  </button>

                  <button
                    onClick={() => handleResolve(c.id, 'MERGE', 'Merged conditions into single rule')}
                    disabled={resolvingId === c.id}
                    className="px-3 py-1.5 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
                  >
                    <GitMerge className="w-3.5 h-3.5 text-signal-blue" />
                    <span>Merge</span>
                  </button>

                  <button
                    onClick={() => handleResolve(c.id, 'KEEP_SEPARATE', 'Rules apply in different setups')}
                    disabled={resolvingId === c.id}
                    className="px-3 py-1.5 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>Keep Separate</span>
                  </button>

                  <button
                    onClick={() => handleResolve(c.id, 'EDIT_RELATIONSHIP', 'Custom relation specified')}
                    disabled={resolvingId === c.id}
                    className="px-3 py-1.5 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
                  >
                    <span>Edit Relationship</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resolved History */}
        {resolved.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-border font-mono text-xs">
            <h3 className="text-foreground-muted uppercase text-[11px] tracking-wider">
              Resolved Contradictions Log ({resolved.length})
            </h3>
            {resolved.map((c) => (
              <div key={c.id} className="p-3 rounded bg-surface-primary border border-border flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-signal-green" />
                  <span className="text-foreground">{c.ruleA.title} vs {c.ruleB.title}</span>
                  <span className="text-foreground-muted">({c.resolutionNotes || 'Resolved'})</span>
                </div>
                <span className="text-foreground-muted">Resolved</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
