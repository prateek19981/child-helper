import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Back, Body, Field, PrimaryButton, Screen, Title } from "../../components/ui";
import { SvgIcon } from "../../components/SvgIcon";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { createForgotStyles } from "./_forgotStyles";

export default function Forgot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createForgotStyles(theme, insets), [theme, insets]);
  const { forgot } = useAuth();
  const [email, setEmail] = useState("");

  async function onSubmit() {
    try {
      const token = await forgot(email);
      Alert.alert(
        "Check your inbox",
        token ? `Dev reset token: ${token}` : "If that email exists, a reset was sent."
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Try again");
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Back onPress={() => router.back()} />
        <View style={styles.intro}>
          <Title>Forgot password</Title>
          <Body>Enter the email on your grown-up account and we’ll send a reset link.</Body>
        </View>
        <View style={styles.art}>
          <SvgIcon name="mail" width={80} height={80} />
        </View>
        <Field
          label="Email address"
          icon="mail"
          placeholder="mia@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <View style={styles.actions}>
          <PrimaryButton label="Send reset link" onPress={onSubmit} />
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.return}>Return to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}
