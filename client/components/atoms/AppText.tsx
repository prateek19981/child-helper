import type { ReactNode } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTheme, useThemedStyles, type TypographyTokens } from "../../lib/theme";
import { createAppTextStyles } from "./AppText.styles";

export type TextVariant = keyof TypographyTokens;
export type TextTone = "text" | "muted" | "primary" | "accent" | "white" | "success" | "danger";

type AppTextProps = {
  children: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function AppText({
  children,
  variant = "body",
  tone = "text",
  style,
  numberOfLines,
}: AppTextProps) {
  const { typography } = useTheme();
  const styles = useThemedStyles(createAppTextStyles);

  return (
    <Text numberOfLines={numberOfLines} style={[typography[variant], styles[tone], style]}>
      {children}
    </Text>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <AppText variant="title" tone="text" style={style}>
      {children}
    </AppText>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <AppText variant="body" tone="muted" style={style}>
      {children}
    </AppText>
  );
}
