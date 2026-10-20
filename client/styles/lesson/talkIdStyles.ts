import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../../lib/theme";

export function createTalkStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space } = t;
  return {
    wrap: {
      flex: 1 as const,
      paddingTop: insets.top + space.md,
      paddingHorizontal: space.xl,
      paddingBottom: Math.max(insets.bottom, space.lg),
    },
    top: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    progress: {
      ...t.typography.caption,
      color: colors.muted,
      fontWeight: "700" as const,
    },
    center: {
      flex: 1 as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: space.lg,
    },
    actions: { gap: space.md, paddingBottom: space.sm },
    secondary: {
      alignItems: "center" as const,
      paddingVertical: space.sm,
    },
    secondaryText: {
      ...t.typography.label,
      color: colors.primary,
    },
  };
}
