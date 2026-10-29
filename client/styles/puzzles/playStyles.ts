import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createPuzzlePlayStyles(t: Theme, insets: EdgeInsets) {
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
      marginBottom: space.md,
    },
    topMeta: {
      alignItems: "flex-end" as const,
      gap: 2,
    },
    levelLabel: {
      ...typography.label,
      color: colors.muted,
    },
    timer: {
      ...typography.h3,
      color: colors.accent,
      fontVariant: ["tabular-nums" as const],
      letterSpacing: 0.5,
    },
    timerUrgent: {
      color: colors.danger,
    },
    winTime: {
      ...typography.label,
      color: colors.muted,
    },
    loseCard: {
      backgroundColor: colors.soft,
      borderRadius: radius.card,
      padding: space.xl,
      alignItems: "center" as const,
      gap: space.md,
      marginBottom: space.lg,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    prompt: {
      ...typography.body,
      color: colors.text,
      textAlign: "center" as const,
      marginBottom: space.sm,
    },
    playBody: {
      flex: 1 as const,
      minHeight: 0 as const,
    },
    playScroll: {
      flex: 1 as const,
      minHeight: 0 as const,
    },
    scrollBody: {
      flexGrow: 1 as const,
      paddingBottom: space.sm,
      justifyContent: "center" as const,
    },
    boardWrap: {
      alignItems: "center" as const,
      marginBottom: space.sm,
    },
    feedback: {
      ...typography.bodySm,
      color: colors.muted,
      textAlign: "center" as const,
      marginBottom: space.sm,
      minHeight: 18,
    },
    feedbackWrong: { color: colors.danger },
    feedbackOk: { color: colors.success },
    padDock: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: space.sm,
      flexShrink: 0 as const,
      backgroundColor: colors.app,
    },
    actions: {
      gap: space.md,
      marginTop: "auto" as const,
    },
    winCard: {
      backgroundColor: colors.successBg,
      borderRadius: radius.card,
      padding: space.xl,
      alignItems: "center" as const,
      gap: space.md,
      marginBottom: space.lg,
    },
    winTitle: {
      ...typography.h1,
      color: colors.text,
      textAlign: "center" as const,
    },
    winBody: {
      ...typography.body,
      color: colors.muted,
      textAlign: "center" as const,
    },
  };
}
