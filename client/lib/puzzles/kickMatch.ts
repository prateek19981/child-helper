import type { PuzzleDifficulty } from "./types";

export const KICK_DIFFICULTIES: PuzzleDifficulty[] = ["EASY", "MEDIUM", "HARD"];

export type KickDifficultyConfig = {
  kickSolveMinSec: number;
  kickSolveMaxSec: number;
  roundTimeLimitSec: number;
};

export const KICK_CONFIG: Record<PuzzleDifficulty, KickDifficultyConfig> = {
  EASY: { kickSolveMinSec: 18, kickSolveMaxSec: 28, roundTimeLimitSec: 45 },
  MEDIUM: { kickSolveMinSec: 12, kickSolveMaxSec: 20, roundTimeLimitSec: 35 },
  HARD: { kickSolveMinSec: 8, kickSolveMaxSec: 14, roundTimeLimitSec: 25 },
};

/** Solo timer mode round limits by difficulty (hub blurb + fallback). */
export const TIMER_MODE_LIMITS: Record<PuzzleDifficulty, number> = {
  EASY: 45,
  MEDIUM: 35,
  HARD: 25,
};

export type RaceWinner = "you" | "kick";
export type RacePhase = "playing" | "result";

export function parseDifficulty(raw: string | undefined): PuzzleDifficulty | null {
  const d = (raw ?? "").toUpperCase();
  if (d === "EASY" || d === "MEDIUM" || d === "HARD") return d;
  return null;
}

/** Kick's simultaneous solve duration for this race (rolled once at start). */
export function randomKickSolveSec(difficulty: PuzzleDifficulty): number {
  const { kickSolveMinSec, kickSolveMaxSec } = KICK_CONFIG[difficulty];
  return (
    kickSolveMinSec +
    Math.floor(Math.random() * (kickSolveMaxSec - kickSolveMinSec + 1))
  );
}

/**
 * Simultaneous race: Kick's finish time is known at race start.
 * Compare user solve vs Kick's predetermined time. Timeout with no user solve → Kick.
 */
export function decideRaceWinner(args: {
  userSolvedAtMs: number | null;
  kickSolvedAtMs: number;
  timedOut: boolean;
}): RaceWinner {
  const { userSolvedAtMs, kickSolvedAtMs, timedOut } = args;
  if (userSolvedAtMs != null) {
    return userSolvedAtMs <= kickSolvedAtMs ? "you" : "kick";
  }
  if (timedOut) return "kick";
  // Kick's clock hit first while user still unsolved
  return "kick";
}

export function formatSolveTime(msFromStart: number): string {
  const sec = Math.max(0, msFromStart) / 1000;
  return `${sec.toFixed(1)}s`;
}
