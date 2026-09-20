import { darkColors, lightColors, radius, space, typography } from "./tokens";
import type { Theme, ThemeMode, ThemeOverrides } from "./types";

export const lightTheme: Theme = {
  mode: "light",
  colors: lightColors,
  space,
  radius,
  typography,
};

export const darkTheme: Theme = {
  mode: "dark",
  colors: darkColors,
  space,
  radius,
  typography,
};

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

function mergeTypography(
  base: Theme["typography"],
  patch?: ThemeOverrides["typography"]
): Theme["typography"] {
  if (!patch) return base;
  const next = { ...base };
  for (const key of Object.keys(patch) as (keyof Theme["typography"])[]) {
    const partial = patch[key];
    if (partial) next[key] = { ...base[key], ...partial };
  }
  return next;
}

/** Deep-merge overrides onto a base theme (branding, remote config, A/B). */
export function createTheme(base: Theme, overrides?: ThemeOverrides): Theme {
  if (!overrides) return base;
  return {
    mode: overrides.mode ?? base.mode,
    colors: { ...base.colors, ...overrides.colors },
    space: { ...base.space, ...overrides.space },
    radius: { ...base.radius, ...overrides.radius },
    typography: mergeTypography(base.typography, overrides.typography),
  };
}

export function resolveTheme(mode: ThemeMode, overrides?: ThemeOverrides): Theme {
  return createTheme(themes[mode], overrides);
}
