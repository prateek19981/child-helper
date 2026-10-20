import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Back, PrimaryButton, Screen, Title } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { createSettingsStyles } from "../styles/settingsStyles";

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createSettingsStyles(theme, insets), [theme, insets]);
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.wrap}>
        <Back onPress={() => router.back()} />
        <Title>Settings</Title>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.actions}>
          <PrimaryButton
            label="Sign out"
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
