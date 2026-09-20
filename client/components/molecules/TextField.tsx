import { View, type TextInputProps } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import { AppText } from "../atoms/AppText";
import { Icon, type IconName } from "../atoms/Icon";
import { Input } from "../atoms/Input";
import { createTextFieldStyles } from "./TextField.styles";

type TextFieldProps = TextInputProps & {
  label: string;
  icon: IconName;
};

export function TextField({ label, icon, ...props }: TextFieldProps) {
  const styles = useThemedStyles(createTextFieldStyles);

  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.inputWrap}>
        <Icon name={icon} width={18} height={18} />
        <Input {...props} />
      </View>
    </View>
  );
}

export function Field(props: TextFieldProps) {
  return <TextField {...props} />;
}
