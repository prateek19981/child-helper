import type { Theme } from "../../lib/theme";

export function createTabsLayoutStyles(t: Theme) {
  const { colors, radius, space } = t;
  return {
    bar: {
      height: 76,
      width: "100%",
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      paddingHorizontal: space.xl,
      justifyContent: "space-between" as const,
    },
    tabRow: {
      flex: 1 as const,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-around" as const,
    },
    tabButton: {
      width: 100,
      justifyContent: "center" as const
    },
    item: { 
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginTop: space["4xl"],
      marginLeft: space["2xl"],
    },
    badge: {
      width: 44,
      height: 30,
      borderRadius: radius.pill,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: colors.surface,
    },
    badgeOn: { backgroundColor: colors.soft },
    label: { fontSize: 11, fontWeight: "500" as const, color: colors.muted },
    labelOn: { fontWeight: "700" as const, color: colors.primary },
  };
}
