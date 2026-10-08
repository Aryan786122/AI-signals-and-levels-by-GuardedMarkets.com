'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

interface ScenarioCondition {
  id?: string;
  stepOrder: number;
  description: string;
  logicOp: string;
}

interface ScenarioItem {
  id: string;
  name: string;
  marketContext: string;
  expectedAction: string;
  invalidationCondition: string;
  conditions: ScenarioCondition[];
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioItem | null>(null);
  const [loading, setLoading] = useState(true);

  // New Scenario Modal
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newAction, setNewAction] = useState('SHORT_CANDIDATE');
  const [newInvalidation, setNewInvalidation] = useState('');
  const [newSteps, setNewSteps] = useState<Array<{ description: string; logicOp: string }>>([
    { description: 'Price approaches key resistance level', logicOp: 'IF' },
    { description: 'Price sweeps previous swing high', logicOp: 'THEN' },
    { description: 'Price fails to maintain candle body acceptance above', logicOp: 'AND' },
    { description: 'Candle closes back below resistance boundary', logicOp: 'AND' },
    { description: 'Breakout candle was excessively extended', logicOp: 'EXCEPT' },
  ]);

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/scenarios');
      if (res.ok) {
        const json = await res.json();
        setScenarios(json.scenarios || []);
        if (json.scenarios?.length > 0 && !selectedScenario) {
          setSelectedScenario(json.scenarios[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          marketContext: newContext,
          expectedAction: newAction,
          invalidationCondition: newInvalidation,
          conditions: newSteps,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setNewName('');
        setNewContext('');
        await fetchScenarios();
      }
    } catch (err) {
      console.error('Failed to create scenario:', err);
    }
  };

  const addStep = () => {
    setNewSteps([...newSteps, { description: '', logicOp: 'AND' }]);
  };

  const removeStep = (index: number) => {
    setNewSteps(newSteps.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <Header
        title="Scenario Engine"
        subtitle="Data-driven sequential market situations with IF, THEN, EXCEPT, UNLESS logic"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 rounded text-xs font-mono font-semibold bg-accent text-background hover:bg-accent-hover transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Define New Scenario</span>
          </button>
        }
      />

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Column: Scenario List (4 cols) */}
        <div className="col-span-4 border-r border-border bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-3 border-b border-border text-xs font-mono font-semibold text-foreground-secondary uppercase tracking-wider">
            Registered Scenarios ({scenarios.length})
          </div>

          <div className="divide-y divide-border/50 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs font-mono text-foreground-muted">
                Loading scenarios...
              </div>
            ) : scenarios.length === 0 ? (
              <div className="p-6 text-center space-y-2 text-xs font-mono text-foreground-muted">
                <p>No scenarios defined yet.</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-3 py-1 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border"
                >
                  Create Scenario
                </button>
              </div>
            ) : (
              scenarios.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedScenario(s)}
                  className={cn(
                    'p-4 cursor-pointer transition-colors space-y-1.5 font-mono text-xs',
                    selectedScenario?.id === s.id
                      ? 'bg-surface-secondary border-l-2 border-accent'
                      : 'hover:bg-surface-secondary/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{s.name}</span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-bold',
                        s.expectedAction === 'SHORT_CANDIDATE'
                          ? 'bg-signal-red/10 text-signal-red'
                          : s.expectedAction === 'LONG_CANDIDATE'
                          ? 'bg-signal-green/10 text-signal-green'
                          : 'bg-signal-amber/10 text-signal-amber'
                      )}
                    >
                      {s.expectedAction}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-muted font-sans line-clamp-2">
                    {s.marketContext || 'Sequential market conditions.'}
                  </p>
                  <div className="text-[10px] text-foreground-secondary pt-1 flex items-center justify-between">
                    <span>{s.conditions.length} Sequential Conditions</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Scenario Details & Step Sequence (8 cols) */}
        <div className="col-span-8 bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-6 space-y-6">
          {selectedScenario ? (
            <div className="space-y-6 font-mono text-xs">
              <div className="border-b border-border pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">{selectedScenario.name}</h2>
                  <p className="text-xs text-foreground-secondary mt-1 font-sans">
                    {selectedScenario.marketContext}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-[10px] text-foreground-muted uppercase">Potential Action</span>
                  <div className="text-sm font-bold text-accent">
                    {selectedScenario.expectedAction}
                  </div>
                </div>
              </div>

              {/* Sequential Conditions */}
              <div className="space-y-3">
                <span className="text-xs text-foreground font-semibold uppercase tracking-wider">
                  Sequential Logic Chain ({selectedScenario.conditions.length} Steps)
                </span>

                <div className="space-y-2">
                  {selectedScenario.conditions.map((cond) => (
                    <div
                      key={cond.id || cond.stepOrder}
                      className="p-3 rounded bg-surface-secondary border border-border flex items-center space-x-3 text-xs"
                    >
                      <span className="px-2 py-0.5 rounded bg-surface-tertiary text-accent font-bold text-[10px] min-w-[50px] text-center">
                        {cond.logicOp}
                      </span>
                      <span className="text-foreground-muted text-[11px]">#{cond.stepOrder}</span>
                      <span className="text-foreground flex-1 font-sans text-xs">
                        {cond.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invalidation Criteria */}
              <div className="p-4 rounded bg-signal-red/5 border border-signal-red/20 space-y-1.5">
                <div className="flex items-center space-x-2 text-signal-red font-semibold text-xs uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Invalidation Criteria</span>
                </div>
                <p className="text-foreground-secondary text-xs font-sans">
                  {selectedScenario.invalidationCondition}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs font-mono text-foreground-muted">
              Select a scenario on the left to inspect its sequential conditions.
            </div>
          )}
        </div>
      </div>

      {/* New Scenario Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-primary border border-border rounded shadow-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold tracking-wide uppercase text-foreground">
                Define New Market Scenario
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-foreground-muted hover:text-foreground text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="p-5 space-y-4 text-xs font-mono max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-foreground-muted mb-1">Scenario Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Breakout Failure"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground-muted mb-1">Expected Action</label>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    className="w-full bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="LONG_CANDIDATE">LONG_CANDIDATE</option>
                    <option value="SHORT_CANDIDATE">SHORT_CANDIDATE</option>
                    <option value="WAIT">WAIT</option>
                    <option value="NO_TRADE">NO_TRADE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground-muted mb-1">Invalidation Trigger</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Price accepts back above resistance"
                    value={newInvalidation}
                    onChange={(e) => setNewInvalidation(e.target.value)}
                    className="w-full bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Conditions Sequence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-foreground-muted">Sequential Conditions</label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-[10px] text-accent hover:underline flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Step</span>
                  </button>
                </div>

                {newSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <select
                      value={step.logicOp}
                      onChange={(e) => {
                        const updated = [...newSteps];
                        updated[idx].logicOp = e.target.value;
                        setNewSteps(updated);
                      }}
                      className="bg-surface-secondary border border-border rounded px-2 py-1.5 text-[11px] text-accent focus:outline-none"
                    >
                      <option value="IF">IF</option>
                      <option value="THEN">THEN</option>
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                      <option value="EXCEPT">EXCEPT</option>
                      <option value="UNLESS">UNLESS</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder={`Step ${idx + 1} description`}
                      value={step.description}
                      onChange={(e) => {
                        const updated = [...newSteps];
                        updated[idx].description = e.target.value;
                        setNewSteps(updated);
                      }}
                      className="flex-1 bg-surface-secondary border border-border rounded px-3 py-1.5 text-foreground focus:outline-none"
                    />
                    {newSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-foreground-muted hover:text-signal-red p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded bg-surface-secondary text-foreground hover:bg-surface-tertiary border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-accent text-background font-semibold hover:bg-accent-hover"
                >
                  Save Scenario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
