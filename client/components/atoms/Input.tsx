import {
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { createInputStyles } from "./Input.styles";

type InputProps = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

export function Input({ style, ...props }: InputProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createInputStyles);

  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, style]}
      autoCapitalize="none"
      {...props}
    />
  );
}
