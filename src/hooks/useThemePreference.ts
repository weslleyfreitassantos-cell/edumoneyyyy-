import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark';

const themePreferenceKey = 'edumanager.theme';

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light';
  }

  try {
    return window.localStorage.getItem(themePreferenceKey) === 'dark'
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

function writeThemePreference(theme: ThemePreference): void {
  try {
    window.localStorage.setItem(themePreferenceKey, theme);
  } catch {
    // A interface continua funcional quando o armazenamento local esta indisponivel.
  }
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(
    readThemePreference,
  );

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    writeThemePreference(theme);

    return () => {
      root.classList.remove('dark');
      delete root.dataset.theme;
      root.style.removeProperty('color-scheme');
    };
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme: () => {
      setTheme((current) =>
        current === 'light' ? 'dark' : 'light',
      );
    },
  };
}
