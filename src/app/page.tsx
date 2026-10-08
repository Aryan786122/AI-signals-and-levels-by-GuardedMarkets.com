'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  LineChart,
  ArrowRight,
  Sparkles,
  Brain,
  Scale,
  Target,
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Cpu,
  Globe,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useAppMode } from '@/lib/context/AppModeContext';
import { cn } from '@/lib/utils';
import {
  CognitiveHypothesis,
  MarketWorldState,
  ActiveLearningQuestionItem,
  ProposedPrincipleItem,
} from '@/lib/types';

interface DashboardStats {
  knowledge: {
    totalLessons: number;
    concepts: number;
    rules: number;
    exceptions: number;
    scenarios: number;
    examples: number;
    corrections: number;
  };
  learning: {
    lessonsProcessed: number;
    lessonsAwaitingApproval: number;
    knowledgeConflicts: number;
    unresolvedContradictions: number;
    supersededRules: number;
    currentKnowledgeVersion: number;
  };
  testing: {
    scenariosTested: number;
    correctDecisions: number;
    incorrectDecisions: number;
    needsReview: number;
  };
  aiProvider: string;
}

export default function DashboardPage() {
  const { mode } = useAppMode();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cognitive, setCognitive] = useState<{
    worldState: MarketWorldState;
    competingHypotheses: CognitiveHypothesis[];
    decision: { state: string; whyThisAction: string[] };
    questions: ActiveLearningQuestionItem[];
    principles: ProposedPrincipleItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<{ name: string; status: string }>({
    name: 'London / NY Overlap',
    status: 'High Liquidity',
  });

  // Calculate live market session based on UTC
  useEffect(() => {
    const hour = new Date().getUTCHours();
    if (hour >= 13 && hour <= 16) {
      setCurrentSession({ name: 'London / New York Overlap', status: 'Peak Liquidity & High Volatility' });
    } else if (hour >= 8 && hour < 16) {
      setCurrentSession({ name: 'London Session', status: 'Active European Order Flow' });
    } else if (hour >= 13 && hour <= 21) {
      setCurrentSession({ name: 'New York Session', status: 'US Hours & News Flow' });
    } else {
      setCurrentSession({ name: 'Asian Session', status: 'Tokyo / Sydney Range Formation' });
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, cogRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/cognitive'),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (cogRes.ok) {
        setCognitive(await cogRes.json());
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAnswerQuestion = async (questionId: string, response: 'YES' | 'NO' | 'IGNORE') => {
    try {
      const res = await fetch('/api/cognitive/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, response }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to answer question:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background select-none">
      <Header
        title={mode === 'public' ? 'Trading AI — Live Signal Workstation' : 'Trading AI — Master Methodology'}
        subtitle="Adaptive Personal AI Student & Market Analyst Workstation"
        actions={
          <div className="flex items-center space-x-2">
            {mode === 'teacher' && (
              <>
                <Link
                  href="/brain"
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border transition-colors flex items-center space-x-1.5"
                >
                  <Brain className="w-3.5 h-3.5 text-accent" />
                  <span>AI Brain Diagnostics</span>
                </Link>
                <Link
                  href="/training"
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-accent text-background hover:bg-accent-hover transition-colors flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Teach AI</span>
                </Link>
              </>
            )}
            <Link
              href="/analysis"
              className="px-3 py-1.5 rounded text-xs font-semibold bg-accent text-background hover:bg-accent-hover transition-colors flex items-center space-x-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Start Analysis</span>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6 flex-1 max-w-7xl">
        {/* TOP STATUS BAR: AI STATUS, METHODOLOGY & SESSION */}
        <div className="p-4 rounded-lg bg-surface-primary border border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-signal-green inline-block animate-pulse" />
              <span className="text-foreground-muted text-[10px] uppercase tracking-wider">Current AI State:</span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent/15 border border-accent/30 text-accent">
                {cognitive?.decision?.state || 'OBSERVE'}
              </span>
              <span className="text-[11px] text-foreground-secondary">
                (Disciplined No-Forced-Trade)
              </span>
            </div>
            <p className="text-foreground-secondary text-xs font-sans pl-4.5">
              {cognitive?.decision?.whyThisAction?.[0] || 'System maintains disciplined observation awaiting structural trigger.'}
            </p>
          </div>

          <div className="flex items-center space-x-4 shrink-0 text-xs">
            <div className="text-right">
              <span className="text-[10px] text-foreground-muted block uppercase">Active Methodology</span>
              <span className="text-foreground font-semibold">Liquidity & Order Flow</span>
            </div>
            <div className="text-right border-l border-border pl-4">
              <span className="text-[10px] text-foreground-muted block uppercase">Market Session</span>
              <span className="text-accent font-semibold">{currentSession.name}</span>
            </div>
            <div className="text-right border-l border-border pl-4">
              <span className="text-[10px] text-foreground-muted block uppercase">Instrument / Timeframe</span>
              <span className="text-foreground font-semibold">
                {cognitive?.worldState?.instrument || 'XAUUSD'} · {cognitive?.worldState?.timeframe || '5M'}
              </span>
            </div>
          </div>
        </div>

        {/* 3 QUICK ACTION BUTTONS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <Link
            href="/training"
            className="p-4 rounded-lg bg-surface-primary border border-border hover:border-accent transition-all group flex items-center justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="font-semibold text-foreground text-sm uppercase">1. Teach AI</span>
              </div>
              <p className="text-foreground-secondary text-[11px] font-sans">
                Upload video, audio, or charts. Extract concepts, rules, and exceptions.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-accent transition-colors shrink-0 ml-3" />
          </Link>

          <Link
            href="/analysis"
            className="p-4 rounded-lg bg-surface-primary border border-border hover:border-accent transition-all group flex items-center justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <LineChart className="w-4 h-4 text-accent" />
                <span className="font-semibold text-foreground text-sm uppercase">2. Start Analysis</span>
              </div>
              <p className="text-foreground-secondary text-[11px] font-sans">
                Real-time chart workspace with WAIT/LONG/SHORT and auditable reasoning.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-accent transition-colors shrink-0 ml-3" />
          </Link>

          <Link
            href="/replay"
            className="p-4 rounded-lg bg-surface-primary border border-border hover:border-accent transition-all group flex items-center justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <PlayCircle className="w-4 h-4 text-accent" />
                <span className="font-semibold text-foreground text-sm uppercase">3. Replay Validation</span>
              </div>
              <p className="text-foreground-secondary text-[11px] font-sans">
                Zero-lookahead backtest across known scenarios & generalization audit.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-accent transition-colors shrink-0 ml-3" />
          </Link>
        </div>

        {/* LEARNING TELEMETRY GRID (Honest Metrics) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
          <div className="p-3.5 rounded border border-border bg-surface-primary flex flex-col justify-between">
            <div className="text-foreground-secondary text-[10px] uppercase">ACTIVE RULES</div>
            <div className="mt-1">
              <span className="text-xl font-bold text-foreground">
                {stats ? stats.knowledge.rules : 0}
              </span>
            </div>
            <div className="text-[10px] text-foreground-muted">Enforced in reasoning</div>
          </div>

          <div className="p-3.5 rounded border border-border bg-surface-primary flex flex-col justify-between">
            <div className="text-foreground-secondary text-[10px] uppercase">EXCEPTIONS ACTIVE</div>
            <div className="mt-1">
              <span className="text-xl font-bold text-foreground">
                {stats ? stats.knowledge.exceptions : 0}
              </span>
            </div>
            <div className="text-[10px] text-foreground-muted">Hierarchy overrides</div>
          </div>

          <div className="p-3.5 rounded border border-border bg-surface-primary flex flex-col justify-between">
            <div className="text-foreground-secondary text-[10px] uppercase">UNRESOLVED CONFLICTS</div>
            <div className="mt-1">
              <span className={cn(
                'text-xl font-bold',
                stats && stats.learning.knowledgeConflicts > 0 ? 'text-signal-amber' : 'text-signal-green'
              )}>
                {stats ? stats.learning.knowledgeConflicts : 0}
              </span>
            </div>
            <div className="text-[10px] text-foreground-muted">
              {stats && stats.learning.knowledgeConflicts > 0 ? (
                <Link href="/knowledge/conflicts" className="text-signal-amber hover:underline flex items-center space-x-0.5">
                  <span>Adjudicate</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              ) : (
                'Harmonized'
              )}
            </div>
          </div>

          <div className="p-3.5 rounded border border-border bg-surface-primary flex flex-col justify-between">
            <div className="text-foreground-secondary text-[10px] uppercase">TEACHER CORRECTIONS</div>
            <div className="mt-1">
              <span className="text-xl font-bold text-foreground">
                {stats ? stats.knowledge.corrections : 0}
              </span>
            </div>
            <div className="text-[10px] text-foreground-muted">
              <Link href="/brain" className="text-accent hover:underline">Pedagogical memory</Link>
            </div>
          </div>

          <div className="p-3.5 rounded border border-border bg-surface-primary flex flex-col justify-between col-span-2 md:col-span-1">
            <div className="text-foreground-secondary text-[10px] uppercase">KNOWLEDGE VERSION</div>
            <div className="mt-1">
              <span className="text-xl font-bold text-accent">
                v{stats ? stats.learning.currentKnowledgeVersion : 1}.0
              </span>
            </div>
            <div className="text-[10px] text-foreground-muted">Current Methodology</div>
          </div>
        </div>

        {/* ACTIVE COMPETING HYPOTHESES & ACTIVE LEARNING SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Competing Hypotheses Card */}
          <div className="lg:col-span-2 border border-border rounded bg-surface-primary overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-secondary/40">
              <div className="flex items-center space-x-2">
                <Scale className="w-4 h-4 text-accent" />
                <h2 className="text-xs font-semibold font-mono tracking-wider text-foreground uppercase">
                  Active Competing Hypotheses
                </h2>
              </div>
              <Link
                href="/brain"
                className="text-[11px] font-mono text-accent hover:underline flex items-center space-x-1"
              >
                <span>Full Evidence Matrix</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-4 divide-y divide-border/60 space-y-3 font-mono text-xs">
              {(cognitive?.competingHypotheses || []).map((hyp, i) => (
                <div key={hyp.id} className={cn('space-y-1.5', i > 0 && 'pt-3')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        i === 0 ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-surface-secondary text-foreground-secondary border border-border'
                      )}>
                        {i === 0 ? 'PRIMARY' : `ALT ${i}`}
                      </span>
                      <span className="font-semibold text-foreground text-xs font-sans">{hyp.title}</span>
                    </div>
                    {/* Honest evidence count instead of fake probability */}
                    <div className="text-[11px] text-foreground-secondary">
                      <span className="text-signal-green font-bold">{hyp.supportingEvidence.length}</span> /{' '}
                      <span className="text-signal-red font-bold">{hyp.contradictingEvidence.length}</span> /{' '}
                      <span className="text-signal-amber font-bold">{hyp.missingEvidence.length}</span> (S / C / M)
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-[11px] text-foreground-secondary">
                    <span className="text-signal-green flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{hyp.supportingEvidence.length} Supporting</span>
                    </span>
                    <span className="text-signal-red flex items-center space-x-1">
                      <XCircle className="w-3 h-3" />
                      <span>{hyp.contradictingEvidence.length} Contradicting</span>
                    </span>
                    <span className="text-signal-amber flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{hyp.missingEvidence.length} Missing</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Learning (AI Inquiries for Teacher) */}
          <div className="border border-border rounded bg-surface-primary overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-secondary/40">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-signal-amber" />
                <h2 className="text-xs font-semibold font-mono tracking-wider text-foreground uppercase">
                  Questions for Teacher
                </h2>
              </div>
              <span className="text-[10px] font-mono text-signal-amber">Active Inquiries</span>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between font-mono text-xs space-y-3">
              {(cognitive?.questions && cognitive.questions.length > 0) ? (
                <div className="space-y-3">
                  <p className="text-foreground text-xs font-sans leading-relaxed">
                    &ldquo;{cognitive.questions[0].question}&rdquo;
                  </p>
                  <p className="text-[11px] text-foreground-muted font-sans">
                    {cognitive.questions[0].context}
                  </p>

                  <div className="pt-2 flex items-center space-x-2">
                    <button
                      onClick={() => handleAnswerQuestion(cognitive.questions[0].id, 'YES')}
                      className="flex-1 py-1.5 rounded bg-signal-green/20 border border-signal-green/40 text-signal-green font-bold hover:bg-signal-green/30 transition-colors flex items-center justify-center space-x-1"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>YES</span>
                    </button>
                    <button
                      onClick={() => handleAnswerQuestion(cognitive.questions[0].id, 'NO')}
                      className="flex-1 py-1.5 rounded bg-signal-red/20 border border-signal-red/40 text-signal-red font-bold hover:bg-signal-red/30 transition-colors flex items-center justify-center space-x-1"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      <span>NO</span>
                    </button>
                    <button
                      onClick={() => handleAnswerQuestion(cognitive.questions[0].id, 'IGNORE')}
                      className="px-2.5 py-1.5 rounded bg-surface-secondary text-foreground-muted hover:text-foreground border border-border"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-foreground-muted text-xs font-sans">
                  No active inquiries right now. The AI is reasoning strictly within approved boundaries.
                </div>
              )}

              <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-foreground-muted">
                <span>Adaptive Learning</span>
                <Link href="/brain" className="text-accent hover:underline">View All Inquiries &rarr;</Link>
              </div>
            </div>
          </div>
        </div>

        {/* GENERALIZED LESSONS & RECENT LEARNING EVENTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Generalized Lessons Preview */}
          <div className="p-4 rounded-lg bg-surface-primary border border-border space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-accent" />
                <span className="font-semibold text-foreground uppercase tracking-wider text-xs">
                  Generalized Lessons (Proposed Principles)
                </span>
              </div>
              <Link href="/brain" className="text-accent text-[11px] hover:underline">Review &rarr;</Link>
            </div>

            {(cognitive?.principles && cognitive.principles.length > 0) ? (
              <div className="p-3 rounded bg-surface-secondary border border-border/80 space-y-1">
                <span className="text-[10px] text-signal-amber font-bold uppercase block">
                  Candidate Generalization:
                </span>
                <h4 className="font-semibold text-foreground font-sans text-xs">{cognitive.principles[0].title}</h4>
                <p className="text-foreground-secondary text-[11px] font-sans leading-tight">
                  &ldquo;{cognitive.principles[0].statement}&rdquo;
                </p>
              </div>
            ) : (
              <p className="text-foreground-muted text-xs">No pending principles. The engine evaluates across lessons.</p>
            )}
          </div>

          {/* Core Workflows Navigation */}
          <div className="p-4 rounded-lg bg-surface-primary border border-border space-y-3 font-mono text-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground uppercase tracking-wider text-xs">
                Core Workspaces
              </span>
              <span className="text-[10px] text-accent">Ready</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Link
                href="/training"
                className="p-2.5 rounded bg-surface-secondary border border-border hover:border-accent text-center space-y-1 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-accent mx-auto" />
                <span className="block text-[10px] font-bold text-foreground">Teach AI</span>
                <span className="block text-[9px] text-foreground-muted">Video / Audio</span>
              </Link>

              <Link
                href="/analysis"
                className="p-2.5 rounded bg-surface-secondary border border-border hover:border-accent text-center space-y-1 transition-colors"
              >
                <LineChart className="w-4 h-4 text-accent mx-auto" />
                <span className="block text-[10px] font-bold text-foreground">Analysis</span>
                <span className="block text-[9px] text-foreground-muted">Live Chart</span>
              </Link>

              <Link
                href="/replay"
                className="p-2.5 rounded bg-surface-secondary border border-border hover:border-accent text-center space-y-1 transition-colors"
              >
                <PlayCircle className="w-4 h-4 text-accent mx-auto" />
                <span className="block text-[10px] font-bold text-foreground">Replay Lab</span>
                <span className="block text-[9px] text-foreground-muted">0 Lookahead</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
