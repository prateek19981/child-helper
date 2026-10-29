import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KickLottie, Mascot, type MascotMood } from "../../../components/organisms";
import { Back, ConfirmDialog, PrimaryButton, Screen } from "../../../components/ui";
import { apiJson, getApiBaseUrl } from "../../../lib/api";
import { mouthAt, mouthTrackFromWav, type MouthPose, CLOSED_MOUTH } from "../../../lib/lipsync";
import { useAuth } from "../../../lib/auth";
import { peekTalkPrep } from "../../../lib/talkPrep";
import { useTheme } from "../../../lib/theme";
import { createTalkStyles } from "../../../styles/lesson/talkIdStyles";

type Question = { id: string; prompt: string; retry: string };
type TalkScript = { lesson_id: string; title: string; questions: Question[] };
type ChildReply = {
  id: string;
  transcription: string;
  accepted: boolean;
  action: "advance" | "retry";
  next_prompt?: string;
  done?: boolean;
  streak_days?: number;
  stars_earned?: number;
};
type TtsResponse = {
  provider: string;
  voice: string;
  url: string;
  sample_rate?: number;
};

type Phase = "loading" | "speaking" | "listening" | "retry" | "success" | "done";

/** Metering is dBFS (−160 silence → 0 max). Often stuck on emulators. */
const SPEECH_METERING_THRESHOLD = -10;
const METERING_ALIVE_THRESHOLD = -159;
const METERING_POLL_MS = 120;
/** After the child stops speaking, wait this long before ending the turn. */
const SILENCE_TO_END_MS = 1_200;
/** Hard cap so recording cannot run forever. */
const MAX_LISTEN_MS = 10_0000;
const MIN_RECORDED_AUDIO_BYTES = 8_000;
const DEFAULT_RETRY = "I didn't quite catch that. Can you say it again?";

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

  // Hydrate synchronously so the first paint isn't an empty "loading" flash.
  const [boot] = useState(() => (typeof id === "string" ? peekTalkPrep(id) : null));
  const [conversationId, setConversationId] = useState<string | null>(boot?.conversationId ?? null);
  const [promptText, setPromptText] = useState(boot?.prompt ?? "");
  const [retryFallback, setRetryFallback] = useState(boot?.retry ?? DEFAULT_RETRY);
  const [phase, setPhase] = useState<Phase>(boot ? "speaking" : "loading");
  const [busy, setBusy] = useState(false);
  const [isWrapUp, setIsWrapUp] = useState(false);
  const [mouth, setMouth] = useState<MouthPose>(CLOSED_MOUTH);
  const [starsEarned, setStarsEarned] = useState(5);
  const [streakDays, setStreakDays] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Cover talk with the loading Lottie until Kick's 3D model is drawn. */
  const [bridgeVisible, setBridgeVisible] = useState(Boolean(boot));
  const streakRecorded = useRef(false);

  useEffect(() => {
    if (!bridgeVisible) return;
    const t = setTimeout(() => setBridgeVisible(false), 4_000);
    return () => clearTimeout(t);
  }, [bridgeVisible]);

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const listenStartedAt = useRef<number>(0);
  const peakMetering = useRef<number>(-160);
  const meteringLive = useRef(false);
  const finishing = useRef(false);
  const cancelled = useRef(false);
  /** Avoid duplicate mascot rows when the speaking effect re-runs. */
  const lastSavedMascotKey = useRef<string | null>(null);
  /** Server already persisted this line via child-reply — skip client POST. */
  const mascotPersistedByServer = useRef(false);
  const ttsPlayer = useRef<AudioPlayer | null>(null);
  const mouthTrack = useRef<MouthPose[] | null>(null);

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
    try {
      ttsPlayer.current?.pause();
      ttsPlayer.current?.remove();
    } catch {
      /* ignore */
    }
    ttsPlayer.current = null;
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
    if (boot || conversationId) {
      mascotPersistedByServer.current = false;
      return;
    }
    (async () => {
      try {
        const [talk, conv] = await Promise.all([
          apiJson<TalkScript>(`/lessons/${id}/talk-script`),
          apiJson<{ id: string }>("/conversations", {
            method: "POST",
            data: { child_id: child.id, title: "Talk with Kick", context: `lesson:${id}` },
          }),
        ]);
        if (cancelled.current) return;
        const opener = talk.questions[0];
        setPromptText(opener?.prompt ?? "Hi friend! How are you today?");
        setRetryFallback(opener?.retry ?? DEFAULT_RETRY);
        mascotPersistedByServer.current = false;
        setIsWrapUp(false);
        setConversationId(conv.id);
        setPhase("speaking");
      } catch (e) {
        Alert.alert("Could not start", e instanceof Error ? e.message : "Try again");
        router.back();
      }
    })();
  }, [id, child, router, boot, conversationId]);

  useEffect(() => {
    if (phase !== "speaking" || !promptText || !conversationId || bridgeVisible) return;
    let cancelledSpeak = false;
    stopSpeech();

    const mascotKey = `${conversationId}:${promptText}`;
    const skipSave = mascotPersistedByServer.current;

    const afterSpeak = () => {
      if (cancelled.current || cancelledSpeak) return;
      if (isWrapUp) {
        setIsWrapUp(false);
        setPhase("done");
        return;
      }
      setPhase("listening");
    };

    const speakWithKokoro = async () => {
      const tts = await apiJson<TtsResponse>("/tts", {
        method: "POST",
        data: { text: promptText },
        timeout: 60_000,
      });
      if (cancelledSpeak || cancelled.current) return;
      if (!tts.url) throw new Error("TTS returned no audio URL");

      const remote = `${getApiBaseUrl()}${tts.url}`;
      const dest = new File(Paths.cache, `kokoro_${Date.now()}.wav`);
      const local = await File.downloadFileAsync(remote, dest, { idempotent: true });
      if (cancelledSpeak || cancelled.current) return;

      try {
        mouthTrack.current = mouthTrackFromWav(await new File(local.uri).arrayBuffer());
      } catch {
        mouthTrack.current = null;
      }
      const player = createAudioPlayer({ uri: local.uri }, { updateInterval: 100 });
      ttsPlayer.current = player;
      let finished = false;
      let started = false;
      const finishOnce = () => {
        if (finished || cancelledSpeak || cancelled.current) return;
        finished = true;
        sub.remove();
        afterSpeak();
      };
      const sub = player.addListener("playbackStatusUpdate", (status) => {
        if (cancelledSpeak || cancelled.current) return;
        if (status.playing || status.currentTime > 0) started = true;
        if (mouthTrack.current) setMouth(mouthAt(mouthTrack.current, status.currentTime));
        if (status.didJustFinish) {
          finishOnce();
          return;
        }
        if (
          started &&
          status.isLoaded &&
          !status.playing &&
          status.duration > 0 &&
          status.currentTime >= status.duration - 0.15
        ) {
          finishOnce();
        }
      });
      player.play();
      setTimeout(() => {
        if (finished || cancelledSpeak || cancelled.current) return;
        if (!started) {
          sub.remove();
          Alert.alert("TTS", "Could not play Kokoro audio");
          afterSpeak();
        }
      }, 12_000);
    };

    (async () => {
      if (!skipSave && lastSavedMascotKey.current !== mascotKey) {
        try {
          await apiJson(`/conversations/${conversationId}/messages`, {
            method: "POST",
            data: { sender_type: "mascot", text_content: promptText },
          });
          lastSavedMascotKey.current = mascotKey;
        } catch {
          /* still speak even if logging fails */
        }
      } else if (skipSave) {
        lastSavedMascotKey.current = mascotKey;
      }
      if (cancelledSpeak || cancelled.current) return;

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

      try {
        await speakWithKokoro();
      } catch (e) {
        if (cancelledSpeak || cancelled.current) return;
        Alert.alert("TTS", e instanceof Error ? e.message : "Kokoro TTS failed");
        afterSpeak();
      }
    })();

    return () => {
      cancelledSpeak = true;
      stopSpeech();
    };
  }, [phase, promptText, stopSpeech, conversationId, isWrapUp, bridgeVisible]);

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
            if (status.metering > METERING_ALIVE_THRESHOLD) meteringLive.current = true;
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
            const next = (result.next_prompt || "").trim();
            if (result.done) {
              setStarsEarned(result.stars_earned ?? 5);
              if (typeof result.streak_days === "number") setStreakDays(result.streak_days);
              if ((result.stars_earned ?? 0) > 0 || (result.streak_days ?? 0) > 0) {
                streakRecorded.current = true;
              }
              if (next) {
                mascotPersistedByServer.current = true;
                setIsWrapUp(true);
                setPromptText(next);
                setPhase("speaking");
              } else {
                setPhase("done");
              }
              return;
            }
            if (!next) {
              setStarsEarned(result.stars_earned ?? 5);
              if (typeof result.streak_days === "number") setStreakDays(result.streak_days);
              if ((result.stars_earned ?? 0) > 0 || (result.streak_days ?? 0) > 0) {
                streakRecorded.current = true;
              }
              setPhase("done");
              return;
            }
            mascotPersistedByServer.current = true;
            setIsWrapUp(false);
            setPromptText(next);
            setPhase("speaking");
          }, 900);
        } else {
          setPhase("retry");
          setTimeout(() => {
            if (cancelled.current) return;
            mascotPersistedByServer.current = false;
            setIsWrapUp(false);
            setPromptText((result.next_prompt || retryFallback).trim() || DEFAULT_RETRY);
            setPhase("speaking");
          }, 700);
        }
      } catch (e) {
        Alert.alert("Hmm", e instanceof Error ? e.message : "Could not hear you");
        mascotPersistedByServer.current = false;
        setIsWrapUp(false);
        setPromptText(retryFallback);
        setPhase("speaking");
      } finally {
        setBusy(false);
        finishing.current = false;
      }
    },
    [phase, conversationId, recorder, retryFallback]
  );

  useEffect(() => {
    if (phase !== "listening") return;
    let meterTimer: ReturnType<typeof setInterval> | undefined;
    peakMetering.current = -160;
    meteringLive.current = false;
    finishing.current = false;

    let hasSpoken = false;
    let silenceMs = 0;

    const stopMetering = () => {
      if (meterTimer) {
        clearInterval(meterTimer);
        meterTimer = undefined;
      }
    };

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
          if (finishing.current) return;
          try {
            const status = recorder.getStatus();
            if (!status.isRecording || typeof status.metering !== "number") return;

            const metering = status.metering;
            peakMetering.current = Math.max(peakMetering.current, metering);
            if (metering > METERING_ALIVE_THRESHOLD) meteringLive.current = true;

            const elapsed = Date.now() - listenStartedAt.current;

            if (meteringLive.current) {
              if (metering >= SPEECH_METERING_THRESHOLD) {
                hasSpoken = true;
                silenceMs = 0;
              } else if (hasSpoken) {
                silenceMs += METERING_POLL_MS;
              }

              if (hasSpoken && silenceMs >= SILENCE_TO_END_MS) {
                stopMetering();
                void finishListening();
                return;
              }
            }

            if (elapsed >= MAX_LISTEN_MS) {
              stopMetering();
              void finishListening();
            }
          } catch {
            /* recording stopped */
          }
        }, METERING_POLL_MS);
      } catch {
        /* mic unavailable — user can still tap I'm done speaking */
      }
    })();

    return () => {
      stopMetering();
    };
  }, [phase, cleanupRecording, finishListening, recorder]);

  const leaveTalk = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    stopSpeech();
    await cleanupRecording();
    try {
      if (conversationId && !streakRecorded.current) {
        const end = await apiJson<{ streak_days: number; stars_earned: number }>(
          `/conversations/${conversationId}/end`,
          { method: "POST" }
        );
        streakRecorded.current = true;
        if (typeof end.streak_days === "number") setStreakDays(end.streak_days);
        if (typeof end.stars_earned === "number") setStarsEarned(end.stars_earned);
      }
    } catch {
      /* still leave even if streak write fails */
    } finally {
      setLeaveOpen(false);
      setLeaving(false);
      router.back();
    }
  }, [leaving, stopSpeech, cleanupRecording, conversationId, router]);

  const onBackPress = useCallback(() => {
    if (phase === "done" || phase === "loading") {
      stopSpeech();
      void cleanupRecording();
      router.back();
      return;
    }
    setLeaveOpen(true);
  }, [phase, stopSpeech, cleanupRecording, router]);

  return (
    <Screen>
      <ConfirmDialog
        visible={leaveOpen}
        title="Leave talk?"
        body="Your speaking streak updates when this talk ends. Leave now or keep practicing with Kick?"
        confirmLabel="Leave talk"
        cancelLabel="Keep talking"
        busy={leaving}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => void leaveTalk()}
      />
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Back onPress={onBackPress} />
        </View>

        <View style={styles.center}>
          {phase === "loading" ? (
            <View style={styles.boot}>
              <KickLottie style={styles.wink} />
              <Text style={styles.rewardHint}>Kick is getting ready…</Text>
            </View>
          ) : phase === "done" ? (
            <View style={styles.reward}>
              <KickLottie style={styles.wink} />
              <Text style={styles.rewardTitle}>You did amazing!</Text>
              {starsEarned > 0 ? (
                <View style={styles.starsEarn}>
                  <Text style={styles.starsEarnText}>+{starsEarned} stars</Text>
                </View>
              ) : null}
              {streakDays > 0 ? (
                <Text style={styles.rewardHint}>{streakDays}-day speaking streak</Text>
              ) : (
                <Text style={styles.rewardHint}>Kick is proud of you</Text>
              )}
            </View>
          ) : (
            <Mascot
              mood={mood}
              mouth={phase === "speaking" ? mouth : CLOSED_MOUTH}
              prompt={promptText}
              onModelReady={() => setBridgeVisible(false)}
              hint={
                phase === "listening"
                  ? "Speak when you're ready — Kick is listening"
                  : phase === "retry"
                    ? "Kick will ask again"
                    : phase === "success"
                      ? "Nice!"
                      : undefined
              }
            />
          )}
        </View>

        {bridgeVisible && phase !== "done" ? (
          <View style={styles.bridge} pointerEvents="none">
            <KickLottie style={styles.wink} />
            <Text style={styles.rewardTitle}>Almost there</Text>
            <Text style={styles.rewardHint}>Kick is getting ready…</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {phase === "listening" ? (
            <PrimaryButton
              tone="accent"
              label={busy ? "Checking…" : "I'm done speaking"}
              onPress={() => void finishListening({ confirmSpoken: true })}
            />
          ) : null}
          {phase === "done" ? (
            <PrimaryButton
              tone="accent"
              label="Play Math Puzzles"
              onPress={() => router.replace("/puzzles" as Href)}
            />
          ) : null}
          {phase === "speaking" && !bridgeVisible ? (
            <PrimaryButton
              label={isWrapUp ? "Continue" : "Skip to listening"}
              onPress={() => {
                if (isWrapUp) {
                  setIsWrapUp(false);
                  setPhase("done");
                  return;
                }
                stopSpeech();
                setPhase("listening");
              }}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
