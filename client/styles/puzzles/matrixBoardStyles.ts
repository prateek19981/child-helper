import type { Theme } from "../../lib/theme";

export function createMatrixBoardStyles(t: Theme) {
  const { colors, radius, space, typography } = t;
  return {
    grid: {
      gap: space.sm,
    },
    row: {
      flexDirection: "row" as const,
      gap: space.sm,
    },
    cell: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    cellMissing: {
      borderColor: colors.accent,
      backgroundColor: colors.soft,
      borderWidth: 2,
    },
    cellText: {
      ...typography.h2,
      color: colors.text,
    },
    cellMissingText: {
      ...typography.h2,
      color: colors.accent,
    },
  };
}
