import type { EdgeInsets } from "react-native-safe-area-context";
import type { Theme } from "../../lib/theme";

export function createSignInStyles(t: Theme, insets: EdgeInsets) {
  const { colors, radius, space } = t;
  return {
    wrap: {
      paddingHorizontal: space.xl,
      paddingBottom: space["2xl"],
      paddingTop: insets.top + space["2xl"],
    },
    intro: { gap: space.md, marginTop: space.lg },
    form: { gap: space["2xl"], marginTop: 28 },
    footerBlock: { marginTop: space["2xl"], gap: space.xl },
    forgot: {
      fontSize: 13,
      fontWeight: "700" as const,
      color: colors.primary,
      textAlign: "right" as const,
    },
    or: { gap: space.md },
    line: { height: 1, backgroundColor: colors.border },
    orText: { fontSize: 12, color: colors.muted, textAlign: "center" as const },
    google: {
      height: 54,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    googleLabel: { fontSize: 14, fontWeight: "700" as const, color: colors.text },
    footer: { fontSize: 14, color: colors.muted, textAlign: "center" as const },
    link: { fontWeight: "800" as const, color: colors.primary },
  };
}
