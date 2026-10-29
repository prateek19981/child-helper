import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createKickMatchStyles(t: Theme, insets: EdgeInsets) {
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
      marginBottom: space.sm,
    },
    topMeta: {
      alignItems: "flex-end" as const,
      gap: 2,
    },
    roundLabel: {
      ...typography.label,
      color: colors.muted,
    },
    timer: {
      ...typography.h3,
      color: colors.accent,
      fontVariant: ["tabular-nums" as const],
    },
    timerUrgent: {
      color: colors.danger,
    },
    kickRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: space.md,
      marginBottom: space.md,
      paddingHorizontal: space.sm,
    },
    kickLottie: {
      width: 56,
      height: 56,
    },
    kickStatus: {
      flex: 1 as const,
      ...typography.bodySm,
      color: colors.muted,
    },
    kickSolved: {
      color: colors.success,
      fontWeight: "700" as const,
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
    prompt: {
      ...typography.body,
      color: colors.text,
      textAlign: "center" as const,
      marginBottom: space.sm,
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
    padDock: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: space.sm,
      flexShrink: 0 as const,
      backgroundColor: colors.app,
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: space.xl,
      alignItems: "center" as const,
      gap: space.md,
      marginBottom: space.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultWin: {
      borderColor: colors.success,
      backgroundColor: colors.successBg,
    },
    resultLose: {
      borderColor: colors.danger,
    },
    resultTitle: {
      ...typography.h1,
      color: colors.text,
      textAlign: "center" as const,
    },
    resultBody: {
      ...typography.body,
      color: colors.muted,
      textAlign: "center" as const,
    },
    actions: {
      gap: space.md,
      marginTop: "auto" as const,
    },
  };
}
