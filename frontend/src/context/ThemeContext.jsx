import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'reqinsight-theme';
const ThemeContext = createContext(null);

function readTheme() {
  const applied = document.documentElement.dataset.theme;
  return applied === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 300);
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable (private mode): theme still applies for this session */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Chart libraries need literal colour strings, so resolve the CSS variables. */
export function useThemeColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => `rgb(${style.getPropertyValue(`--c-${name}`).trim().split(/\s+/).join(',')})`;
    return {
      accent: read('accent'),
      ok: read('ok'),
      warn: read('warn'),
      bad: read('bad'),
      info: read('info'),
      line: read('line'),
      muted: read('muted'),
      surface: read('surface'),
      ink: read('ink'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
