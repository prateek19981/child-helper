import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mascot, type MascotMood } from "../../../components/organisms";
import { Back, PrimaryButton, Screen } from "../../../components/ui";
import { apiJson } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useTheme } from "../../../lib/theme";
import { createTalkStyles } from "./_idStyles";

type Question = { id: string; prompt: string; retry: string };
type TalkScript = { lesson_id: string; title: string; questions: Question[] };
type ChildReply = { id: string; transcription: string; accepted: boolean; action: "advance" | "retry" };

type Phase = "loading" | "speaking" | "listening" | "retry" | "success" | "done";

/** Metering is dBFS (−160 silence → 0 max). Often stuck on emulators. */
const SPEECH_METERING_THRESHOLD = -55;
const MIN_RECORDED_AUDIO_BYTES = 8_000;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(binary);
}

function decideHeardSpeech(opts: {
  forceSilence?: boolean;
  forcedText?: string;
  confirmSpoken?: boolean;
  peakMetering: number;
  meteringLive: boolean;
  audioByteLength: number;
}): boolean {
  if (opts.forceSilence) return false;
  if (opts.forcedText) return true;
  if (opts.meteringLive) return opts.peakMetering >= SPEECH_METERING_THRESHOLD;
  if (opts.confirmSpoken === true) return true;
  return opts.audioByteLength >= MIN_RECORDED_AUDIO_BYTES;
}

