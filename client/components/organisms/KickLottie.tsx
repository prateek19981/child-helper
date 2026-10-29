import LottieView, { type LottieViewProps } from "lottie-react-native";
import type { StyleProp, ViewStyle } from "react-native";

type Props = {
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  loop?: boolean;
} & Pick<LottieViewProps, "onAnimationFinish">;

/** Kick mascot Lottie: wink + smile together, then loop. */
export function KickLottie({ style, autoPlay = true, loop = true, onAnimationFinish }: Props) {
  return (
    <LottieView
      source={require("../../assets/lottie/kick-wink-smile.json")}
      autoPlay={autoPlay}
      loop={loop}
      style={style}
      onAnimationFinish={onAnimationFinish}
    />
  );
}
