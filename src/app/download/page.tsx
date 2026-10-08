'use client';

import React, { useState } from 'react';
import {
  Download,
  ShieldCheck,
  Cpu,
  HardDrive,
  Monitor,
  CheckCircle2,
  Lock,
  ArrowDownToLine,
  FileCode,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

export default function DownloadPage() {
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleDownload = () => {
    setDownloadStarted(true);
    // Trigger download of the setup installer
    const link = document.createElement('a');
    link.href = '/TradingAI-Setup.exe';
    link.download = 'TradingAI-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background select-none">
      <Header
        title="Trading AI Desktop Workstation"
        subtitle="Official Windows Desktop Installer & Local-First Client Package"
      />

      <div className="p-6 space-y-8 max-w-5xl mx-auto flex-1">
        {/* HERO SECTION */}
        <div className="p-8 rounded-xl bg-surface-primary border border-border flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent/15 border border-accent/30 text-accent">
                WINDOWS 64-BIT (x64)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-signal-green/10 border border-signal-green/20 text-signal-green font-semibold">
                v1.0.0 STABLE
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              TradingAI Desktop Workstation
            </h1>

            <p className="text-sm text-foreground-secondary max-w-xl font-sans leading-relaxed">
              Run your personal trading AI natively on Windows. Enjoy low-latency desktop screen capture, hardware-accelerated charting, zero-lookahead backtests, and 100% local-first privacy.
            </p>

            <div className="flex items-center space-x-4 pt-2 text-xs font-mono text-foreground-muted">
              <span className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-signal-green" />
                <span>Zero Cloud Leakage</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-accent" />
                <span>Local SQLite Storage</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-signal-amber" />
                <span>Native Electron Shell</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 shrink-0">
            <button
              onClick={handleDownload}
              className="px-6 py-3.5 rounded-lg bg-accent text-background font-bold hover:bg-accent-hover transition-all flex items-center space-x-2 text-sm shadow-lg shadow-accent/10 hover:scale-105"
            >
              <Download className="w-5 h-5" />
              <span>Download TradingAI-Setup.exe</span>
            </button>

            <span className="text-[11px] font-mono text-foreground-muted">
              Package Size: ~152.5 MB · Windows 10/11 (x64)
            </span>

            {downloadStarted && (
              <span className="text-[11px] font-mono text-signal-green flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Installer download triggered</span>
              </span>
            )}
          </div>
        </div>

        {/* INTEGRITY & SYSTEM REQUIREMENTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security & Checksum */}
          <div className="p-6 rounded-lg bg-surface-primary border border-border space-y-4 font-mono text-xs">
            <div className="flex items-center space-x-2 text-foreground font-semibold uppercase tracking-wider text-xs border-b border-border pb-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Cryptographic Verification & Checksums</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-foreground-muted uppercase block">Package Artifact</span>
                <span className="text-foreground font-bold">TradingAI-Setup.exe</span>
              </div>

              <div>
                <span className="text-[10px] text-foreground-muted uppercase block">SHA-256 Hash</span>
                <div className="p-2 rounded bg-surface-secondary border border-border text-[10px] text-accent break-all select-all font-mono">
                  0AF413051A252643ABE9BA2C03945144614D71A400F40DB33B5932F74A1CF126
                </div>
              </div>

              <div>
                <span className="text-[10px] text-foreground-muted uppercase block">Signing Authority</span>
                <span className="text-foreground-secondary">GuardedMarkets Local-First Verified Authority</span>
              </div>
            </div>
          </div>

          {/* System Requirements */}
          <div className="p-6 rounded-lg bg-surface-primary border border-border space-y-4 font-mono text-xs">
            <div className="flex items-center space-x-2 text-foreground font-semibold uppercase tracking-wider text-xs border-b border-border pb-2">
              <Monitor className="w-4 h-4 text-accent" />
              <span>Minimum System Specifications</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Operating System</span>
                <span className="text-foreground font-semibold">Windows 10 / 11 (64-bit)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Processor (CPU)</span>
                <span className="text-foreground font-semibold">Intel Core i5 / AMD Ryzen 5 or higher</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">System Memory (RAM)</span>
                <span className="text-foreground font-semibold">8 GB RAM (16 GB Recommended)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-foreground-secondary">Disk Storage</span>
                <span className="text-foreground font-semibold">2 GB available SSD space</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-foreground-secondary">Display Resolution</span>
                <span className="text-foreground font-semibold">1920 &times; 1080 or higher</span>
              </div>
            </div>
          </div>
        </div>

        {/* INSTALLATION GUIDE */}
        <div className="p-6 rounded-lg bg-surface-primary border border-border space-y-4 font-mono text-xs">
          <div className="flex items-center space-x-2 text-foreground font-semibold uppercase tracking-wider text-xs border-b border-border pb-2">
            <Terminal className="w-4 h-4 text-accent" />
            <span>3-Step Installation Walkthrough</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-surface-secondary border border-border space-y-2">
              <span className="text-accent font-bold text-sm">Step 1</span>
              <h3 className="font-semibold text-foreground font-sans text-xs">Run the Installer</h3>
              <p className="text-foreground-secondary text-[11px] font-sans">
                Double click <code className="text-accent">TradingAI-Setup.exe</code> in your Downloads folder to launch the setup wizard.
              </p>
            </div>

            <div className="p-4 rounded bg-surface-secondary border border-border space-y-2">
              <span className="text-accent font-bold text-sm">Step 2</span>
              <h3 className="font-semibold text-foreground font-sans text-xs">SmartScreen Notification</h3>
              <p className="text-foreground-secondary text-[11px] font-sans">
                If Windows Defender SmartScreen appears, simply click <strong className="text-foreground">"More info"</strong> and then select <strong className="text-foreground">"Run anyway"</strong>.
              </p>
            </div>

            <div className="p-4 rounded bg-surface-secondary border border-border space-y-2">
              <span className="text-accent font-bold text-sm">Step 3</span>
              <h3 className="font-semibold text-foreground font-sans text-xs">Launch Desktop App</h3>
              <p className="text-foreground-secondary text-[11px] font-sans">
                Launch TradingAI from your Desktop shortcut or Windows Start Menu. The local server and SQLite engine initialize automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
