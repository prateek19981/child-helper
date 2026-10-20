import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createSignUpStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space } = t;
  return {
    wrap: {
      paddingHorizontal: space.xl,
      paddingBottom: space["2xl"],
      flexGrow: 1 as const,
      justifyContent: "space-between" as const,
      paddingTop: insets.top + 18,
    },
    intro: { gap: space.md, marginTop: space.md },
    form: { gap: space.xl, marginTop: space["2xl"] },
    actions: { marginTop: space["5xl"], gap: space.md },
    hint: { fontSize: 12, color: colors.muted },
    terms: { fontSize: 11, color: colors.muted, textAlign: "center" as const },
  };
}
