import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { resolveTheme } from "./themes";
import type { Theme, ThemeMode, ThemeOverrides } from "./types";

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  /** Switch light / dark. Pass `"system"` to follow OS. */
  setMode: (mode: ThemeMode | "system") => void;
  /** Patch tokens at runtime (branding, remote config). */
  setOverrides: (overrides: ThemeOverrides | ((prev: ThemeOverrides) => ThemeOverrides)) => void;
  clearOverrides: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** Initial mode. `"system"` follows the OS appearance. */
  initialMode?: ThemeMode | "system";
  /** Seed overrides (e.g. white-label colors from env / API). */
  initialOverrides?: ThemeOverrides;
};

export function ThemeProvider({
  children,
  initialMode = "light",
  initialOverrides,
}: Props) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemeMode | "system">(initialMode);
  const [overrides, setOverridesState] = useState<ThemeOverrides>(initialOverrides ?? {});

  const mode: ThemeMode =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  const theme = useMemo(() => resolveTheme(mode, overrides), [mode, overrides]);

  const setMode = useCallback((next: ThemeMode | "system") => {
    setPreference(next);
  }, []);

  const setOverrides = useCallback(
    (next: ThemeOverrides | ((prev: ThemeOverrides) => ThemeOverrides)) => {
      setOverridesState((prev) => (typeof next === "function" ? next(prev) : next));
    },
    []
  );

  const clearOverrides = useCallback(() => setOverridesState({}), []);

  const value = useMemo(
    () => ({ theme, mode, setMode, setOverrides, clearOverrides }),
    [theme, mode, setMode, setOverrides, clearOverrides]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx.theme;
}

export function useThemeControls() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeControls must be used within ThemeProvider");
  return {
    mode: ctx.mode,
    setMode: ctx.setMode,
    setOverrides: ctx.setOverrides,
    clearOverrides: ctx.clearOverrides,
  };
}

/** Build styles that recompute when the theme changes. Pass a stable factory (module-level). */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
