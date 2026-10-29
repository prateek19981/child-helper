import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnswerPad } from "../../../../components/molecules/puzzles/AnswerPad";
import { CrossMathBoard } from "../../../../components/organisms/puzzles/CrossMathBoard";
import { EquationBoard } from "../../../../components/organisms/puzzles/EquationBoard";
import { MatrixBoard } from "../../../../components/organisms/puzzles/MatrixBoard";
import { Back, PrimaryButton, Screen } from "../../../../components/ui";
import {
  blankCount,
  checkCrossMathPuzzle,
  checkEquationPuzzle,
  checkPuzzleAnswer,
  crossBlankCount,
  formatCrossSolution,
  formatFilledEquation,
  generateCrossMathPuzzle,
  getCompletedPuzzleIds,
  getLevelsByDifficulty,
  getPuzzleLevel,
  isLevelUnlockedInList,
  markPuzzleCompleted,
  parseDifficulty,
  type CrossMathGrid,
} from "../../../../lib/puzzles";
import { useTheme } from "../../../../lib/theme";
import { createPuzzlePlayStyles } from "../../../../styles/puzzles/playStyles";

type Status = "playing" | "wrong" | "correct" | "timed_out";

function formatTimer(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TimerPuzzlePlayScreen() {
  const { difficulty: rawDiff, id: rawId } = useLocalSearchParams<{
    difficulty: string;
    id: string;
  }>();
  const difficulty = parseDifficulty(rawDiff);
  const levelId = Number(rawId);
  const level = getPuzzleLevel(levelId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createPuzzlePlayStyles(theme, insets), [theme, insets]);

  const levels = useMemo(
    () => (difficulty ? getLevelsByDifficulty(difficulty) : []),
    [difficulty]
  );

  const templateCross = level?.data.crossMath;
  const equation = level?.data.equation;
  const isCross = Boolean(templateCross);
  const isEquation = Boolean(equation?.length) && !isCross;
  const timeLimit = level?.timeLimitSec ?? 60;

  const [liveCross, setLiveCross] = useState<CrossMathGrid | null>(null);
  const [blanks, setBlanks] = useState<string[]>(["", ""]);
  const [activeBlank, setActiveBlank] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [allowed, setAllowed] = useState(false);
  const [solvedLine, setSolvedLine] = useState("");
  const [remainingSec, setRemainingSec] = useState(timeLimit);
  const deadlineRef = useRef<number | null>(null);

  const crossMath = liveCross ?? templateCross ?? null;
  const blanksNeeded = crossMath
    ? crossBlankCount(crossMath)
    : equation
      ? blankCount(equation)
      : 1;

  function startRound() {
    if (!level) return;
    if (level.data.crossMath) {
      const generated = generateCrossMathPuzzle(level.data.crossMath, level.difficulty);
      setLiveCross(generated.grid);
      setBlanks(Array(crossBlankCount(generated.grid)).fill(""));
    } else {
      setLiveCross(null);
      const n = level.data.equation ? blankCount(level.data.equation) : 1;
      setBlanks(Array(n).fill(""));
    }
    setActiveBlank(0);
    setStatus("playing");
    setSolvedLine("");
    setRemainingSec(level.timeLimitSec);
    deadlineRef.current = Date.now() + level.timeLimitSec * 1000;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!difficulty || !level || level.difficulty !== difficulty) {
        router.replace("/puzzles" as Href);
        return;
      }
      const completed = await getCompletedPuzzleIds(difficulty);
      if (cancelled) return;
      if (!isLevelUnlockedInList(level.id, levels, completed)) {
        router.replace(`/puzzles/timer/${difficulty.toLowerCase()}` as Href);
        return;
      }
      setAllowed(true);
      startRound();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, difficulty, router, timeLimit]);

  useEffect(() => {
    if (!allowed || status === "correct" || status === "timed_out" || !deadlineRef.current) {
      return;
    }
    const tick = () => {
      const deadline = deadlineRef.current;
      if (!deadline) return;
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) {
        setRemainingSec(0);
        setStatus("timed_out");
        return;
      }
      setRemainingSec(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [allowed, status, levelId]);

  if (!level || !difficulty || !allowed) {
    return <Screen>{null}</Screen>;
  }

  const matrixGrid = level.data.grid ?? [];
  const levelIdx = levels.findIndex((l) => l.id === level.id);
  const nextLevel = levelIdx >= 0 ? levels[levelIdx + 1] : undefined;
  const allBlanksFilled = blanks.every((b) => b.trim().length > 0);
  const multiBlank = blanksNeeded > 1;
  const timerLabel = formatTimer(remainingSec);
  const timerUrgent = remainingSec <= 10;
  const usedSec = Math.max(0, timeLimit - remainingSec);
  const listHref = `/puzzles/timer/${difficulty.toLowerCase()}` as Href;

  async function onSubmit() {
    if (status === "correct" || status === "timed_out") return;
    let ok = false;
    if (isCross && crossMath) {
      ok = checkCrossMathPuzzle(crossMath, blanks);
      if (ok) setSolvedLine(formatCrossSolution(crossMath, blanks));
    } else if (isEquation && equation) {
      ok = checkEquationPuzzle(equation, blanks);
      if (ok) setSolvedLine(formatFilledEquation(equation, blanks));
    } else {
      ok = checkPuzzleAnswer(blanks[0] ?? "", level!.answer);
      if (ok) setSolvedLine(level!.answer);
    }
    if (ok) {
      setStatus("correct");
      await markPuzzleCompleted(level!.id, difficulty!);
    } else {
      setStatus("wrong");
    }
  }

  function onChangeActive(next: string) {
    if (status === "timed_out") return;
    setBlanks((prev) => {
      const copy = [...prev];
      copy[activeBlank] = next;
      return copy;
    });
    if (status === "wrong") setStatus("playing");
  }

  const defaultPrompt = isCross
    ? "Fill both ? so every row and column is true"
    : isEquation
      ? "Fill the boxes to make the equation true"
      : "What replaces the ?";

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Back onPress={() => router.back()} />
          <View style={styles.topMeta}>
            <Text style={styles.levelLabel}>
              Level {level.id} · {level.difficulty}
            </Text>
            <Text
              style={[styles.timer, timerUrgent && styles.timerUrgent]}
              accessibilityLabel={`${timerLabel} remaining`}
            >
              {timerLabel}
            </Text>
          </View>
        </View>

        {status === "correct" ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <Text style={styles.prompt}>{level.questionText ?? defaultPrompt}</Text>
            <View style={styles.winCard}>
              <Text style={styles.winTitle}>Nice work!</Text>
              <Text style={styles.winBody}>{solvedLine || level.answer}</Text>
              <Text style={styles.winTime}>
                Solved with {timerLabel} left · {formatTimer(usedSec)} used
              </Text>
            </View>
            <View style={styles.actions}>
              {nextLevel ? (
                <PrimaryButton
                  tone="accent"
                  label={`Next: Level ${nextLevel.id}`}
                  onPress={() =>
                    router.replace(
                      `/puzzles/timer/${difficulty.toLowerCase()}/${nextLevel.id}` as Href
                    )
                  }
                />
              ) : null}
              <PrimaryButton label="Back to levels" onPress={() => router.replace(listHref)} />
            </View>
          </ScrollView>
        ) : status === "timed_out" ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <Text style={styles.prompt}>{level.questionText ?? defaultPrompt}</Text>
            <View style={styles.loseCard}>
              <Text style={styles.winTitle}>Time's up</Text>
              <Text style={styles.winBody}>
                You had {formatTimer(timeLimit)} for this level. Try again a bit faster.
              </Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton tone="accent" label="Try again" onPress={startRound} />
              <PrimaryButton label="Back to levels" onPress={() => router.replace(listHref)} />
            </View>
          </ScrollView>
        ) : (
          <View style={styles.playBody}>
            <ScrollView
              style={styles.playScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
              keyboardShouldPersistTaps="handled"
              bounces
            >
              <Text style={styles.prompt}>{level.questionText ?? defaultPrompt}</Text>
              <View style={styles.boardWrap}>
                {isCross && crossMath ? (
                  <CrossMathBoard
                    grid={crossMath}
                    blanks={blanks}
                    activeBlank={activeBlank}
                    onSelectBlank={setActiveBlank}
                  />
                ) : isEquation && equation ? (
                  <EquationBoard
                    equation={equation}
                    blanks={blanks}
                    activeBlank={activeBlank}
                    onSelectBlank={setActiveBlank}
                  />
                ) : (
                  <MatrixBoard grid={matrixGrid} />
                )}
              </View>
              <Text style={[styles.feedback, status === "wrong" && styles.feedbackWrong]}>
                {status === "wrong"
                  ? "Not quite — check every row and column!"
                  : allBlanksFilled
                    ? "Both filled — tap Check answer"
                    : `Fill both dim tiles (${blanks.filter((b) => b.trim()).length}/${blanksNeeded})`}
              </Text>
            </ScrollView>

            <View style={styles.padDock}>
              <AnswerPad
                compact
                value={blanks[activeBlank] ?? ""}
                onChange={onChangeActive}
                onSubmit={() => void onSubmit()}
                label={
                  multiBlank
                    ? `Tile ${activeBlank + 1} of ${blanksNeeded}${blanks[activeBlank] ? ` · ${blanks[activeBlank]}` : ""}`
                    : blanks[activeBlank]
                      ? `Answer · ${blanks[activeBlank]}`
                      : undefined
                }
                submitDisabled={!allBlanksFilled}
              />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
