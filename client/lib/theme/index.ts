export { ThemeProvider, useTheme, useThemeControls, useThemedStyles } from "./ThemeProvider";
export { createTheme, darkTheme, lightTheme, resolveTheme, themes } from "./themes";
export { darkColors, lightColors, radius, space, typography } from "./tokens";
export type {
  ColorTokens,
  FontWeight,
  RadiusTokens,
  SpaceTokens,
  Theme,
  ThemeMode,
  ThemeOverrides,
  TypeStyle,
  TypographyTokens,
} from "./types";

import { lightColors } from "./tokens";

/**
 * Static light palette for module-scope StyleSheet.create.
 * Prefer `useTheme().colors` inside components so values stay dynamic.
 */
export const colors = lightColors;
