import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createActivityStyles(t: Theme, insets: EdgeInsets) {
  const { colors, radius, space } = t;
  return {
    scroll: {
      paddingTop: insets.top + 10,
      paddingBottom: space["2xl"],
      paddingHorizontal: space.xl,
    },
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: space.lg,
    },
    h1: { fontSize: 26, fontWeight: "800" as const, color: colors.text },
    sub: { fontSize: 14, color: colors.muted },
    profileBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.xl, gap: space.md },
    cardHead: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    emoji: { fontSize: 32 },
    kicker: { fontSize: 11, fontWeight: "700" as const, color: colors.muted },
    big: { fontSize: 22, fontWeight: "800" as const, color: colors.text },
    metrics: { flexDirection: "row" as const, gap: 10 },
    metric: {
      flex: 1 as const,
      backgroundColor: colors.soft,
      borderRadius: 14,
      paddingVertical: space.md,
      alignItems: "center" as const,
    },
    metricN: { fontSize: 20, fontWeight: "800" as const, color: colors.primary },
    metricL: { fontSize: 10, color: colors.muted, textAlign: "center" as const },
    chart: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-end" as const,
      height: 80,
    },
    barCol: { width: 34, alignItems: "center" as const, gap: 5 },
    bar: { width: 14, borderRadius: radius.pill },
    barEmpty: { backgroundColor: colors.border },
    barPrimary: { backgroundColor: colors.primary },
    barAccent: { backgroundColor: colors.accent },
    barL: { fontSize: 10, color: colors.muted, fontWeight: "600" as const },
    barLActive: { color: colors.accent, fontWeight: "700" as const },
    h2: {
      fontSize: 20,
      fontWeight: "800" as const,
      color: colors.text,
      marginBottom: space.md,
      marginTop: space.lg,
    },
    hist: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: space.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 14,
      marginBottom: 10,
    },
    histBody: { flex: 1 as const },
    histArt: {
      width: 50,
      height: 50,
      borderRadius: space.lg,
      backgroundColor: colors.soft,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    histTitle: { fontWeight: "700" as const, color: colors.text, fontSize: 14 },
    histSub: { color: colors.muted, fontSize: 12 },
    score: {
      backgroundColor: colors.soft,
      borderRadius: radius.pill,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    scoreGreat: { backgroundColor: colors.successBg },
    scoreT: { color: colors.primary, fontWeight: "800" as const, fontSize: 12 },
    scoreTGreat: { color: colors.success },
  };
}

export function barHeight(minutes: number, max: number) {
  return { height: 16 + (minutes / max) * 36 };
}
