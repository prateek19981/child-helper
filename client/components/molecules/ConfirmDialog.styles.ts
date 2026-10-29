import type { Theme } from "../../lib/theme";

export function createConfirmDialogStyles(t: Theme) {
  const { colors, radius, space, typography } = t;
  return {
    backdrop: {
      flex: 1 as const,
      backgroundColor: colors.overlay,
      justifyContent: "center" as const,
      paddingHorizontal: space.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: space["2xl"],
      gap: space.lg,
    },
    title: {
      ...typography.h2,
      color: colors.text,
      textAlign: "center" as const,
    },
    body: {
      ...typography.body,
      color: colors.muted,
      textAlign: "center" as const,
    },
    actions: {
      gap: space.md,
      marginTop: space.sm,
    },
    cancelLink: {
      alignItems: "center" as const,
      paddingVertical: space.sm,
    },
    cancelText: {
      ...typography.label,
      color: colors.muted,
    },
  };
}
