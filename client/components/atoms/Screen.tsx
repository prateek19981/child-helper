import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import { createScreenStyles } from "./Screen.styles";

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, style }: ScreenProps) {
  const styles = useThemedStyles(createScreenStyles);
  return <View style={[styles.screen, style]}>{children}</View>;
}
