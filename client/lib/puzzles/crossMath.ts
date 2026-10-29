import { normalizeAnswer } from "./checkAnswer";
import type { CrossMathGrid, MathOp } from "./types";

export function applyOp(a: number, op: MathOp, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      if (b === 0) return null;
      return a / b;
    default:
      return null;
  }
}

export function crossBlankPositions(grid: CrossMathGrid): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      if (grid.cells[r]?.[c] === "?") out.push({ r, c });
    }
  }
  return out;
}

export function crossBlankCount(grid: CrossMathGrid): number {
  return crossBlankPositions(grid).length;
}

export function fillCrossCells(
  grid: CrossMathGrid,
  blanks: string[]
): (number | "?")[][] {
  const positions = crossBlankPositions(grid);
  const cells = grid.cells.map((row) => row.slice()) as (number | "?")[][];
  positions.forEach((pos, i) => {
    const raw = blanks[i] ?? "";
    const n = Number(normalizeAnswer(raw));
    if (raw.trim() !== "" && Number.isFinite(n)) {
      cells[pos.r]![pos.c] = n;
    }
  });
  return cells;
}

function nearlyEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** Every row (L→R) and column (T→B) equation must hold. */
export function crossMathHolds(grid: CrossMathGrid, blanks: string[]): boolean {
  if (blanks.length < crossBlankCount(grid)) return false;
  if (blanks.some((b) => b.trim() === "")) return false;

  const cells = fillCrossCells(grid, blanks);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      if (cells[r]![c] === "?") return false;
    }
  }

  for (let r = 0; r < 2; r++) {
    const a = cells[r]![0] as number;
    const b = cells[r]![1] as number;
    const v = applyOp(a, grid.rowOps[r]!, b);
    if (v == null || !nearlyEq(v, grid.rowResults[r]!)) return false;
  }

  for (let c = 0; c < 2; c++) {
    const a = cells[0]![c] as number;
    const b = cells[1]![c] as number;
    const v = applyOp(a, grid.colOps[c]!, b);
    if (v == null || !nearlyEq(v, grid.colResults[c]!)) return false;
  }

  return true;
}

export function formatCrossSolution(grid: CrossMathGrid, blanks: string[]): string {
  const cells = fillCrossCells(grid, blanks);
  return cells.map((row) => row.join(" ")).join(" · ");
}
