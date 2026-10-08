'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  ShieldAlert,
  Code2,
  ListOrdered,
  Pause,
  Play,
  HelpCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { StructuredAIResponse, Candle } from '@/lib/types';
import { CorrectAIModal } from '@/components/ui/CorrectAIModal';
import { useAppMode } from '@/lib/context/AppModeContext';
import { cn } from '@/lib/utils';
import { LearnedLevel } from '@/lib/types/adaptive';
import { WhyProvenanceModal } from '@/components/overlay/WhyProvenanceModal';

export default function MarketAnalysisPage() {
  const { mode } = useAppMode();
  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('5M');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<StructuredAIResponse | null>(null);
  const [evaluationData, setEvaluationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [learnedLevels, setLearnedLevels] = useState<LearnedLevel[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);

  const runAnalysis = async () => {
    if (isAiPaused) return;
    try {
      setLoading(true);
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, timeframe }),
      });

      if (res.ok) {
        const json = await res.json();
        setAnalysis(json.analysis);
        setEvaluationData(json.evaluation);
        setCandles(json.candles || []);
      }
    } catch (err) {
      console.error('Market analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLearnedLevels = async () => {
    try {
      setLevelsLoading(true);
      const res = await fetch('/api/brain/levels');
      if (res.ok) {
        const data = await res.json();
        setLearnedLevels(data.levels || []);
      }
    } catch {
      // supplementary — silently ignore
    } finally {
      setLevelsLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
    loadLearnedLevels();
  }, [symbol, timeframe, isAiPaused]);

  // SVG dimensions for candlestick rendering
  const chartHeight = 320;
  const chartWidth = 720;
  const minPrice = candles.length > 0 ? Math.min(...candles.map((c) => c.low)) : 100;
  const maxPrice = candles.length > 0 ? Math.max(...candles.map((c) => c.high)) : 110;
  const priceRange = maxPrice - minPrice || 1;

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 40) - 20;
  };

  // Human vs Debug formatters (Section 22)
  const formatSetupStatus = (status?: string) => {
    if (!status) return 'WAIT';
    if (isDebugMode && mode === 'teacher') return status;
    switch (status) {
      case 'TRADE_CANDIDATE':
      case 'SETUP_CONFIRMED':
        return analysis?.direction === 'SHORT' ? 'SHORT' : 'LONG';
      case 'SETUP_FORMING':
      case 'WAIT':
        return 'WAIT';
      case 'NO_TRADE':
        return 'NO TRADE';
      case 'OBSERVATION':
        return 'WAIT';
      default:
        return status;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background select-none">
      <Header
        title={mode === 'public' ? 'Market Analysis — Clean Signals' : 'Market Analysis Workstation'}
        subtitle="Live chart structure, scenario recognition, rule verification, and proposal audit"
        actions={
          <div className="flex items-center space-x-2">
            {/* Pause / Resume AI Button */}
            <button
              onClick={() => setIsAiPaused(!isAiPaused)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors flex items-center space-x-1.5',
                isAiPaused
                  ? 'bg-signal-amber/20 border-signal-amber/40 text-signal-amber'
                  : 'bg-surface-secondary border-border text-foreground hover:bg-surface-tertiary'
              )}
              title={isAiPaused ? 'Resume live AI evaluations' : 'Pause live AI evaluations'}
            >
              {isAiPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isAiPaused ? 'AI Paused (Resume)' : 'Pause AI'}</span>
            </button>

            {mode === 'teacher' && (
              <button
                onClick={() => setIsDebugMode(!isDebugMode)}
                className={cn(
                  'px-2.5 py-1.5 rounded text-xs font-mono font-medium border transition-colors flex items-center space-x-1',
                  isDebugMode
                    ? 'bg-accent/20 border-accent/40 text-accent'
                    : 'bg-surface-secondary border-border text-foreground-muted hover:text-foreground'
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{isDebugMode ? 'Debug: ON' : 'Human View'}</span>
              </button>
            )}

            <button
              onClick={() => setShowAnnotations(!showAnnotations)}
              className="px-3 py-1.5 rounded text-xs font-mono font-medium bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border transition-colors flex items-center space-x-1.5"
            >
              {showAnnotations ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-accent" />}
              <span>{showAnnotations ? 'Hide Levels' : 'Show Levels'}</span>
            </button>

            <button
              onClick={runAnalysis}
              disabled={loading || isAiPaused}
              className="px-3 py-1.5 rounded text-xs font-mono font-semibold bg-accent text-background hover:bg-accent-hover transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              <span>{loading ? 'Evaluating...' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left / Center Area: Chart & Annotation Area (8 cols) */}
        <div className="col-span-8 border-r border-border bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto">
          {/* Market Header Bar */}
          <div className="p-4 border-b border-border flex items-center justify-between font-mono text-xs">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-foreground-muted">INSTRUMENT:</span>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-surface-secondary border border-border rounded px-2 py-1 text-foreground font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="XAUUSD">XAUUSD (Gold)</option>
                  <option value="EURUSD">EURUSD</option>
                  <option value="NQ">NQ (Nasdaq Futures)</option>
                  <option value="BTCUSDT">BTCUSDT</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-foreground-muted">TIMEFRAME:</span>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="bg-surface-secondary border border-border rounded px-2 py-1 text-foreground font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="1M">1M</option>
                  <option value="5M">5M</option>
                  <option value="15M">15M</option>
                  <option value="1H">1H</option>
                  <option value="4H">4H</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-foreground-secondary">
              <span>STATE: <strong className="text-foreground">{analysis?.market_state || 'OBSERVATION'}</strong></span>
              <span>SCENARIO: <strong className="text-accent">{analysis?.detected_scenarios?.[0] || 'Range Structure'}</strong></span>
            </div>
          </div>

          {/* SVG Candlestick Chart Area */}
          <div className="p-4 flex-1 flex flex-col justify-center items-center bg-background select-none">
            <div className="w-full max-w-3xl aspect-[16/9] max-h-[340px] bg-surface-primary rounded border border-border relative overflow-hidden flex items-center justify-center">
              {loading ? (
                <div className="text-xs font-mono text-foreground-muted">Loading candlestick feed...</div>
              ) : candles.length === 0 ? (
                <div className="text-xs font-mono text-foreground-muted">NO DATA AVAILABLE</div>
              ) : (
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                  {/* Price Gridlines */}
                  {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                    const price = minPrice + priceRange * ratio;
                    const y = getY(price);
                    return (
                      <g key={ratio}>
                        <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="#1C222E" strokeWidth="1" strokeDasharray="3,3" />
                        <text x="8" y={y - 4} fill="#667085" fontSize="9" fontFamily="monospace">
                          {price.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Candlesticks */}
                  {candles.map((candle, idx) => {
                    const candleWidth = Math.max(chartWidth / (candles.length * 1.6), 4);
                    const gap = chartWidth / candles.length;
                    const x = idx * gap + gap / 2;

                    const openY = getY(candle.open);
                    const closeY = getY(candle.close);
                    const highY = getY(candle.high);
                    const lowY = getY(candle.low);

                    const isBullish = candle.close >= candle.open;
                    const color = isBullish ? '#10B981' : '#EF4444';
                    const bodyTop = Math.min(openY, closeY);
                    const bodyHeight = Math.max(Math.abs(openY - closeY), 2);

                    return (
                      <g key={candle.timestamp || idx}>
                        <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1" />
                        <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx="1" />
                      </g>
                    );
                  })}

                  {/* Annotations */}
                  {showAnnotations && analysis && (
                    <g>
                      <line x1="0" y1={getY(maxPrice * 0.999)} x2={chartWidth} y2={getY(maxPrice * 0.999)} stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4,4" />
                      <text x={chartWidth - 110} y={getY(maxPrice * 0.999) - 5} fill="#EF4444" fontSize="9" fontFamily="monospace">
                        RESISTANCE
                      </text>

                      {analysis.entry && (
                        <>
                          <line x1="0" y1={getY(analysis.entry)} x2={chartWidth} y2={getY(analysis.entry)} stroke="#10B981" strokeWidth="1.5" />
                          <text x={chartWidth - 100} y={getY(analysis.entry) - 5} fill="#10B981" fontSize="9" fontFamily="monospace" fontWeight="bold">
                            ENTRY: {analysis.entry}
                          </text>
                        </>
                      )}

                      {analysis.stop_loss && (
                        <>
                          <line x1="0" y1={getY(analysis.stop_loss)} x2={chartWidth} y2={getY(analysis.stop_loss)} stroke="#EF4444" strokeWidth="1.5" />
                          <text x={chartWidth - 90} y={getY(analysis.stop_loss) - 5} fill="#EF4444" fontSize="9" fontFamily="monospace" fontWeight="bold">
                            SL: {analysis.stop_loss}
                          </text>
                        </>
                      )}
                    </g>
                  )}
                </svg>
              )}
            </div>
          </div>

          {/* Audit Panels: WHY and WHAT CHANGED */}
          <div className="p-4 space-y-4 border-t border-border bg-surface-primary">
            {/* WHY THIS SETUP? Panel */}
            <div className="p-4 rounded border border-border bg-surface-secondary/40 space-y-3">
              <div className="flex items-center space-x-2 text-accent font-semibold uppercase text-xs">
                <Shield className="w-4 h-4" />
                <span>WHY THIS SETUP? (Auditable Rationale)</span>
              </div>

              {analysis?.reasoning && analysis.reasoning.length > 0 ? (
                <ol className="space-y-1.5 list-decimal list-inside text-foreground-secondary text-xs font-sans leading-relaxed">
                  {analysis.reasoning.map((step, idx) => (
                    <li key={idx} className="text-foreground">
                      <span className="text-foreground-secondary">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-foreground-muted font-mono text-xs">Awaiting evaluation criteria.</p>
              )}

              {/* Supporting Rules Cited (Visible in Teacher mode or expanded) */}
              {mode === 'teacher' && analysis?.supporting_rules && analysis.supporting_rules.length > 0 && (
                <div className="pt-2 border-t border-border/60 space-y-1 text-[11px] font-mono">
                  <span className="text-foreground font-semibold">Rules Applied:</span>
                  {analysis.supporting_rules.map((rule, idx) => (
                    <div key={idx} className="text-foreground-secondary">
                      &bull; <strong className="text-accent">{rule.title}</strong>: {rule.statement}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WHAT CHANGED? Panel (Teacher mode) */}
            {mode === 'teacher' && analysis?.what_changed && (
              <div className="p-4 rounded border border-signal-amber/30 bg-signal-amber/5 space-y-2">
                <div className="flex items-center space-x-2 text-signal-amber font-semibold uppercase text-xs font-mono">
                  <Clock className="w-4 h-4" />
                  <span>"WHAT CHANGED?" (State Transition Record)</span>
                </div>
                <div className="flex items-center space-x-3 text-xs font-mono">
                  <span className="px-2 py-1 rounded bg-surface-secondary border border-border text-foreground-muted">
                    {analysis.what_changed.previous_state}
                  </span>
                  <ArrowRight className="w-4 h-4 text-signal-amber" />
                  <span className="text-foreground-secondary italic font-sans">
                    "{analysis.what_changed.new_information}"
                  </span>
                  <ArrowRight className="w-4 h-4 text-signal-amber" />
                  <span className="px-2 py-1 rounded bg-accent/20 border border-accent/40 text-accent font-semibold">
                    {analysis.what_changed.new_state}
                  </span>
                </div>
              </div>
            )}

            {/* DECISION TIMELINE (Teacher mode) — derived from analysis.reasoning steps */}
            {mode === 'teacher' && analysis?.reasoning && analysis.reasoning.length > 0 && (
              <div className="p-4 rounded border border-border bg-surface-secondary/40 space-y-3 font-mono text-xs">
                <div className="flex items-center space-x-2 text-foreground font-semibold uppercase text-xs border-b border-border pb-2">
                  <ListOrdered className="w-4 h-4 text-accent" />
                  <span>Decision Reasoning Sequence</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {analysis.reasoning.map((step, idx) => (
                    <div key={idx} className="flex items-start space-x-3 text-[11px]">
                      <span className="text-accent font-semibold px-1.5 py-0.5 rounded bg-surface-secondary text-[10px] flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-foreground-secondary font-sans text-[11px]">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: AI Decision & Setup Proposed + Learned Levels (4 cols) */}
        <div className="col-span-4 bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-6 space-y-6 font-mono text-xs">
          {/* Decision Status Card with Teach Correction button (Section 25) */}
          <div className="p-4 rounded border border-border bg-surface-secondary space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
                Current Signal State
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setShowWhyModal(true)}
                  className="px-2 py-1 rounded bg-accent text-background text-[10px] font-bold flex items-center space-x-1 hover:bg-accent-hover transition-colors shadow-sm"
                  title="Audit provenance: Why did AI think this?"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>[WHY?]</span>
                </button>
                {mode === 'teacher' && (
                  <button
                    onClick={() => setShowCorrectionModal(true)}
                    className="px-2 py-1 rounded bg-signal-amber/10 hover:bg-signal-amber/20 text-signal-amber border border-signal-amber/30 text-[10px] font-bold flex items-center space-x-1 transition-colors"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Correct AI</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-base font-bold px-2.5 py-1 rounded',
                  analysis?.setup_status === 'TRADE_CANDIDATE' || analysis?.setup_status === 'SETUP_CONFIRMED'
                    ? 'bg-signal-green/20 text-signal-green border border-signal-green/40'
                    : analysis?.setup_status === 'WAIT' || analysis?.setup_status === 'SETUP_FORMING'
                    ? 'bg-signal-amber/20 text-signal-amber border border-signal-amber/40'
                    : 'bg-surface-tertiary text-foreground-muted'
                )}
              >
                {formatSetupStatus(analysis?.setup_status)}
              </span>

              <span className="text-[11px] text-foreground-secondary">
                Direction: <strong className="text-foreground">{analysis?.direction || 'UNDEFINED'}</strong>
              </span>
            </div>

            <p className="text-[11px] text-foreground-secondary font-sans leading-relaxed">
              {analysis?.setup_status === 'WAIT'
                ? 'Price movement detected, but confirmation conditions or exceptions prevent immediate execution.'
                : analysis?.setup_status === 'TRADE_CANDIDATE'
                ? 'All learned rules satisfied. Proposed Entry, SL, and TP calculated below.'
                : 'Observing structural price action. Waiting for confirmed setup conditions.'}
            </p>
          </div>

          {/* Trade Parameters (Entry, SL, TP) */}
          <div className="p-4 rounded border border-border bg-surface-secondary space-y-3">
            <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
              Calculated Trade Parameters
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Entry</span>
                <span className="text-foreground font-bold">{analysis?.entry ? `$${analysis.entry}` : 'WAITING'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Stop Loss (SL)</span>
                <span className="text-signal-red font-bold">{analysis?.stop_loss ? `$${analysis.stop_loss}` : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Target (TP1)</span>
                <span className="text-signal-green font-bold">
                  {analysis?.take_profit && analysis.take_profit.length > 0 ? `$${analysis.take_profit[0]}` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Runner (TP2)</span>
                <span className="text-signal-green font-bold">
                  {analysis?.take_profit && analysis.take_profit.length > 1 ? `$${analysis.take_profit[1]}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* What It Is Waiting For (Missing Conditions) */}
          {analysis?.missing_conditions && analysis.missing_conditions.length > 0 && (
            <div className="p-4 rounded border border-signal-amber/30 bg-signal-amber/5 space-y-2">
              <div className="flex items-center space-x-1.5 text-signal-amber font-semibold text-[11px] uppercase">
                <Clock className="w-3.5 h-3.5" />
                <span>What It Is Waiting For:</span>
              </div>
              <ul className="space-y-1 text-foreground-secondary text-[11px]">
                {analysis.missing_conditions.map((item, i) => (
                  <li key={i}>&bull; {item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Invalidation Triggers */}
          {analysis?.invalidation && analysis.invalidation.length > 0 && (
            <div className="p-4 rounded border border-signal-red/30 bg-signal-red/5 space-y-2">
              <div className="flex items-center space-x-1.5 text-signal-red font-semibold text-[11px] uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Invalidation Triggers</span>
              </div>
              <ul className="space-y-1 text-foreground-secondary text-[11px]">
                {analysis.invalidation.map((item, i) => (
                  <li key={i}>&bull; {item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Learned Levels from Canonical Brain */}
          {mode === 'teacher' && (
            <div className="p-4 rounded border border-border bg-surface-secondary space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center space-x-2 text-foreground font-semibold uppercase text-xs">
                  <Layers className="w-4 h-4 text-accent" />
                  <span>Learned Levels</span>
                </div>
                <span className="text-[10px] text-foreground-muted">From Brain</span>
              </div>

              {levelsLoading ? (
                <p className="text-foreground-muted text-[11px]">Loading levels from Canonical Brain...</p>
              ) : learnedLevels.length === 0 ? (
                <p className="text-foreground-muted text-[11px] font-sans">No price levels learned yet. Approve a lesson with support/resistance teaching to populate this.</p>
              ) : (
                <div className="space-y-3">
                  {learnedLevels.map((level) => (
                    <div key={level.id} className="p-3 rounded bg-surface-tertiary border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-bold text-[11px]">{level.name}</span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-bold border',
                          level.type === 'SUPPORT'
                            ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
                            : level.type === 'RESISTANCE'
                            ? 'text-rose-400 bg-rose-400/10 border-rose-400/30'
                            : 'text-accent bg-accent/10 border-accent/30'
                        )}>
                          {level.type}
                        </span>
                      </div>
                      <div className="text-accent font-bold text-xs font-mono">{level.priceZoneStr}</div>
                      <p className="text-foreground-secondary font-sans text-[10px] leading-relaxed">{level.whatItIs}</p>
                      {level.expectedBehavior && (
                        <div className="text-[10px]">
                          <span className="text-foreground-muted">Expected: </span>
                          <span className="text-foreground-secondary">{level.expectedBehavior}</span>
                        </div>
                      )}
                      {level.invalidation && (
                        <div className="text-[10px] text-rose-400">
                          ✕ Invalidated if: {level.invalidation}
                        </div>
                      )}
                      <div className="text-[9px] text-foreground-muted font-mono">
                        Source: {level.sourceLessonTitle}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Teach Correction Modal (Section 25) */}
      <CorrectAIModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        aiDecision={analysis?.setup_status || 'WAIT'}
        conceptName={analysis?.active_concepts?.[0] || 'Breakout'}
        onCorrectionSaved={() => {
          runAnalysis();
        }}
      />

      {/* Auditable Why Provenance Modal (Phase 3.5) */}
      <WhyProvenanceModal
        isOpen={showWhyModal}
        onClose={() => setShowWhyModal(false)}
        provenance={evaluationData?.provenance || (analysis as any)?.provenance}
        currentPrice={evaluationData?.currentPrice}
        matchedLevelName={evaluationData?.matchedLevel?.name}
        expectedBehavior={evaluationData?.expectedBehavior}
        state={analysis?.setup_status || 'WATCH'}
        bias={analysis?.direction || 'UNDEFINED'}
      />
    </div>
  );
}
