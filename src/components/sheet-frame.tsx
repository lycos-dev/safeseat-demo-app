import { type ReactNode } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  /** The existing card style (background, radius, padding, alignItems, gap ...). */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityViewIsModal?: boolean;
  /** Extra space kept between the card and the screen edges (the backdrop may already add some). */
  edgeGap?: number;
  /** true: card is attached to the screen bottom (background continues behind the nav bar). false: floating card lifted above the nav bar. */
  attachToBottom?: boolean;
};

/**
 * Card used by every bottom-sheet style modal.
 *
 * - Lifts the card above the Android system navigation bar / gesture pill (modals are drawn
 *   edge-to-edge, so the card must add the bottom inset itself).
 * - Caps the card height to the visible window and scrolls the content when it is taller, so
 *   action buttons at the bottom of the sheet can never end up off-screen or untappable.
 */
export default function SheetFrame({ style, children, accessibilityViewIsModal, edgeGap = 16, attachToBottom = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const flat = StyleSheet.flatten(style) ?? {};
  const maxHeight = Math.max(
    260,
    attachToBottom ? height - insets.top - 12 : height - insets.top - insets.bottom - edgeGap - 16,
  );

  return (
    <View
      accessibilityViewIsModal={accessibilityViewIsModal}
      style={[style, { alignItems: "stretch", maxHeight, marginBottom: attachToBottom ? 0 : insets.bottom + 4, padding: 0, paddingHorizontal: 0, paddingVertical: 0, paddingTop: 0, paddingBottom: attachToBottom ? insets.bottom + 12 : 0 }]}
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={{
          alignItems: flat.alignItems,
          gap: flat.gap,
          paddingHorizontal: flat.paddingHorizontal ?? (typeof flat.padding === "number" ? flat.padding : 0),
          paddingTop: flat.paddingTop ?? flat.paddingVertical ?? (typeof flat.padding === "number" ? flat.padding : 0),
          paddingBottom: flat.paddingBottom ?? flat.paddingVertical ?? (typeof flat.padding === "number" ? flat.padding : 0),
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, alignSelf: "stretch" },
});
