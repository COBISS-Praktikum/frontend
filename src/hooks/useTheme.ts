import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sgc-theme';

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage unavailable — fall back to system preference */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

// Resolve + apply once at module load to minimise the flash of the wrong theme.
let currentTheme: Theme = getPreferredTheme();
applyTheme(currentTheme);

// Lightweight subscription so every useTheme() instance (header toggle, graph
// canvas, …) stays in sync without needing a context provider in the tree.
const listeners = new Set<(theme: Theme) => void>();

function commitTheme(theme: Theme) {
  currentTheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore persistence errors */
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener(theme));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const listener = (next: Theme) => setTheme(next);
    listeners.add(listener);
    // Re-sync in case the theme changed between module load and mount.
    setTheme(currentTheme);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setThemeValue = useCallback((next: Theme) => commitTheme(next), []);
  const toggleTheme = useCallback(
    () => commitTheme(currentTheme === 'dark' ? 'light' : 'dark'),
    [],
  );

  return { theme, setTheme: setThemeValue, toggleTheme };
}
