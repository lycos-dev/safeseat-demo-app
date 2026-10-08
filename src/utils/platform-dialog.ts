import { Alert, Platform } from "react-native";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

/**
 * Cross-platform confirmation dialog.
 * React Native Web does not reliably support Alert.alert button callbacks,
 * so Web uses the browser's native confirm dialog instead.
 */
export async function confirmAction({
  title,
  message = "",
  confirmText = "OK",
  cancelText = "Cancel",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return false;
    const copy = [title, message].filter(Boolean).join("\n\n");
    return window.confirm(copy);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
