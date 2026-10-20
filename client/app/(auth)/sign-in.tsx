import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { Back, Body, Field, PrimaryButton, Screen, Title } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { createSignInStyles } from "../../styles/auth/signInStyles";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createSignInStyles(theme, insets), [theme, insets]);
  const { signIn, google } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [, response, prompt] = Google.useIdTokenAuthRequest({
    clientId: clientId || "missing.apps.googleusercontent.com",
  });

  async function onSubmit() {
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Could not sign in", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (!clientId) {
      Alert.alert("Google sign-in", "Set EXPO_PUBLIC_GOOGLE_CLIENT_ID to enable Google.");
      return;
    }
    const result = await prompt();
    const token =
      result?.type === "success"
        ? result.params.id_token
        : response?.type === "success"
          ? response.params.id_token
          : undefined;
    if (!token) return;
    try {
      await google(token);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Google", e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Back onPress={() => router.back()} />
        <View style={styles.intro}>
          <Title>Welcome back!</Title>
          <Body>Koober missed you. Sign in to keep your speaking streak going.</Body>
        </View>
        <View style={styles.form}>
          <Field
            label="Email address"
            icon="mail"
            placeholder="mia@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Field
            label="Password"
            icon="lock"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity onPress={() => router.push("/(auth)/forgot")} activeOpacity={0.7}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>
          <View style={styles.or}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>
          <TouchableOpacity onPress={onGoogle} style={styles.google} activeOpacity={0.85}>
            <Text style={styles.googleLabel}>G  Continue with Google</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.footerBlock}>
          <PrimaryButton label={busy ? "Signing in…" : "Sign in"} onPress={onSubmit} />
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")} activeOpacity={0.7}>
            <Text style={styles.footer}>
              New to Koober?  <Text style={styles.link}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
