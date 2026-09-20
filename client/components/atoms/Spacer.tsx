import type { ReactNode } from "react";
import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, type SpaceTokens } from "../../lib/theme";
import { createSpacerStyles } from "./Spacer.styles";

type SpacerProps = {
  size?: keyof SpaceTokens;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Spacer({ size = "md", horizontal, style, children }: SpacerProps) {
  const theme = useTheme();
  const styles = useMemo(
    () => createSpacerStyles(theme, size, horizontal),
    [theme, size, horizontal]
  );

  return <View style={[styles.box, style]}>{children}</View>;
}
