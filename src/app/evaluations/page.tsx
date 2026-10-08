'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  BookOpen,
  Brain,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Target,
  ChevronRight,
  Info,
  HelpCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn, formatDate } from '@/lib/utils';
import { AdaptiveQuestionItem, QuestionEvaluationResult, ConceptMasterySummary } from '@/lib/types/adaptive';

type QuizState = 'loading' | 'idle' | 'answering' | 'result' | 'done' | 'empty';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MCQ: { label: 'Multiple Choice', color: 'text-accent bg-accent/10 border-accent/30' },
  TRUE_FALSE: { label: 'True / False', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  SCENARIO: { label: 'Scenario', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  WHAT_WOULD_YOU_DO: { label: 'What Would You Do?', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  EXCEPTION: { label: 'Exception Rule', color: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
  COUNTEREXAMPLE: { label: 'Counterexample', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'text-emerald-400',
  MEDIUM: 'text-amber-400',
  HARD: 'text-rose-400',
};

const MASTERY_STATUS_STYLES: Record<string, string> = {
  STRONG: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  ADEQUATE: 'text-accent bg-accent/10 border-accent/30',
  WEAK: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  UNTESTED: 'text-foreground-muted bg-surface-tertiary border-border',
};

export default function EvaluationsPage() {
  const [quizState, setQuizState] = useState<QuizState>('loading');
  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestionItem | null>(null);
  const [questionQueue, setQuestionQueue] = useState<AdaptiveQuestionItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<QuestionEvaluationResult | null>(null);
  const [mastery, setMastery] = useState<ConceptMasterySummary[]>([]);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, total: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setQuizState('loading');
    setLoadError(null);
    try {
      const res = await fetch('/api/brain/questions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const questions: AdaptiveQuestionItem[] = data.questions || [];
      if (questions.length === 0) {
        setQuizState('empty');
        return;
      }
      setQuestionQueue(questions);
      setQueueIndex(0);
      setCurrentQuestion(questions[0]);
      setQuizState('answering');
    } catch (err) {
      console.error('Failed to load questions:', err);
      setLoadError('Could not load questions. Ensure a lesson is approved first.');
      setQuizState('idle');
    }
  }, []);

  const loadMastery = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/levels');
      if (res.ok) {
        const data = await res.json();
        if (data.mastery) setMastery(data.mastery);
      }
    } catch {
      // mastery is supplementary — silently ignore
    }
  }, []);

  useEffect(() => {
    loadQuestions();
    loadMastery();
  }, [loadQuestions, loadMastery]);

  const handleSubmit = async () => {
    if (selectedOption === null || !currentQuestion) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/brain/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion.id, selectedIndex: selectedOption }),
      });
      if (!res.ok) throw new Error('Evaluation failed');
      const result: QuestionEvaluationResult = await res.json();
      setEvaluationResult(result);
      setSessionStats((s) => ({
        correct: s.correct + (result.isCorrect ? 1 : 0),
        wrong: s.wrong + (result.isCorrect ? 0 : 1),
        total: s.total + 1,
      }));
      setQuizState('result');
      await loadMastery();
    } catch (err) {
      console.error('Evaluation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    const result = evaluationResult;
    // If wrong and there's a follow-up question, inject it next
    if (result && !result.isCorrect && result.followUpQuestion) {
      const followUp = result.followUpQuestion;
      const newQueue = [
        ...questionQueue.slice(0, queueIndex + 1),
        followUp,
        ...questionQueue.slice(queueIndex + 1),
      ];
      setQuestionQueue(newQueue);
    }

    const nextIndex = queueIndex + 1;
    if (nextIndex >= questionQueue.length) {
      setQuizState('done');
    } else {
      setQueueIndex(nextIndex);
      setCurrentQuestion(questionQueue[nextIndex]);
      setSelectedOption(null);
      setEvaluationResult(null);
      setQuizState('answering');
    }
  };

  const handleRestart = () => {
    setSessionStats({ correct: 0, wrong: 0, total: 0 });
    setSelectedOption(null);
    setEvaluationResult(null);
    loadQuestions();
  };

  const accuracy = sessionStats.total > 0
    ? Math.round((sessionStats.correct / sessionStats.total) * 100)
    : null;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <Header
        title="AI Exam Mode — Adaptive Brain Test"
        subtitle="Questions generated from approved lesson knowledge — tests understanding, not memorization"
      />

      <div className="p-6 space-y-6 flex-1 max-w-6xl">
        {/* Session Stats Bar */}
        <div className="grid grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3.5 rounded border border-border bg-surface-primary">
            <span className="text-foreground-secondary text-[10px] uppercase">Questions Done</span>
            <div className="text-lg font-bold text-foreground mt-1">{sessionStats.total}</div>
          </div>
          <div className="p-3.5 rounded border border-border bg-surface-primary">
            <span className="text-foreground-secondary text-[10px] uppercase">Correct</span>
            <div className="text-lg font-bold text-emerald-400 mt-1">{sessionStats.correct}</div>
          </div>
          <div className="p-3.5 rounded border border-border bg-surface-primary">
            <span className="text-foreground-secondary text-[10px] uppercase">Mistakes</span>
            <div className="text-lg font-bold text-rose-400 mt-1">{sessionStats.wrong}</div>
          </div>
          <div className="p-3.5 rounded border border-border bg-surface-primary">
            <span className="text-foreground-secondary text-[10px] uppercase">Session Accuracy</span>
            <div className={cn('text-lg font-bold mt-1',
              accuracy === null ? 'text-foreground-muted' :
              accuracy >= 80 ? 'text-emerald-400' :
              accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'
            )}>
              {accuracy !== null ? `${accuracy}%` : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Question Card */}
          <div className="lg:col-span-7 border border-border rounded bg-surface-primary flex flex-col font-mono text-xs">
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center space-x-2 text-accent font-semibold uppercase text-xs">
                <Award className="w-4 h-4" />
                <span>Adaptive Knowledge Exam</span>
              </div>
              <div className="flex items-center space-x-2">
                {questionQueue.length > 0 && (
                  <span className="text-[10px] text-foreground-muted">
                    {Math.min(queueIndex + 1, questionQueue.length)} / {questionQueue.length}
                  </span>
                )}
                <button
                  onClick={handleRestart}
                  className="p-1.5 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground-muted hover:text-foreground border border-border transition-colors"
                  title="Reload questions"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Question Body */}
            <div className="flex-1 p-5 space-y-5">
              {quizState === 'loading' && (
                <div className="flex flex-col items-center justify-center py-16 space-y-3 text-foreground-muted">
                  <Brain className="w-8 h-8 animate-pulse" />
                  <p>Loading questions from Canonical Brain...</p>
                </div>
              )}

              {quizState === 'empty' && (
                <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
                  <BookOpen className="w-10 h-10 text-foreground-muted" />
                  <div className="space-y-1.5">
                    <p className="text-foreground font-semibold">No questions available yet</p>
                    <p className="text-foreground-muted font-sans text-xs max-w-xs">
                      Approve a lesson in the Training workspace first. Questions are generated automatically from approved concepts, hypotheses, and preferences.
                    </p>
                  </div>
                  <a
                    href="/training"
                    className="px-4 py-2 rounded bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors"
                  >
                    Go to Training →
                  </a>
                </div>
              )}

              {(quizState === 'idle') && loadError && (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                  <p className="text-amber-400 text-center font-sans text-xs">{loadError}</p>
                  <button
                    onClick={loadQuestions}
                    className="px-4 py-2 rounded bg-surface-secondary border border-border hover:bg-surface-tertiary text-foreground text-xs"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {(quizState === 'answering' || quizState === 'result') && currentQuestion && (
                <div className="space-y-4">
                  {/* Question Type + Difficulty Badge */}
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold border',
                      TYPE_LABELS[currentQuestion.type]?.color || 'text-foreground-muted border-border'
                    )}>
                      {TYPE_LABELS[currentQuestion.type]?.label || currentQuestion.type}
                    </span>
                    <span className={cn('text-[10px] font-semibold', DIFFICULTY_COLORS[currentQuestion.difficulty])}>
                      {currentQuestion.difficulty}
                    </span>
                    {currentQuestion.isFollowUp && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/30 font-semibold">
                        Follow-up
                      </span>
                    )}
                  </div>

                  {/* Scenario Context */}
                  {currentQuestion.scenarioContext && (
                    <div className="p-3 rounded bg-surface-secondary border border-border space-y-1">
                      <span className="text-[10px] text-foreground-muted uppercase">Market Context</span>
                      <p className="text-foreground-secondary font-sans text-xs leading-relaxed">
                        {currentQuestion.scenarioContext}
                      </p>
                    </div>
                  )}

                  {/* Question Prompt */}
                  <div className="p-4 rounded bg-surface-secondary/60 border border-border">
                    <p className="text-foreground font-sans text-sm leading-relaxed font-semibold">
                      {currentQuestion.prompt}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, idx) => {
                      const isSelected = selectedOption === idx;
                      const isCorrect = evaluationResult && idx === currentQuestion.correctIndex;
                      const isWrong = evaluationResult && isSelected && !evaluationResult.isCorrect;

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (quizState === 'answering') setSelectedOption(idx);
                          }}
                          disabled={quizState === 'result'}
                          className={cn(
                            'w-full text-left px-4 py-3 rounded border text-xs font-sans transition-all',
                            quizState === 'result'
                              ? isCorrect
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                : isWrong
                                ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                                : 'bg-surface-secondary border-border text-foreground-muted'
                              : isSelected
                              ? 'bg-accent/15 border-accent/50 text-foreground'
                              : 'bg-surface-secondary border-border text-foreground-secondary hover:border-accent/40 hover:text-foreground'
                          )}
                        >
                          <span className="font-mono font-bold mr-2 text-foreground-muted">{String.fromCharCode(65 + idx)}.</span>
                          {option}
                          {quizState === 'result' && isCorrect && <CheckCircle2 className="inline w-3.5 h-3.5 ml-2 text-emerald-400" />}
                          {quizState === 'result' && isWrong && <XCircle className="inline w-3.5 h-3.5 ml-2 text-rose-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Result Feedback */}
                  {quizState === 'result' && evaluationResult && (
                    <div className={cn(
                      'p-4 rounded border space-y-3',
                      evaluationResult.isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-rose-500/10 border-rose-500/30'
                    )}>
                      <div className="flex items-center space-x-2">
                        {evaluationResult.isCorrect
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                        <span className={cn(
                          'font-bold text-xs',
                          evaluationResult.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                        )}>
                          {evaluationResult.isCorrect ? 'Correct!' : 'Incorrect'}
                        </span>
                      </div>

                      <p className="text-foreground-secondary font-sans text-xs leading-relaxed">
                        {evaluationResult.explanation}
                      </p>

                      {evaluationResult.misconception && (
                        <div className="p-2.5 rounded bg-amber-400/10 border border-amber-400/30 space-y-1">
                          <span className="text-amber-400 text-[10px] font-bold uppercase">Common Misconception Detected</span>
                          <p className="text-amber-300 font-sans text-[11px]">{evaluationResult.misconception}</p>
                        </div>
                      )}

                      {evaluationResult.teacherCorrection && (
                        <div className="p-2.5 rounded bg-accent/10 border border-accent/30 space-y-1">
                          <span className="text-accent text-[10px] font-bold uppercase">Teacher Correction</span>
                          <p className="text-foreground-secondary font-sans text-[11px]">{evaluationResult.teacherCorrection}</p>
                        </div>
                      )}

                      {!evaluationResult.isCorrect && evaluationResult.followUpQuestion && (
                        <div className="flex items-center space-x-2 text-amber-400 text-[11px] font-semibold">
                          <Info className="w-3.5 h-3.5" />
                          <span>A follow-up question has been queued to address this gap.</span>
                        </div>
                      )}

                      <div className="text-[10px] text-foreground-muted font-mono">
                        Mastery → {currentQuestion.knowledgeType}:{' '}
                        <span className={cn(
                          'font-bold',
                          evaluationResult.newMasteryScore >= 0.8 ? 'text-emerald-400' :
                          evaluationResult.newMasteryScore >= 0.5 ? 'text-amber-400' : 'text-rose-400'
                        )}>
                          {Math.round(evaluationResult.newMasteryScore * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Submit / Next Button */}
                  <div className="pt-2 flex justify-end">
                    {quizState === 'answering' && (
                      <button
                        onClick={handleSubmit}
                        disabled={selectedOption === null || isSubmitting}
                        className="px-5 py-2 rounded bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center space-x-2"
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>{isSubmitting ? 'Evaluating...' : 'Submit Answer'}</span>
                      </button>
                    )}
                    {quizState === 'result' && (
                      <button
                        onClick={handleNext}
                        className="px-5 py-2 rounded bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors flex items-center space-x-2"
                      >
                        <span>Next Question</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {quizState === 'done' && (
                <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
                  <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center text-3xl',
                    (accuracy || 0) >= 80 ? 'bg-emerald-500/20' : 'bg-amber-400/20'
                  )}>
                    {(accuracy || 0) >= 80 ? '🏆' : '📚'}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-foreground font-bold text-base">Session Complete</p>
                    <p className="text-foreground-secondary font-sans text-xs">
                      {sessionStats.correct} correct out of {sessionStats.total} questions • {accuracy}% accuracy
                    </p>
                  </div>
                  <div className="text-foreground-muted font-sans text-xs max-w-xs">
                    {(accuracy || 0) >= 80
                      ? 'Strong understanding demonstrated. The AI brain has registered your mastery scores.'
                      : 'Some gaps remain. Follow-up questions were generated to reinforce weak areas.'}
                  </div>
                  <button
                    onClick={handleRestart}
                    className="px-5 py-2 rounded bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors flex items-center space-x-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Start New Session</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Concept Mastery Breakdown */}
          <div className="lg:col-span-5 space-y-5 font-mono text-xs">
            {/* Mastery Table */}
            <div className="border border-border rounded bg-surface-primary p-4 space-y-3">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-foreground font-semibold uppercase">
                  <Brain className="w-4 h-4 text-accent" />
                  <span>Concept Mastery Brain State</span>
                </div>
                <button onClick={loadMastery} className="text-foreground-muted hover:text-foreground">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {mastery.length === 0 ? (
                <div className="text-center py-8 space-y-2 text-foreground-muted">
                  <HelpCircle className="w-7 h-7 mx-auto" />
                  <p className="font-sans text-xs">No mastery data yet. Answer questions to build your profile.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mastery.map((m) => (
                    <div key={m.conceptName} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-semibold text-[11px]">{m.conceptName}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-bold border',
                          MASTERY_STATUS_STYLES[m.status]
                        )}>
                          {m.status}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-secondary rounded overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded transition-all duration-500',
                            m.masteryScore >= 0.8 ? 'bg-emerald-400' :
                            m.masteryScore >= 0.5 ? 'bg-accent' : 'bg-rose-400'
                          )}
                          style={{ width: `${Math.round(m.masteryScore * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-foreground-muted">
                        <span>{m.totalAttempts} attempted</span>
                        <span>{m.correctAttempts} correct • {Math.round(m.masteryScore * 100)}%</span>
                      </div>
                      {m.knownMisconceptions.length > 0 && (
                        <div className="text-[10px] text-amber-400 font-sans">
                          ⚠ Misconceptions: {m.knownMisconceptions.slice(0, 2).join('; ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* About This System */}
            <div className="border border-border rounded bg-surface-primary p-4 space-y-3">
              <div className="flex items-center space-x-2 text-foreground font-semibold uppercase border-b border-border pb-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>How This Works</span>
              </div>
              <div className="space-y-2 text-foreground-secondary font-sans text-xs leading-relaxed">
                <p>Questions are generated automatically from the <strong className="text-foreground">Canonical Brain</strong> — the approved knowledge store from all teaching sessions.</p>
                <p>Each claim type generates different question formats:</p>
                <ul className="space-y-1 pl-3">
                  <li><span className="text-purple-400 font-bold">Conditional Hypothesis</span> → Scenario + What Would You Do</li>
                  <li><span className="text-accent font-bold">Concept</span> → MCQ + True/False</li>
                  <li><span className="text-amber-400 font-bold">Preference</span> → What Would You Do</li>
                </ul>
                <p>Wrong answers trigger <strong className="text-rose-400">misconception detection</strong> and inject targeted follow-up questions automatically.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
