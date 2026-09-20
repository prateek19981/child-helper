import type { Theme } from "../../lib/theme";

export function createButtonStyles(t: Theme) {
  const { colors, space, radius, typography } = t;
  return {
    base: {
      height: 54,
      borderRadius: radius.pill,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      padding: space.lg,
    },
    primary: { backgroundColor: colors.primary },
    accent: { backgroundColor: colors.accent },
    label: { ...typography.button, color: colors.white },
    disabled: { opacity: 0.5 },
  };
}
