'use client';

import React from 'react';
import { useAppMode } from '@/lib/context/AppModeContext';
import { GraduationCap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalKnowledgeSyncBadge } from '@/components/layout/GlobalKnowledgeSyncBadge';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { mode, setMode } = useAppMode();

  return (
    <header className="h-14 border-b border-border bg-surface-primary/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-foreground-secondary font-mono">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {/* Global Knowledge Brain Sync Status */}
        <GlobalKnowledgeSyncBadge />

        {/* Mode Toggle Switcher (Public vs Teacher) */}
        <div className="flex items-center p-0.5 rounded bg-surface-secondary border border-border text-xs font-mono">
          <button
            onClick={() => setMode('public')}
            className={cn(
              'px-2.5 py-1 rounded flex items-center space-x-1.5 transition-colors',
              mode === 'public'
                ? 'bg-accent text-background font-semibold shadow-sm'
                : 'text-foreground-secondary hover:text-foreground'
            )}
            title="Public User Mode: Clean, simple, actionable trade signals without internal jargon"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Public Mode</span>
          </button>
          <button
            onClick={() => setMode('teacher')}
            className={cn(
              'px-2.5 py-1 rounded flex items-center space-x-1.5 transition-colors',
              mode === 'teacher'
                ? 'bg-accent text-background font-semibold shadow-sm'
                : 'text-foreground-secondary hover:text-foreground'
            )}
            title="Teacher / Owner Mode: Full methodology management, rule editing, and AI diagnostics"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Teacher Mode</span>
          </button>
        </div>

        {/* Launch Desktop Overlay HUD Button */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).electronAPI?.openOverlay) {
              (window as any).electronAPI.openOverlay();
            } else if (typeof window !== 'undefined' && (window as any).electron?.send) {
              (window as any).electron.send('open-overlay');
            } else {
              alert(
                'Trading AI Screen Overlay is a native Windows background application.\n\n' +
                'Launch "Trading AI.exe" from your desktop or system tray, or press Ctrl + Shift + A to display the transparent floating AI HUD directly over TradingView.'
              );
            }
          }}
          className="px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border text-xs font-mono flex items-center space-x-1.5 transition-colors shadow-sm"
          title="Launch Native Floating Desktop Overlay (Ctrl+Shift+A)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-pulse" />
          <span>Desktop HUD (Ctrl+Shift+A)</span>
        </button>

        {actions && <div className="flex items-center space-x-2 border-l border-border pl-3">{actions}</div>}
      </div>
    </header>
  );
}
