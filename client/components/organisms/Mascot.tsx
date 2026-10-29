import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import type { MouthPose } from "../../lib/lipsync";
import { JamesModel } from "./JamesModel";
import { createMascotStyles, moodLabel, type MascotMood } from "./Mascot.styles";

type Props = {
  mood: MascotMood;
  prompt?: string;
  hint?: string;
  mouth?: MouthPose;
  onModelReady?: () => void;
};

export function Mascot({ mood, prompt, hint, mouth, onModelReady }: Props) {
  const styles = useThemedStyles(createMascotStyles);
  const ring = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    ring.stopAnimation();
    ring.setValue(0.4);
    if (mood !== "listening") return;

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, [mood, ring]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {mood === "listening" ? <Animated.View style={[styles.ring, { opacity: ring }]} /> : null}
        <JamesModel mood={mood} mouth={mouth} style={styles.stageModel} onReady={onModelReady} />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{moodLabel(mood)}</Text>
      </View>
      {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
