import type { ReactNode } from "react";
import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";
import { Screen } from "../atoms/Screen";
import { createAuthLayoutStyles } from "./AuthLayout.styles";

type AuthLayoutProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AuthLayout({ children, style }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createAuthLayoutStyles(theme, insets), [theme, insets]);

  return (
    <Screen>
      <View style={[styles.content, style]}>{children}</View>
    </Screen>
  );
}
