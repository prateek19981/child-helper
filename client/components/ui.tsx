/**
 * Atomic design public API.
 *
 * Prefer importing from layer folders when building new UI:
 *   atoms → molecules → organisms → templates → pages (app/)
 *
 * This barrel keeps existing `from "../components/ui"` imports working.
 */

export {
  AppText,
  Body,
  Button,
  Icon,
  Input,
  PrimaryButton,
  Screen,
  Spacer,
  SvgIcon,
  Title,
} from "./atoms";
export type { ButtonTone, IconName, TextTone, TextVariant } from "./atoms";

export { Back, BackButton, Field, TextField } from "./molecules";

export { AuthLayout } from "./templates";

export { Mascot } from "./organisms";
export type { MascotMood } from "./organisms";
