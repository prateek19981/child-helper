import { applyOp, crossBlankPositions } from "./crossMath";
import type { CrossMathGrid, MathOp, PuzzleDifficulty, PuzzleLevel } from "./types";

export type GeneratedCrossMath = {
  grid: CrossMathGrid;
  /** Solved values for each "?" in blank order */
  solution: number[];
  hints: PuzzleLevel["hints"];
};

function isPositiveInt(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) >= 1;
}

function asInt(n: number): number {
  return Math.round(n);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rangeFor(difficulty: PuzzleDifficulty): [number, number] {
  switch (difficulty) {
    case "EASY":
      return [1, 12];
    case "MEDIUM":
      return [2, 24];
    case "HARD":
      return [3, 48];
  }
}

/** Pick (left, right) so left op right is a positive integer. */
function pickOperands(op: MathOp, min: number, max: number): [number, number] {
  if (op === "÷") {
    const right = randomInt(Math.max(1, min), Math.min(max, 12));
    const quot = randomInt(Math.max(1, min), Math.min(12, max));
    return [right * quot, right];
  }
  if (op === "-") {
    const right = randomInt(min, max);
    const diff = randomInt(min, max);
    return [right + diff, right];
  }
  if (op === "×") {
    const left = randomInt(min, Math.min(max, 12));
    const right = randomInt(min, Math.min(max, 12));
    return [left, right];
  }
  // +
  return [randomInt(min, max), randomInt(min, max)];
}

function buildHints(
  filled: number[][],
  grid: CrossMathGrid,
  solution: number[]
): PuzzleLevel["hints"] {
  const [[a, b], [c, d]] = filled as [[number, number], [number, number]];
  const [r0, r1] = grid.rowResults;
  const blanks = crossBlankPositions(grid);
  const first = blanks[0];
  const topLine =
    first?.r === 0
      ? `Top: ${first.c === 0 ? "?" : a} ${grid.rowOps[0]} ${first.c === 1 ? "?" : b} = ${r0}`
      : `Bottom: ${first?.c === 0 ? "?" : c} ${grid.rowOps[1]} ${first?.c === 1 ? "?" : d} = ${r1}`;

  return {
    clue: `${topLine}. Fill both blanks.`,
    formula: `Ops: rows ${grid.rowOps[0]} / ${grid.rowOps[1]}, columns ${grid.colOps[0]} / ${grid.colOps[1]}.`,
    explanation: `Answers: ${solution.join(" and ")}. Full grid ${a} ${b} / ${c} ${d}.`,
  };
}

/**
 * Build a fresh valid 2×2 cross-math grid using the template's ops + blank
 * positions, with new random cell values every call.
 */
export function generateCrossMathPuzzle(
  template: CrossMathGrid,
  difficulty: PuzzleDifficulty
): GeneratedCrossMath {
  const [min, max] = rangeFor(difficulty);
  const blankPos = crossBlankPositions(template);
  const positions =
    blankPos.length === 2
      ? blankPos
      : [
          { r: 0, c: 1 },
          { r: 1, c: 0 },
        ];

  for (let attempt = 0; attempt < 1000; attempt++) {
    // Seed top row so its op always yields a clean integer
    const [a, b] = pickOperands(template.rowOps[0]!, min, max);
    const row0 = applyOp(a, template.rowOps[0]!, b);
    if (row0 == null || !isPositiveInt(row0)) continue;

    // Pick c so left column is clean
    let c: number | null = null;
    if (template.colOps[0] === "÷") {
      // a ÷ c = int → c must divide a
      const divisors: number[] = [];
      for (let d = Math.max(1, min); d <= Math.min(a, max); d++) {
        if (a % d === 0) divisors.push(d);
      }
      if (!divisors.length) continue;
      c = divisors[randomInt(0, divisors.length - 1)]!;
    } else if (template.colOps[0] === "-") {
      c = randomInt(min, Math.min(max, a - 1 >= min ? a - 1 : max));
    } else {
      c = randomInt(min, max);
    }

    const col0 = applyOp(a, template.colOps[0]!, c);
    if (col0 == null || !isPositiveInt(col0)) continue;

    for (let dTry = 0; dTry < 80; dTry++) {
      const d = randomInt(min, max);
      const row1 = applyOp(c, template.rowOps[1]!, d);
      const col1 = applyOp(b, template.colOps[1]!, d);
      if (row1 == null || col1 == null || !isPositiveInt(row1) || !isPositiveInt(col1)) {
        continue;
      }

      const filled = [
        [a, b],
        [c, d],
      ];
      const cells: (number | "?")[][] = [
        [a, b],
        [c, d],
      ];
      const solution: number[] = [];
      for (const p of positions) {
        solution.push(filled[p.r]![p.c]!);
        cells[p.r]![p.c] = "?";
      }

      const grid: CrossMathGrid = {
        cells,
        rowOps: [...template.rowOps],
        colOps: [...template.colOps],
        rowResults: [asInt(row0), asInt(row1)],
        colResults: [asInt(col0), asInt(col1)],
      };

      return {
        grid,
        solution,
        hints: buildHints(filled, grid, solution),
      };
    }
  }

  // Extremely unlikely fallback: keep template numbers
  const solution = positions.map((p) => {
    const v = template.cells[p.r]?.[p.c];
    return typeof v === "number" ? v : 1;
  });
  return {
    grid: template,
    solution,
    hints: {
      clue: "Fill both dim tiles so every equation is true.",
      formula: "Use the given ops and results.",
      explanation: "Check both rows and both columns.",
    },
  };
}
