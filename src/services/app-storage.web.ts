// Web-safe drop-in replacement for expo-secure-store.
// The hosted demo runs in a browser, where expo-secure-store has no native module.
// Keep this module differently named from expo-secure-store to avoid self-import cycles.
const prefix = "safeseat.secure.";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return getStorage()?.getItem(`${prefix}${key}`) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    getStorage()?.setItem(`${prefix}${key}`, value);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    getStorage()?.removeItem(`${prefix}${key}`);
  } catch {
    // Best-effort browser persistence only.
  }
}
