'use client';

import React from 'react';
import {
  ShieldCheck,
  Clock,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  Quote,
  Eye,
  Layers,
} from 'lucide-react';
import { GroundedProvenance, KnowledgeSourceType } from '@/lib/types/adaptive';
import { KnowledgeProvenanceEngine } from '@/lib/services/knowledgeProvenanceEngine';
import { cn } from '@/lib/utils';

interface WhyProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  provenance?: GroundedProvenance;
  currentPrice?: number;
  matchedLevelName?: string;
  expectedBehavior?: string;
  state?: string;
  bias?: string;
}

export function WhyProvenanceModal({
  isOpen,
  onClose,
  provenance,
  currentPrice,
  matchedLevelName,
  expectedBehavior,
  state = 'WATCH',
  bias = 'UNDEFINED',
}: WhyProvenanceModalProps) {
  if (!isOpen) return null;

  const badge = KnowledgeProvenanceEngine.getProvenanceBadge(
    provenance?.sourceType || 'TEACHER_TAUGHT'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-primary border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col font-mono text-xs max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-secondary">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="font-bold text-foreground text-sm uppercase">Why This Analysis?</span>
          </div>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground p-1 rounded hover:bg-surface-tertiary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Provenance Status Strip */}
          <div className="flex items-center justify-between p-2.5 rounded bg-surface-secondary border border-border text-[11px]">
            <span className="text-foreground-muted">Knowledge Classification:</span>
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold border', badge.color)}>
              {badge.label}
            </span>
          </div>

          {/* Teacher Source & Timestamp */}
          <div className="p-3.5 rounded bg-surface-secondary/70 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-foreground-muted uppercase font-bold flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-accent" />
                <span>Teacher Source Lesson</span>
              </span>
              {provenance?.sourceTimestampFormatted && (
                <span className="text-[10px] text-accent font-bold px-1.5 py-0.5 rounded bg-surface-tertiary">
                  Timestamp: {provenance.sourceTimestampFormatted}
                </span>
              )}
            </div>
            <div className="text-foreground font-semibold text-xs">
              {provenance?.sourceLessonTitle || 'Support & Resistance Methodology'}
            </div>
          </div>

          {/* Teacher Quotes */}
          <div className="p-3.5 rounded bg-accent/5 border border-accent/20 space-y-2">
            <span className="text-[10px] text-accent uppercase font-bold flex items-center space-x-1.5">
              <Quote className="w-3.5 h-3.5" />
              <span>Teacher Taught</span>
            </span>
            <p className="text-foreground font-sans text-xs italic leading-relaxed">
              {provenance?.whyThisAnalysis.teacherTaughtQuote ||
                '"This is the support zone... price respected this level before."'}
            </p>
            {provenance?.whyThisAnalysis.laterTeachingQuote && (
              <div className="pt-2 border-t border-accent/15">
                <span className="text-[10px] text-foreground-muted uppercase font-semibold">Conditional Rule:</span>
                <p className="text-foreground-secondary font-sans text-xs italic mt-0.5">
                  {provenance.whyThisAnalysis.laterTeachingQuote}
                </p>
              </div>
            )}
          </div>

          {/* Current Observation */}
          <div className="p-3.5 rounded bg-blue-500/5 border border-blue-500/20 space-y-1.5">
            <span className="text-[10px] text-blue-400 uppercase font-bold flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Current Market Observation</span>
            </span>
            <p className="text-foreground-secondary font-sans text-xs leading-relaxed">
              {provenance?.whyThisAnalysis.currentObservation ||
                `Price is approaching or testing ${matchedLevelName || 'learned zone'} at ${currentPrice || 'active price'}.`}
            </p>
          </div>

          {/* Conclusion */}
          <div className="p-3.5 rounded bg-surface-secondary border border-border space-y-1.5">
            <span className="text-[10px] text-foreground-muted uppercase font-bold">Conclusion</span>
            <p className="text-foreground font-sans text-xs font-semibold">
              {provenance?.whyThisAnalysis.conclusion ||
                `Potential reaction. Current State: ${state}, Bias: ${bias}.`}
            </p>
          </div>

          {/* NOT TAUGHT Section (Honest Scope Limits) */}
          <div className="p-3.5 rounded bg-rose-500/5 border border-rose-500/25 space-y-2">
            <div className="flex items-center space-x-1.5 text-rose-400 text-[10px] font-bold uppercase">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>NOT TAUGHT BY TEACHER (Honest Boundaries)</span>
            </div>
            <ul className="space-y-1 text-[11px] text-foreground-secondary font-sans">
              {(provenance?.whyThisAnalysis.notTaught || [
                'No teacher-defined entry rule currently exists.',
                'No teacher-defined Stop-Loss formula currently exists.',
                'No teacher-defined Take-Profit formula currently exists.',
                'Directional bias remains UNDEFINED.',
              ]).map((item, idx) => (
                <li key={idx} className="flex items-start space-x-1.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-surface-secondary">
          <span className="text-[10px] text-foreground-muted">
            Brain Version: {provenance?.knowledgeVersion || 'v1.1'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
