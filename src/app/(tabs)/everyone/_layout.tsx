import { Stack } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
export default function TabsLayout() {
  const themes = useTheme();
  return (
    <Stack screenOptions={{
      headerShown: true,
      headerTransparent: true,
      title: "",
      headerTintColor: themes.text,
      headerShadowVisible: false,
      headerBackButtonMenuEnabled: false,
      animation: "slide_from_right",
      contentStyle: { backgroundColor: themes.background },
    }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
