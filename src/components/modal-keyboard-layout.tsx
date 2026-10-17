import { type ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  /** Style for the dialog wrapper (width / maxWidth). */
  style?: StyleProp<ViewStyle>;
  /**
   * true (default): the dialog scrolls inside the keyboard-safe area when it is taller than
   * what is left above the keyboard. false: for dialogs that manage their own inner ScrollView.
   */
  scroll?: boolean;
};

/**
 * Keyboard-safe layout for centered form dialogs rendered inside <Modal>.
 *
 * The old code used KeyboardAvoidingView behavior="height" on a content-sized wrapper, which
 * only squeezed the dialog instead of moving it, so the focused field stayed under the keyboard.
 * Here the KeyboardAvoidingView fills the screen (padding behavior, which measures the real
 * overlap and therefore also works when the window is resized by the system), and the dialog is
 * centered inside the remaining space and scrolls if it is still too tall.
 */
export default function ModalKeyboardLayout({ children, style, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const edgePad = { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={styles.fill}
          contentContainerStyle={[styles.scrollContent, edgePad]}
        >
          <View style={[styles.wrap, style]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.fixed, edgePad]}>
          <View style={[styles.wrap, styles.wrapShrink, style]}>{children}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%" },
  scrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  fixed: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  wrap: { width: "100%", alignItems: "center" },
  wrapShrink: { flexShrink: 1, maxHeight: "100%" },
});
