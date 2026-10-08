import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Keyboard } from "react-native";
import { confirmAction } from "../utils/platform-dialog";

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const navigation = useNavigation();

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    void confirmAction({
      title: "Discard changes?",
      message: "You have unsaved changes. If you leave now, they'll be lost.",
      confirmText: "Discard",
      cancelText: "Stay",
      destructive: true,
    }).then((discard) => {
      if (!discard) return;
      Keyboard.dismiss();
      // Resume the original action so the hook can allow this removal.
      navigation.dispatch(data.action);
    });
  });
}
