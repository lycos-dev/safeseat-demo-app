import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

type WindowValue = 20 | 25 | 30;
type Props = {
  value: WindowValue;
  enabled?: boolean;
  onValueChange: (v: WindowValue) => void;
  onInteractionChange?: (active: boolean) => void;
};

const VALUES: WindowValue[] = [20, 25, 30];

const valueFromRatio = (ratio: number): WindowValue => {
  if (ratio < 0.25) return 20;
  if (ratio < 0.75) return 25;
  return 30;
};

const percentForValue = (value: WindowValue) => value === 20 ? 0 : value === 25 ? 50 : 100;

export default function EscalationWindowControl({ value, enabled = true, onValueChange, onInteractionChange }: Props) {
  const themes = useTheme();
  const styles = createStyles(themes);
  const [trackWidth, setTrackWidth] = useState(1);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const dragStartRatio = useRef(0);
  const previewValue = useRef<WindowValue>(value);

  const snappedPercent = percentForValue(value);
  const visualPercent = dragPercent ?? snappedPercent;

  const commit = (next: WindowValue, withHaptic = true) => {
    if (!enabled || next === value) return;
    if (withHaptic) void Haptics.selectionAsync();
    onValueChange(next);
  };

  const setPreviewRatio = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    setDragPercent(clamped * 100);
    const nextPreview = valueFromRatio(clamped);
    if (nextPreview !== previewValue.current) {
      previewValue.current = nextPreview;
      void Haptics.selectionAsync();
    }
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onStartShouldSetPanResponderCapture: () => enabled,
    onMoveShouldSetPanResponder: (_event, gesture) => enabled && Math.abs(gesture.dx) >= 2,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => enabled && Math.abs(gesture.dx) >= 2,
    onPanResponderGrant: (event) => {
      onInteractionChange?.(true);
      const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / Math.max(1, trackWidth)));
      dragStartRatio.current = ratio;
      previewValue.current = valueFromRatio(ratio);
      setPreviewRatio(ratio);
    },
    onPanResponderMove: (_event, gesture) => {
      setPreviewRatio(dragStartRatio.current + gesture.dx / Math.max(1, trackWidth));
    },
    onPanResponderRelease: () => {
      const next = previewValue.current;
      setDragPercent(null);
      onInteractionChange?.(false);
      if (next !== value) onValueChange(next);
    },
    onPanResponderTerminate: () => {
      setDragPercent(null);
      previewValue.current = value;
      onInteractionChange?.(false);
    },
    onPanResponderTerminationRequest: () => false,
  }), [enabled, trackWidth, value, onValueChange, onInteractionChange]);

  return (
    <View style={[styles.card, !enabled && styles.disabled]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Driver SMS Delay</Text>
          <Text style={styles.sub}>Drag the slider to set how long you can cancel a confirmed Driver-seat emergency before automated SMS becomes eligible.</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.value}>{dragPercent === null ? value : previewValue.current}s</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Driver SMS Delay"
        accessibilityValue={{ min: 20, max: 30, now: value, text: `${value} seconds` }}
        onAccessibilityAction={(event) => {
          if (!enabled) return;
          if (event.nativeEvent.actionName === "increment") commit(value === 20 ? 25 : 30);
          if (event.nativeEvent.actionName === "decrement") commit(value === 30 ? 25 : 20);
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={styles.sliderTouchArea}
        {...panResponder.panHandlers}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.active, { width: `${visualPercent}%` }]} />
          {[0, 50, 100].map((position) => (
            <View key={position} style={[styles.stop, { left: `${position}%` }]} />
          ))}
          <View style={[styles.thumb, { left: `${visualPercent}%` }]} />
        </View>
      </View>

      <View style={styles.labels}>
        {VALUES.map((item) => (
          <Pressable key={item} onPress={() => commit(item)} disabled={!enabled} hitSlop={8}>
            <Text style={[styles.label, item === value && dragPercent === null && styles.selected]}>{item}s</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  card: {
    backgroundColor: themes.backgroundElement,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: themes.divider,
    padding: spacing.two,
    gap: spacing.two,
  },
  disabled: { opacity: 0.45 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1 },
  title: { color: themes.text, fontSize: fontsize.body, fontFamily: "Body-Bold" },
  sub: { color: themes.textSecondary, fontSize: fontsize.caption, lineHeight: 20, marginTop: 3, fontFamily: "Body-Regular" },
  badge: { minWidth: 58, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", borderRadius: 999, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
  value: { color: themes.primaryBttn, fontSize: fontsize.body, fontFamily: "Body-Bold" },
  sliderTouchArea: { paddingVertical: 18, justifyContent: "center" },
  track: { height: 8, borderRadius: 999, backgroundColor: themes.secondaryBttn, position: "relative" },
  active: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: themes.primaryBttn },
  stop: { position: "absolute", width: 12, height: 12, marginLeft: -6, marginTop: -2, borderRadius: 6, backgroundColor: themes.backgroundElevated, borderWidth: 2, borderColor: themes.textSecondary },
  thumb: { position: "absolute", width: 28, height: 28, marginLeft: -14, marginTop: -10, borderRadius: 14, backgroundColor: themes.primaryBttn, borderWidth: 3, borderColor: themes.backgroundElement },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: themes.textMuted, fontSize: fontsize.caption, fontFamily: "Body-Medium" },
  selected: { color: themes.primaryBttn, fontFamily: "Body-Bold" },
});
