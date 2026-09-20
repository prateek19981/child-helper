import type { Theme } from "../../lib/theme";

export function createInputStyles(t: Theme) {
  return {
    input: {
      flex: 1 as const,
      fontSize: t.typography.body.fontSize,
      color: t.colors.text,
    },
  };
}
