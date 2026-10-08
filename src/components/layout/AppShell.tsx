'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { StudentChatWidget } from '@/components/chat/StudentChatWidget';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverlay = pathname === '/overlay';

  if (isOverlay) {
    return (
      <div
        className="w-full h-screen bg-[#090B0F] select-none overflow-hidden p-0 m-0"
      >
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col bg-background">
        {children}
      </main>
      <StudentChatWidget />
    </div>
  );
}
