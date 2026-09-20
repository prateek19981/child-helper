import type { TextStyle } from "react-native";

export type ColorTokens = {
  app: string;
  surface: string;
  primary: string;
  accent: string;
  soft: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  successBg: string;
  danger: string;
  warning: string;
  white: string;
  black: string;
  overlay: string;
};

export type SpaceTokens = {
  none: number;
  xxs: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
  "4xl": number;
  "5xl": number;
};

export type RadiusTokens = {
  none: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  pill: number;
  /** @deprecated Prefer lg / xl — kept for existing screens */
  card: number;
  /** @deprecated Prefer md — kept for existing screens */
  input: number;
  /** @deprecated Prefer lg — kept for existing screens */
  tile: number;
};

export type FontWeight = NonNullable<TextStyle["fontWeight"]>;

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  letterSpacing?: number;
};

export type TypographyTokens = {
  display: TypeStyle;
  h1: TypeStyle;
  h2: TypeStyle;
  h3: TypeStyle;
  title: TypeStyle;
  body: TypeStyle;
  bodySm: TypeStyle;
  label: TypeStyle;
  caption: TypeStyle;
  button: TypeStyle;
  overline: TypeStyle;
};

export type ThemeMode = "light" | "dark";

export type Theme = {
  mode: ThemeMode;
  colors: ColorTokens;
  space: SpaceTokens;
  radius: RadiusTokens;
  typography: TypographyTokens;
};

export type ThemeOverrides = {
  mode?: ThemeMode;
  colors?: Partial<ColorTokens>;
  space?: Partial<SpaceTokens>;
  radius?: Partial<RadiusTokens>;
  typography?: Partial<{ [K in keyof TypographyTokens]: Partial<TypeStyle> }>;
};
