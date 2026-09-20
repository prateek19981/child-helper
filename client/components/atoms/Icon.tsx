import { SvgXml } from "react-native-svg";
import { svgs } from "../../lib/svgs";

export type IconName = keyof typeof svgs;

type IconProps = {
  name: IconName;
  width?: number;
  height?: number;
};

export function Icon({ name, width = 18, height = 18 }: IconProps) {
  return <SvgXml xml={svgs[name]} width={width} height={height} />;
}

/** @deprecated Prefer `Icon` — kept for existing imports */
export function SvgIcon(props: { name: IconName; width: number; height: number }) {
  return <Icon {...props} />;
}
