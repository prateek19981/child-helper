import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createPuzzleListStyles(t: Theme, insets: EdgeInsets) {
  const { colors, radius, space, typography } = t;
  return {
    wrap: {
      flex: 1 as const,
      paddingTop: insets.top + space.md,
      paddingHorizontal: space.xl,
      paddingBottom: Math.max(insets.bottom, space.xl),
    },
    top: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: space.lg,
    },
    header: {
      marginBottom: space.lg,
      gap: space.sm,
    },
    subtitle: {
      ...typography.body,
      color: colors.muted,
    },
    tabs: {
      flexDirection: "row" as const,
      gap: space.sm,
      marginBottom: space.xl,
      padding: 4,
      borderRadius: radius.lg,
      backgroundColor: colors.soft,
    },
    tab: {
      flex: 1 as const,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      alignItems: "center" as const,
    },
    tabActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabLabel: {
      ...typography.label,
      color: colors.muted,
    },
    tabLabelActive: {
      color: colors.text,
      fontWeight: "700" as const,
    },
    modeBlurb: {
      ...typography.bodySm,
      color: colors.muted,
      marginBottom: space.lg,
    },
    grid: {
      gap: space.md,
    },
    diffCard: {
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.xs,
    },
    diffTitle: {
      ...typography.h2,
      color: colors.text,
    },
    diffMeta: {
      ...typography.bodySm,
      color: colors.muted,
    },
    diffWins: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: "700" as const,
      marginTop: space.xs,
    },
    // legacy level-grid styles kept for any leftover screens
    card: {
      width: "30%" as const,
      minWidth: 96,
      flexGrow: 1 as const,
      aspectRatio: 1,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: space.xs,
      padding: space.sm,
    },
    cardCurrent: {
      borderColor: colors.primary,
      backgroundColor: colors.soft,
      borderWidth: 2,
    },
    cardCleared: {
      borderColor: colors.success,
      backgroundColor: colors.successBg,
    },
    cardLocked: {
      opacity: 0.55,
    },
    levelNum: {
      ...typography.h2,
      color: colors.text,
    },
    levelMeta: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: "700" as const,
    },
    badge: {
      ...typography.overline,
      color: colors.primary,
      textTransform: "uppercase" as const,
    },
  };
}
