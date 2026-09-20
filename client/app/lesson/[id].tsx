import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Back, Body, PrimaryButton, Screen, Title } from "../../components/ui";
import { apiJson } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { createLessonStyles } from "./_idStyles";

type Lesson = {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  words: { id: string; word: string }[];
};

export default function LessonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createLessonStyles(theme, insets), [theme, insets]);
  const [lesson, setLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    if (!id) return;
    apiJson<Lesson>(`/lessons/${id}`).then(setLesson).catch(() => setLesson(null));
  }, [id]);

  return (
    <Screen>
      <View style={styles.wrap}>
        <Back onPress={() => router.back()} />
        <View style={styles.body}>
          <Title>{lesson?.title ?? "Lesson"}</Title>
          <Body>
            {lesson?.description ??
              "Koober will ask a few friendly questions. Speak your answers out loud!"}
          </Body>
          {(lesson?.words ?? []).map((w) => (
            <Text key={w.id} style={styles.word}>
              {w.word}
            </Text>
          ))}
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            tone="accent"
            label="Talk with Koober"
            onPress={() => {
              if (!id) return;
              router.push(`/lesson/talk/${id}` as Href);
            }}
          />
          <PrimaryButton label="Back to home" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
