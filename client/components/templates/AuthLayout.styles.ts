import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createAuthLayoutStyles(t: Theme, insets: EdgeInsets) {
  return {
    content: {
      flex: 1 as const,
      paddingTop: insets.top + t.space.lg,
      paddingHorizontal: t.space.xl,
      paddingBottom: t.space["2xl"],
    },
  };
}
