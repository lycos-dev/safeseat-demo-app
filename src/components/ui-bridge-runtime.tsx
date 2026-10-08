import Ionicons from "@expo/vector-icons/Ionicons";
import * as ExpoUI from "@expo/ui";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text as RNText,
  View,
} from "react-native";

const IS_WEB = Platform.OS === "web";

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
  plus: "add",
  "plus.circle.fill": "add-circle",
  "person.crop.circle": "person-circle-outline",
  "heart.fill": "heart",
  heart: "heart-outline",
  calendar: "calendar-outline",
  clock: "time-outline",
  trash: "trash-outline",
  "info.circle": "information-circle-outline",
  "exclamationmark.triangle.fill": "warning",
  "checkmark.circle.fill": "checkmark-circle",
  checkmark: "checkmark",
  "circle.dotted": "ellipse-outline",
  "eye.fill": "eye",
  "eye.slash.fill": "eye-off",
  "light.beacon.max.fill": "radio",
  "message.fill": "chatbubble",
  "arrow.up.right.square": "open-outline",
  square: "square-outline",
  "person.badge.plus": "person-add-outline",
  "person.fill": "person",
  person: "person-outline",
};

function normalizeSymbol(name: unknown): string {
  if (typeof name !== "string") return "ellipse-outline";
  if (symbolMap[name]) return symbolMap[name];
  // Dynamic app icon props are frequently already Ionicons names.
  if (name.includes("-") || name.endsWith("outline")) return name;
  if (name.includes("person")) return "person-outline";
  if (name.includes("gear")) return "settings-outline";
  return name;
}

export function Host(props: any) {
  if (!IS_WEB) {
    return React.createElement((ExpoUI as any).Host, props, props.children);
  }
  return <View style={props.style}>{props.children}</View>;
}

export function Icon({ name, size = 20, color = "currentColor", style, ...rest }: any) {
  if (!IS_WEB) {
    return React.createElement((ExpoUI as any).Icon, { name, size, color, style, ...rest });
  }
  return (
    <Ionicons
      name={normalizeSymbol(name) as any}
      size={size}
      color={color}
      style={style}
      {...rest}
    />
  );
}

(Icon as any).select = (options: any) => {
  if (IS_WEB) return options?.web ?? options?.ios ?? options?.android;
  const nativeSelect = (ExpoUI as any).Icon?.select;
  return typeof nativeSelect === "function"
    ? nativeSelect(options)
    : Platform.OS === "ios"
      ? options?.ios ?? options?.android
      : options?.android ?? options?.ios;
};

function WebStack({ children, spacing = 0, alignment = "stretch", style, direction = "column" }: any) {
  const alignItems = alignment === "center"
    ? "center"
    : alignment === "end"
      ? "flex-end"
      : alignment === "start"
        ? "flex-start"
        : "stretch";
  return <View style={[{ flexDirection: direction, gap: spacing, alignItems }, style]}>{children}</View>;
}

export function Column(props: any) {
  if (!IS_WEB) return React.createElement((ExpoUI as any).Column, props, props.children);
  return <WebStack {...props} direction="column" />;
}

export function Row(props: any) {
  if (!IS_WEB) return React.createElement((ExpoUI as any).Row, props, props.children);
  return <WebStack {...props} direction="row" />;
}

export function Spacer({ size = 8, flexible = false, ...rest }: any) {
  if (!IS_WEB) return React.createElement((ExpoUI as any).Spacer, { size, flexible, ...rest });
  return <View style={flexible ? { flex: 1 } : { width: size, height: size }} />;
}

export function Text({ children, textStyle, style, ...rest }: any) {
  if (!IS_WEB) {
    return React.createElement((ExpoUI as any).Text, { textStyle, style, ...rest }, children);
  }
  return <RNText style={[textStyle, style]} {...rest}>{children}</RNText>;
}

export function Button({ children, label, onPress, variant, style, disabled, enabled = true, ...rest }: any) {
  if (!IS_WEB) {
    return React.createElement(
      (ExpoUI as any).Button,
      { label, onPress, variant, style, disabled, enabled, ...rest },
      children,
    );
  }

  const isDisabled = Boolean(disabled) || enabled === false;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
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
          opacity: pressed ? 0.72 : isDisabled ? 0.45 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {children ?? (label ? <RNText>{label}</RNText> : null)}
    </Pressable>
  );
}

export function BottomSheet({ isPresented, onDismiss, children, ...rest }: any) {
  if (!IS_WEB) {
    return React.createElement((ExpoUI as any).BottomSheet, { isPresented, onDismiss, ...rest }, children);
  }
  return (
    <Modal visible={Boolean(isPresented)} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,.4)", justifyContent: "flex-end" }}
        onPress={onDismiss}
      >
        <Pressable
          onPress={(event) => event.stopPropagation?.()}
          style={{
            width: "100%",
            maxHeight: "70%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: "#171b2b",
            padding: 20,
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerBridge({ selectedValue, onValueChange, children, ...rest }: any) {
  if (!IS_WEB) {
    return React.createElement((ExpoUI as any).Picker, { selectedValue, onValueChange, ...rest }, children);
  }
  const items = React.Children.toArray(children) as React.ReactElement[];
  return React.createElement(
    "select",
    {
      value: selectedValue,
      onChange: (event: any) => onValueChange?.(event.target.value),
      style: {
        background: "transparent",
        border: 0,
        color: "inherit",
        font: "inherit",
        outline: "none",
      },
    },
    items.map((item: any) => React.createElement(
      "option",
      { key: item.props.value, value: item.props.value },
      item.props.label,
    )),
  );
}

(PickerBridge as any).Item = (props: any) => {
  if (IS_WEB) return null;
  return React.createElement((ExpoUI as any).Picker.Item, props);
};

export const Picker = PickerBridge as any;