export default function LessonTalk() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createTalkStyles(theme, insets), [theme, insets]);
  const { child } = useAuth();

  const [script, setScript] = useState<TalkScript | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [isRetry, setIsRetry] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const listenStartedAt = useRef<number>(0);
  const peakMetering = useRef<number>(-160);
  const meteringLive = useRef(false);
  const finishing = useRef(false);
  const cancelled = useRef(false);

  const question = script?.questions[index];
  const promptText = question ? (isRetry ? question.retry : question.prompt) : "";

  const mood: MascotMood =
    phase === "speaking"
      ? "speaking"
      : phase === "listening"
        ? "listening"
        : phase === "retry"
          ? "retry"
          : phase === "success" || phase === "done"
            ? "success"
            : "idle";

  const stopSpeech = useCallback(() => {
    Speech.stop();
  }, []);

  const cleanupRecording = useCallback(async () => {
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      /* already stopped */
    }
  }, [recorder]);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      stopSpeech();
      void cleanupRecording();
    };
  }, [stopSpeech, cleanupRecording]);

  useEffect(() => {
    if (!id || !child) return;
    (async () => {
      try {
        const [talk, conv] = await Promise.all([
          apiJson<TalkScript>(`/lessons/${id}/talk-script`),
          apiJson<{ id: string }>("/conversations", {
            method: "POST",
            data: { child_id: child.id, title: "Talk with Koober", context: `lesson:${id}` },
          }),
        ]);
        if (cancelled.current) return;
        setScript(talk);
        setConversationId(conv.id);
        setPhase("speaking");
      } catch (e) {
        Alert.alert("Could not start", e instanceof Error ? e.message : "Try again");
        router.back();
      }
    })();
  }, [id, child, router]);

  useEffect(() => {
    if (phase !== "speaking" || !promptText) return;
    let cancelledSpeak = false;
    stopSpeech();

    (async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "mixWithOthers",
          shouldRouteThroughEarpiece: false,
        });
      } catch {
        /* ignore */
      }
      if (cancelledSpeak || cancelled.current) return;
      Speech.speak(promptText, {
        language: "en-US",
        rate: 0.9,
        pitch: 1.05,
        volume: 1.0,
        onDone: () => {
          if (!cancelled.current) setPhase("listening");
        },
        onStopped: () => {
          if (!cancelled.current) setPhase("listening");
        },
        onError: () => {
          if (!cancelled.current) setPhase("listening");
        },
      });
    })();

    return () => {
      cancelledSpeak = true;
      stopSpeech();
    };
  }, [phase, promptText, stopSpeech, index, isRetry]);

  const finishListening = useCallback(
    async (opts?: { forcedText?: string; forceSilence?: boolean; confirmSpoken?: boolean }) => {
      if (finishing.current || phase !== "listening" || !conversationId) return;
      finishing.current = true;
      setBusy(true);

      const duration = Date.now() - listenStartedAt.current;

      let audio_b64: string | undefined;
      let audioByteLength = 0;
      try {
        try {
          const status = recorder.getStatus();
          if (status.isRecording && typeof status.metering === "number") {
            peakMetering.current = Math.max(peakMetering.current, status.metering);
            if (status.metering > -159) meteringLive.current = true;
          }
        } catch {
          /* ignore */
        }
        if (recorder.isRecording) await recorder.stop();
        const uri = recorder.uri;
        if (uri && !opts?.forcedText && !opts?.forceSilence) {
          const res = await fetch(uri);
          const buf = await res.arrayBuffer();
          audioByteLength = buf.byteLength;
          audio_b64 = toBase64(buf);
        }
      } catch {
        /* ignore */
      }

      const finalHeard = decideHeardSpeech({
        forceSilence: opts?.forceSilence,
        forcedText: opts?.forcedText,
        confirmSpoken: opts?.confirmSpoken,
        peakMetering: peakMetering.current,
        meteringLive: meteringLive.current,
        audioByteLength,
      });

      try {
        const result = await apiJson<ChildReply>(`/conversations/${conversationId}/child-reply`, {
          method: "POST",
          data: {
            audio_b64,
            audio_duration_ms: duration,
            text_content: opts?.forcedText,
            heard_speech: finalHeard,
          },
        });

        if (result.accepted) {
          setPhase("success");
          setTimeout(() => {
            if (cancelled.current) return;
            const next = index + 1;
            if (!script || next >= script.questions.length) {
              setPhase("done");
              return;
            }
            setIndex(next);
            setIsRetry(false);
            setPhase("speaking");
          }, 900);
        } else {
          setPhase("retry");
          setTimeout(() => {
            if (cancelled.current) return;
            setIsRetry(true);
            setPhase("speaking");
          }, 700);
        }
      } catch (e) {
        Alert.alert("Hmm", e instanceof Error ? e.message : "Could not hear you");
        setIsRetry(true);
        setPhase("speaking");
      } finally {
        setBusy(false);
        finishing.current = false;
      }
    },
    [phase, conversationId, index, script, recorder]
  );

  useEffect(() => {
    if (phase !== "listening") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let meterTimer: ReturnType<typeof setInterval> | undefined;
    peakMetering.current = -160;
    meteringLive.current = false;
    finishing.current = false;

    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: "doNotMix",
          shouldRouteThroughEarpiece: false,
          shouldPlayInBackground: false,
        });
        await cleanupRecording();
        await recorder.prepareToRecordAsync();
        recorder.record();
        listenStartedAt.current = Date.now();

        meterTimer = setInterval(() => {
          try {
            const status = recorder.getStatus();
            if (status.isRecording && typeof status.metering === "number") {
              peakMetering.current = Math.max(peakMetering.current, status.metering);
              if (status.metering > -159) meteringLive.current = true;
            }
          } catch {
            /* recording stopped */
          }
        }, 120);

        timer = setTimeout(() => {
          void finishListening();
        }, 5000);
      } catch {
        /* mic unavailable — use simulate / stay silent */
      }
    })();

    return () => {
      if (timer) clearTimeout(timer);
      if (meterTimer) clearInterval(meterTimer);
    };
  }, [phase, cleanupRecording, finishListening, recorder]);

  const progress =
    script && script.questions.length
      ? `Question ${Math.min(index + 1, script.questions.length)} of ${script.questions.length}`
      : "";

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Back
            onPress={() => {
              stopSpeech();
              void cleanupRecording();
              router.back();
            }}
          />
          <Text style={styles.progress}>{progress}</Text>
        </View>

        <View style={styles.center}>
          <Mascot
            mood={mood}
            prompt={phase === "done" ? "You did amazing today!" : promptText}
            hint={
              phase === "listening"
                ? "Speak, then tap I'm done speaking"
                : phase === "retry"
                  ? "Koober will ask again"
                  : phase === "done"
                    ? "Koober is proud of you"
                    : undefined
            }
          />
        </View>

        <View style={styles.actions}>
          {phase === "listening" ? (
            <>
              <PrimaryButton
                tone="accent"
                label={busy ? "Checking…" : "I'm done speaking"}
                onPress={() => void finishListening({ confirmSpoken: true })}
              />
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => void finishListening({ forcedText: "I'm good today" })}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryText}>Simulate a reply (dev)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => void finishListening({ forceSilence: true })}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryText}>Stay silent (ask again)</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {phase === "done" ? (
            <PrimaryButton tone="accent" label="Back to home" onPress={() => router.replace("/(tabs)" as Href)} />
          ) : null}
          {phase === "speaking" ? (
            <PrimaryButton label="Skip to listening" onPress={() => setPhase("listening")} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
