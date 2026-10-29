import { requestRecordingPermissionsAsync } from "expo-audio";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KickLottie } from "../../../components/organisms";
import { Screen } from "../../../components/ui";
import { apiJson } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { setTalkPrep } from "../../../lib/talkPrep";
import { useTheme } from "../../../lib/theme";
import { createLessonLoadingStyles } from "../../../styles/lesson/loadingStyles";

const MIN_VISIBLE_MS = 1_400;
const DEFAULT_PROMPT = "Hi friend! How are you today?";
const DEFAULT_RETRY = "I didn't quite catch that. Can you say it again?";

type TalkScript = {
  lesson_id: string;
  title: string;
  questions: { id: string; prompt: string; retry: string }[];
};

export default function LessonLoading() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createLessonLoadingStyles(theme, insets), [theme, insets]);
  const { child } = useAuth();
  const [status, setStatus] = useState("Kick is getting ready…");
  const [failed, setFailed] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!id || !child) return;
    let cancelled = false;

    (async () => {
      try {
        setStatus("Warming up the mic…");
        await requestRecordingPermissionsAsync().catch(() => null);

        setStatus("Loading your lesson…");
        const [talk, conv] = await Promise.all([
          apiJson<TalkScript>(`/lessons/${id}/talk-script`),
          apiJson<{ id: string }>("/conversations", {
            method: "POST",
            data: { child_id: child.id, title: "Talk with Kick", context: `lesson:${id}` },
          }),
        ]);
        if (cancelled) return;

        const opener = talk.questions[0];
        setTalkPrep({
          lessonId: id,
          conversationId: conv.id,
          prompt: opener?.prompt ?? DEFAULT_PROMPT,
          retry: opener?.retry ?? DEFAULT_RETRY,
        });

        const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;

        router.replace(`/lesson/talk/${id}` as Href);
      } catch {
        if (cancelled) return;
        setFailed(true);
        setStatus("Couldn’t start the lesson. Going back…");
        setTimeout(() => {
          if (!cancelled) router.back();
        }, 1_200);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, child, router]);

  return (
    <Screen>
      <View style={styles.wrap}>
        <KickLottie autoPlay loop={!failed} style={styles.logo} />
        <Text style={styles.title}>{failed ? "Oops" : "Almost there"}</Text>
        <Text style={styles.subtitle}>{status}</Text>
      </View>
    </Screen>
  );
}
