'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppMode = 'public' | 'teacher';

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const AppModeContext = createContext<AppModeContextValue>({
  mode: 'teacher',
  setMode: () => {},
  toggleMode: () => {},
});

const STORAGE_KEY = 'guardedmarkets_app_mode';

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('teacher');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'public' || saved === 'teacher') {
        setModeState(saved);
      }
    } catch {
      // Ignore storage access errors
    }
    setMounted(true);
  }, []);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Ignore
    }
  };

  const toggleMode = () => {
    const nextMode: AppMode = mode === 'teacher' ? 'public' : 'teacher';
    setMode(nextMode);
  };

  return (
    <AppModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
