import type { SpaceTokens, Theme } from "../../lib/theme";

export function createSpacerStyles(
  t: Theme,
  size: keyof SpaceTokens,
  horizontal?: boolean
) {
  const value = t.space[size];
  return {
    box: horizontal ? { width: value } : { height: value },
  };
}
