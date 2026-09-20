import type { ColorTokens, RadiusTokens, SpaceTokens, TypographyTokens } from "./types";

/** 4pt base scale — multiply or swap at runtime via ThemeProvider */
export const space: SpaceTokens = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
};

export const radius: RadiusTokens = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  "2xl": 32,
  pill: 999,
  card: 28,
  input: 18,
  tile: 20,
};

export const typography: TypographyTokens = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "800", letterSpacing: -0.4 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.2 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  button: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  overline: { fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 0.4 },
};

export const lightColors: ColorTokens = {
  app: "#F7F7FB",
  surface: "#FFFFFF",
  primary: "#5B5BD6",
  accent: "#FF7A59",
  soft: "#EEEEFF",
  text: "#25253A",
  muted: "#74748A",
  border: "#E7E7EF",
  success: "#10B981",
  successBg: "rgba(16,185,129,0.08)",
  danger: "#EF4444",
  warning: "#F59E0B",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(37,37,58,0.45)",
};

export const darkColors: ColorTokens = {
  app: "#12121C",
  surface: "#1C1C2A",
  primary: "#8B8BF0",
  accent: "#FF8F73",
  soft: "#2A2A45",
  text: "#F4F4FB",
  muted: "#A0A0B8",
  border: "#2E2E42",
  success: "#34D399",
  successBg: "rgba(52,211,153,0.12)",
  danger: "#F87171",
  warning: "#FBBF24",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.55)",
};
