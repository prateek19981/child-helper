import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createForgotStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space } = t;
  return {
    wrap: {
      flex: 1 as const,
      paddingHorizontal: space.xl,
      paddingTop: insets.top + 18,
    },
    intro: { gap: space.md, marginTop: space.md },
    art: { alignItems: "center" as const, marginVertical: space["2xl"] },
    actions: { marginTop: "auto" as const, gap: space.lg, paddingBottom: space["2xl"] },
    return: { textAlign: "center" as const, color: colors.primary, fontWeight: "700" as const },
  };
}
