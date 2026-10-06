import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps } from "react-native";

// Use native keyboard avoidance instead of scheduling measurements of text
// inputs that may have unmounted during an edit-mode or navigation transition.
export default function FormScrollView(props: ScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        {...props}
      />
    </KeyboardAvoidingView>
  );
}
