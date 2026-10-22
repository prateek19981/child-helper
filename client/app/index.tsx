import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { JamesModel } from "../components/organisms";
import { SvgIcon } from "../components/SvgIcon";
import { PrimaryButton, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { createWelcomeStyles } from "../styles/welcomeStyles";

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createWelcomeStyles(theme), [theme]);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.status === "active") router.replace("/(tabs)" as Href);
  }, [user, router]);

  return (
    <Screen>
      <View style={styles.hero}>
        <JamesModel mood="idle" size={280} />
        <View style={styles.stars}>
          <SvgIcon name="stars" width={10} height={60} />
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.h1}>Big words start with little moments</Text>
        <Text style={styles.sub}>
          Play, practice and grow confident speaking with Koober by your side.
        </Text>
        <PrimaryButton
          tone="accent"
          label="Create an account"
          onPress={() => router.push("/(auth)/sign-up" as Href)}
        />
        <TouchableOpacity onPress={() => router.push("/(auth)/sign-in" as Href)} activeOpacity={0.7}>
          <Text style={styles.footer}>
            Already have an account? <Text style={styles.link}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
