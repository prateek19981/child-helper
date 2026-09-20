import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, PrimaryButton, Screen, Title } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { createVerifiedStyles } from "./_verifiedStyles";

export default function Verified() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createVerifiedStyles(theme, insets), [theme, insets]);
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { verify, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    verify(token)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not verify"))
      .finally(() => setLoading(false));
  }, [token, verify]);

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.badge}>
          <Text style={styles.check}>✓</Text>
        </View>
        <Title>You’re in!</Title>
        {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
        <Body>
          {error
            ? error
            : user
              ? "Your email is verified. Let’s start speaking with Koober."
              : "We sent a verification link. Open it, then continue."}
        </Body>
        <View style={styles.actions}>
          <PrimaryButton
            label="Continue"
            onPress={() =>
              router.replace(user?.status === "active" ? "/(tabs)" : "/(auth)/sign-in")
            }
          />
        </View>
      </View>
    </Screen>
  );
}
