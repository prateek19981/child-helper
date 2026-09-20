import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Text, View } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import { createMascotStyles, moodLabel, type MascotMood } from "./Mascot.styles";

type Props = {
  mood: MascotMood;
  prompt?: string;
  hint?: string;
};

export function Mascot({ mood, prompt, hint }: Props) {
  const styles = useThemedStyles(createMascotStyles);
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    bob.stopAnimation();
    pulse.stopAnimation();
    ring.stopAnimation();
    bob.setValue(0);
    pulse.setValue(1);
    ring.setValue(0.4);

    if (mood === "speaking") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: -10, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(bob, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ])
      );
      const scale = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 220, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
        ])
      );
      loop.start();
      scale.start();
      return () => {
        loop.stop();
        scale.stop();
      };
    }

    if (mood === "listening") {
      const breath = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.02, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        ])
      );
      breath.start();
      glow.start();
      return () => {
        breath.stop();
        glow.stop();
      };
    }

    if (mood === "retry") {
      const tilt = Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 180, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 6, duration: 180, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]);
      tilt.start();
      return () => tilt.stop();
    }

    if (mood === "success") {
      const cheer = Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]);
      cheer.start();
      return () => cheer.stop();
    }

    const idle = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -4, duration: 900, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    idle.start();
    return () => idle.stop();
  }, [mood, bob, pulse, ring]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {mood === "listening" ? (
          <Animated.View style={[styles.ring, { opacity: ring, transform: [{ scale: pulse }] }]} />
        ) : null}
        <Animated.View style={{ transform: [{ translateY: bob }, { scale: pulse }] }}>
          <Image source={require("../../assets/koober-fox.png")} style={styles.fox} resizeMode="contain" />
        </Animated.View>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{moodLabel(mood)}</Text>
      </View>
      {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
