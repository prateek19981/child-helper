import type { EquationPart } from "./types";
import { normalizeAnswer } from "./checkAnswer";

export function blankCount(equation: EquationPart[]): number {
  return equation.filter((p) => p === "?").length;
}

export function fillEquation(equation: EquationPart[], blanks: string[]): EquationPart[] {
  let i = 0;
  return equation.map((part) => {
    if (part !== "?") return part;
    const raw = blanks[i++] ?? "";
    const n = Number(normalizeAnswer(raw));
    return Number.isFinite(n) && raw.trim() !== "" ? n : "?";
  });
}

function applyOp(a: number, op: string, b: number): number | null {
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

/** Left-to-right evaluation of number/op tokens (kid-friendly, no precedence). */
function evalLeftToRight(tokens: (number | string)[]): number | null {
  if (tokens.length === 0) return null;
  const first = tokens[0];
  if (typeof first !== "number") return null;
  let acc = first;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const rhs = tokens[i + 1];
    if (typeof op !== "string" || typeof rhs !== "number") return null;
    const next = applyOp(acc, op, rhs);
    if (next == null || !Number.isFinite(next)) return null;
    acc = next;
  }
  return acc;
}

/** True when blanks fill the equation so left side equals right side. */
export function equationHolds(equation: EquationPart[], blanks: string[]): boolean {
  if (blanks.length < blankCount(equation)) return false;
  if (blanks.some((b) => b.trim() === "")) return false;

  const filled = fillEquation(equation, blanks);
  if (filled.some((p) => p === "?")) return false;

  const eqAt = filled.indexOf("=");
  if (eqAt < 0) return false;

  const left = filled.slice(0, eqAt) as (number | string)[];
  const right = filled.slice(eqAt + 1) as (number | string)[];
  if (right.length !== 1 || typeof right[0] !== "number") {
    // allow right-side expression too
    const lv = evalLeftToRight(left);
    const rv = evalLeftToRight(right);
    if (lv == null || rv == null) return false;
    return Math.abs(lv - rv) < 1e-9;
  }

  const lv = evalLeftToRight(left);
  if (lv == null) return false;
  return Math.abs(lv - (right[0] as number)) < 1e-9;
}

/** Compare stored answer string ("7" or "3,5") to ordered blank guesses. */
export function checkEquationAnswer(guesses: string[], answer: string): boolean {
  const expected = answer.split(",").map((s) => normalizeAnswer(s));
  if (expected.length !== guesses.length) return false;
  return expected.every((e, i) => e === normalizeAnswer(guesses[i] ?? ""));
}

export function formatFilledEquation(equation: EquationPart[], blanks: string[]): string {
  const filled = fillEquation(equation, blanks);
  return filled
    .map((p) => (p === "×" ? "×" : p === "÷" ? "÷" : String(p)))
    .join(" ");
}
