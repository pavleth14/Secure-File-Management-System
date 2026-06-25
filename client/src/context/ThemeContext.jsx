import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'theme';

/**
 * Resolve the initial theme: an explicit saved preference wins, otherwise we
 * respect the operating system preference on first visit.
 * @returns {'light' | 'dark'}
 */
function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  const prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function applyThemeClass(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  // Tracks whether the user explicitly chose a theme (vs. following the system).
  const [hasExplicitPreference, setHasExplicitPreference] = useState(
    () =>
      typeof window !== 'undefined' &&
      ['light', 'dark'].includes(window.localStorage.getItem(STORAGE_KEY))
  );

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Keep following the system theme until the user makes an explicit choice.
  useEffect(() => {
    if (hasExplicitPreference || !window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [hasExplicitPreference]);

  const setThemePreference = useCallback((next) => {
    setTheme(next);
    setHasExplicitPreference(true);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setThemePreference]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme: setThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
