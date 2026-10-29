import { Text, TouchableOpacity, View } from "react-native";
import type { EquationPart } from "../../../lib/puzzles/types";
import { useThemedStyles } from "../../../lib/theme";
import { createEquationBoardStyles } from "../../../styles/puzzles/equationBoardStyles";

type Props = {
  equation: EquationPart[];
  /** Filled values for each "?" left→right */
  blanks: string[];
  /** Which blank is selected for typing (0-based among blanks) */
  activeBlank: number;
  onSelectBlank: (blankIndex: number) => void;
};

function isOp(part: EquationPart): part is "+" | "-" | "×" | "÷" {
  return part === "+" || part === "-" || part === "×" || part === "÷";
}

export function EquationBoard({ equation, blanks, activeBlank, onSelectBlank }: Props) {
  const styles = useThemedStyles(createEquationBoardStyles);
  let blankIdx = -1;

  return (
    <View style={styles.row} accessibilityLabel="Equation puzzle">
      {equation.map((part, i) => {
        if (part === "=") {
          return (
            <Text key={`eq-${i}`} style={styles.eq}>
              =
            </Text>
          );
        }
        if (isOp(part)) {
          return (
            <View key={`op-${i}`} style={styles.op}>
              <Text style={styles.opText}>{part}</Text>
            </View>
          );
        }
        if (part === "?") {
          blankIdx += 1;
          const idx = blankIdx;
          const filled = blanks[idx] ?? "";
          const active = idx === activeBlank;
          return (
            <TouchableOpacity
              key={`blank-${i}`}
              style={[styles.num, styles.numBlank, active && styles.numBlankActive]}
              onPress={() => onSelectBlank(idx)}
              accessibilityRole="button"
              accessibilityLabel={`Blank ${idx + 1}${filled ? `, value ${filled}` : ""}`}
            >
              <Text style={styles.numBlankText}>{filled || "?"}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <View key={`n-${i}`} style={styles.num}>
            <Text style={styles.numText}>{String(part)}</Text>
          </View>
        );
      })}
    </View>
  );
}
