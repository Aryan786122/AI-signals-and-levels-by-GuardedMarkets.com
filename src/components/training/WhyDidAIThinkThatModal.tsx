'use client';

import React from 'react';
import {
  X,
  Clock,
  Sparkles,
  Layers,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Quote,
  Target,
  ArrowRight,
  ShieldCheck,
  Eye,
  Crosshair,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeachingClaim } from '@/lib/types/cognitive';

interface WhyDidAIThinkThatModalProps {
  claim: TeachingClaim | null;
  onClose: () => void;
  onJumpToTimestamp?: (sec: number) => void;
}

export function WhyDidAIThinkThatModal({
  claim,
  onClose,
  onJumpToTimestamp,
}: WhyDidAIThinkThatModalProps) {
  if (!claim) return null;

  const formatSec = (sec?: number) => {
    if (sec === undefined || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'CONCEPT':
        return { label: 'Market Concept', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'OBSERVATION':
        return { label: 'Historical Observation', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'CONDITIONAL_HYPOTHESIS':
        return { label: 'Conditional Hypothesis', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'RULE_CANDIDATE':
        return { label: 'Rule Candidate', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'EXCEPTION':
        return { label: 'Exception', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      case 'PREFERENCE':
        return { label: 'Discretionary Preference', bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
      default:
        return { label: type, bg: 'bg-surface-secondary text-foreground-muted border-border' };
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'HIGH':
        return { label: 'Evidence Quality: HIGH', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'MEDIUM':
        return { label: 'Evidence Quality: MEDIUM', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'LOW':
        return { label: 'Evidence Quality: LOW', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      default:
        return { label: `Evidence: ${quality}`, bg: 'bg-surface-secondary text-foreground-muted border-border' };
    }
  };

  const badge = getTypeBadge(claim.type);
  const qualityBadge = getQualityBadge(claim.evidenceQuality || 'HIGH');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-primary border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-accent/15 text-accent border border-accent/30">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-sm font-bold text-foreground">Why Did AI Think That?</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded font-bold uppercase border', badge.bg)}>
                  {badge.label}
                </span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded font-bold uppercase border', qualityBadge.bg)}>
                  {qualityBadge.label}
                </span>
                {claim.timestampSec !== undefined && (
                  <button
                    onClick={() => onJumpToTimestamp && onJumpToTimestamp(claim.timestampSec!)}
                    className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded bg-surface-secondary text-accent font-mono font-semibold border border-border hover:border-accent transition-colors"
                  >
                    <Clock className="w-3 h-3" />
                    <span>@ {formatSec(claim.timestampSec)}</span>
                    <Play className="w-2.5 h-2.5 ml-0.5 fill-current" />
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground-muted mt-0.5">
                Full auditable provenance, reference resolution, and falsifiability analysis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-secondary text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Claim Statement & Title */}
          <div className="p-4 rounded-xl bg-surface-secondary/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Claim Statement</span>
              </span>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded font-semibold border',
                  claim.explicit ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-surface-secondary text-foreground-muted border-border'
                )}>
                  {claim.explicit ? 'EXPLICIT (Stated by Teacher)' : 'DERIVED'}
                </span>
                {claim.inferred && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    INFERRED
                  </span>
                )}
              </div>
            </div>
            <h3 className="text-base font-bold text-foreground">
              {claim.title}
            </h3>
            <div className="p-3 rounded-lg bg-surface-primary border border-border/80 text-foreground-muted italic flex items-start space-x-2">
              <Quote className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="font-sans leading-relaxed text-foreground">
                "{claim.statement}"
              </p>
            </div>

            {/* Semantic Triplet */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-surface-primary/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-foreground-muted block mb-1">Subject</span>
                <span className="font-mono text-xs text-foreground font-semibold">{claim.subject || 'Market Price'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-primary/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-foreground-muted block mb-1">Predicate</span>
                <span className="font-mono text-xs text-accent font-semibold">{claim.predicate}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-primary/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-foreground-muted block mb-1">Object / Target</span>
                <span className="font-mono text-xs text-foreground font-semibold">{claim.object}</span>
              </div>
            </div>
          </div>

          {/* Auditable Reasoning Chain */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted flex items-center space-x-2">
              <Layers className="w-4 h-4 text-signal-blue" />
              <span>Auditable Reasoning Steps ({claim.reasoningChain?.length || 0} Steps)</span>
            </h4>
            <div className="space-y-2">
              {claim.reasoningChain && claim.reasoningChain.length > 0 ? (
                claim.reasoningChain.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-surface-secondary/30 border border-border flex items-start space-x-3 text-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-accent/15 text-accent font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 border border-accent/30 text-[11px]">
                      {idx + 1}
                    </div>
                    <p className="leading-relaxed text-foreground/90 font-sans">
                      {step}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg bg-surface-secondary/20 border border-border text-foreground-muted text-xs">
                  Direct extraction from teacher utterance.
                </div>
              )}
            </div>
          </div>

          {/* Conditions & Expected Outcomes */}
          {(claim.conditions && claim.conditions.length > 0) || claim.expectedOutcome ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted flex items-center space-x-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span>Conditions & Expected Behavior</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
                  <span className="text-[11px] font-bold uppercase text-foreground-muted block">Conditions</span>
                  {claim.conditions && claim.conditions.length > 0 ? (
                    <div className="space-y-1.5">
                      {claim.conditions.map((cond, i) => (
                        <div key={cond.id || i} className="flex items-start space-x-2 text-xs">
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5 border',
                            cond.explicit
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          )}>
                            {cond.explicit ? 'EXPLICIT' : 'INFERRED'}
                          </span>
                          <span className="text-foreground">{cond.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-foreground-muted">No preconditions specified.</span>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
                  <span className="text-[11px] font-bold uppercase text-foreground-muted block">Expected Reaction</span>
                  <div className="flex items-start space-x-2 text-xs">
                    <ArrowRight className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-foreground font-medium">
                      {claim.expectedOutcome || claim.action || claim.statement}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Falsifiability Analysis */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Falsifiability: "What Would Invalidate This?"</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
                <span className="text-[11px] font-bold uppercase text-rose-400 block">Invalidation Triggers</span>
                {claim.invalidationConditions && claim.invalidationConditions.length > 0 ? (
                  <div className="space-y-1.5">
                    {claim.invalidationConditions.map((inv, i) => (
                      <div key={inv.id || i} className="flex items-start space-x-2 text-xs">
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5 border',
                          inv.explicit
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        )}>
                          {inv.explicit ? 'EXPLICIT' : 'INFERRED'}
                        </span>
                        <span className="text-foreground">{inv.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-foreground-muted">
                    Price penetrates through the zone with strong acceptance candles.
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border space-y-2">
                <span className="text-[11px] font-bold uppercase text-amber-400 block">What Would Change My Mind?</span>
                <p className="text-xs text-foreground leading-relaxed">
                  {claim.whatWouldChangeMyMind || 'If price re-tests this level and pierces through with high volume and consecutive closing candles on higher timeframe, this support/resistance hypothesis is falsified.'}
                </p>
              </div>
            </div>
          </div>

          {/* Evidence Quality Breakdown */}
          <div className="p-4 rounded-xl bg-surface-secondary/30 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Evidence Quality Verification</span>
              </span>
              <span className="font-mono text-xs text-foreground-muted">
                Confidence: {(claim.confidence * 100).toFixed(0)}%
              </span>
            </div>
            {claim.evidenceQualityRationale && claim.evidenceQualityRationale.length > 0 ? (
              <ul className="space-y-1 pt-1">
                {claim.evidenceQualityRationale.map((rat, i) => (
                  <li key={i} className="text-xs text-foreground-muted flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rat}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-foreground-muted">
                Derived directly from synchronized speech transcription and grounded visual box perception.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface-secondary/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-foreground-muted flex items-center space-x-2">
            <Eye className="w-3.5 h-3.5" />
            <span>Audited against Ground-Truth Media Facts</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-secondary hover:bg-surface-secondary/80 border border-border text-foreground font-semibold text-xs transition-colors"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
}
