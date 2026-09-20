import type { Theme } from "../../lib/theme";

export function createTextFieldStyles(t: Theme) {
  return {
    field: { gap: t.space.md, width: "100%" as const },
    inputWrap: {
      height: 54,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: t.space.lg,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: t.space.md,
    },
  };
}
