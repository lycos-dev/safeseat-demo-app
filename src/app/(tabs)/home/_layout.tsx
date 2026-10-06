import { Stack } from "expo-router";

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      {/* Points to the index folder */}
      <Stack.Screen name="index" options={{ title: "Home" }} />
    </Stack>
  );
}
