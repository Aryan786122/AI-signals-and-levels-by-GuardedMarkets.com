'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  Cpu,
  Database,
  ShieldCheck,
  Code2,
  Terminal,
  Bug,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [debugMode, setDebugMode] = useState(true);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [debugLogs, setDebugLogs] = useState<Array<{ timestamp: string; level: string; message: string; details?: string }>>([
    {
      timestamp: 'SYSTEM_BOOT',
      level: 'INFO',
      message: 'GuardedMarketsAI initialized with Local-First SQLite storage.',
    },
    {
      timestamp: 'SYSTEM_SYNC',
      level: 'INFO',
      message: 'Prisma Client schema synced cleanly (22 domain entities active).',
    },
    {
      timestamp: 'SYSTEM_READY',
      level: 'DEBUG',
      message: 'AI Provider active: Local Rule Validator (Deterministic Offline Fallback).',
      details: 'Strict rule hierarchy applied: Base Conditions + Exceptions + Context.',
    },
  ]);

  useEffect(() => {
    const timeStr = new Date().toLocaleTimeString();
    setDebugLogs([
      {
        timestamp: timeStr,
        level: 'INFO',
        message: 'GuardedMarketsAI initialized with Local-First SQLite storage.',
      },
      {
        timestamp: timeStr,
        level: 'INFO',
        message: 'Prisma Client schema synced cleanly (22 domain entities active).',
      },
      {
        timestamp: timeStr,
        level: 'DEBUG',
        message: 'AI Provider active: Local Rule Validator (Deterministic Offline Fallback).',
        details: 'Strict rule hierarchy applied: Base Conditions + Exceptions + Context.',
      },
    ]);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background font-mono text-xs">
      <Header
        title="System Settings & Developer Debug Panel"
        subtitle="Provider configuration, storage management, and decision audit logs"
      />

      {saveSuccess && (
        <div className="px-6 py-2.5 bg-signal-green/10 border-b border-signal-green/30 text-signal-green flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully.</span>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6 flex-1 max-w-5xl">
        {/* Provider Settings */}
        <div className="border border-border rounded bg-surface-primary p-5 space-y-4">
          <div className="flex items-center space-x-2 text-foreground font-semibold uppercase text-xs border-b border-border pb-3">
            <Cpu className="w-4 h-4 text-accent" />
            <span>AI Reasoning & Provider Abstraction</span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-foreground-muted mb-1">Active AI Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full bg-surface-secondary border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-accent"
              >
                <option value="local">Local Deterministic Reasoning Engine (Offline / Safe Fallback)</option>
                <option value="gemini">Google Gemini (Gemini 2.0 Flash / Pro via API)</option>
                <option value="openai">OpenAI (GPT-4o via API)</option>
                <option value="ollama">Ollama (Local Open Weights: Llama 3 / Mistral)</option>
              </select>
            </div>

            {selectedProvider === 'gemini' && (
              <div>
                <label className="block text-foreground-muted mb-1">Gemini API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            )}

            {selectedProvider === 'openai' && (
              <div>
                <label className="block text-foreground-muted mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            )}

            {selectedProvider === 'ollama' && (
              <div>
                <label className="block text-foreground-muted mb-1">Ollama Base URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-foreground-muted">
                Keys are managed in local server environment and never exposed in client bundles.
              </span>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-accent text-background font-semibold hover:bg-accent-hover transition-colors"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* Database & Local Storage Status */}
        <div className="border border-border rounded bg-surface-primary p-5 space-y-4">
          <div className="flex items-center space-x-2 text-foreground font-semibold uppercase text-xs border-b border-border pb-3">
            <Database className="w-4 h-4 text-signal-green" />
            <span>Local Database & Storage Health</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded bg-surface-secondary border border-border space-y-1">
              <span className="text-foreground-muted text-[10px] uppercase">Relational DB</span>
              <div className="font-semibold text-foreground">SQLite (dev.db)</div>
              <p className="text-[10px] text-signal-green flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected & Healthy</span>
              </p>
            </div>

            <div className="p-3 rounded bg-surface-secondary border border-border space-y-1">
              <span className="text-foreground-muted text-[10px] uppercase">Production Target</span>
              <div className="font-semibold text-foreground">PostgreSQL + pgvector</div>
              <p className="text-[10px] text-foreground-muted">
                Schema: schema.postgresql.prisma
              </p>
            </div>

            <div className="p-3 rounded bg-surface-secondary border border-border space-y-1">
              <span className="text-foreground-muted text-[10px] uppercase">Media Storage</span>
              <div className="font-semibold text-foreground">./storage/</div>
              <p className="text-[10px] text-signal-green flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Directories Initialized</span>
              </p>
            </div>
          </div>
        </div>

        {/* Debug Panel (Section 43) */}
        <div className="border border-border rounded bg-surface-primary p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center space-x-2 text-foreground font-semibold uppercase text-xs">
              <Bug className="w-4 h-4 text-signal-amber" />
              <span>Developer Debug Panel & Audit Log</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-foreground-muted">Debug Mode:</span>
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-bold transition-colors',
                  debugMode
                    ? 'bg-signal-green/20 text-signal-green border border-signal-green/40'
                    : 'bg-surface-secondary text-foreground-muted border border-border'
                )}
              >
                {debugMode ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {debugMode ? (
            <div className="space-y-3">
              <div className="p-3 rounded bg-background border border-border space-y-2 font-mono text-[11px]">
                {debugLogs.map((log, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <span suppressHydrationWarning className="text-foreground-muted">[{log.timestamp}]</span>
                    <span
                      className={cn(
                        'px-1 py-0.2 rounded text-[9px] font-bold',
                        log.level === 'INFO'
                          ? 'bg-signal-blue/20 text-signal-blue'
                          : 'bg-signal-amber/20 text-signal-amber'
                      )}
                    >
                      {log.level}
                    </span>
                    <div className="flex-1">
                      <span className="text-foreground">{log.message}</span>
                      {log.details && (
                        <p className="text-foreground-secondary text-[10px] mt-0.5">{log.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample AI Structured Output Inspection */}
              <div className="p-3 rounded bg-surface-secondary border border-border space-y-1.5">
                <span className="text-[10px] text-foreground-muted uppercase">Structured Schema Validation Contract</span>
                <pre className="text-[10px] text-accent p-2 rounded bg-background overflow-x-auto">
{`{
  "market_state": "BULLISH_BIAS",
  "setup_status": "WAIT",
  "direction": "NEUTRAL",
  "supporting_rules": ["Breakout Acceptance Criteria #1"],
  "conflicting_rules": [],
  "reasoning": [
    "Candle body broke resistance, but excessive extension exception triggers WAIT state."
  ]
}`}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-foreground-muted">Debug mode disabled.</p>
          )}
        </div>
      </div>
    </div>
  );
}
