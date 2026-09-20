import type { Theme } from "../lib/theme";

export function createRootLayoutStyles(t: Theme) {
  return {
    loading: {
      flex: 1 as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.app,
    },
    stackContent: { backgroundColor: t.colors.app },
  };
}
