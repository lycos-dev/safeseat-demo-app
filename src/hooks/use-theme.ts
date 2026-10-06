import { DarkTheme, LightTheme, type ThemePalette } from "@/constants/theme";
import { useOptionalUserPreferences } from "@/hooks/user-preferences-context";

export function useTheme(): ThemePalette {
  const preferences = useOptionalUserPreferences();
  return preferences?.themeMode === "light" ? LightTheme : DarkTheme;
}
