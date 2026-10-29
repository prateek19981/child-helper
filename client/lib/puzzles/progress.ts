import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PuzzleDifficulty } from "./types";

const LEGACY_KEY = "kick.puzzle.completed";

function timerKey(difficulty: PuzzleDifficulty): string {
  return `kick.puzzle.completed.timer.${difficulty}`;
}

function kickWinsKey(difficulty: PuzzleDifficulty): string {
  return `kick.puzzle.wins.kick.${difficulty}`;
}

export async function getCompletedPuzzleIds(
  difficulty?: PuzzleDifficulty
): Promise<number[]> {
  try {
    const key = difficulty ? timerKey(difficulty) : LEGACY_KEY;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number");
  } catch {
    return [];
  }
}

export async function markPuzzleCompleted(
  id: number,
  difficulty?: PuzzleDifficulty
): Promise<number[]> {
  const current = await getCompletedPuzzleIds(difficulty);
  if (current.includes(id)) return current;
  const next = [...current, id].sort((a, b) => a - b);
  const key = difficulty ? timerKey(difficulty) : LEGACY_KEY;
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}

export async function getKickMatchWins(difficulty: PuzzleDifficulty): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(kickWinsKey(difficulty));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function incrementKickMatchWins(difficulty: PuzzleDifficulty): Promise<number> {
  const next = (await getKickMatchWins(difficulty)) + 1;
  await AsyncStorage.setItem(kickWinsKey(difficulty), String(next));
  return next;
}
