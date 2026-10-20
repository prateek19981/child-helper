import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgIcon } from "../../components/SvgIcon";
import { Screen } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { barHeight, createActivityStyles } from "../../styles/tabs/activityStyles";

type ActivityData = {
  week: {
    words_practiced: number;
    streak_days: number;
    minutes: number;
    accuracy_pct: number;
    days: { label: string; minutes: number }[];
  };
  history: { id: string; title: string; subtitle: string; score_label: string; score: number | null }[];
};

function histIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("space") || t.includes("rocket") || t.includes("star")) return "hist_space" as const;
  if (t.includes("hello") || t.includes("koober")) return "hist_koober" as const;
  return "hist_jungle" as const;
}

export default function Activity() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createActivityStyles(theme, insets), [theme, insets]);
  const router = useRouter();
  const { child } = useAuth();
  const [data, setData] = useState<ActivityData | null>(null);

  useEffect(() => {
    if (!child) return;
    apiJson<ActivityData>(`/children/${child.id}/activity`).then(setData).catch(() => setData(null));
  }, [child]);

  const week = data?.week;
  const max = Math.max(1, ...(week?.days.map((d) => d.minutes) ?? [1]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Your activity</Text>
            <Text style={styles.sub}>Look how your voice is growing!</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push("/profile")}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <SvgIcon name="icon_profile" width={20} height={20} />
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.kicker}>THIS WEEK</Text>
              <Text style={styles.big}>{week?.words_practiced ?? 0} words practiced</Text>
            </View>
            <Text style={styles.emoji}>🎉</Text>
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricN}>{week?.streak_days ?? 0}</Text>
              <Text style={styles.metricL}>day streak 🔥</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricN}>{week?.minutes ?? 0}</Text>
              <Text style={styles.metricL}>minutes ⏱</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricN}>{week?.accuracy_pct ?? 0}%</Text>
              <Text style={styles.metricL}>accuracy ✨</Text>
            </View>
          </View>
          <View style={styles.chart}>
            {(week?.days ?? []).map((d, i) => {
              const lastActive = i === 5;
              const fill =
                d.minutes === 0 ? styles.barEmpty : lastActive ? styles.barAccent : styles.barPrimary;
              return (
                <View key={`${d.label}-${i}`} style={styles.barCol}>
                  <View style={[styles.bar, fill, barHeight(d.minutes, max)]} />
                  <Text style={[styles.barL, lastActive && styles.barLActive]}>{d.label[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <Text style={styles.h2}>Recent activity</Text>
        {(data?.history ?? []).map((item) => {
          const great = item.score_label === "Great!";
          return (
            <View key={item.id} style={styles.hist}>
              <View style={styles.histArt}>
                <SvgIcon name={histIcon(item.title)} width={36} height={36} />
              </View>
              <View style={styles.histBody}>
                <Text style={styles.histTitle}>{item.title}</Text>
                <Text style={styles.histSub}>{item.subtitle}</Text>
              </View>
              <View style={[styles.score, great && styles.scoreGreat]}>
                <Text style={[styles.scoreT, great && styles.scoreTGreat]}>{item.score_label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
