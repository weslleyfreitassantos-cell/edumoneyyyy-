import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(
  null,
);

interface ThemeProviderProps {
  children: ReactNode;
}

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
    // Continua funcional sem localStorage.
  }
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] =
    useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    writeThemePreference(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => {
        setThemeState((current) =>
          current === 'light' ? 'dark' : 'light',
        );
      },
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useThemePreference deve ser usado dentro de ThemeProvider.',
    );
  }

  return context;
}