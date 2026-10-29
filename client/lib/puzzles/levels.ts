import type { PuzzleLevel } from "./types";

/**
 * 2×2 cross-math crossword — every level has exactly two "?" blanks.
 *   A  op  B  =  row
 *   op     op
 *   C  op  D  =  row
 *   =      =
 *   col   col
 */
export const PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    id: 1,
    difficulty: "EASY",
    category: "CROSS_MATH",
    timeLimitSec: 20,
    questionText: "Fill both ? so every row and column is true",
    data: {
      crossMath: {
        cells: [
          [9, "?"],
          ["?", 1],
        ],
        rowOps: ["+", "+"],
        colOps: ["÷", "÷"],
        rowResults: [12, 4],
        colResults: [3, 3],
      },
    },
    answer: "3,3",
    hints: {
      clue: "Top: 9 + ? = 12. Then left column: 9 ÷ ? = 3.",
      formula: "9 + a = 12 → a = 3; 9 ÷ b = 3 → b = 3",
      explanation: "Top-right 3, bottom-left 3. Bottom: 3 + 1 = 4. Right: 3 ÷ 1 = 3.",
    },
  },
  {
    id: 2,
    difficulty: "EASY",
    category: "CROSS_MATH",
    timeLimitSec: 15,
    questionText: "Make both rows and columns work",
    data: {
      crossMath: {
        cells: [
          [12, "?"],
          ["?", 1],
        ],
        rowOps: ["×", "+"],
        colOps: ["÷", "×"],
        rowResults: [48, 4],
        colResults: [4, 4],
      },
    },
    answer: "4,3",
    hints: {
      clue: "Top: 12 × ? = 48. Left: 12 ÷ ? = 4.",
      formula: "12 × a = 48 → a = 4; 12 ÷ b = 4 → b = 3",
      explanation: "Top-right 4, bottom-left 3. Bottom: 3 + 1 = 4. Right: 4 × 1 = 4.",
    },
  },
  {
    id: 3,
    difficulty: "MEDIUM",
    category: "CROSS_MATH",
    timeLimitSec: 10,
    questionText: "Find both missing numbers",
    data: {
      crossMath: {
        cells: [
          [20, "?"],
          ["?", 2],
        ],
        rowOps: ["-", "×"],
        colOps: ["÷", "+"],
        rowResults: [15, 8],
        colResults: [5, 7],
      },
    },
    answer: "5,4",
    hints: {
      clue: "Top: 20 − ? = 15. Left: 20 ÷ ? = 5.",
      formula: "20 − a = 15 → a = 5; 20 ÷ b = 5 → b = 4",
      explanation: "Top-right 5, bottom-left 4. Bottom: 4 × 2 = 8. Right: 5 + 2 = 7.",
    },
  },
  {
    id: 4,
    difficulty: "MEDIUM",
    category: "CROSS_MATH",
    timeLimitSec: 14,
    questionText: "Fill both ? to satisfy every equation",
    data: {
      crossMath: {
        cells: [
          ["?", 2],
          [4, "?"],
        ],
        rowOps: ["×", "+"],
        colOps: ["÷", "×"],
        rowResults: [16, 6],
        colResults: [2, 4],
      },
    },
    answer: "8,2",
    hints: {
      clue: "Top: ? × 2 = 16. Bottom: 4 + ? = 6.",
      formula: "a × 2 = 16 → a = 8; 4 + b = 6 → b = 2",
      explanation: "Top-left 8, bottom-right 2. Left: 8 ÷ 4 = 2. Right: 2 × 2 = 4.",
    },
  },
  {
    id: 5,
    difficulty: "HARD",
    category: "CROSS_MATH",
    timeLimitSec: 15,
    questionText: "Two blanks — both must fit",
    data: {
      crossMath: {
        cells: [
          [15, "?"],
          ["?", 3],
        ],
        rowOps: ["÷", "×"],
        colOps: ["÷", "+"],
        rowResults: [3, 9],
        colResults: [5, 8],
      },
    },
    answer: "5,3",
    hints: {
      clue: "Top: 15 ÷ ? = 3. Left: 15 ÷ ? = 5.",
      formula: "15 ÷ a = 3 → a = 5; 15 ÷ b = 5 → b = 3",
      explanation: "Top-right 5, bottom-left 3. Bottom: 3 × 3 = 9. Right: 5 + 3 = 8.",
    },
  },
  {
    id: 6,
    difficulty: "HARD",
    category: "CROSS_MATH",
    timeLimitSec: 5,
    questionText: "Classic cross — fill both grey boxes",
    data: {
      crossMath: {
        cells: [
          [156, "?"],
          ["?", 6],
        ],
        rowOps: ["+", "-"],
        colOps: ["÷", "+"],
        rowResults: [166, 46],
        colResults: [3, 16],
      },
    },
    answer: "10,52",
    hints: {
      clue: "Top: 156 + ? = 166. Left: 156 ÷ ? = 3.",
      formula: "156 + a = 166 → a = 10; 156 ÷ b = 3 → b = 52",
      explanation: "Top-right 10, bottom-left 52. Bottom: 52 − 6 = 46. Right: 10 + 6 = 16.",
    },
  },
];

export function getPuzzleLevel(id: number): PuzzleLevel | undefined {
  return PUZZLE_LEVELS.find((l) => l.id === id);
}

export function getLevelsByDifficulty(difficulty: PuzzleLevel["difficulty"]): PuzzleLevel[] {
  return PUZZLE_LEVELS.filter((l) => l.difficulty === difficulty);
}

/** Unlock sequentially within a difficulty list (first always open). */
export function isLevelUnlockedInList(
  levelId: number,
  levels: PuzzleLevel[],
  completedIds: number[]
): boolean {
  const idx = levels.findIndex((l) => l.id === levelId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = levels[idx - 1];
  return prev ? completedIds.includes(prev.id) : false;
}

export function isLevelUnlocked(id: number, completedIds: number[]): boolean {
  if (id === 1) return true;
  return completedIds.includes(id - 1);
}
