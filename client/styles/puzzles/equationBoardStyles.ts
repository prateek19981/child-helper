import type { Theme } from "../../lib/theme";

export function createEquationBoardStyles(t: Theme) {
  const { colors, radius, space, typography } = t;
  return {
    row: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: space.sm,
    },
    num: {
      minWidth: 56,
      height: 56,
      paddingHorizontal: space.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    numBlank: {
      borderColor: colors.accent,
      backgroundColor: colors.soft,
      borderWidth: 2,
    },
    numBlankActive: {
      borderColor: colors.primary,
      backgroundColor: colors.soft,
      borderWidth: 2.5,
    },
    numText: {
      ...typography.h2,
      color: colors.text,
    },
    numBlankText: {
      ...typography.h2,
      color: colors.accent,
    },
    op: {
      minWidth: 36,
      height: 44,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: space.sm,
    },
    opText: {
      ...typography.h2,
      color: colors.white,
      fontWeight: "800" as const,
    },
    eq: {
      ...typography.h1,
      color: colors.text,
      paddingHorizontal: space.xs,
    },
  };
}
