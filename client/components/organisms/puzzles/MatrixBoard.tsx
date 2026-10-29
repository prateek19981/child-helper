import { Text, View } from "react-native";
import { useThemedStyles } from "../../../lib/theme";
import { createMatrixBoardStyles } from "../../../styles/puzzles/matrixBoardStyles";

type Props = {
  grid: (string | number)[][];
};

function isMissing(value: string | number): boolean {
  return String(value).trim() === "?";
}

export function MatrixBoard({ grid }: Props) {
  const styles = useThemedStyles(createMatrixBoardStyles);

  return (
    <View style={styles.grid} accessibilityLabel="Puzzle grid">
      {grid.map((row, ri) => (
        <View key={`r-${ri}`} style={styles.row}>
          {row.map((cell, ci) => {
            const missing = isMissing(cell);
            return (
              <View
                key={`c-${ri}-${ci}`}
                style={[styles.cell, missing && styles.cellMissing]}
              >
                <Text style={missing ? styles.cellMissingText : styles.cellText}>
                  {String(cell)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
