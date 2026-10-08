'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Shield,
  Layers,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  name: string;
  category?: string;
  definition: string;
  type: 'CONCEPT' | 'CLAIM' | string;
  claimType?: string;
  x: number;
  y: number;
  confidence?: number;
  rules: any[];
  examples: any[];
  counterExamples: any[];
}

interface GraphLink {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

// Node fill/stroke color by claim type
function getNodeColor(node: GraphNode): { fill: string; stroke: string; text: string } {
  if (node.type === 'CONCEPT') {
    return { fill: '#10B981', stroke: '#10B981', text: '#FFFFFF' };
  }
  switch (node.claimType) {
    case 'CONDITIONAL_HYPOTHESIS':
      return { fill: '#F59E0B', stroke: '#F59E0B', text: '#FFFFFF' };
    case 'OBSERVATION':
    case 'HISTORICAL_OBSERVATION':
      return { fill: '#3B82F6', stroke: '#3B82F6', text: '#FFFFFF' };
    case 'PREFERENCE':
      return { fill: '#8B5CF6', stroke: '#8B5CF6', text: '#FFFFFF' };
    case 'RULE':
    case 'CONDITIONAL_RULE':
      return { fill: '#EF4444', stroke: '#EF4444', text: '#FFFFFF' };
    default:
      return { fill: '#252B35', stroke: '#475569', text: '#9299A6' };
  }
}

function getClaimTypeLabel(claimType?: string): string {
  switch (claimType) {
    case 'CONCEPT': return 'Concept';
    case 'CONDITIONAL_HYPOTHESIS': return 'Hypothesis';
    case 'OBSERVATION':
    case 'HISTORICAL_OBSERVATION': return 'Observation';
    case 'PREFERENCE': return 'Preference';
    case 'RULE':
    case 'CONDITIONAL_RULE': return 'Rule';
    default: return claimType || 'Node';
  }
}

// Radial layout helper
function layoutNodesRadially(
  items: { id: string; name: string; [key: string]: any }[],
  centerX: number,
  centerY: number,
  minRadius: number,
  maxRadius: number
): { x: number; y: number }[] {
  return items.map((_, idx) => {
    const angle = (idx / items.length) * 2 * Math.PI - Math.PI / 2;
    const r = minRadius + ((idx % 3) / 2) * (maxRadius - minRadius);
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  });
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [versionTag, setVersionTag] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadGraph = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch('/api/knowledge');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setVersionTag(data.versionTag || null);

      const centerX = 450;
      const centerY = 320;

      // Build nodes from concepts + claims
      const rawNodes: { id: string; name: string; type: string; claimType?: string; definition: string; confidence?: number; rules?: any[]; examples?: any[]; counterExamples?: any[] }[] = [];

      // 1. Canonical Concepts
      for (const c of data.concepts || []) {
        rawNodes.push({
          id: `concept-${c.id}`,
          name: c.name,
          type: 'CONCEPT',
          claimType: 'CONCEPT',
          definition: c.definition || `Canonical concept: ${c.name}`,
          rules: c.rules || [],
          examples: c.examples || [],
          counterExamples: c.counterExamples || [],
        });
      }

      // 2. Teaching Claims (hypotheses, observations, preferences, rules)
      for (const claim of data.claims || []) {
        // Deduplicate — skip if we already have a concept node with same name
        if (rawNodes.some((n) => n.name.toLowerCase() === claim.title.toLowerCase() && n.type === 'CONCEPT')) continue;
        rawNodes.push({
          id: `claim-${claim.id}`,
          name: claim.title,
          type: 'CLAIM',
          claimType: claim.type,
          definition: claim.statement || claim.title,
          confidence: claim.confidence,
          rules: [],
          examples: [],
          counterExamples: [],
        });
      }

      if (rawNodes.length === 0) {
        // Empty brain — render a placeholder instructional node
        setNodes([]);
        setLinks([]);
        setLoading(false);
        return;
      }

      const positions = layoutNodesRadially(rawNodes, centerX, centerY, 150, 260);

      const calculatedNodes: GraphNode[] = rawNodes.map((n, idx) => ({
        ...n,
        x: positions[idx].x,
        y: positions[idx].y,
        rules: n.rules ?? [],
        examples: n.examples ?? [],
        counterExamples: n.counterExamples ?? [],
      }));

      // 3. Semantic Relationships → links
      const calculatedLinks: GraphLink[] = [];
      for (const rel of data.relationships || []) {
        const srcId =
          calculatedNodes.find((n) => n.name.toLowerCase() === rel.fromEntity?.toLowerCase())?.id ||
          calculatedNodes.find((n) => n.id.includes(rel.fromId))?.id;
        const tgtId =
          calculatedNodes.find((n) => n.name.toLowerCase() === rel.toEntity?.toLowerCase())?.id ||
          calculatedNodes.find((n) => n.id.includes(rel.toId))?.id;
        if (srcId && tgtId && srcId !== tgtId) {
          calculatedLinks.push({
            source: srcId,
            target: tgtId,
            label: rel.relationshipType || rel.label,
            type: rel.relationshipType,
          });
        }
      }

      // If no semantic links, connect concepts to hypotheses
      if (calculatedLinks.length === 0 && calculatedNodes.length > 1) {
        const conceptNodes = calculatedNodes.filter((n) => n.type === 'CONCEPT');
        const claimNodes = calculatedNodes.filter((n) => n.type === 'CLAIM');
        for (const claim of claimNodes) {
          const nearestConcept = conceptNodes[0];
          if (nearestConcept) {
            calculatedLinks.push({
              source: nearestConcept.id,
              target: claim.id,
              label: 'teaches',
              type: 'TEACHES',
            });
          }
        }
      }

      setNodes(calculatedNodes);
      setLinks(calculatedLinks);
      if (calculatedNodes.length > 0) setSelectedNode(calculatedNodes[0]);
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setLoadError('Failed to load knowledge graph. Approve a lesson first.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGraph(); }, []);

  const getLinkColor = (link: GraphLink): string => {
    switch (link.type) {
      case 'INVALIDATES': return '#EF4444';
      case 'CONFIRMS': return '#10B981';
      case 'REQUIRES': return '#3B82F6';
      case 'EXCEPT_WHEN': return '#F59E0B';
      case 'LEADS_TO': return '#8B5CF6';
      default: return '#252B35';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <Header
        title="Visual Knowledge Graph"
        subtitle="Live network from Canonical Brain — concepts, hypotheses, observations, and semantic relationships"
        actions={
          <div className="flex items-center space-x-2">
            {versionTag && (
              <span className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded">
                Brain {versionTag}
              </span>
            )}
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 2))}
              className="p-1.5 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.5))}
              className="p-1.5 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={loadGraph}
              className="p-1.5 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border"
              title="Reload Graph"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="flex-1 grid grid-cols-12 overflow-hidden relative">
        {/* Main Graph Canvas Area (8 cols) */}
        <div
          ref={containerRef}
          className="col-span-8 bg-surface-primary relative overflow-hidden flex items-center justify-center select-none"
        >
          {loading ? (
            <div className="text-xs font-mono text-foreground-muted flex flex-col items-center space-y-2">
              <Network className="w-8 h-8 animate-pulse" />
              <span>Building knowledge network from Canonical Brain...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center space-y-3 text-center px-12">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-amber-400 text-xs font-sans">{loadError}</p>
              <a href="/training" className="text-accent text-xs hover:underline">→ Go to Training to approve a lesson</a>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center space-y-3 text-center px-12">
              <Network className="w-8 h-8 text-foreground-muted" />
              <p className="text-foreground-muted text-xs font-sans">No knowledge in the brain yet. Approve a lesson to populate the graph.</p>
              <a href="/training" className="text-accent text-xs hover:underline">→ Go to Training</a>
            </div>
          ) : (
            <svg
              className="w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-100"
              style={{ transform: `scale(${zoomLevel})` }}
              viewBox="0 0 900 650"
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1C222E" strokeWidth="0.75" />
                </pattern>
                <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <polygon points="0 0, 6 3, 0 6" fill="#475569" />
                </marker>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Links */}
              {links.map((link, idx) => {
                const src = nodes.find((n) => n.id === link.source);
                const tgt = nodes.find((n) => n.id === link.target);
                if (!src || !tgt) return null;

                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;
                const color = getLinkColor(link);

                return (
                  <g key={idx}>
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={color}
                      strokeWidth="1.2"
                      strokeDasharray={link.type === 'INVALIDATES' ? '5,3' : 'none'}
                      strokeOpacity="0.7"
                    />
                    {link.label && (
                      <text
                        x={midX}
                        y={midY - 4}
                        fill={color}
                        fontSize="8"
                        fontFamily="monospace"
                        textAnchor="middle"
                        fillOpacity="0.9"
                      >
                        {link.label.toLowerCase().replace(/_/g, ' ')}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const colors = getNodeColor(node);
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedNode(node)}
                  >
                    {/* Glow ring */}
                    {isSelected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="36"
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth="2"
                        strokeOpacity="0.6"
                      />
                    )}
                    {/* Node body */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="28"
                      fill={isSelected ? colors.fill + '33' : '#101318'}
                      stroke={isSelected ? colors.stroke : '#252B35'}
                      strokeWidth={isSelected ? 2 : 1.2}
                    />
                    {/* Node dot */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="5"
                      fill={colors.fill}
                      fillOpacity="0.9"
                    />
                    {/* Label */}
                    <text
                      x={node.x}
                      y={node.y + 20}
                      fill={isSelected ? '#F2F4F7' : '#9299A6'}
                      fontSize="8.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.name.length > 12 ? node.name.slice(0, 10) + '..' : node.name}
                    </text>
                    {/* Claim type badge */}
                    <text
                      x={node.x}
                      y={node.y + 44}
                      fill={colors.fill}
                      fontSize="7"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fillOpacity="0.8"
                    >
                      {getClaimTypeLabel(node.claimType)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Legend */}
          {!loading && !loadError && nodes.length > 0 && (
            <div className="absolute bottom-4 left-4 p-2.5 rounded bg-surface-secondary/90 backdrop-blur border border-border text-[9px] font-mono text-foreground-secondary flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Concept</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span>Hypothesis</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                <span>Observation</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                <span>Preference</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 border-t border-dashed border-amber-400 inline-block" />
                <span>Except-when</span>
              </div>
            </div>
          )}
        </div>

        {/* Node Detail Drawer (4 cols) */}
        <div className="col-span-4 border-l border-border bg-surface-primary flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto p-5 space-y-5">
          {selectedNode ? (
            <div className="space-y-4 font-mono text-xs">
              <div className="border-b border-border pb-3 flex items-start justify-between">
                <div>
                  <span
                    className="text-[10px] uppercase font-semibold tracking-wider"
                    style={{ color: getNodeColor(selectedNode).fill }}
                  >
                    {getClaimTypeLabel(selectedNode.claimType)}
                  </span>
                  <h2 className="text-base font-bold text-foreground mt-0.5">{selectedNode.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-foreground-muted hover:text-foreground text-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Definition / Statement */}
              <div className="p-3 rounded bg-surface-secondary border border-border space-y-1">
                <span className="text-[10px] text-foreground-muted uppercase">
                  {selectedNode.type === 'CONCEPT' ? 'Definition' : 'Statement'}
                </span>
                <p className="text-foreground-secondary font-sans text-xs leading-relaxed">
                  {selectedNode.definition}
                </p>
              </div>

              {/* Confidence (for claims) */}
              {selectedNode.confidence !== undefined && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground-muted">AI Confidence</span>
                  <span className={cn(
                    'font-bold',
                    selectedNode.confidence >= 0.8 ? 'text-emerald-400' :
                    selectedNode.confidence >= 0.6 ? 'text-accent' : 'text-amber-400'
                  )}>
                    {Math.round(selectedNode.confidence * 100)}%
                  </span>
                </div>
              )}

              {/* Connected Relationships */}
              {links.filter((l) => l.source === selectedNode.id || l.target === selectedNode.id).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] text-foreground font-semibold uppercase">Semantic Relationships</span>
                  <div className="space-y-1.5">
                    {links
                      .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
                      .map((l, idx) => {
                        const otherId = l.source === selectedNode.id ? l.target : l.source;
                        const other = nodes.find((n) => n.id === otherId);
                        const direction = l.source === selectedNode.id ? 'out' : 'in';
                        return (
                          <div
                            key={idx}
                            className="p-2 rounded bg-surface-secondary border border-border flex items-center space-x-2 text-[10px]"
                          >
                            {direction === 'in' && <ArrowRight className="w-3 h-3 text-foreground-muted rotate-180" />}
                            <span className="text-foreground-muted font-mono">{(l.label || '').toLowerCase().replace(/_/g, ' ')}</span>
                            {direction === 'out' && <ArrowRight className="w-3 h-3 text-foreground-muted" />}
                            <span
                              className="font-semibold"
                              style={{ color: getNodeColor(other || selectedNode).fill }}
                            >
                              {other?.name || otherId}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Attached Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-semibold uppercase">Attached Rules</span>
                  <span className="text-accent">{selectedNode.rules.length} Active</span>
                </div>
                {selectedNode.rules.length === 0 ? (
                  <p className="text-[11px] text-foreground-muted italic">
                    No execution rules attached. This concept teaches understanding, not a trade trigger.
                  </p>
                ) : (
                  selectedNode.rules.map((rule: any) => (
                    <div key={rule.id} className="p-2.5 rounded bg-surface-secondary border border-border space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">{rule.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-tertiary text-accent">
                          {rule.priority}
                        </span>
                      </div>
                      <p className="text-[10px] text-foreground-secondary">{rule.statement}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Teach Lesson Link */}
              <div className="pt-4 border-t border-border">
                <Link
                  href="/training"
                  className="w-full py-2 px-3 rounded bg-accent text-background font-semibold hover:bg-accent-hover text-xs flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Teach More About {selectedNode.name}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs font-mono text-foreground-muted space-y-2">
              <Network className="w-8 h-8 mx-auto text-foreground-muted" />
              <p>Click any node to inspect its definition, confidence, semantic relationships, and attached rules.</p>
              <p className="text-[11px] font-sans">
                Nodes are built live from the Canonical Brain — approve a lesson to populate the graph.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
