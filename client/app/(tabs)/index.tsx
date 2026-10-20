import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgIcon } from "../../components/SvgIcon";
import { Screen } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { createHomeStyles } from "../../styles/tabs/indexStyles";

type HomeData = {
  greeting: string;
  headline: string;
  streak_days: number;
  stars: number;
  continue_lesson: {
    id: string;
    title: string;
    description: string;
    estimated_minutes: number;
    slug: string;
    index: number;
    total: number;
  } | null;
  games: { id: string; title: string; description: string; slug: string }[];
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createHomeStyles(theme, insets), [theme, insets]);
  const { child } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    if (!child) return;
    apiJson<HomeData>(`/children/${child.id}/home`).then(setData).catch(() => setData(null));
  }, [child]);

  const lesson = data?.continue_lesson;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>{data?.greeting ?? "Good morning!"}</Text>
            <Text style={styles.h1}>{data?.headline ?? "Ready to speak?"}</Text>
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
        <View style={styles.streak}>
          <Text style={styles.streakText}>🔥  {data?.streak_days ?? 0} day speaking streak</Text>
          <View style={styles.starsBadge}>
            <Text style={styles.starsText}>+{data?.stars ?? 0} stars ⭐</Text>
          </View>
        </View>
        <View style={styles.sectionHead}>
          <Text style={styles.h2}>Today's lesson</Text>
          <Text style={styles.muted}>{lesson ? `${lesson.index} of ${lesson.total}` : ""}</Text>
        </View>
        {lesson ? (
          <View style={styles.lesson}>
            <View style={styles.lessonBody}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{lesson.estimated_minutes} MIN · AI LESSON</Text>
              </View>
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              <Text style={styles.lessonDesc}>{lesson.description}</Text>
              <TouchableOpacity
                style={styles.start}
                onPress={() => router.push(`/lesson/talk/${lesson.id}` as Href)}
                activeOpacity={0.85}
              >
                <SvgIcon name="play" width={14} height={14} />
                <Text style={styles.startText}>Start lesson</Text>
              </TouchableOpacity>
            </View>
            <Image
              source={require("../../assets/koober-fox.png")}
              style={styles.fox}
              resizeMode="contain"
            />
          </View>
        ) : null}
        <View style={styles.dots}>
          <View style={styles.dotOn} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <View style={styles.sectionHead}>
          <Text style={styles.h2}>Play & practice</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>
        <View style={styles.row}>
          {(data?.games ?? []).map((g) => (
            <View key={g.id} style={styles.game}>
              <View style={styles.art}>
                <SvgIcon name={g.slug === "sound-space" ? "space" : "jungle"} width={72} height={72} />
              </View>
              <Text style={styles.gameTitle}>{g.title}</Text>
              <Text style={styles.gameDesc}>{g.description}</Text>
              <TouchableOpacity
                style={styles.play}
                onPress={() => router.push(`/lesson/${g.id}` as Href)}
                activeOpacity={0.85}
              >
                <Text style={styles.playText}>Play</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
