'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  AlertTriangle,
  Network,
  Shield,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Search,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn, formatDate } from '@/lib/utils';

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<'RULES' | 'CONCEPTS' | 'EXCEPTIONS' | 'EXAMPLES' | 'CONFLICTS'>('RULES');
  const [data, setData] = useState<{
    concepts: any[];
    rules: any[];
    exceptions: any[];
    examples: any[];
    counterExamples: any[];
    conflicts: any[];
  } | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const json = await res.json();
        // Normalize the brain snapshot response shape into what this page renders.
        // The new /api/knowledge returns: { concepts, claims, rules, relationships, scenarios, mastery, ... }
        // We map it into the legacy shape expected by the tabs below.
        const normalized = {
          concepts: (json.concepts || []).map((c: any) => ({
            ...c,
            rules: c.rules || [],
            examples: c.examples || [],
            counterExamples: c.counterExamples || [],
          })),
          rules: json.rules || [],
          exceptions: (json.rules || []).flatMap((r: any) => (r.exceptions || []).map((e: any) => ({ ...e, rule: r }))),
          examples: [],
          counterExamples: [],
          conflicts: json.conflicts || [],
        };
        setData(normalized);
      }
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRules = (data?.rules || []).filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.statement.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <Header
        title="Knowledge Base & Rules Engine"
        subtitle="Structured concepts, hierarchy, conditional logic, and exceptions"
        actions={
          <div className="flex items-center space-x-2">
            <Link
              href="/knowledge/conflicts"
              className="px-3 py-1.5 rounded text-xs font-mono font-medium bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border transition-colors flex items-center space-x-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-signal-amber" />
              <span>Contradiction Manager ({(data?.conflicts || []).filter(c => c.status === 'UNRESOLVED').length || 0})</span>
            </Link>
            <Link
              href="/knowledge/graph"
              className="px-3 py-1.5 rounded text-xs font-mono font-semibold bg-accent text-background hover:bg-accent-hover transition-colors flex items-center space-x-1.5"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Visual Knowledge Graph</span>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6 flex-1">
        {/* Navigation Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-2 text-xs font-mono">
            {[
              { id: 'RULES', label: `Rules (${(data?.rules || []).length})` },
              { id: 'CONCEPTS', label: `Concepts (${(data?.concepts || []).length})` },
              { id: 'EXCEPTIONS', label: `Exceptions (${(data?.exceptions || []).length})` },
              { id: 'EXAMPLES', label: `Examples (${((data?.examples || []).length + (data?.counterExamples || []).length)})` },
              { id: 'CONFLICTS', label: `Conflicts (${(data?.conflicts || []).length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded transition-colors',
                  activeTab === tab.id
                    ? 'bg-surface-tertiary text-foreground font-semibold border-b-2 border-accent'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-surface-secondary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search knowledge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-secondary border border-border rounded pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="p-12 text-center text-xs font-mono text-foreground-muted">
            Loading knowledge records...
          </div>
        ) : (
          <div>
            {/* RULES TAB */}
            {activeTab === 'RULES' && (
              <div className="space-y-4">
                {filteredRules.length === 0 ? (
                  <div className="p-12 text-center rounded border border-border bg-surface-primary space-y-3">
                    <p className="text-xs font-mono text-foreground-muted">
                      No trading rules approved yet.
                    </p>
                    <Link
                      href="/training"
                      className="inline-block px-3 py-1.5 rounded text-xs font-medium bg-accent text-background hover:bg-accent-hover transition-colors"
                    >
                      Teach a Rule via Lesson
                    </Link>
                  </div>
                ) : (
                  filteredRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={cn(
                        'p-4 rounded border bg-surface-primary space-y-3',
                        rule.status === 'SUPERSEDED'
                          ? 'border-border/50 opacity-60'
                          : 'border-border'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-semibold text-foreground">{rule.title}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-secondary text-accent border border-border">
                              {rule.priority}
                            </span>
                            {rule.status === 'SUPERSEDED' && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-signal-amber/10 text-signal-amber border border-signal-amber/30">
                                SUPERSEDED (v{rule.version})
                              </span>
                            )}
                          </div>
                          {rule.concept && (
                            <span className="text-[11px] font-mono text-foreground-muted">
                              Concept: {rule.concept.name}
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-foreground-muted">
                          {formatDate(rule.createdAt)}
                        </span>
                      </div>

                      {/* Rule Statement & Rationale */}
                      <div className="p-3 rounded bg-surface-secondary border border-border/80 text-xs font-mono space-y-1">
                        <div className="text-foreground leading-relaxed">{rule.statement}</div>
                        {rule.rationale && (
                          <p className="text-[11px] text-foreground-muted pt-1">
                            Rationale: {rule.rationale}
                          </p>
                        )}
                      </div>

                      {/* Atomic Conditions */}
                      {rule.conditions && rule.conditions.length > 0 && (
                        <div className="space-y-1.5 text-xs font-mono">
                          <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
                            Base Conditions ({rule.conditions.length}):
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {rule.conditions.map((cond: any) => (
                              <div
                                key={cond.id}
                                className="p-2 rounded bg-surface-secondary border border-border text-[11px] flex items-center justify-between"
                              >
                                <span className="text-foreground">{cond.field}</span>
                                <span className="text-accent font-semibold">
                                  {cond.operator} {cond.threshold || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exceptions */}
                      {rule.exceptions && rule.exceptions.length > 0 && (
                        <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-border/60">
                          <span className="text-[10px] text-signal-amber uppercase tracking-wider font-semibold">
                            Enforced Exceptions ({rule.exceptions.length}):
                          </span>
                          <div className="space-y-1.5">
                            {rule.exceptions.map((exc: any) => (
                              <div
                                key={exc.id}
                                className="p-2.5 rounded bg-signal-amber/5 border border-signal-amber/20 text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-signal-amber">{exc.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-secondary text-foreground">
                                    Override: {exc.overrideBehavior}
                                  </span>
                                </div>
                                <p className="text-foreground-secondary">{exc.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Version Audit */}
                      {rule.versions && rule.versions.length > 0 && (
                        <div className="text-[10px] font-mono text-foreground-muted pt-1">
                          History: {rule.versions.length} earlier version(s) preserved in audit log.
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* CONCEPTS TAB */}
            {activeTab === 'CONCEPTS' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                {(data?.concepts || []).length === 0 ? (
                  <div className="col-span-3 p-12 text-center rounded border border-border bg-surface-primary space-y-3">
                    <p className="text-xs font-mono text-foreground-muted">
                      No concepts in the brain yet. Approve a teaching lesson to populate this.
                    </p>
                    <Link
                      href="/training"
                      className="inline-block px-3 py-1.5 rounded text-xs font-medium bg-accent text-background hover:bg-accent-hover transition-colors"
                    >
                      Go to Training
                    </Link>
                  </div>
                ) : (
                  data?.concepts.map((concept) => (
                    <div key={concept.id} className="p-4 rounded border border-border bg-surface-primary space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{concept.name}</h3>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-secondary text-accent">
                          {concept.category || 'CONCEPT'}
                        </span>
                      </div>
                      <p className="text-xs text-foreground-secondary leading-relaxed font-sans">
                        {concept.definition}
                      </p>
                      <div className="pt-2 border-t border-border text-[11px] flex items-center justify-between text-foreground-muted">
                        <span>{(concept.rules || []).length} Rules Attached</span>
                        <span>{(concept.examples || []).length} Examples</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* EXCEPTIONS TAB */}
            {activeTab === 'EXCEPTIONS' && (
              <div className="space-y-3 font-mono">
                {data?.exceptions.map((exc) => (
                  <div key={exc.id} className="p-4 rounded border border-border bg-surface-primary space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-signal-amber">{exc.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-foreground">
                        Action: {exc.overrideBehavior}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-secondary font-sans">{exc.description}</p>
                    <div className="text-[11px] text-foreground-muted">
                      Attached to Rule: <span className="text-foreground">{exc.rule.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* EXAMPLES TAB */}
            {activeTab === 'EXAMPLES' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {data?.examples.map((ex) => (
                  <div key={ex.id} className="p-4 rounded border border-signal-green/20 bg-surface-primary space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-signal-green flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>POSITIVE EXAMPLE</span>
                      </span>
                      <span className="text-[10px] text-foreground-muted">
                        {ex.market} &bull; {ex.timeframe}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{ex.context}</p>
                    <div className="text-[11px] text-foreground-secondary bg-surface-secondary p-2 rounded">
                      Teacher Decision: <span className="text-signal-green font-semibold">{ex.teacherDecision}</span>
                      <p className="mt-1 text-[10px] text-foreground-muted">{ex.teacherExplanation}</p>
                    </div>
                  </div>
                ))}

                {data?.counterExamples.map((cex) => (
                  <div key={cex.id} className="p-4 rounded border border-signal-red/20 bg-surface-primary space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-signal-red flex items-center space-x-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>COUNTEREXAMPLE ("Looks like setup but isn't")</span>
                      </span>
                      <span className="text-[10px] text-foreground-muted">
                        {cex.market} &bull; {cex.timeframe}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{cex.context}</p>
                    <div className="text-[11px] text-foreground-secondary bg-surface-secondary p-2 rounded">
                      Why Invalid: <span className="text-signal-red font-semibold">{cex.whyInvalid}</span>
                      <p className="mt-1 text-[10px] text-foreground-muted">{cex.teacherExplanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CONFLICTS TAB */}
            {activeTab === 'CONFLICTS' && (
              <div className="space-y-4 font-mono">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-foreground-secondary">
                    Review and adjudicate contradictions surfaced by the AI reasoning engine.
                  </p>
                  <Link
                    href="/knowledge/conflicts"
                    className="px-3 py-1.5 rounded bg-accent text-background text-xs font-bold hover:bg-accent-hover"
                  >
                    Open Interactive Contradiction Adjudicator &rarr;
                  </Link>
                </div>

                {data?.conflicts.map((c) => (
                  <div key={c.id} className="p-4 rounded border border-border bg-surface-primary space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-signal-amber">
                        CONFLICT: {c.conflictType}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface-secondary text-foreground-muted">
                        Status: {c.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded bg-surface-secondary border border-border">
                        <span className="text-foreground-muted text-[10px]">Rule A:</span>
                        <div className="font-semibold text-foreground">{c.ruleA.title}</div>
                        <p className="text-[11px] text-foreground-secondary mt-1">{c.ruleA.statement}</p>
                      </div>
                      <div className="p-2.5 rounded bg-surface-secondary border border-border">
                        <span className="text-foreground-muted text-[10px]">Rule B:</span>
                        <div className="font-semibold text-foreground">{c.ruleB.title}</div>
                        <p className="text-[11px] text-foreground-secondary mt-1">{c.ruleB.statement}</p>
                      </div>
                    </div>
                    <div className="text-xs text-foreground-secondary bg-surface-secondary/60 p-2.5 rounded">
                      <span className="font-semibold text-foreground">AI Interpretation: </span>
                      {c.aiInterpretation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
