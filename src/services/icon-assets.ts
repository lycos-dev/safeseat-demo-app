import { Asset } from "expo-asset";

// Keep static requires: Metro must include every drawable in the offline APK.
export const ANDROID_ICON_MODULES: number[] = [
  require("@expo/material-symbols/add.xml"),
  require("@expo/material-symbols/airline_seat_recline_extra.xml"),
  require("@expo/material-symbols/call.xml"),
  require("@expo/material-symbols/chat.xml"),
  require("@expo/material-symbols/check.xml"),
  require("@expo/material-symbols/circle.xml"),
  require("@expo/material-symbols/close.xml"),
  require("@expo/material-symbols/directions_car.xml"),
  require("@expo/material-symbols/edit.xml"),
  require("@expo/material-symbols/group.xml"),
  require("@expo/material-symbols/groups.xml"),
  require("@expo/material-symbols/home.xml"),
  require("@expo/material-symbols/lock_open.xml"),
  require("@expo/material-symbols/settings.xml"),
  require("@expo/material-symbols/siren.xml"),
  require("@expo/material-symbols/unfold_more.xml"),
  require("@expo/material-symbols/visibility.xml"),
  require("@expo/material-symbols/visibility_off.xml"),
  require("@expo/material-symbols/warning.xml"),
];

const localSources = new Map<number, { uri: string }>();
let preload: Promise<void> | undefined;

export function preloadAndroidIcons(): Promise<void> {
  if (!preload) {
    preload = Promise.all(ANDROID_ICON_MODULES.map(async (moduleId) => {
      const asset = await Asset.fromModule(moduleId).downloadAsync();
      if (!asset.localUri) throw new Error(`No local URI for icon ${asset.name}`);
      localSources.set(moduleId, { uri: asset.localUri });
    })).then(() => undefined).catch((error) => {
      preload = undefined;
      throw error;
    });
  }
  return preload;
}

export function getAndroidIconSource(name: unknown): unknown {
  // App call sites use static XML module IDs. A file URI also avoids the
  // Expo UI raw-resource XML/bitmap fallback in standalone Android builds.
  if (typeof name !== "number") return name;
  const source = localSources.get(name);
  if (!source) throw new Error(`Android icon ${name} was not preloaded`);
  return source;
}
