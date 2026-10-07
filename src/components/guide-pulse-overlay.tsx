import { useTheme } from "@/hooks/use-theme";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Props = {
  active?: boolean;
  label?: string; // retained for call-site compatibility/accessibility intent
  borderRadius?: number;
  inset?: number;
  beaconPosition?: "top" | "bottom"; // retained for call-site compatibility
};

/**
 * Non-blocking tutorial focus frame. The frame wraps the actual tappable
 * bounds instead of drawing an arrow/pill over the control.
 */
export default function GuidePulseOverlay({
  active = false,
  borderRadius = 16,
  inset = -4,
}: Props) {
  const themes = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (!active) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [active, pulse]);

  if (!active) return null;

  const outerScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 0.34] });
  const fillOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.14] });

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { top: inset, right: inset, bottom: inset, left: inset }]}
    >
      <Animated.View
        style={[
          styles.softFill,
          {
            borderRadius,
            backgroundColor: themes.primaryBttn,
            opacity: fillOpacity,
          },
        ]}
      />
      <View
        style={[
          styles.innerFrame,
          {
            borderRadius,
            borderColor: themes.primaryBttn,
            shadowColor: themes.primaryBttn,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.outerFrame,
          {
            borderRadius: borderRadius + 4,
            borderColor: themes.primaryBttn,
            opacity: outerOpacity,
            transform: [{ scale: outerScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    zIndex: 999,
    overflow: "visible",
  },
  softFill: {
    ...StyleSheet.absoluteFill,
  },
  innerFrame: {
    ...StyleSheet.absoluteFill,
    borderWidth: 2.5,
    shadowOpacity: 0.75,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
    elevation: 13,
  },
  outerFrame: {
    position: "absolute",
    top: -5,
    right: -5,
    bottom: -5,
    left: -5,
    borderWidth: 2,
  },
});
