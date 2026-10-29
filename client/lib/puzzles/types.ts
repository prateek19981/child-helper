export type PuzzleCategory =
  | "GEOMETRIC_SHAPE"
  | "MATRIX_GRID"
  | "SYMBOLIC_EQUATION"
  | "SEQUENCE_PATTERN"
  | "EQUATION"
  | "CROSS_MATH";

export type ShapeType = "TRIANGLE" | "CIRCLE" | "SQUARE";

export type PuzzleDifficulty = "EASY" | "MEDIUM" | "HARD";

export type NodePosition = "top" | "left" | "right" | "center" | "bottom";

export type MathOp = "+" | "-" | "×" | "÷";

export type EquationPart = number | "?" | MathOp | "=";

/**
 * 2×2 crossword of numbers with ops between them (matches simple cross-math UI).
 * Rows L→R and columns T→B must equal their results.
 */
export interface CrossMathGrid {
  /** 2×2 number cells; "?" = blank */
  cells: (number | "?")[][];
  /** One op between the two cells in each row */
  rowOps: MathOp[];
  /** One op between the two cells in each column */
  colOps: MathOp[];
  rowResults: number[]; // length 2
  colResults: number[]; // length 2
}

export interface PuzzleLevel {
  id: number;
  difficulty: PuzzleDifficulty;
  category: PuzzleCategory;
  questionText?: string;
  /** Seconds allowed to solve; decreases on harder levels */
  timeLimitSec: number;
  data: {
    shapeType?: ShapeType;
    nodes?: { id: string; value: string | number; position: NodePosition }[];
    grid?: (string | number)[][];
    equations?: { left: string; right: string | number }[];
    equation?: EquationPart[];
    crossMath?: CrossMathGrid;
  };
  answer: string;
  hints: {
    clue: string;
    formula: string;
    explanation: string;
  };
}
