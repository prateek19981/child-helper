import { crossMathHolds } from "./crossMath";
import { equationHolds } from "./equation";
import type { CrossMathGrid, EquationPart } from "./types";

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/^0+(?=\d)/, "");
}

export function checkPuzzleAnswer(guess: string, answer: string): boolean {
  return normalizeAnswer(guess) === normalizeAnswer(answer);
}

/** Linear equation: any blanks that make the equation true are correct. */
export function checkEquationPuzzle(equation: EquationPart[], blanks: string[]): boolean {
  return equationHolds(equation, blanks);
}

/** 3×3 cross-math: all rows and columns must hold. */
export function checkCrossMathPuzzle(grid: CrossMathGrid, blanks: string[]): boolean {
  return crossMathHolds(grid, blanks);
}

