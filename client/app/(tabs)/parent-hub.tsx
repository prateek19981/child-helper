import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgIcon } from "../../components/SvgIcon";
import { Screen } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { createParentHubStyles } from "../../styles/tabs/parentHubStyles";

type Hub = {
  headline: string;
  summary: string;
  week_label: string;
  tips: { id: string; title: string; body: string; read_minutes: number }[];
};

export default function ParentHub() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createParentHubStyles(theme, insets), [theme, insets]);
  const router = useRouter();
  const { child } = useAuth();
  const [data, setData] = useState<Hub | null>(null);

  useEffect(() => {
    if (!child) return;
    apiJson<Hub>(`/children/${child.id}/parent-hub`).then(setData).catch(() => setData(null));
  }, [child]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowT}>GROWN-UPS ONLY</Text>
            </View>
            <Text style={styles.h1}>Parent Hub</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/settings")} style={styles.cog} activeOpacity={0.7}>
            <SvgIcon name="cog" width={20} height={20} />
          </TouchableOpacity>
        </View>
        <View style={styles.progress}>
          <View style={styles.progressBody}>
            <View style={styles.weekPill}>
              <Text style={styles.weekT}>{(data?.week_label ?? "This week").toUpperCase()}</Text>
            </View>
            <Text style={styles.progressH}>{data?.headline ?? "Confidence is blooming 🌸"}</Text>
            <Text style={styles.progressS}>{data?.summary ?? ""}</Text>
            <View style={styles.cta}>
              <Text style={styles.ctaT}>View full report →</Text>
            </View>
          </View>
          <SvgIcon name="progress" width={90} height={96} />
        </View>
        <Text style={styles.h2}>Tips for growing talkers</Text>
        <Text style={styles.sub}>Simple, expert-backed ideas for everyday moments.</Text>
        {(data?.tips ?? []).map((tip) => (
          <View key={tip.id} style={styles.tip}>
            <View style={styles.tipArt}>
              <SvgIcon name="tip" width={44} height={44} />
            </View>
            <View style={styles.tipBody}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.body}</Text>
              <View style={styles.read}>
                <Text style={styles.readT}>{tip.read_minutes} min read</Text>
              </View>
            </View>
            <SvgIcon name="chevron" width={16} height={16} />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
