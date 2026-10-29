import type { Theme } from "../../lib/theme";

export function createHintSheetStyles(t: Theme) {
  const { colors, radius, space, typography } = t;
  return {
    wrap: {
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
    },
    title: {
      ...typography.label,
      color: colors.primary,
    },
    body: {
      ...typography.body,
      color: colors.text,
    },
    step: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: "700" as const,
    },
  };
}
