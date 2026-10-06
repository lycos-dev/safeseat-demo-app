import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

type MiniTabProps = {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: ViewStyle;
};

export default function MiniTab({ values, selectedIndex, onChange, style }: MiniTabProps) {

  const themes = useTheme();
  const styles = createStyles(themes);  return (
    <View style={[styles.container, style]}>
      {values.map((item, index) => {
        const isSelected = selectedIndex === index;
        return (
          <Pressable
            key={`${item}-${index}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.tab,
              isSelected && styles.selectedTab,
              pressed && styles.pressedTab,
            ]}
            onPress={() => onChange(index)}
          >
            <Text style={[styles.text, isSelected && styles.selectedText]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: spacing.half,
    gap: spacing.half,
    backgroundColor: themes.backgroundElement,
    borderRadius: spacing.edge + 4,
    borderWidth: 1,
    borderColor: themes.divider,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    paddingVertical: spacing.one,
    paddingHorizontal: spacing.one,
    borderRadius: spacing.edge,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTab: {
    backgroundColor: themes.primarySoft,
    borderWidth: 1,
    borderColor: themes.primaryBttn,
  },
  pressedTab: {
    opacity: 0.78,
  },
  text: {
    fontSize: fontsize.button,
    color: themes.textSecondary,
    fontFamily: "Body-Medium",
  },
  selectedText: {
    color: themes.primaryBttn,
    fontFamily: "Body-Bold",
  },
});
