import { type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * A <Modal> is a separate Android window. The insets reported by the app-level
 * SafeAreaProvider belong to the MAIN window (on many phones the bottom inset there is 0),
 * while the modal can be drawn under the system navigation bar / gesture pill.
 *
 * Wrapping the modal content in its own full-screen SafeAreaProvider makes
 * useSafeAreaInsets() inside the modal report the modal window's real insets.
 * The provider must cover the whole screen, so it wraps the backdrop.
 */
export default function ModalSafeArea({ children }: { children: ReactNode }) {
  return <SafeAreaProvider style={styles.fill}>{children}</SafeAreaProvider>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
