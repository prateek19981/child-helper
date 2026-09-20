import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createLessonStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space } = t;
  return {
    wrap: {
      paddingTop: insets.top + 18,
      paddingHorizontal: space.xl,
      flex: 1 as const,
    },
    body: { marginTop: space.xl, gap: space.md },
    word: { fontSize: 18, fontWeight: "700" as const, color: colors.text },
    actions: { marginTop: "auto" as const, paddingBottom: space["2xl"] },
  };
}
