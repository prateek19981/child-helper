import type { Theme } from "../../lib/theme";

export function createScreenStyles(t: Theme) {
  return {
    screen: { flex: 1 as const, backgroundColor: t.colors.app },
  };
}
