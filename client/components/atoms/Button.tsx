import { TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import { AppText } from "./AppText";
import { createButtonStyles } from "./Button.styles";

export type ButtonTone = "primary" | "accent";

type ButtonProps = {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function Button({ label, onPress, tone = "primary", style, disabled }: ButtonProps) {
  const styles = useThemedStyles(createButtonStyles);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, styles[tone], disabled && styles.disabled, style]}
      activeOpacity={0.85}
    >
      <AppText tone="white" style={styles.label}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

export function PrimaryButton(props: ButtonProps) {
  return <Button {...props} />;
}
