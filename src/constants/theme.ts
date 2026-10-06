/**
 * SafeSeat visual system.
 * Dark mode remains the default low-glare vehicle theme. Light mode keeps the
 * same emerald brand accent while using high-contrast ink on soft neutral cards.
 */

import "@/global.css";
import { Platform } from "react-native";

export const DarkTheme = {
  mode: "dark" as const,
  text: "#F8FAFC",
  textSecondary: "#A9B7C8",
  textMuted: "#7D8EA3",
  background: "#0B1220",
  backgroundElement: "#111C2D",
  backgroundElevated: "#172437",
  backgroundSelected: "#123827",
  surfaceSoft: "#0E1828",
  divider: "#26364C",
  primaryBttn: "#34D17F",
  primaryBttnText: "#05160E",
  primarySoft: "#123827",
  primaryBorder: "#2A8F5E",
  secondaryBttn: "#213148",
  secondaryBttnText: "#F8FAFC",
  textInputPlaceholder: "#9EADBF",
  warnBttn: "#FF676F",
  warnBttnText: "#2A090C",
  lightOrange: "#F5C451",
  green: "#66E3A0",
  info: "#75B8FF",
  overlay: "rgba(3, 7, 15, 0.78)",
  cardTranslucent: "rgba(8,18,30,0.70)",
  carOverlay: "rgba(6,14,24,0.38)",
  shadow: "#000000",
} as const;

export const LightTheme = {
  mode: "light" as const,
  text: "#102033",
  textSecondary: "#4D6074",
  textMuted: "#728196",
  background: "#F4F8F6",
  backgroundElement: "#FFFFFF",
  backgroundElevated: "#FFFFFF",
  backgroundSelected: "#E4F7EC",
  surfaceSoft: "#EDF4F1",
  divider: "#D5E0DB",
  primaryBttn: "#168A52",
  primaryBttnText: "#FFFFFF",
  primarySoft: "#E1F4E9",
  primaryBorder: "#7CC59D",
  secondaryBttn: "#E7EEEB",
  secondaryBttnText: "#102033",
  textInputPlaceholder: "#77879A",
  warnBttn: "#D94B55",
  warnBttnText: "#FFFFFF",
  lightOrange: "#B46B00",
  green: "#137A49",
  info: "#286FB4",
  overlay: "rgba(16, 32, 51, 0.36)",
  cardTranslucent: "rgba(255,255,255,0.88)",
  carOverlay: "rgba(255,255,255,0.72)",
  shadow: "#183329",
} as const;

export type ThemePalette = typeof DarkTheme | typeof LightTheme;

// Legacy fallback for auth / untouched legacy code. The in-app screens use
// useTheme() so switching appearance updates immediately.
export const Themes = DarkTheme;
export type ThemeColor = keyof ThemePalette;
export const Colors = { light: LightTheme, dark: DarkTheme } as const;

export const Fonts = Platform.select({
  ios: { sans: "system-ui", serif: "ui-serif", rounded: "ui-rounded", mono: "ui-monospace" },
  default: { sans: "normal", serif: "serif", rounded: "normal", mono: "monospace" },
  web: { sans: "var(--font-display)", serif: "var(--font-serif)", rounded: "var(--font-rounded)", mono: "var(--font-mono)" },
});

export const Spacing = {
  none: 0, quarter: 2, half: 4, one: 8, two: 16, three: 24, four: 32,
  five: 40, six: 48, seven: 56, eight: 64, nine: 72, ten: 80, edge: 12,
} as const;

// R24: restore the original app-wide typography scale. Home uses local,
// slightly larger monitoring typography where glanceability matters most.
export const FontSize = {
  title: 30,
  pageHeader: 34,
  header: 22,
  body: 16,
  caption: 12,
  button: 15,
  giant: 60,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
