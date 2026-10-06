import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Alert, Keyboard } from "react-native";

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const navigation = useNavigation();

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    Alert.alert(
      "Discard changes?",
      "You have unsaved changes. If you leave now, they'll be lost.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            Keyboard.dismiss();
            // Resume the original action so the hook can allow this removal.
            navigation.dispatch(data.action);
          },
        },
      ],
    );
  });
}
