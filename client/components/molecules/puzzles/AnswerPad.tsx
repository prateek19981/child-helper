import { Text, TouchableOpacity, View } from "react-native";
import { useThemedStyles } from "../../../lib/theme";
import { createAnswerPadStyles } from "../../../styles/puzzles/answerPadStyles";
import { PrimaryButton } from "../../atoms";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLength?: number;
  /** e.g. "Blank 1 of 2" */
  label?: string;
  submitDisabled?: boolean;
  /** Hide the big readout — value already shows on the board tile */
  compact?: boolean;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export function AnswerPad({
  value,
  onChange,
  onSubmit,
  disabled,
  maxLength = 4,
  label,
  submitDisabled,
  compact,
}: Props) {
  const styles = useThemedStyles(createAnswerPadStyles);

  function pressDigit(d: string) {
    if (disabled) return;
    if (value.length >= maxLength) return;
    onChange(value + d);
  }

  function backspace() {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {!compact ? (
        <View style={styles.display}>
          {value ? (
            <Text style={styles.displayText}>{value}</Text>
          ) : (
            <Text style={styles.displayPlaceholder}>Your answer</Text>
          )}
        </View>
      ) : null}
      <View style={styles.keys}>
        {KEYS.map((d) => (
          <TouchableOpacity
            key={d}
            style={styles.key}
            onPress={() => pressDigit(d)}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Digit ${d}`}
          >
            <Text style={styles.keyText}>{d}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.key, styles.keyWide]}
          onPress={backspace}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Text style={styles.keyText}>⌫</Text>
        </TouchableOpacity>
      </View>
      <PrimaryButton
        tone="accent"
        label="Check answer"
        onPress={onSubmit}
        disabled={
          disabled || (submitDisabled !== undefined ? submitDisabled : value.length === 0)
        }
      />
    </View>
  );
}
