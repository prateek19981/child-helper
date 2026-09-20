import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../lib/theme";

export function createSettingsStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space } = t;
  return {
    wrap: {
      paddingTop: insets.top + 18,
      paddingHorizontal: space.xl,
      flex: 1 as const,
    },
    email: { marginTop: space.md, color: colors.muted },
    actions: { marginTop: "auto" as const, paddingBottom: space["2xl"] },
  };
}
