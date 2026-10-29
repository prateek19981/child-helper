import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createLessonLoadingStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space, typography } = t;
  return {
    wrap: {
      flex: 1 as const,
      paddingTop: insets.top + space.xl,
      paddingBottom: Math.max(insets.bottom, space.xl),
      paddingHorizontal: space.xl,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: space.lg,
    },
    logo: {
      width: 220,
      height: 220,
    },
    title: {
      ...typography.h1,
      color: colors.text,
      textAlign: "center" as const,
    },
    subtitle: {
      ...typography.body,
      color: colors.muted,
      textAlign: "center" as const,
      maxWidth: 280,
    },
  };
}
