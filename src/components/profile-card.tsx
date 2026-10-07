import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type ProfileCardProps = {
  name?: string;
  img?: string;
  profileId?: string;
  isLast?: boolean;
  enabled?: boolean;
  onPress?: () => void;
};

const normalizeImage = (value?: string) => {
  if (!value || value === "Not Set" || value.trim() === "") return "";
  if (value.startsWith("http") || value.startsWith("data:")) return value;
  return `data:image/jpeg;base64,${value}`;
};

export default function ProfileCard({
  name = "Profile",
  img,
  profileId,
  isLast = false,
  enabled = true,
  onPress,
}: ProfileCardProps) {

  const themes = useTheme();
  const styles = createStyles(themes);  const [avatarUri, setAvatarUri] = useState(normalizeImage(img));

  useEffect(() => {
    const provided = normalizeImage(img);
    if (provided) {
      setAvatarUri(provided);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const cacheKey = profileId ? `profile_${profileId}` : "user_health_profile";
        const cachedHealth = await SecureStore.getItemAsync(cacheKey);
        if (!cachedHealth || cancelled) return;

        const parsed = JSON.parse(cachedHealth);
        const cachedImage = normalizeImage(parsed.icon || parsed.pfp || parsed.img);
        if (cachedImage) setAvatarUri(cachedImage);
      } catch (error) {
        console.error("Error loading cached avatar:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [img, profileId]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.baseCard,
        {
          borderBottomWidth: isLast ? 0 : 1,
          opacity: enabled ? (pressed ? 0.72 : 1) : 0.45,
        },
      ]}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.initial}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>
        </View>
      )}

      <View style={styles.copy}>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileMeta}>Tap to view or edit</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
  baseCard: {
    width: "100%",
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.one,
    paddingHorizontal: spacing.one + 4,
    paddingVertical: spacing.one,
    backgroundColor: themes.backgroundElement,
    borderBottomColor: themes.divider,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themes.primarySoft,
    borderWidth: 1,
    borderColor: themes.primaryBorder,
  },
  initial: {
    color: themes.primaryBttn,
    fontSize: 17,
    fontFamily: "Body-Bold",
  },
  copy: {
    flex: 1,
  },
  profileName: {
    color: themes.text,
    fontFamily: "Body-Bold",
    fontSize: fontsize.body,
  },
  profileMeta: {
    color: themes.textMuted,
    fontFamily: "Body-Regular",
    fontSize: 10.5,
    marginTop: 2,
  },
  chevron: { color: themes.textMuted, fontSize: 24, lineHeight: 24, fontFamily: "Body-Regular" },
});
