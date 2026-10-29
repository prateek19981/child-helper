import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createTalkStyles(t: Theme, insets: EdgeInsets) {
  const { colors, radius, space, typography } = t;
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
      ...typography.caption,
      color: colors.muted,
      fontWeight: "700" as const,
    },
    center: {
      flex: 1 as const,
      width: "100%" as const,
      alignItems: "stretch" as const,
    },
    reward: {
      flex: 1 as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: space.md,
      paddingHorizontal: space.lg,
    },
    boot: {
      flex: 1 as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: space.md,
      paddingHorizontal: space.lg,
    },
    bridge: {
      position: "absolute" as const,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.app,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: space.lg,
      paddingHorizontal: space.xl,
      zIndex: 20,
    },
    wink: {
      width: 220,
      height: 220,
    },
    rewardTitle: {
      ...typography.h1,
      color: colors.text,
      textAlign: "center" as const,
    },
    starsEarn: {
      backgroundColor: colors.soft,
      borderRadius: radius.pill,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
    },
    starsEarnText: {
      ...typography.label,
      color: colors.primary,
    },
    rewardHint: {
      ...typography.bodySm,
      color: colors.muted,
      textAlign: "center" as const,
    },
    actions: { gap: space.md, paddingBottom: space.sm },
    secondary: {
      alignItems: "center" as const,
      paddingVertical: space.sm,
    },
    secondaryText: {
      ...typography.label,
      color: colors.primary,
    },
  };
}
