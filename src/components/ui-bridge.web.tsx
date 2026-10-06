import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  Text as RNText,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type CommonProps = { children?: React.ReactNode; style?: StyleProp<ViewStyle>; [key: string]: any };

export function Host({ children, style }: CommonProps) {
  return <View style={style}>{children}</View>;
}

const symbolMap: Record<string, string> = {
  "house.fill": "home",
  house: "home-outline",
  "carseat.right.fill": "car-sport",
  "carseat.right": "car-sport-outline",
  "person.3.fill": "people",
  "person.3": "people-outline",
  "gearshape.fill": "settings",
  gearshape: "settings-outline",
  "circle.fill": "ellipse",
  xmark: "close",
  pencil: "pencil",
  "bubble.left.and.bubble.right.fill": "chatbubbles",
  "phone.fill": "call",
  "chevron.up.chevron.down": "chevron-expand",
  "chevron.right": "chevron-forward",
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "person.crop.circle": "person-circle-outline",
  "heart.fill": "heart",
  heart: "heart-outline",
  "calendar": "calendar-outline",
  "clock": "time-outline",
  "trash": "trash-outline",
  "info.circle": "information-circle-outline",
  "exclamationmark.triangle.fill": "warning",
  "checkmark.circle.fill": "checkmark-circle",
  checkmark: "checkmark",
  "circle.dotted": "ellipse-outline",
  "eye.fill": "eye",
  "eye.slash.fill": "eye-off",
  "light.beacon.max.fill": "radio",
  "message.fill": "chatbubble",
  square: "square-outline",
};

function normalizeSymbol(name: any): string {
  if (typeof name !== "string") return "ellipse-outline";
  if (symbolMap[name]) return symbolMap[name];
  // Most app-level iconName props are already Ionicons names (e.g.
  // "pulse-outline", "book-outline"). Preserve those directly.
  if (name.includes("-") || name.endsWith("outline")) return name;
  return name.includes("person") ? "person-outline" : name.includes("gear") ? "settings-outline" : "ellipse-outline";
}

export function Icon({ name, size = 20, color = "currentColor", style }: any) {
  return <Ionicons name={normalizeSymbol(name) as any} size={size} color={color} style={style} />;
}
Icon.select = (options: any) => options?.web ?? options?.ios ?? options?.android;

function Stack({ children, spacing = 0, alignment = "stretch", style, direction = "column" }: CommonProps & { spacing?: number; alignment?: string; direction?: "row" | "column" }) {
  return (
    <View
      style={[
        { flexDirection: direction, gap: spacing, alignItems: alignment === "center" ? "center" : alignment === "end" ? "flex-end" : alignment === "start" ? "flex-start" : "stretch" },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Column(props: any) { return <Stack {...props} direction="column" />; }
export function Row(props: any) { return <Stack {...props} direction="row" />; }

export function Spacer({ size = 8, flexible = false }: any) {
  return <View style={flexible ? { flex: 1 } : { width: size, height: size }} />;
}

export function Text({ children, textStyle, style }: { children?: React.ReactNode; textStyle?: StyleProp<TextStyle>; style?: StyleProp<TextStyle> }) {
  return <RNText style={[textStyle, style]}>{children}</RNText>;
}

export function Button({ children, label, onPress, variant, style, disabled }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 36,
          minWidth: 36,
          paddingHorizontal: label ? 12 : 8,
          paddingVertical: 8,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: variant === "outlined" ? 1 : 0,
          borderColor: "rgba(127,127,127,.35)",
          opacity: pressed ? 0.72 : disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {children ?? (label ? <RNText>{label}</RNText> : null)}
    </Pressable>
  );
}

export function BottomSheet({ isPresented, onDismiss, children }: any) {
  return (
    <Modal visible={Boolean(isPresented)} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "flex-end" }} onPress={onDismiss}>
        <Pressable
          onPress={(event) => event.stopPropagation?.()}
          style={{ width: "100%", maxHeight: "70%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#171b2b", padding: 20 }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerBase({ selectedValue, onValueChange, children }: any) {
  const items = React.Children.toArray(children) as React.ReactElement[];
  return React.createElement(
    "select",
    {
      value: selectedValue,
      onChange: (event: any) => onValueChange?.(event.target.value),
      style: { background: "transparent", border: 0, color: "inherit", font: "inherit", outline: "none" },
    },
    items.map((item: any) => React.createElement("option", { key: item.props.value, value: item.props.value }, item.props.label)),
  );
}
(PickerBase as any).Item = () => null;
export const Picker = PickerBase as any;
