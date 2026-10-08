'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Cpu,
  Eye,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Clock,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  History,
  Target,
  Scale,
  TrendingUp,
  Activity,
  Layers,
  XCircle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { CorrectAIModal } from '@/components/ui/CorrectAIModal';
import {
  MarketWorldState,
  CognitiveHypothesis,
  ActiveLearningQuestionItem,
  ProposedPrincipleItem,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface BrainData {
  providers: {
    reasoning: { id: string; name: string; fallback: string; status: string; security: string };
    vision: { id: string; name: string; fallback: string; status: string; security: string };
    speech: { id: string; name: string; fallback: string; status: string; security: string };
    embeddings: { id: string; name: string; fallback: string; status: string; security: string };
    marketData: { id: string; name: string; fallback: string; status: string; security: string };
  };
  metrics: {
    totalLessons: number;
    approvedLessons: number;
    pendingLessons: number;
    conceptsCount: number;
    activeRulesCount: number;
    supersededRulesCount: number;
    totalExceptionsCount: number;
    baseExceptionsCount: number;
    nestedExceptionsCount: number;
    examplesCount: number;
    counterExamplesCount: number;
    correctionsCount: number;
    unresolvedConflictsCount: number;
    currentKnowledgeVersion: number;
    pendingQuestionsCount?: number;
    proposedPrinciplesCount?: number;
  };
  worldState?: MarketWorldState;
  cognitiveDecision?: {
    state: string;
    currentAction: string;
    whyThisAction: string[];
    whatWouldChangeMyMind: string[];
    novelScenarioAnalysis?: {
      isExactMatchFound: boolean;
      structuralSimilarities: string[];
      structuralDifferences: string[];
      applicablePrinciples: string[];
      uncertainties: string[];
    };
  };
  competingHypotheses?: CognitiveHypothesis[];
  whatWouldChangeMyMind?: string[];
  questions?: ActiveLearningQuestionItem[];
  principles?: ProposedPrincipleItem[];
  experiences?: Array<{
    id: string;
    situationSummary: string;
    market: string;
    timeframe: string;
    aiDecision: string;
    aiReasoning: string;
    learnedInsight?: string | null;
    createdAt: string;
  }>;
  concepts: Array<{
    id: string;
    name: string;
    category: string;
    definition: string;
    importance: number;
    rules: Array<{ id: string; title: string; specificity: number }>;
  }>;
  rules: Array<{
    id: string;
    title: string;
    statement: string;
    priority: string;
    scope: string;
    tradePhase: string;
    specificity: number;
    teacherApproved: boolean;
    status: string;
    concept?: { name: string };
    exceptions: Array<{
      id: string;
      description: string;
      overrideBehavior: string;
      specificity: number;
      parentExceptionId?: string | null;
      childExceptions?: Array<{
        id: string;
        description: string;
        overrideBehavior: string;
        specificity: number;
      }>;
    }>;
  }>;
  corrections: Array<{
    id: string;
    correctionType: string;
    previousAiDecision: string;
    correctedDecision: string;
    teacherExplanation: string;
    conceptName?: string | null;
    condition?: string | null;
    action?: string | null;
    alternative?: string | null;
    reason?: string | null;
    createdAt: string;
  }>;
  examples: Array<{
    id: string;
    context: string;
    market: string;
    timeframe: string;
    teacherDecision: string;
    teacherExplanation: string;
  }>;
  counterExamples: Array<{
    id: string;
    context: string;
    market: string;
    timeframe: string;
    whyInvalid: string;
    teacherExplanation: string;
  }>;
  conflicts: Array<{
    id: string;
    conflictType: string;
    ruleA: { id: string; title: string; specificity: number };
    ruleB: { id: string; title: string; specificity: number };
    aiInterpretation: string;
    suggestedAction: string;
  }>;
}

export default function AIBrainPage() {
  const [data, setData] = useState<BrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'hypotheses' | 'world' | 'counterfactuals' | 'questions' | 'principles' | 'experiences' | 'rules' | 'corrections'
  >('hypotheses');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadBrainData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/brain');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load brain data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrainData();
  }, []);

  const handleAnswerQuestion = async (questionId: string, response: 'YES' | 'NO' | 'EDIT' | 'IGNORE') => {
    try {
      setActionInProgress(questionId);
      const res = await fetch('/api/cognitive/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, response }),
      });
      if (res.ok) {
        await loadBrainData();
      }
    } catch (err) {
      console.error('Failed to answer question:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReviewPrinciple = async (principleId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      setActionInProgress(principleId);
      const res = await fetch('/api/cognitive/principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principleId, action }),
      });
      if (res.ok) {
        await loadBrainData();
      }
    } catch (err) {
      console.error('Failed to review principle:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredRules = (data?.rules || []).filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.statement.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.concept?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans select-none pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-secondary border border-border flex items-center justify-center text-accent">
              <Brain className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">AI Brain & Diagnostics</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 border border-accent/20 text-accent font-semibold">
              AI BRAIN ACTIVE
            </span>
          </div>
          <p className="text-xs text-foreground-secondary mt-1">
            Auditable cognitive architecture: World Model, Competing Hypotheses, Evidence Engine, Counterfactuals, and Active Learning.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadBrainData}
            className="px-3 py-1.5 rounded bg-surface-secondary border border-border text-foreground-secondary hover:text-foreground text-xs font-mono flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin text-accent')} />
            <span>Sync Engine</span>
          </button>

          <button
            onClick={() => setIsCorrectModalOpen(true)}
            className="px-3.5 py-1.5 rounded bg-signal-amber/15 border border-signal-amber/30 text-signal-amber hover:bg-signal-amber/25 text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Add Correction</span>
          </button>
        </div>
      </div>

      {/* Top Cognitive State Card */}
      <div className="p-4 rounded-lg bg-surface-primary border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-signal-green inline-block animate-pulse" />
            <span className="text-[11px] font-mono text-foreground-muted uppercase tracking-wider">Current AI State:</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-accent/15 border border-accent/30 text-accent">
              {data?.cognitiveDecision?.state || 'OBSERVE'}
            </span>
            <span className="text-xs text-foreground-secondary font-mono">
              (No-Forced-Trade Mode)
            </span>
          </div>
          <p className="text-xs text-foreground-secondary font-mono pl-4.5">
            {data?.cognitiveDecision?.whyThisAction?.[0] || 'Maintaining structured observation while evaluating incoming candle events.'}
          </p>
        </div>

        <div className="flex items-center space-x-4 font-mono text-xs shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-foreground-muted block uppercase">Instrument / Timeframe</span>
            <span className="text-foreground font-semibold">{data?.worldState?.instrument || 'XAUUSD'} · {data?.worldState?.timeframe || '5M'}</span>
          </div>
          <div className="text-right border-l border-border pl-4">
            <span className="text-[10px] text-foreground-muted block uppercase">Regime</span>
            <span className="text-accent font-semibold">{data?.worldState?.marketRegime || 'CALCULATING'}</span>
          </div>
          <div className="text-right border-l border-border pl-4">
            <span className="text-[10px] text-foreground-muted block uppercase">Uncertainty</span>
            <span className="text-signal-amber font-semibold">{((data?.worldState?.uncertaintyScore || 0.25) * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('hypotheses')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'hypotheses'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Competing Hypotheses ({data?.competingHypotheses?.length || 3})</span>
          </button>

          <button
            onClick={() => setActiveTab('world')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'world'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>World Model & Sequence</span>
          </button>

          <button
            onClick={() => setActiveTab('counterfactuals')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'counterfactuals'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <Target className="w-3.5 h-3.5" />
            <span>What Would Change My Mind</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'questions'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>AI Questions for Teacher ({data?.questions?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('principles')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'principles'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Proposed Principles ({data?.principles?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('experiences')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'experiences'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>Episodic Memory</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'rules'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Rules & Exceptions ({data?.rules?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('corrections')}
            className={cn(
              'px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5',
              activeTab === 'corrections'
                ? 'bg-accent text-background font-semibold'
                : 'bg-surface-secondary text-foreground-secondary hover:text-foreground'
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Corrections Log ({data?.corrections?.length || 0})</span>
          </button>
        </div>

        {activeTab === 'rules' && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
            <input
              type="text"
              placeholder="Filter rules or concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-surface-secondary border border-border rounded text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent font-mono"
            />
          </div>
        )}
      </div>

      {/* TAB 1: COMPETING HYPOTHESES & EVIDENCE MATRIX */}
      {activeTab === 'hypotheses' && (
        <div className="space-y-4">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-xs font-mono text-foreground-secondary flex items-center justify-between">
            <span>
              The AI maintains multiple plausible market hypotheses rather than forcing an early single bias. Every hypothesis tracks supporting, contradicting, and missing evidence.
            </span>
            <span className="text-accent font-semibold">Evidence-Weighted Probability</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data?.competingHypotheses || []).map((hyp, idx) => (
              <div
                key={hyp.id}
                className={cn(
                  'p-4 rounded-lg bg-surface-primary border flex flex-col justify-between space-y-4 font-mono text-xs transition-colors',
                  idx === 0 ? 'border-accent/60 shadow-lg shadow-accent/5' : 'border-border'
                )}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold',
                      idx === 0 ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-surface-secondary text-foreground-secondary border border-border'
                    )}>
                      {idx === 0 ? 'PRIMARY HYPOTHESIS' : `ALTERNATIVE ${idx}`}
                    </span>
                    <span className="text-foreground font-bold text-sm">
                      {(hyp.probability * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Title & Bias */}
                  <div>
                    <h3 className="font-semibold text-foreground text-sm font-sans">{hyp.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] text-foreground-muted">Bias:</span>
                      <span className={cn(
                        'text-[10px] font-bold',
                        hyp.bias === 'LONG' ? 'text-signal-green' : hyp.bias === 'SHORT' ? 'text-signal-red' : 'text-foreground-secondary'
                      )}>
                        {hyp.bias}
                      </span>
                    </div>
                  </div>

                  {/* Supporting Evidence */}
                  <div className="space-y-1 pt-2 border-t border-border/60">
                    <div className="text-[10px] uppercase text-signal-green flex items-center space-x-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Supporting Evidence ({hyp.supportingEvidence.length})</span>
                    </div>
                    {hyp.supportingEvidence.length === 0 ? (
                      <p className="text-[11px] text-foreground-muted italic">None observed yet.</p>
                    ) : (
                      hyp.supportingEvidence.map((ev, i) => (
                        <div key={i} className="p-1.5 rounded bg-surface-secondary/70 border border-border/50 text-[11px] text-foreground-secondary">
                          • {ev.description}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Contradicting Evidence */}
                  <div className="space-y-1 pt-2 border-t border-border/60">
                    <div className="text-[10px] uppercase text-signal-red flex items-center space-x-1 font-bold">
                      <XCircle className="w-3 h-3" />
                      <span>Contradicting Evidence ({hyp.contradictingEvidence.length})</span>
                    </div>
                    {hyp.contradictingEvidence.length === 0 ? (
                      <p className="text-[11px] text-foreground-muted italic">No rule violations detected.</p>
                    ) : (
                      hyp.contradictingEvidence.map((ev, i) => (
                        <div key={i} className="p-1.5 rounded bg-signal-red/10 border border-signal-red/20 text-[11px] text-signal-red">
                          • {ev.description}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Missing Evidence */}
                  <div className="space-y-1 pt-2 border-t border-border/60">
                    <div className="text-[10px] uppercase text-signal-amber flex items-center space-x-1 font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Missing Conditions ({hyp.missingEvidence.length})</span>
                    </div>
                    {hyp.missingEvidence.map((m, i) => (
                      <div key={i} className="p-1.5 rounded bg-surface-tertiary text-[11px] text-foreground-muted">
                        • {m}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invalidation Trigger */}
                <div className="p-2.5 rounded bg-surface-secondary/80 border border-border text-[10px] space-y-1">
                  <span className="text-foreground-muted uppercase block font-bold">Invalidation Condition:</span>
                  <span className="text-signal-amber font-sans leading-tight block">
                    {hyp.invalidationCondition}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: WORLD MODEL & SEQUENCE MEMORY */}
      {activeTab === 'world' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-foreground-secondary">
            Structured representation of the AI’s current market model. Meaning is derived from the chronological sequence of events rather than single screenshots.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Structural Boundaries */}
            <div className="p-4 rounded-lg bg-surface-primary border border-border space-y-3">
              <h3 className="font-semibold text-foreground text-sm font-sans flex items-center space-x-2">
                <Target className="w-4 h-4 text-accent" />
                <span>Structural Levels & Liquidity</span>
              </h3>

              <div className="space-y-2">
                <div className="p-2.5 rounded bg-surface-secondary border border-border space-y-1">
                  <span className="text-[10px] text-foreground-muted uppercase block">Key Resistance Band</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(data?.worldState?.resistanceLevels || []).map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-signal-red/10 border border-signal-red/20 text-signal-red font-bold">
                        {r.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-surface-secondary border border-border space-y-1">
                  <span className="text-[10px] text-foreground-muted uppercase block">Key Support Band</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(data?.worldState?.supportLevels || []).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-signal-green/10 border border-signal-green/20 text-signal-green font-bold">
                        {s.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-surface-secondary border border-border space-y-1">
                  <span className="text-[10px] text-foreground-muted uppercase block">Liquidity Zones</span>
                  {(data?.worldState?.liquidityZones || []).map((z, i) => (
                    <div key={i} className="text-[11px] text-accent">
                      {z}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamics & Regime */}
            <div className="p-4 rounded-lg bg-surface-primary border border-border space-y-3">
              <h3 className="font-semibold text-foreground text-sm font-sans flex items-center space-x-2">
                <Activity className="w-4 h-4 text-accent" />
                <span>Market Dynamics & Regime</span>
              </h3>

              <div className="space-y-2">
                <div className="p-2.5 rounded bg-surface-secondary border border-border flex items-center justify-between">
                  <span className="text-foreground-muted uppercase text-[10px]">Market Regime:</span>
                  <span className="text-accent font-bold">{data?.worldState?.marketRegime || 'RANGE_BOUND'}</span>
                </div>

                <div className="p-2.5 rounded bg-surface-secondary border border-border flex items-center justify-between">
                  <span className="text-foreground-muted uppercase text-[10px]">Momentum State:</span>
                  <span className="text-foreground font-semibold">{data?.worldState?.momentum || 'NEUTRAL'}</span>
                </div>

                <div className="p-2.5 rounded bg-surface-secondary border border-border flex items-center justify-between">
                  <span className="text-foreground-muted uppercase text-[10px]">Volatility State:</span>
                  <span className={cn(
                    'font-semibold',
                    data?.worldState?.volatility === 'EXPANDED' ? 'text-signal-amber' : 'text-foreground'
                  )}>
                    {data?.worldState?.volatility || 'NORMAL'}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-surface-secondary border border-border flex items-center justify-between">
                  <span className="text-foreground-muted uppercase text-[10px]">Active Scenario:</span>
                  <span className="text-foreground font-semibold">{data?.worldState?.activeScenario || 'Observation'}</span>
                </div>
              </div>
            </div>

            {/* Chronological Event Sequence */}
            <div className="p-4 rounded-lg bg-surface-primary border border-border space-y-3">
              <h3 className="font-semibold text-foreground text-sm font-sans flex items-center space-x-2">
                <Clock className="w-4 h-4 text-accent" />
                <span>Temporal Event Sequence (Section 6)</span>
              </h3>

              <div className="space-y-1.5">
                {(data?.worldState?.recentEvents || []).map((ev, i) => (
                  <div key={i} className="p-2 rounded bg-surface-secondary border border-border/70 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-foreground-muted">
                      <span className="text-accent font-bold">{ev.eventType}</span>
                      <span suppressHydrationWarning>{ev.timestamp}</span>
                    </div>
                    <p className="text-foreground-secondary text-[11px] font-sans">{ev.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COUNTERFACTUAL REASONING ("WHAT WOULD CHANGE MY MIND") */}
      {activeTab === 'counterfactuals' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-foreground-secondary">
            Section 12: The AI explicitly reasons about what specific future market behavior would invalidate its current thesis or confirm an alternative scenario.
          </div>

          <div className="space-y-3">
            {(data?.whatWouldChangeMyMind || []).map((item, idx) => {
              const [condition, consequence] = item.split('->');
              return (
                <div key={idx} className="p-4 rounded-lg bg-surface-primary border border-border space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-signal-amber/15 border border-signal-amber/30 text-signal-amber">
                      TRIGGER {idx + 1}
                    </span>
                    <span className="text-foreground font-semibold text-xs font-sans">{condition.trim()}</span>
                  </div>
                  {consequence && (
                    <div className="p-2.5 rounded bg-surface-secondary border border-border/60 text-foreground-secondary font-sans leading-relaxed text-[11px] pl-3 border-l-2 border-l-accent">
                      <strong>Consequence:</strong> {consequence.trim()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVE LEARNING — AI QUESTIONS FOR TEACHER */}
      {activeTab === 'questions' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-foreground-secondary flex items-center justify-between">
            <span>
              Section 13 & 37: When the AI detects uncertainty or edge-case confluences, it actively formulates questions for you rather than blindly assuming rules.
            </span>
            <span className="text-accent font-semibold">Active Inquiries</span>
          </div>

          <div className="space-y-3">
            {(data?.questions || []).map((q) => (
              <div key={q.id} className="p-5 rounded-lg bg-surface-primary border border-accent/40 space-y-3 shadow-lg shadow-accent/5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/30">
                    PENDING INQUIRY
                  </span>
                  <span className="text-[10px] text-foreground-muted" suppressHydrationWarning>
                    {new Date(q.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-semibold text-foreground text-sm font-sans leading-relaxed">
                  &ldquo;{q.question}&rdquo;
                </h3>

                <div className="p-3 rounded bg-surface-secondary border border-border space-y-1 text-[11px]">
                  <span className="text-foreground-muted uppercase text-[10px] block font-bold">Contextual Observation:</span>
                  <p className="text-foreground-secondary font-sans">{q.context}</p>
                  {q.proposedAction && (
                    <p className="text-accent font-mono text-[10px] mt-1 pt-1 border-t border-border/50">
                      <strong>Proposed Adaptation:</strong> {q.proposedAction}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    disabled={actionInProgress === q.id}
                    onClick={() => handleAnswerQuestion(q.id, 'YES')}
                    className="px-3.5 py-1.5 rounded bg-signal-green/20 border border-signal-green/40 text-signal-green font-bold hover:bg-signal-green/30 transition-colors flex items-center space-x-1.5"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>YES (Apply Exception)</span>
                  </button>

                  <button
                    disabled={actionInProgress === q.id}
                    onClick={() => handleAnswerQuestion(q.id, 'NO')}
                    className="px-3.5 py-1.5 rounded bg-signal-red/20 border border-signal-red/40 text-signal-red font-bold hover:bg-signal-red/30 transition-colors flex items-center space-x-1.5"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>NO</span>
                  </button>

                  <button
                    disabled={actionInProgress === q.id}
                    onClick={() => handleAnswerQuestion(q.id, 'IGNORE')}
                    className="px-3 py-1.5 rounded bg-surface-secondary border border-border text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PROPOSED PRINCIPLES — GENERALIZED LESSONS */}
      {activeTab === 'principles' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-foreground-secondary">
            Section 8: Generalized Lessons identify underlying principles across multiple lessons and corrections. Principles remain PROPOSED until you approve them.
          </div>

          <div className="space-y-3">
            {(data?.principles || []).map((p) => (
              <div key={p.id} className="p-4 rounded-lg bg-surface-primary border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold',
                      p.status === 'APPROVED' ? 'bg-signal-green/15 text-signal-green border border-signal-green/30' : 'bg-signal-amber/15 text-signal-amber border border-signal-amber/30'
                    )}>
                      {p.status}
                    </span>
                    <span className="text-[10px] text-foreground-muted">Scope: {p.scope}</span>
                    <span className="text-[10px] text-accent">Confidence: {(p.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground font-sans">{p.title}</h3>
                  <p className="text-xs text-foreground-secondary mt-1 font-sans leading-relaxed">
                    &ldquo;{p.statement}&rdquo;
                  </p>
                </div>

                <div className="p-2.5 rounded bg-surface-secondary border border-border/60 text-[11px] text-foreground-muted font-sans">
                  <strong>Inference Rationale:</strong> {p.rationale}
                </div>

                {p.status === 'PROPOSED' && (
                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      disabled={actionInProgress === p.id}
                      onClick={() => handleReviewPrinciple(p.id, 'APPROVED')}
                      className="px-3.5 py-1.5 rounded bg-accent text-background font-semibold hover:bg-accent-hover transition-colors"
                    >
                      Approve Principle
                    </button>
                    <button
                      disabled={actionInProgress === p.id}
                      onClick={() => handleReviewPrinciple(p.id, 'REJECTED')}
                      className="px-3 py-1.5 rounded bg-surface-secondary border border-border text-foreground-muted hover:text-foreground transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: EPISODIC EXPERIENCE MEMORY */}
      {activeTab === 'experiences' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-foreground-secondary">
            Section 9 & 14: Episodic memory logs past situations, decisions, and outcomes. Used as structural evidence to evaluate novel market scenarios.
          </div>

          <div className="space-y-3">
            {(data?.experiences || []).map((exp) => (
              <div key={exp.id} className="p-4 rounded-lg bg-surface-primary border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-accent font-bold">{exp.market} · {exp.timeframe}</span>
                  <span className="text-foreground-muted text-[10px]" suppressHydrationWarning>
                    {new Date(exp.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-foreground font-medium text-xs font-sans">{exp.situationSummary}</p>
                <div className="p-2 rounded bg-surface-secondary border border-border text-[11px] text-foreground-secondary">
                  <strong>AI Decision:</strong> <span className="text-accent font-bold">{exp.aiDecision}</span> — {exp.aiReasoning}
                </div>
                {exp.learnedInsight && (
                  <p className="text-[11px] text-signal-green">
                    <strong>Learned Insight:</strong> {exp.learnedInsight}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: RULES & NESTED EXCEPTIONS (Preserved & Enhanced) */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-xs font-mono text-foreground-secondary flex items-center justify-between">
            <span>
              Specificity Precedence: Higher specificity score rules take contextual precedence over broad base rules without triggering false contradiction flags.
            </span>
            <span className="text-accent font-semibold">Ordered by Specificity & Priority</span>
          </div>

          <div className="space-y-3">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'p-4 rounded-lg bg-surface-primary border transition-colors space-y-3',
                  rule.status === 'SUPERSEDED' ? 'border-border/50 opacity-60' : 'border-border hover:border-accent/40'
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 border border-accent/30 text-accent font-semibold">
                      Specificity: {rule.specificity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-secondary text-foreground-secondary border border-border">
                      {rule.tradePhase}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-secondary text-foreground-secondary border border-border">
                      {rule.scope}
                    </span>
                    {rule.teacherApproved && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-signal-green/10 text-signal-green border border-signal-green/30 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Teacher Approved</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-foreground-muted">
                    Concept: <strong className="text-foreground">{rule.concept?.name || 'General'}</strong>
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground">{rule.title}</h3>
                  <p className="text-xs text-foreground-secondary mt-1 font-mono leading-relaxed">
                    &ldquo;{rule.statement}&rdquo;
                  </p>
                </div>

                {rule.exceptions && rule.exceptions.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-signal-amber flex items-center space-x-1.5">
                      <GitBranch className="w-3 h-3" />
                      <span>Nested Exception Hierarchy (Base → Child Exception):</span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {rule.exceptions.map((exc) => (
                        <div key={exc.id} className="space-y-1.5">
                          <div className="p-2.5 rounded bg-surface-secondary/70 border border-border/80 text-xs font-mono space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-signal-amber flex items-center space-x-1">
                                <ArrowRight className="w-3 h-3 text-accent" />
                                <span>Exception (Tier 1): {exc.description}</span>
                              </span>
                              <span className="text-[10px] text-accent font-semibold">
                                Override: {exc.overrideBehavior}
                              </span>
                            </div>
                          </div>

                          {exc.childExceptions && exc.childExceptions.length > 0 && (
                            <div className="pl-6 space-y-1">
                              {exc.childExceptions.map((child) => (
                                <div
                                  key={child.id}
                                  className="p-2 rounded bg-surface-tertiary/70 border border-border text-[11px] font-mono space-y-0.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-signal-green font-semibold flex items-center space-x-1">
                                      <ChevronRight className="w-3 h-3 text-signal-green" />
                                      <span>Nested Exception (Tier 2): {child.description}</span>
                                    </span>
                                    <span className="text-[9px] text-accent">
                                      Override: {child.overrideBehavior}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: CORRECTIONS LOG */}
      {activeTab === 'corrections' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded bg-surface-secondary/40 border border-border text-foreground-secondary flex items-center justify-between">
            <span>
              Continuous Pedagogical Loop: Every teacher correction updates the AI’s knowledge weights and prevents repeat errors.
            </span>
            <button
              onClick={() => setIsCorrectModalOpen(true)}
              className="px-2.5 py-1 rounded bg-accent text-background font-semibold hover:bg-accent-hover transition-colors"
            >
              + Add Correction
            </button>
          </div>

          {(data?.corrections || []).map((corr) => (
            <div key={corr.id} className="p-4 rounded-lg bg-surface-primary border border-border space-y-2.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-signal-amber/15 text-signal-amber border border-signal-amber/30 font-semibold">
                    {corr.correctionType}
                  </span>
                  <span className="text-foreground-muted text-[11px]">
                    {corr.conceptName ? `Concept: ${corr.conceptName}` : 'General Rule'}
                  </span>
                </div>
                <span className="text-[10px] text-foreground-muted flex items-center space-x-1" suppressHydrationWarning>
                  <Clock className="w-3 h-3" />
                  <span>{new Date(corr.createdAt).toLocaleString()}</span>
                </span>
              </div>

              <div className="p-2.5 rounded bg-surface-secondary border border-border/70 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-foreground-muted text-[10px] uppercase">AI Stated:</span>
                  <span className="text-signal-red font-semibold">{corr.previousAiDecision}</span>
                  <ArrowRight className="w-3 h-3 text-accent" />
                  <span className="text-foreground-muted text-[10px] uppercase">Teacher Corrected To:</span>
                  <span className="text-signal-green font-semibold">{corr.correctedDecision}</span>
                </div>
              </div>

              <div className="text-xs text-foreground-secondary font-sans leading-relaxed">
                <strong>Teacher Explanation:</strong> &ldquo;{corr.teacherExplanation}&rdquo;
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Teacher Correction Modal */}
      <CorrectAIModal
        isOpen={isCorrectModalOpen}
        onClose={() => setIsCorrectModalOpen(false)}
        aiDecision="OBSERVATION / SETUP_FORMING"
        conceptName={data?.concepts?.[0]?.name}
        onCorrectionSaved={() => loadBrainData()}
      />
    </div>
  );
}
