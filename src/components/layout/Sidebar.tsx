'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GraduationCap,
  Network,
  GitBranch,
  PlaySquare,
  MonitorPlay,
  LineChart,
  ShieldCheck,
  Settings,
  Database,
  Cpu,
  BookOpen,
  Brain,
  Download,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/lib/context/AppModeContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { mode } = useAppMode();
  const [stats, setStats] = useState({
    knowledgeCount: 0,
    activeRules: 0,
    aiProvider: 'Local',
    isOnline: true,
    versionTag: 'v1.0',
  });

  useEffect(() => {
    async function loadStats() {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const [statsRes, syncRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/brain/sync'),
        ]);
        let data: any = {};
        if (statsRes.ok) {
          data = await statsRes.json();
        }
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          data.versionTag = syncData.versionTag || 'v1.0';
          if (syncData.itemCounts) {
            data.knowledgeCount = (syncData.itemCounts.concepts || 0) + (syncData.itemCounts.hypotheses || 0) + (syncData.itemCounts.rules || 0);
          }
        }
        setStats(prev => ({ ...prev, ...data }));
      } catch {
        // Fallback gracefully without breaking UI
      }
    }
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Public User Sections (ultra-clean, no cognitive jargon, no rule IDs)
  const publicSections: NavSection[] = [
    {
      items: [
        { label: 'Home', href: '/', icon: LayoutDashboard },
        { label: 'Market Analysis', href: '/analysis', icon: LineChart },
        { label: 'Desktop Overlay', href: '/overlay', icon: MonitorPlay, badge: 'LIVE' },
        { label: 'Replay Lab', href: '/replay', icon: PlaySquare },
        { label: 'Desktop App', href: '/download', icon: Download },
      ],
    },
  ];

  // Teacher / Owner Sections (full access)
  const teacherSections: NavSection[] = [
    {
      items: [
        { label: 'Home', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'TEACH (METHODOLOGY)',
      items: [
        { label: 'Lessons & Ingestion', href: '/training', icon: GraduationCap },
        { label: 'Concepts & Rules', href: '/knowledge', icon: BookOpen },
        { label: 'Knowledge Graph', href: '/knowledge/graph', icon: Network },
        { label: 'Scenarios Engine', href: '/scenarios', icon: GitBranch },
      ],
    },
    {
      title: 'ANALYZE (LIVE WORKSPACE)',
      items: [
        { label: 'Desktop Overlay HUD', href: '/overlay', icon: MonitorPlay, badge: 'LIVE' },
        { label: 'Market Analysis', href: '/analysis', icon: LineChart },
        { label: 'Screen Monitor', href: '/screen-monitor', icon: MonitorPlay },
        { label: 'Replay Validation', href: '/replay', icon: PlaySquare },
      ],
    },
    {
      title: 'SYSTEM & DIAGNOSTICS',
      items: [
        { label: 'AI Brain', href: '/brain', icon: Brain },
        { label: 'Evaluations & Exam', href: '/evaluations', icon: ShieldCheck },
        { label: 'Desktop Installer', href: '/download', icon: Download },
        { label: 'Settings', href: '/settings', icon: Settings },
      ],
    },
  ];

  const sections = mode === 'public' ? publicSections : teacherSections;

  return (
    <aside className="w-64 bg-surface-primary border-r border-border flex flex-col h-screen fixed top-0 left-0 z-40 select-none">
      {/* Brand & System Status */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold tracking-wider text-foreground text-sm uppercase">
              Trading AI
            </span>
          </div>
          <div className="flex items-center space-x-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-signal-green inline-block animate-pulse"></span>
            <span className="text-[11px] font-mono text-foreground-secondary">
              {mode === 'public' ? 'Public Client' : 'Teacher Workstation'}
            </span>
          </div>
        </div>

        <div className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-secondary text-foreground-secondary border border-border">
          {stats.versionTag}
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider text-foreground-muted uppercase">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-surface-secondary text-foreground border-l-2 border-accent font-semibold'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-surface-secondary/50'
                  )}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={cn('w-4 h-4', isActive ? 'text-accent' : 'text-foreground-muted')} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-surface-tertiary text-foreground-muted">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Metadata & Telemetry */}
      <div className="p-3 border-t border-border bg-surface-secondary/40 space-y-2 text-[11px] font-mono">
        <div className="flex items-center justify-between text-foreground-secondary">
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-foreground-muted" />
            <span>AI Status</span>
          </div>
          <span className="text-accent">{stats.aiProvider}</span>
        </div>

        <div className="flex items-center justify-between text-foreground-secondary">
          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-foreground-muted" />
            <span>Knowledge</span>
          </div>
          <span className="text-foreground">{stats.knowledgeCount} Items</span>
        </div>
      </div>
    </aside>
  );
}
