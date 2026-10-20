import type { Theme } from "../lib/theme";

export function createWelcomeStyles(t: Theme) {
  const { colors, space } = t;
  return {
    hero: {
      height: 420,
      backgroundColor: colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 18,
    },
    fox: { width: 188, height: 188 },
    stars: { height: 60, width: 10 },
    content: {
      flex: 1 as const,
      paddingHorizontal: space["2xl"],
      paddingTop: space["2xl"],
      alignItems: "center" as const,
      gap: space.lg,
    },
    h1: {
      fontSize: 32,
      fontWeight: "800" as const,
      color: colors.text,
      textAlign: "center" as const,
    },
    sub: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      textAlign: "center" as const,
      marginBottom: space.sm,
    },
    footer: { fontSize: 14, color: colors.muted, marginTop: space.sm },
    link: { fontWeight: "800" as const, color: colors.primary },
  };
}
