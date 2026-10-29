import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Back, Screen, Title } from "../../components/ui";
import {
  getKickMatchWins,
  KICK_CONFIG,
  KICK_DIFFICULTIES,
  TIMER_MODE_LIMITS,
  type PuzzleDifficulty,
} from "../../lib/puzzles";
import { useTheme } from "../../lib/theme";
import { createPuzzleListStyles } from "../../styles/puzzles/listStyles";

type Mode = "timer" | "kick";

export default function PuzzleHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createPuzzleListStyles(theme, insets), [theme, insets]);
  const [mode, setMode] = useState<Mode>("timer");
  const [kickWins, setKickWins] = useState<Record<PuzzleDifficulty, number>>({
    EASY: 0,
    MEDIUM: 0,
    HARD: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void Promise.all(KICK_DIFFICULTIES.map((d) => getKickMatchWins(d))).then((wins) => {
        setKickWins({
          EASY: wins[0] ?? 0,
          MEDIUM: wins[1] ?? 0,
          HARD: wins[2] ?? 0,
        });
      });
    }, [])
  );

  function openDifficulty(difficulty: PuzzleDifficulty) {
    const path =
      mode === "timer"
        ? `/puzzles/timer/${difficulty.toLowerCase()}`
        : `/puzzles/kick/${difficulty.toLowerCase()}`;
    router.push(path as Href);
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Back onPress={() => router.back()} />
        </View>
        <View style={styles.header}>
          <Title>Math Puzzles</Title>
          <Text style={styles.subtitle}>Pick a mode, then a difficulty.</Text>
        </View>

        <View style={styles.tabs}>
          {(
            [
              { id: "timer" as const, label: "Vs Timer" },
              { id: "kick" as const, label: "Vs Kick" },
            ] as const
          ).map((tab) => {
            const active = mode === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setMode(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.modeBlurb}>
          {mode === "timer"
            ? "Solo race against the clock. Clear levels to unlock the next."
            : "One race vs Kick. Same puzzle — solve faster to win."}
        </Text>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {KICK_DIFFICULTIES.map((difficulty) => {
            const kickCfg = KICK_CONFIG[difficulty];
            const meta =
              mode === "timer"
                ? `Up to ~${TIMER_MODE_LIMITS[difficulty]}s per puzzle`
                : `${kickCfg.roundTimeLimitSec}s limit · Kick aims ${kickCfg.kickSolveMinSec}–${kickCfg.kickSolveMaxSec}s`;
            return (
              <TouchableOpacity
                key={difficulty}
                style={styles.diffCard}
                activeOpacity={0.85}
                onPress={() => openDifficulty(difficulty)}
                accessibilityRole="button"
                accessibilityLabel={`${difficulty} ${mode === "timer" ? "vs timer" : "vs Kick"}`}
              >
                <Text style={styles.diffTitle}>{difficulty}</Text>
                <Text style={styles.diffMeta}>{meta}</Text>
                {mode === "kick" && kickWins[difficulty] > 0 ? (
                  <Text style={styles.diffWins}>
                    Matches won: {kickWins[difficulty]}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}
