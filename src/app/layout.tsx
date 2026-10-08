import type { Metadata } from 'next';
import './globals.css';
import { AppModeProvider } from '@/lib/context/AppModeContext';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'GuardedMarketsAI — Personal Trading AI Student & Analyst',
  description: 'Local-first personal AI trading system learning from your teaching videos, rules, and chart examples.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-background">
      <body className="bg-background text-foreground min-h-screen antialiased selection:bg-accent/20 selection:text-accent overflow-x-hidden">
        <AppModeProvider>
          <AppShell>{children}</AppShell>
        </AppModeProvider>
      </body>
    </html>
  );
}
