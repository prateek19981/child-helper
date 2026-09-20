import type { Theme } from "../../lib/theme";

export type MascotMood = "idle" | "speaking" | "listening" | "retry" | "success";

export function createMascotStyles(t: Theme) {
  const { colors, space, radius, typography } = t;
  return {
    wrap: { alignItems: "center" as const, gap: space.md },
    stage: {
      width: 220,
      height: 220,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    fox: { width: 180, height: 180 },
    ring: {
      position: "absolute" as const,
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 3,
      borderColor: colors.accent,
    },
    badge: {
      marginTop: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.soft,
    },
    badgeText: { ...typography.caption, color: colors.primary, fontWeight: "700" as const },
    prompt: {
      ...typography.h3,
      color: colors.text,
      textAlign: "center" as const,
      paddingHorizontal: space.xl,
    },
    hint: {
      ...typography.bodySm,
      color: colors.muted,
      textAlign: "center" as const,
    },
  };
}

export function moodLabel(mood: MascotMood): string {
  switch (mood) {
    case "speaking":
      return "Koober is talking";
    case "listening":
      return "I'm listening…";
    case "retry":
      return "Try again";
    case "success":
      return "Great job!";
    default:
      return "Hi there";
  }
}
