import { Text, View } from "react-native";
import { useThemedStyles } from "../../../lib/theme";
import { createHintSheetStyles } from "../../../styles/puzzles/hintSheetStyles";
import { PrimaryButton } from "../../atoms";

type Hints = {
  clue: string;
  formula: string;
  explanation: string;
};

type Props = {
  hints: Hints;
  /** 0 = none revealed; 1 = clue; 2 = formula; 3 = explanation */
  step: number;
  onRevealNext: () => void;
  disabled?: boolean;
};

const LABELS = ["Need a hint?", "Show formula", "Show full explanation"] as const;

export function HintSheet({ hints, step, onRevealNext, disabled }: Props) {
  const styles = useThemedStyles(createHintSheetStyles);
  const revealed =
    step >= 1
      ? [
          step >= 1 ? { label: "Clue", text: hints.clue } : null,
          step >= 2 ? { label: "Formula", text: hints.formula } : null,
          step >= 3 ? { label: "Explanation", text: hints.explanation } : null,
        ].filter(Boolean)
      : [];

  return (
    <View style={styles.wrap}>
      {revealed.length === 0 ? (
        <Text style={styles.body}>Stuck? Tap below for a gentle hint.</Text>
      ) : (
        revealed.map((item) =>
          item ? (
            <View key={item.label} style={{ gap: 4 }}>
              <Text style={styles.step}>
                Hint {item.label === "Clue" ? 1 : item.label === "Formula" ? 2 : 3} · {item.label}
              </Text>
              <Text style={styles.body}>{item.text}</Text>
            </View>
          ) : null
        )
      )}
      {step < 3 ? (
        <PrimaryButton
          label={LABELS[step] ?? "Next hint"}
          onPress={onRevealNext}
          disabled={disabled}
        />
      ) : (
        <Text style={styles.title}>All hints unlocked</Text>
      )}
    </View>
  );
}
