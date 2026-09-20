import type { Theme } from "../../lib/theme";

export function createAppTextStyles(t: Theme) {
  return {
    text: { color: t.colors.text },
    muted: { color: t.colors.muted },
    primary: { color: t.colors.primary },
    accent: { color: t.colors.accent },
    white: { color: t.colors.white },
    success: { color: t.colors.success },
    danger: { color: t.colors.danger },
  };
}
