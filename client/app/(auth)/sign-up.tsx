import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Back, Body, Field, PrimaryButton, Screen, Title } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { createSignUpStyles } from "../../styles/auth/signUpStyles";

export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createSignUpStyles(theme, insets), [theme, insets]);
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [childName, setChildName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit() {
    if (!childName.trim()) {
      Alert.alert("Child’s name", "Please enter your child’s name.");
      return;
    }
    try {
      const token = await register(name, email, password, childName.trim());
      router.push({ pathname: "/(auth)/verified", params: { token } });
    } catch (e) {
      Alert.alert("Could not create account", e instanceof Error ? e.message : "Try again");
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Back onPress={() => router.back()} />
        <View style={styles.intro}>
          <Title>Let’s grow together</Title>
          <Body>Create your grown-up account, then we’ll set up your child’s playful space.</Body>
        </View>
        <View style={styles.form}>
          <Field
            label="Your name"
            icon="user"
            placeholder="Alex Carter"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Child’s name"
            icon="user"
            placeholder="Mia"
            autoCapitalize="words"
            value={childName}
            onChangeText={setChildName}
          />
          <Field
            label="Email address"
            icon="mail"
            placeholder="mia@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Field
            label="Create password"
            icon="lock"
            placeholder="8+ characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text style={styles.hint}>Use a number and one special character.</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton tone="accent" label="Create account" onPress={onSubmit} />
          <Text style={styles.terms}>By continuing, you agree to Kick’s Terms and Privacy Policy.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
