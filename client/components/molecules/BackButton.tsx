import { TouchableOpacity } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import { AppText } from "../atoms/AppText";
import { createBackButtonStyles } from "./BackButton.styles";

type BackButtonProps = {
  onPress: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  const styles = useThemedStyles(createBackButtonStyles);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.back}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <AppText style={styles.icon}>‹</AppText>
    </TouchableOpacity>
  );
}

export function Back(props: BackButtonProps) {
  return <BackButton {...props} />;
}
