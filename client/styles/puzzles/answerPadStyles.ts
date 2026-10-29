import type { Theme } from "../../lib/theme";

export function createAnswerPadStyles(t: Theme) {
  const { colors, radius, space, typography } = t;
  return {
    wrap: {
      gap: space.sm,
    },
    label: {
      ...typography.label,
      color: colors.muted,
      textAlign: "center" as const,
    },
    display: {
      minHeight: 40,
      borderRadius: radius.input,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: space.md,
    },
    displayText: {
      ...typography.h2,
      color: colors.text,
      letterSpacing: 2,
    },
    displayPlaceholder: {
      ...typography.bodySm,
      color: colors.muted,
    },
    keys: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 6,
      justifyContent: "space-between" as const,
    },
    key: {
      width: "23%" as const,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.soft,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    keyWide: {
      width: "48%" as const,
    },
    keyText: {
      ...typography.h3,
      color: colors.text,
      fontSize: 18,
    },
  };
}
