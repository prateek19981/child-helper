import { Text, TouchableOpacity, View } from "react-native";
import { crossBlankPositions, fillCrossCells } from "../../../lib/puzzles/crossMath";
import type { CrossMathGrid, MathOp } from "../../../lib/puzzles/types";
import { useThemedStyles } from "../../../lib/theme";
import { createCrossMathBoardStyles } from "../../../styles/puzzles/crossMathBoardStyles";

type Props = {
  grid: CrossMathGrid;
  blanks: string[];
  activeBlank: number;
  onSelectBlank: (blankIndex: number) => void;
};

/**
 * Simple crossword layout (matches reference):
 *   [A] [+] [B] [=] [row]
 *   [÷] [ ] [+] [ ] [ ]
 *   [C] [-] [D] [=] [row]
 *   [=] [ ] [=] [ ] [ ]
 *   [c] [ ] [c] [ ] [ ]
 */
export function CrossMathBoard({ grid, blanks, activeBlank, onSelectBlank }: Props) {
  const styles = useThemedStyles(createCrossMathBoardStyles);
  const filled = fillCrossCells(grid, blanks);
  const positions = crossBlankPositions(grid);

  function blankIndexAt(r: number, c: number): number {
    return positions.findIndex((p) => p.r === r && p.c === c);
  }

  function Tile({
    label,
    blankIndex,
  }: {
    label: string;
    blankIndex?: number;
  }) {
    const isBlank = blankIndex != null && blankIndex >= 0;
    const active = isBlank && blankIndex === activeBlank;
    const body = (
      <View style={[styles.tile, isBlank && styles.tileBlank, active && styles.tileBlankActive]}>
        <Text
          style={
            active ? styles.tileTextOnAccent : isBlank ? styles.tileTextBlank : styles.tileText
          }
        >
          {label}
        </Text>
      </View>
    );
    if (!isBlank) return body;
    return (
      <TouchableOpacity
        onPress={() => onSelectBlank(blankIndex)}
        accessibilityRole="button"
        accessibilityLabel={`Blank ${blankIndex + 1}`}
      >
        {body}
      </TouchableOpacity>
    );
  }

  function Ghost() {
    return <View style={styles.tileGhost} />;
  }

  function Num({ r, c }: { r: number; c: number }) {
    const bi = blankIndexAt(r, c);
    const isBlank = bi >= 0;
    const label = isBlank ? blanks[bi] || "?" : String(filled[r]![c]);
    return <Tile label={label} blankIndex={isBlank ? bi : undefined} />;
  }

  function OpTile({ op }: { op: MathOp | "=" }) {
    return <Tile label={op} />;
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Cross math crossword">
      {/* Row 0 numbers */}
      <View style={styles.row}>
        <Num r={0} c={0} />
        <OpTile op={grid.rowOps[0]!} />
        <Num r={0} c={1} />
        <OpTile op="=" />
        <Tile label={String(grid.rowResults[0])} />
      </View>

      {/* Vertical ops under row 0 */}
      <View style={styles.row}>
        <OpTile op={grid.colOps[0]!} />
        <Ghost />
        <OpTile op={grid.colOps[1]!} />
        <Ghost />
        <Ghost />
      </View>

      {/* Row 1 numbers */}
      <View style={styles.row}>
        <Num r={1} c={0} />
        <OpTile op={grid.rowOps[1]!} />
        <Num r={1} c={1} />
        <OpTile op="=" />
        <Tile label={String(grid.rowResults[1])} />
      </View>

      {/* Equals under columns */}
      <View style={styles.row}>
        <OpTile op="=" />
        <Ghost />
        <OpTile op="=" />
        <Ghost />
        <Ghost />
      </View>

      {/* Column results */}
      <View style={styles.row}>
        <Tile label={String(grid.colResults[0])} />
        <Ghost />
        <Tile label={String(grid.colResults[1])} />
        <Ghost />
        <Ghost />
      </View>
    </View>
  );
}
