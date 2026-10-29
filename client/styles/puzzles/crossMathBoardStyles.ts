import type { Theme } from "../../lib/theme";

/** Crossword tile board — same-size tiles for numbers, ops, equals, results. */
export function createCrossMathBoardStyles(t: Theme) {
  const { colors, radius, space, typography } = t;
  const TILE = 48;
  const GAP = 6;
  return {
    TILE,
    GAP,
    wrap: {
      alignItems: "center" as const,
      gap: GAP,
      paddingVertical: space.sm,
    },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: GAP,
    },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: radius.sm,
      backgroundColor: colors.success,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      // soft “glow” without neon clutter
      shadowColor: colors.success,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    tileBlank: {
      backgroundColor: "#86D4B0",
      opacity: 0.95,
    },
    tileBlankActive: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
    },
    tileGhost: {
      width: TILE,
      height: TILE,
      opacity: 0,
    },
    tileText: {
      ...typography.h3,
      color: colors.black,
      fontWeight: "800" as const,
      fontSize: 18,
    },
    tileTextBlank: {
      ...typography.h3,
      color: colors.black,
      fontWeight: "800" as const,
      fontSize: 20,
    },
    tileTextOnAccent: {
      ...typography.h3,
      color: colors.white,
      fontWeight: "800" as const,
      fontSize: 20,
    },
  };
}
