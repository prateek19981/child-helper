import "react-native-gesture-handler";
import { type Href, Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth";
import { ThemeProvider, useTheme } from "../lib/theme";
import { createRootLayoutStyles } from "../styles/layoutStyles";

function Gate() {
  const { user, ready } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createRootLayoutStyles(theme), [theme]);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const root = String(segments[0] ?? "");
    const inAuth = root === "(auth)" || root === "index" || root === "";
    if (user?.status === "active" && inAuth) {
      router.replace("/(tabs)" as Href);
    }
  }, [user, ready, segments, router]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: styles.stackContent }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="lesson/[id]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider initialMode="light">
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
