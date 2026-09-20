import type { Theme } from "../../lib/theme";

export function createBackButtonStyles(t: Theme) {
  return {
    back: {
      width: 42,
      height: 42,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    icon: {
      ...t.typography.h3,
      color: t.colors.text,
      marginTop: -2,
    },
  };
}
