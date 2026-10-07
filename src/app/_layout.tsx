import { Themes as themes } from "@/constants/theme";
import { Stack, useRouter, useSegments } from "expo-router";
import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";
import { useEffect, useState } from "react";
import { auth } from "@/firebase";
import { saveUserProfile } from "@/services/user-profile";
export { ErrorBoundary } from "expo-router";

import { useColorScheme, View } from "react-native";

import {
	Inter_400Regular,
	Inter_400Regular_Italic,
	Inter_500Medium,
	Inter_600SemiBold,
	Inter_700Bold,
	Inter_900Black,
	useFonts,
} from "@expo-google-fonts/inter";

import * as SplashScreen from "expo-splash-screen";
// ⚠️ FIXED: Removed the broken "@expo/ui/swift-ui/modifiers" import

// Keep the splash screen visible while fonts and auth initialize
SplashScreen.preventAutoHideAsync();

import * as SystemUI from 'expo-system-ui';
import { BannerProvider } from "@/hooks/banner-context";

// Force the underlying native iOS frame window to change colors
SystemUI.setBackgroundColorAsync("#101322")


export default function RootLayout() {
	const colorScheme = useColorScheme();
	const [loaded, error] = useFonts({
		"Heading-Font": Inter_600SemiBold,
		"Logo-Font": Inter_900Black,
		"Body-Regular": Inter_400Regular,
		"Body-Regular-Italic": Inter_400Regular_Italic,
		"Body-Bold": Inter_700Bold,
		"Body-Medium": Inter_500Medium,
		"Condensed-Regular": Inter_400Regular,
		"Condensed-Regular-Italic": Inter_400Regular_Italic
	});

	const router = useRouter();
	const segments = useSegments();

	const [authLoading, setAuthLoading] = useState(true);
	const [hasSession, setHasSession] = useState(false);


	// Wait for Firebase persistence before trusting the local completed-login flag.
	useEffect(() => {
		let active = true;
		async function checkAuthSession() {
			try {
				await auth.authStateReady();
				const sessionFlag = await getLocalValue("is_logged_in");
				if (active) setHasSession(sessionFlag === "true" && auth.currentUser !== null);
			} catch (e) {
				console.error("Failed to read auth token from local device:", e);
				if (active) setHasSession(false);
			} finally {
				if (active) setAuthLoading(false);
			}
		}
		checkAuthSession();
		return () => { active = false; };
	}, [segments]); // Check session status when navigation routes shift

	useEffect(() => {
		if (hasSession && auth.currentUser) {
			// Older installations can already be logged in without a user document.
			void saveUserProfile(auth.currentUser).catch((error) => {
				console.warn("Could not restore the account profile; profile saves can retry:", error);
			});
		}
	}, [hasSession]);

	// 2. Control when the native splash screen hides safely
	useEffect(() => {
		if (loaded && !authLoading) {
			SplashScreen.hideAsync();
		}
	}, [loaded, authLoading]);

	// 3. Complete Navigation Authentication Guard Logic
	useEffect(() => {
		// Wait until both fonts are ready and auth state has been parsed from SecureStore
		if (!loaded || authLoading) return;

		const inAuthGroup = segments[0] === "(auth)";

		if (!hasSession && !inAuthGroup) {
			// User is NOT logged in and trying to go to tabs -> send them to the login flow
			router.replace("/(auth)/splash");
		} else if (hasSession && inAuthGroup) {
			// User IS logged in but accidentally went back to splash/login -> force them back inside
			router.replace("/(tabs)/home");
		}
	}, [segments, loaded, authLoading, hasSession]);

	// Prevent rendering stack screens if basic system elements aren't initialized yet
	if (!loaded || authLoading) {
		return null;
	}

	const CustomTheme = {
		colors: {
			background: "#101322" // This fixes your keyboard white flashing issue!
		}
	};

	return (
		<>
			{/* The View wrapper guarantees that the React Native layer remains your theme color */}
			<BannerProvider>
				<View style={{ backgroundColor: themes.background || "#101322", flex: 1 }}>
					<Stack screenOptions={{
						headerShown: false,
						contentStyle: {
							backgroundColor: themes.background,
						},
					}}>
						<Stack.Screen name="(auth)" />
						<Stack.Screen name="(tabs)" />
					</Stack>
				</View>
			</BannerProvider>
		</>
	);
}
