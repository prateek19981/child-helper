import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Back, Screen, Title } from "../../../../components/ui";
import {
  getCompletedPuzzleIds,
  getLevelsByDifficulty,
  isLevelUnlockedInList,
  parseDifficulty,
} from "../../../../lib/puzzles";
import { useTheme } from "../../../../lib/theme";
import { createPuzzleListStyles } from "../../../../styles/puzzles/listStyles";

export default function TimerDifficultyLevelsScreen() {
  const { difficulty: raw } = useLocalSearchParams<{ difficulty: string }>();
  const difficulty = parseDifficulty(raw);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => createPuzzleListStyles(theme, insets), [theme, insets]);
  const levels = useMemo(
    () => (difficulty ? getLevelsByDifficulty(difficulty) : []),
    [difficulty]
  );
  const [completed, setCompleted] = useState<number[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!difficulty) {
        router.replace("/puzzles" as Href);
        return;
      }
      void getCompletedPuzzleIds(difficulty).then(setCompleted);
    }, [difficulty, router])
  );

  if (!difficulty) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Back onPress={() => router.back()} />
        </View>
        <View style={styles.header}>
          <Title>Vs Timer · {difficulty}</Title>
          <Text style={styles.subtitle}>Clear a level to unlock the next.</Text>
        </View>
        <ScrollView
          contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {levels.map((level) => {
            const unlocked = isLevelUnlockedInList(level.id, levels, completed);
            const cleared = completed.includes(level.id);
            const current = unlocked && !cleared;
            return (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.card,
                  current && styles.cardCurrent,
                  cleared && styles.cardCleared,
                  !unlocked && styles.cardLocked,
                ]}
                disabled={!unlocked}
                activeOpacity={0.85}
                onPress={() =>
                  router.push(
                    `/puzzles/timer/${difficulty.toLowerCase()}/${level.id}` as Href
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Level ${level.id}`}
              >
                <Text style={styles.levelNum}>{level.id}</Text>
                <Text style={styles.badge}>{level.difficulty}</Text>
                <Text style={styles.levelMeta}>
                  {!unlocked ? "Locked" : cleared ? "Cleared" : `${level.timeLimitSec}s`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}
