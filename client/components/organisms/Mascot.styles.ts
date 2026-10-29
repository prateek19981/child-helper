import type { Theme } from "../../lib/theme";

export type MascotMood = "idle" | "speaking" | "listening" | "retry" | "success";

export function createMascotStyles(t: Theme) {
  const { colors, space, radius, typography } = t;
  return {
    wrap: { flex: 1 as const, width: "100%" as const, alignItems: "stretch" as const, gap: space.md },
    // Fill the space between the header and the buttons, and ignore the
    // screen's side padding so the model is not clipped.
    stage: {
      flex: 1 as const,
      marginHorizontal: -space.xl,
      padding: 0,
      overflow: "visible" as const,
    },
    stageModel: {
      position: "absolute" as const,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    ring: {
      position: "absolute" as const,
      width: 280,
      height: 280,
      left: "50%" as const,
      top: "50%" as const,
      marginLeft: -140,
      marginTop: -140,
      borderRadius: 100,
      borderWidth: 3,
      borderColor: colors.accent,
    },
    badge: {
      alignSelf: "center" as const,
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
      return "Kick is talking";
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
