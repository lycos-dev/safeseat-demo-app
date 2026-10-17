import * as Clipboard from "expo-clipboard";
import { Alert, Linking } from "react-native";

/** Keeps digits and a single leading "+". Spaces, dashes and brackets are removed. */
export function sanitizeDialNumber(raw: string | null | undefined): string {
  const trimmed = String(raw ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

function offerCopy(number: string, title: string, message: string) {
  Alert.alert(title, message, [
    {
      text: "Copy number",
      onPress: () => {
        void Clipboard.setStringAsync(number).catch(() => undefined);
      },
    },
    { text: "OK", style: "cancel" },
  ]);
}

/**
 * Opens the phone's default dialer with the number pre-filled (it never places the call itself).
 *
 * We intentionally do NOT gate on Linking.canOpenURL("tel:"). On Android 11+ it returns false
 * unless package visibility is declared, which produced the false "dialer not available" error
 * on phones that do have a dialer. openURL is attempted directly and only a real failure
 * (tablet without telephony, invalid number...) falls back to offering the number to copy.
 */
export async function openPhoneDialer(rawNumber: string | null | undefined): Promise<boolean> {
  const number = sanitizeDialNumber(rawNumber);
  if (!number) {
    Alert.alert("No phone number", "This contact does not have a usable phone number.");
    return false;
  }
  try {
    await Linking.openURL(`tel:${number}`);
    return true;
  } catch (error) {
    console.warn("[SafeSeat/Call] Could not open the phone dialer", error);
    offerCopy(number, "Couldn't open the dialer", `This device didn't open its phone app. You can copy ${number} and dial it manually.`);
    return false;
  }
}

/** Opens the default messaging app with the number pre-filled. */
export async function openSmsComposer(rawNumber: string | null | undefined): Promise<boolean> {
  const number = sanitizeDialNumber(rawNumber);
  if (!number) {
    Alert.alert("No phone number", "This contact does not have a usable phone number.");
    return false;
  }
  try {
    await Linking.openURL(`sms:${number}`);
    return true;
  } catch (error) {
    console.warn("[SafeSeat/Call] Could not open the messaging app", error);
    offerCopy(number, "Couldn't open messages", `This device didn't open its messaging app. You can copy ${number} instead.`);
    return false;
  }
}
