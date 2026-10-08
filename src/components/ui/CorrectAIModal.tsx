'use client';

import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, X, Send, AlertTriangle } from 'lucide-react';
import { CorrectionType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CorrectAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiDecision: string;
  conceptName?: string;
  ruleId?: string;
  onCorrectionSaved?: () => void;
}

export function CorrectAIModal({
  isOpen,
  onClose,
  aiDecision,
  conceptName,
  ruleId,
  onCorrectionSaved,
}: CorrectAIModalProps) {
  const [correctionType, setCorrectionType] = useState<CorrectionType>('WRONG_SETUP');
  const [correctedDecision, setCorrectedDecision] = useState('WAIT');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousAiDecision: aiDecision,
          correctedDecision,
          correctionType,
          explanation,
          conceptName,
          ruleId,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onCorrectionSaved?.();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to submit correction:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-surface-primary border border-border rounded-lg max-w-lg w-full overflow-hidden shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-secondary/50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-signal-amber">
            <ShieldAlert className="w-4 h-4" />
            <span className="font-semibold text-foreground">Teach AI Correction</span>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-signal-green mx-auto" />
            <div className="text-foreground font-semibold">Correction Learned!</div>
            <p className="text-foreground-muted text-[11px]">
              Structured learning data registered in AI memory.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* AI Decision vs Expected */}
            <div className="p-3 rounded bg-surface-secondary border border-border space-y-1">
              <span className="text-[10px] text-foreground-muted block uppercase">Current AI Decision</span>
              <span className="text-signal-amber font-bold">{aiDecision}</span>
            </div>

            {/* Correction Type */}
            <div className="space-y-1.5">
              <label className="text-foreground-secondary text-[11px] block">Correction Type</label>
              <select
                value={correctionType}
                onChange={(e) => setCorrectionType(e.target.value as CorrectionType)}
                className="w-full bg-surface-secondary border border-border rounded p-2 text-foreground focus:outline-none focus:border-accent"
              >
                <option value="WRONG_SETUP">Wrong setup</option>
                <option value="MISSING_CONDITION">Missing condition</option>
                <option value="EXCEPTION_IGNORED">Exception ignored</option>
                <option value="WRONG_ENTRY">Wrong entry</option>
                <option value="WRONG_SL">Wrong SL</option>
                <option value="WRONG_TP">Wrong TP</option>
                <option value="CONTEXT_MISUNDERSTOOD">Context misunderstood</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Expected Decision */}
            <div className="space-y-1.5">
              <label className="text-foreground-secondary text-[11px] block">Expected Decision</label>
              <select
                value={correctedDecision}
                onChange={(e) => setCorrectedDecision(e.target.value)}
                className="w-full bg-surface-secondary border border-border rounded p-2 text-foreground focus:outline-none focus:border-accent"
              >
                <option value="WAIT">Wait / No Trade</option>
                <option value="LONG_CANDIDATE">Long Candidate</option>
                <option value="SHORT_CANDIDATE">Short Candidate</option>
                <option value="AVOID_CHASE">Avoid Chase / Extended</option>
                <option value="WAIT_FOR_RETEST">Wait for Retest</option>
                <option value="INVALID_SETUP">Invalid Setup</option>
              </select>
            </div>

            {/* Teacher Explanation */}
            <div className="space-y-1.5">
              <label className="text-foreground-secondary text-[11px] block">
                Teacher Explanation (Why was this wrong? What rule/context applies?)
              </label>
              <textarea
                rows={3}
                required
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder='e.g. "The breakout candle was too extended, therefore wait for retest before considering entry."'
                className="w-full bg-surface-secondary border border-border rounded p-2.5 text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent resize-none text-[11px]"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !explanation.trim()}
                className="px-3.5 py-1.5 rounded bg-accent text-background font-semibold hover:bg-accent-hover transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Save Correction'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
