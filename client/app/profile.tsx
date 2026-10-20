import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgIcon } from "../components/SvgIcon";
import { Back, PrimaryButton, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { createProfileStyles } from "../styles/profileStyles";

function ageLabel(band: string | null | undefined) {
  if (!band) return null;
  return `Ages ${band}`;
}

function langLabel(code: string | null | undefined) {
  if (!code) return null;
  const map: Record<string, string> = { en: "English", hi: "Hindi", es: "Spanish" };
  return map[code.toLowerCase()] ?? code.toUpperCase();
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createProfileStyles(theme, insets), [theme, insets]);
  const router = useRouter();
  const { user, child, signOut } = useAuth();

  const age = ageLabel(child?.age_band);
  const language = langLabel(child?.language);
  const parentName = user?.display_name ?? "Parent";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Back onPress={() => router.back()} />
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.h1}>Profile</Text>
            <Text style={styles.sub}>Your family on Koober</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")} style={styles.cog} activeOpacity={0.7}>
            <SvgIcon name="cog" width={20} height={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <SvgIcon name="avatar" width={72} height={72} />
          </View>
          <View>
            <Text style={styles.name}>{child?.display_name ?? "Your learner"}</Text>
            <Text style={styles.role}>Learner profile</Text>
          </View>
          {(age || language) && (
            <View style={styles.chips}>
              {age ? (
                <View style={styles.chip}>
                  <Text style={styles.chipT}>{age}</Text>
                </View>
              ) : null}
              {language ? (
                <View style={styles.chip}>
                  <Text style={styles.chipT}>{language}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Account</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowIcon}>
                <SvgIcon name="user" width={18} height={18} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>PARENT</Text>
                <Text style={styles.rowValue}>{parentName}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <SvgIcon name="mail" width={18} height={18} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>EMAIL</Text>
                <Text style={styles.rowValue}>{user?.email ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Quick links</Text>
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/parent-hub")}
          >
            <View style={styles.rowIcon}>
              <SvgIcon name="icon_parent" width={19} height={19} />
            </View>
            <View style={styles.linkBody}>
              <Text style={styles.linkTitle}>Parent Hub</Text>
              <Text style={styles.linkSub}>Tips and weekly progress</Text>
            </View>
            <SvgIcon name="chevron" width={16} height={16} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} activeOpacity={0.7} onPress={() => router.push("/settings")}>
            <View style={styles.rowIcon}>
              <SvgIcon name="cog" width={18} height={18} />
            </View>
            <View style={styles.linkBody}>
              <Text style={styles.linkTitle}>Settings</Text>
              <Text style={styles.linkSub}>Manage your account</Text>
            </View>
            <SvgIcon name="chevron" width={16} height={16} />
          </TouchableOpacity>
        </View>

        <View style={styles.signOut}>
          <PrimaryButton
            label="Sign out"
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
