import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createVerifiedStyles(t: Theme, insets: EdgeInsets) {
  const { colors, space } = t;
  return {
    wrap: {
      flex: 1 as const,
      paddingHorizontal: space["2xl"],
      alignItems: "center" as const,
      gap: space.lg,
      paddingTop: insets.top + space["5xl"],
    },
    badge: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.soft,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: space["2xl"],
    },
    check: { fontSize: 40, color: colors.primary, fontWeight: "800" as const },
    actions: { marginTop: "auto" as const, paddingBottom: space["2xl"], alignSelf: "stretch" as const },
  };
}
