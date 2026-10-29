import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnswerPad } from "../../../components/molecules/puzzles/AnswerPad";
import { KickLottie } from "../../../components/organisms/KickLottie";
import { CrossMathBoard } from "../../../components/organisms/puzzles/CrossMathBoard";
import { Back, PrimaryButton, Screen } from "../../../components/ui";
import {
  checkCrossMathPuzzle,
  crossBlankCount,
  decideRaceWinner,
  formatSolveTime,
  generateCrossMathPuzzle,
  getLevelsByDifficulty,
  incrementKickMatchWins,
  KICK_CONFIG,
  parseDifficulty,
  randomKickSolveSec,
  type CrossMathGrid,
  type RacePhase,
  type RaceWinner,
} from "../../../lib/puzzles";
import { useTheme } from "../../../lib/theme";
import { createKickMatchStyles } from "../../../styles/puzzles/kickMatchStyles";

function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Single simultaneous race vs Kick.
 * Kick's finish time is rolled at start and runs in parallel — when you Check,
 * we compare immediately to Kick's time (no waiting).
 */
export default function KickMatchScreen() {
  const { difficulty: raw } = useLocalSearchParams<{ difficulty: string }>();
  const difficulty = parseDifficulty(raw);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createKickMatchStyles(theme, insets), [theme, insets]);

  const template = useMemo(() => {
    if (!difficulty) return null;
    const levels = getLevelsByDifficulty(difficulty);
    return levels.find((l) => l.data.crossMath)?.data.crossMath ?? levels[0]?.data.crossMath ?? null;
  }, [difficulty]);

  const config = difficulty ? KICK_CONFIG[difficulty] : null;

  const [phase, setPhase] = useState<RacePhase>("playing");
  const [winner, setWinner] = useState<RaceWinner | null>(null);
  const [liveCross, setLiveCross] = useState<CrossMathGrid | null>(null);
  const [blanks, setBlanks] = useState<string[]>(["", ""]);
  const [activeBlank, setActiveBlank] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [kickSolved, setKickSolved] = useState(false);
  const [timesLabel, setTimesLabel] = useState("");
  const [kickElapsedSec, setKickElapsedSec] = useState(0);

  const raceStartRef = useRef(0);
  const deadlineRef = useRef<number | null>(null);
  const kickAtRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  function startRace() {
    if (!difficulty || !template || !config) return;
    const generated = generateCrossMathPuzzle(template, difficulty);
    const now = Date.now();
    const kickDelaySec = randomKickSolveSec(difficulty);

    setLiveCross(generated.grid);
    setBlanks(Array(crossBlankCount(generated.grid)).fill(""));
    setActiveBlank(0);
    setWrong(false);
    setKickSolved(false);
    setWinner(null);
    setTimesLabel("");
    setKickElapsedSec(0);
    setRemainingSec(config.roundTimeLimitSec);
    setPhase("playing");
    settledRef.current = false;
    raceStartRef.current = now;
    deadlineRef.current = now + config.roundTimeLimitSec * 1000;
    kickAtRef.current = now + kickDelaySec * 1000;
  }

  useEffect(() => {
    if (!difficulty || !template) {
      router.replace("/puzzles" as Href);
      return;
    }
    startRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  async function settle(
    result: RaceWinner,
    userMs: number | null,
    kickMs: number
  ) {
    if (settledRef.current) return;
    settledRef.current = true;
    const start = raceStartRef.current;
    const youLabel = userMs != null ? formatSolveTime(userMs - start) : "—";
    const kickLabel = formatSolveTime(kickMs - start);
    setTimesLabel(`You ${youLabel} · Kick ${kickLabel}`);
    setWinner(result);
    setKickSolved(true);
    setPhase("result");
    if (result === "you" && difficulty) {
      await incrementKickMatchWins(difficulty);
    }
  }

  // Parallel clocks: round timer + Kick's predetermined finish
  useEffect(() => {
    if (phase !== "playing" || !deadlineRef.current || !kickAtRef.current) return;

    const tick = () => {
      if (settledRef.current) return;
      const now = Date.now();
      const deadline = deadlineRef.current!;
      const kickAt = kickAtRef.current!;

      setKickElapsedSec(Math.floor((now - raceStartRef.current) / 1000));

      if (now >= kickAt) {
        setKickSolved(true);
        // Kick finished first — race over
        void settle("kick", null, kickAt);
        return;
      }

      const left = Math.ceil((deadline - now) / 1000);
      if (left <= 0) {
        setRemainingSec(0);
        void settle("kick", null, kickAt);
        return;
      }
      setRemainingSec(left);
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function onSubmit() {
    if (phase !== "playing" || !liveCross || settledRef.current) return;
    const ok = checkCrossMathPuzzle(liveCross, blanks);
    if (!ok) {
      setWrong(true);
      return;
    }
    const now = Date.now();
    const kickAt = kickAtRef.current!;
    // Simultaneous: Kick's time is already known — compare immediately
    const result = decideRaceWinner({
      userSolvedAtMs: now,
      kickSolvedAtMs: kickAt,
      timedOut: false,
    });
    void settle(result, now, kickAt);
  }

  function onChangeActive(next: string) {
    if (phase !== "playing") return;
    setBlanks((prev) => {
      const copy = [...prev];
      copy[activeBlank] = next;
      return copy;
    });
    if (wrong) setWrong(false);
  }

  if (!difficulty || !config || !template) {
    return <Screen>{null}</Screen>;
  }

  const crossMath = liveCross;
  const blanksNeeded = crossMath ? crossBlankCount(crossMath) : 2;
  const allBlanksFilled = blanks.every((b) => b.trim().length > 0);
  const timerLabel = formatTimer(remainingSec);
  const timerUrgent = remainingSec <= 10;
  const hubHref = "/puzzles" as Href;

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Back onPress={() => router.replace(hubHref)} />
          <View style={styles.topMeta}>
            <Text style={styles.roundLabel}>Vs Kick · {difficulty}</Text>
            {phase === "playing" ? (
              <Text
                style={[styles.timer, timerUrgent && styles.timerUrgent]}
                accessibilityLabel={`${timerLabel} remaining`}
              >
                {timerLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {phase === "playing" && crossMath ? (
          <View style={styles.playBody}>
            <View style={styles.kickRow}>
              <KickLottie style={styles.kickLottie} />
              <Text style={[styles.kickStatus, kickSolved && styles.kickSolved]}>
                {kickSolved
                  ? "Kick solved!"
                  : `Kick is solving… (${Math.floor(kickElapsedSec)}s)`}
              </Text>
            </View>
            <ScrollView
              style={styles.playScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.prompt}>
                Same puzzle — solve faster than Kick to win
              </Text>
              <View style={styles.boardWrap}>
                <CrossMathBoard
                  grid={crossMath}
                  blanks={blanks}
                  activeBlank={activeBlank}
                  onSelectBlank={setActiveBlank}
                />
              </View>
              <Text style={[styles.feedback, wrong && styles.feedbackWrong]}>
                {wrong
                  ? "Not quite — keep going!"
                  : allBlanksFilled
                    ? "Tap Check answer"
                    : `Fill both dim tiles (${blanks.filter((b) => b.trim()).length}/${blanksNeeded})`}
              </Text>
            </ScrollView>
            <View style={styles.padDock}>
              <AnswerPad
                compact
                value={blanks[activeBlank] ?? ""}
                onChange={onChangeActive}
                onSubmit={onSubmit}
                label={`Tile ${activeBlank + 1} of ${blanksNeeded}${blanks[activeBlank] ? ` · ${blanks[activeBlank]}` : ""}`}
                submitDisabled={!allBlanksFilled}
              />
            </View>
          </View>
        ) : null}

        {phase === "result" ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View
              style={[
                styles.resultCard,
                winner === "you" ? styles.resultWin : styles.resultLose,
              ]}
            >
              <Text style={styles.resultTitle}>
                {winner === "you" ? "You beat Kick!" : "Kick wins"}
              </Text>
              <Text style={styles.resultBody}>{timesLabel}</Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton tone="accent" label="Rematch" onPress={startRace} />
              <PrimaryButton label="Back to modes" onPress={() => router.replace(hubHref)} />
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Screen>
  );
}
