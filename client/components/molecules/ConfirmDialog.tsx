import { Modal, Text, TouchableOpacity, View } from "react-native";
import { useThemedStyles } from "../../lib/theme";
import { PrimaryButton } from "../atoms";
import { createConfirmDialogStyles } from "./ConfirmDialog.styles";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
}: Props) {
  const styles = useThemedStyles(createConfirmDialogStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <PrimaryButton tone="accent" label={cancelLabel} onPress={onCancel} disabled={busy} />
            <TouchableOpacity
              style={styles.cancelLink}
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{busy ? "Leaving…" : confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
