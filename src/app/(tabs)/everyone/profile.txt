import { FontSize as fontsize, Spacing as spacing, Themes as themes } from "@/constants/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Dimensions,
	Image,
	ImageBackground,
	Keyboard,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TouchableWithoutFeedback,
	View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

import Button from "@/components/button";
import TextInput from "@/components/text-input";
import { Dropdown } from "react-native-element-dropdown";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebase";

import { useNavigation } from "expo-router";

const { width: screenWidth } = Dimensions.get("window");

const bloodTypes = [
	{ label: "A+", value: "a+" },
	{ label: "A-", value: "a-" },
	{ label: "B+", value: "b+" },
	{ label: "B-", value: "b-" },
	{ label: "AB+", value: "ab+" },
	{ label: "AB-", value: "ab-" },
	{ label: "O+", value: "o+" },
	{ label: "O-", value: "o-" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const isLeapYear = (year: number): boolean => {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const daysInMonth = (year: number, month: number): number => {
	const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return days[month - 1] ?? 31;
};

// Pure int validation, no Date object involved anywhere.
const isValidDateParts = (year: number, month: number, day: number): boolean => {
	if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > daysInMonth(year, month)) return false;
	return true;
};

// Pure arithmetic age check — no Date object round-trips for the birthday itself.
const isUnder18Parts = (year: number, month: number, day: number): boolean => {
	if (!isValidDateParts(year, month, day)) return true;

	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth() + 1;
	const currentDay = today.getDate();

	const age = currentYear - year;

	if (age > 18) return false;
	if (age < 18) return true;

	if (month < currentMonth) return false;
	if (month > currentMonth) return true;

	return day > currentDay;
};

// Birthday is stored as three separate int64 fields in Firestore: birthYear,
// birthMonth, birthDate.
const extractBirthdayParts = (data: any): { year: number; month: number; day: number } | null => {
	if (!data) return null;

	const hasSeparateFields =
		data.birthYear !== undefined && data.birthYear !== null &&
		data.birthMonth !== undefined && data.birthMonth !== null &&
		((data.birthDate !== undefined && data.birthDate !== null) ||
			(data.birthDay !== undefined && data.birthDay !== null));

	if (hasSeparateFields) {
		const y = Number(data.birthYear);
		const m = Number(data.birthMonth);
		const d = Number(data.birthDate ?? data.birthDay);
		return isValidDateParts(y, m, d) ? { year: y, month: m, day: d } : null;
	}

	const legacy = data.birthday;
	if (legacy && legacy !== "Not Set") {
		if (typeof legacy === "object") {
			const y = Number(legacy.birthYear ?? legacy.year);
			const m = Number(legacy.birthMonth ?? legacy.month);
			const d = Number(legacy.birthDay ?? legacy.day);
			return isValidDateParts(y, m, d) ? { year: y, month: m, day: d } : null;
		}
		if (typeof legacy === "string") {
			const match = legacy.match(/^(\d{4})-(\d{2})-(\d{2})/);
			if (match) {
				const y = parseInt(match[1], 10);
				const m = parseInt(match[2], 10);
				const d = parseInt(match[3], 10);
				return isValidDateParts(y, m, d) ? { year: y, month: m, day: d } : null;
			}
		}
	}

	return null;
};

import * as ImagePicker from "expo-image-picker";

export default function Profile() {
	const router = useRouter();

	const { profileId } = useLocalSearchParams<{ profileId?: string }>();
	const isSubProfile = !!profileId;
	const cacheKey = isSubProfile ? `profile_${profileId}` : "user_health_profile";

	// Original data references for checking discard state changes
	const originalDataRef = useRef<any>({});
	const skipNextConversion = useRef(false);

	// 1. Core Account States
	const [userName, setUserName] = useState<string>("Guest");
	const [userIcon, setUserIcon] = useState<string>("");
	const [userEmail, setUserEmail] = useState<string>("Not Set");
	const [userPhone, setUserPhone] = useState<string>("Not Set");

	// 2. Health Metrics States
	const [height, setHeight] = useState<string>("Not Set");
	const [weight, setWeight] = useState<string>("Not Set");
	const [bloodType, setBloodType] = useState<string>("Not Set");
	const [allergies, setAllergies] = useState<string>("None Stored");

	const [birthYear, setBirthYear] = useState<string>("");
	const [birthMonth, setBirthMonth] = useState<string>("");
	const [birthDate, setBirthDate] = useState<string>("");

	// Imperial height split local editing states
	const [tempFeet, setTempFeet] = useState<string>("");
	const [tempInches, setTempInches] = useState<string>("");
	const [tempLbs, setTempLbs] = useState<string>("");

	// 3. Unit Preference State
	const [isMetric, setIsMetric] = useState<boolean>(true);

	// 4. UI Interaction State
	const [editMode, setEditMode] = useState(false);
	const [saving, setSaving] = useState(false);

	const navigation = useNavigation();
	const unsavedRef = useRef(false);

	useEffect(() => {
		unsavedRef.current = editMode && hasUnsavedChanges();
	});

	useEffect(() => {
		const unsubscribe = navigation.addListener("beforeRemove", (e) => {
			if (!unsavedRef.current) {
				return;
			}

			e.preventDefault();

			Alert.alert(
				"Discard changes?",
				"You have unsaved changes. If you leave now, they'll be lost.",
				[
					{ text: "Stay", style: "cancel" },
					{
						text: "Discard",
						style: "destructive",
						onPress: () => navigation.dispatch(e.data.action),
					},
				]
			);
		});

		return unsubscribe;
	}, [navigation]);

	const loadAllUserData = useCallback(async () => {
		try {
			const currentUser = auth.currentUser;
			if (!currentUser) return;

			const savedPrivacyString = await SecureStore.getItemAsync("user_privacy_prefs");
			if (savedPrivacyString) {
				const savedPrivacy = JSON.parse(savedPrivacyString);
				if (savedPrivacy.useMetric !== undefined) setIsMetric(savedPrivacy.useMetric);
			}

			const cachedHealth = await SecureStore.getItemAsync(cacheKey);
			if (cachedHealth) {
				const localData = JSON.parse(cachedHealth);
				const bdayParts = extractBirthdayParts(localData);

				const loadedData = {
					name: localData.name || "Guest",
					icon: localData.icon || localData.pfp || "Not Set",
					email: localData.email || "Not Set",
					phone: localData.phone || "Not Set",
					birthYear: bdayParts ? bdayParts.year : null,
					birthMonth: bdayParts ? bdayParts.month : null,
					birthDate: bdayParts ? bdayParts.day : null,
					height: localData.height || "Not Set",
					weight: localData.weight || "Not Set",
					bloodType: localData.bloodType || "Not Set",
					allergies: localData.allergies || "None Stored",
				};

				originalDataRef.current = loadedData;

				setUserName(loadedData.name);
				setUserIcon(loadedData.icon);
				setUserEmail(loadedData.email);
				setUserPhone(loadedData.phone);
				setBirthYear(bdayParts ? String(bdayParts.year) : "");
				setBirthMonth(bdayParts ? String(bdayParts.month) : "");
				setBirthDate(bdayParts ? String(bdayParts.day) : "");
				setHeight(loadedData.height);
				setWeight(loadedData.weight);
				setBloodType(loadedData.bloodType);
				setAllergies(loadedData.allergies);

				const cmVal = parseFloat(loadedData.height.replace(/[^0-9.]/g, ""));
				if (!isNaN(cmVal)) {
					const totalInches = cmVal / 2.54;
					setTempFeet(String(Math.floor(totalInches / 12)));
					setTempInches(String(Math.round(totalInches % 12)));
				} else {
					setTempFeet("");
					setTempInches("");
				}
			}

			const settingsDocRef = doc(db, "users", currentUser.uid, "settings", "preferences");
			const settingsDocSnap = await getDoc(settingsDocRef);
			if (settingsDocSnap.exists()) {
				const settingsData = settingsDocSnap.data();
				if (settingsData.useMetric !== undefined) {
					setIsMetric(settingsData.useMetric);
					await SecureStore.setItemAsync("user_privacy_prefs", JSON.stringify({ useMetric: settingsData.useMetric }));
				}
			}

			let cloudData: any = null;
			if (isSubProfile) {
				const profileDocRef = doc(db, "users", currentUser.uid, "profiles", profileId as string);
				const profileDocSnap = await getDoc(profileDocRef);
				if (profileDocSnap.exists()) {
					cloudData = profileDocSnap.data();
				}
			} else {
				const userDocRef = doc(db, "users", currentUser.uid);
				const userDocSnap = await getDoc(userDocRef);
				if (userDocSnap.exists()) {
					cloudData = userDocSnap.data();
				}
			}

			if (cloudData) {
				const nameVal = cloudData.name || "Guest";
				const iconVal = cloudData.icon || "Not Set";
				const emailVal = cloudData.email || "Not Set";
				const phoneVal = cloudData.phone || "Not Set";

				const bdayParts = extractBirthdayParts(cloudData);

				const heightVal = cloudData.heightCm !== undefined ? `${cloudData.heightCm}` : (cloudData.height || "Not Set");
				const weightVal = cloudData.weightKg !== undefined ? `${cloudData.weightKg}` : (cloudData.weight || "Not Set");
				const bloodVal = cloudData.bloodType || "Not Set";
				const allergyVal = cloudData.allergies || "None Stored";

				const loadedCloudData = {
					name: nameVal,
					icon: iconVal,
					email: emailVal,
					phone: phoneVal,
					birthYear: bdayParts ? bdayParts.year : null,
					birthMonth: bdayParts ? bdayParts.month : null,
					birthDate: bdayParts ? bdayParts.day : null,
					height: heightVal,
					weight: weightVal,
					bloodType: bloodVal,
					allergies: allergyVal,
				};

				originalDataRef.current = loadedCloudData;

				setUserName(nameVal);
				setUserIcon(iconVal);
				setUserEmail(emailVal);
				setUserPhone(phoneVal);
				setBirthYear(bdayParts ? String(bdayParts.year) : "");
				setBirthMonth(bdayParts ? String(bdayParts.month) : "");
				setBirthDate(bdayParts ? String(bdayParts.day) : "");
				setHeight(heightVal);
				setWeight(weightVal);
				setBloodType(bloodVal);
				setAllergies(allergyVal);

				const cmVal = parseFloat(heightVal.replace(/[^0-9.]/g, ""));
				if (!isNaN(cmVal)) {
					const totalInches = cmVal / 2.54;
					setTempFeet(String(Math.floor(totalInches / 12)));
					setTempInches(String(Math.round(totalInches % 12)));
				} else {
					setTempFeet("");
					setTempInches("");
				}

				const kgVal = parseFloat(weightVal.replace(/[^0-9.]/g, ""));
				if (!isNaN(kgVal)) {
					setTempLbs(String(Math.round(kgVal * 2.20462)));
				} else {
					setTempLbs("");
				}

				await SecureStore.setItemAsync(cacheKey, JSON.stringify(loadedCloudData));
			}
		} catch (error) {
			console.error("Error syncing cache with Firestore:", error);
		}
	}, [profileId, cacheKey, isSubProfile]);

	useFocusEffect(
		useCallback(() => {
			loadAllUserData();
		}, [loadAllUserData]),
	);

	useEffect(() => {
		if (editMode && !skipNextConversion.current) {
			skipNextConversion.current = true;
			return;
		}
		if (!editMode) {
			skipNextConversion.current = false;
			return;
		}

		if (!isMetric) {
			const feetNum = parseFloat(tempFeet);
			const inchesNum = parseFloat(tempInches || "0");

			if (!isNaN(feetNum) && feetNum >= 0) {
				const totalInches = (feetNum * 12) + (isNaN(inchesNum) ? 0 : inchesNum);
				const computedCm = totalInches * 2.54;
				setHeight(String(Math.round(computedCm * 10) / 10));
			} else if (tempFeet === "" && tempInches === "") {
				setHeight("Not Set");
			}

			const lbsNum = parseFloat(tempLbs);

			if (!isNaN(lbsNum) && lbsNum >= 0) {
				const computedKg = lbsNum / 2.20462;
				setWeight(String(Math.round(computedKg * 10) / 10));
			} else if (tempLbs === "") {
				setWeight("Not Set");
			}
		}
	}, [tempFeet, tempInches, tempLbs, isMetric, editMode]);

	const validateForm = () => {
		if (userName.trim() === "") return false;
		if (birthYear.trim() === "" || birthMonth.trim() === "" || birthDate.trim() === "") return false;

		if (isMetric) {
			if (height.trim() === "" || height === "Not Set") return false;
			if (weight.trim() === "" || weight === "Not Set") return false;
		} else {
			if (tempFeet.trim() === "" || tempInches.trim() === "") return false;
			if (weight.trim() === "" || weight === "Not Set") return false;
		}

		const yVal = birthYear.trim();
		const mVal = birthMonth.trim();
		const dVal = birthDate.trim();

		if (yVal !== "" || mVal !== "" || dVal !== "") {
			const y = parseInt(yVal, 10);
			const m = parseInt(mVal, 10);
			const d = parseInt(dVal, 10);

			if (!isValidDateParts(y, m, d)) return false;

			const currentYear = new Date().getFullYear();
			if (y < 1900 || y > currentYear) return false;

			if (isUnder18Parts(y, m, d)) return false;
		}

		if (!isMetric) {
			const fVal = tempFeet.trim();
			const iVal = tempInches.trim();

			if (fVal !== "" || iVal !== "") {
				const f = parseFloat(fVal);
				const i = parseFloat(iVal || "0");

				if (isNaN(f) || f < 0 || f > 10) return false;
				if (isNaN(i) || i < 0 || i >= 12) return false;
			}
		}

		return true;
	};

	const isFormValid = validateForm();

	const hasUnsavedChanges = () => {
		const orig = originalDataRef.current;
		const origYear = orig.birthYear !== null && orig.birthYear !== undefined ? String(orig.birthYear) : "";
		const origMonth = orig.birthMonth !== null && orig.birthMonth !== undefined ? String(orig.birthMonth) : "";
		const origDay = orig.birthDate !== null && orig.birthDate !== undefined ? String(orig.birthDate) : "";

		const origHeightCm = parseFloat(orig.height ? orig.height.replace(/[^0-9.]/g, "") : "");
		let origFeet = "";
		let origInches = "";
		if (!isNaN(origHeightCm)) {
			const totalInches = origHeightCm / 2.54;
			origFeet = String(Math.floor(totalInches / 12));
			origInches = String(Math.round(totalInches % 12));
		}

		return (
			userName !== orig.name ||
			userIcon !== orig.icon ||
			height !== orig.height ||
			weight !== orig.weight ||
			bloodType !== orig.bloodType ||
			allergies !== orig.allergies ||
			birthYear !== origYear ||
			birthMonth !== origMonth ||
			birthDate !== origDay ||
			(!isMetric && (tempFeet !== origFeet || tempInches !== origInches))
		);
	};

	const handleCancelEdit = () => {
		if (hasUnsavedChanges()) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			Alert.alert(
				"Discard?",
				"You have unsaved changes. Discard?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Discard",
						style: "destructive",
						onPress: () => {
							loadAllUserData();
							setEditMode(false);
						}
					}
				]
			);
		} else {
			setEditMode(false);
		}
	};

	const handleSaveChanges = async () => {
		if (!isFormValid) return;

		try {
			setSaving(true);
			const currentUser = auth.currentUser;
			if (!currentUser) return;

			const y = parseInt(birthYear, 10);
			const m = parseInt(birthMonth, 10);
			const d = parseInt(birthDate, 10);
			const validBday = isValidDateParts(y, m, d);

			const updatedProfile = {
				name: userName,
				icon: userIcon,
				email: userEmail,
				phone: userPhone,
				birthYear: validBday ? y : null,
				birthMonth: validBday ? m : null,
				birthDate: validBday ? d : null,
				height: height,
				weight: weight,
				bloodType: bloodType,
				allergies: allergies,
			};

			await SecureStore.setItemAsync(cacheKey, JSON.stringify(updatedProfile));

			const cleanHeightNum = height !== "Not Set" ? parseFloat(height.replace(/[^0-9.]/g, "")) : null;
			const cleanWeightNum = weight !== "Not Set" ? parseFloat(weight.replace(/[^0-9.]/g, "")) : null;

			const firestorePayload: any = {
				name: userName,
				icon: userIcon,
				email: userEmail,
				phone: userPhone,
				bloodType: bloodType,
				allergies: allergies,
				birthYear: validBday ? y : null,
				birthMonth: validBday ? m : null,
				birthDate: validBday ? d : null,
			};

			if (cleanHeightNum !== null && !isNaN(cleanHeightNum)) {
				firestorePayload.heightCm = cleanHeightNum;
				firestorePayload.height = String(cleanHeightNum);
			}
			if (cleanWeightNum !== null && !isNaN(cleanWeightNum)) {
				firestorePayload.weightKg = cleanWeightNum;
				firestorePayload.weight = String(cleanWeightNum);
			}

			const profileDocRef = isSubProfile
				? doc(db, "users", currentUser.uid, "profiles", profileId as string)
				: doc(db, "users", currentUser.uid);

			await updateDoc(profileDocRef, firestorePayload);
			setEditMode(false);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		} catch (error) {
			Alert.alert("Failed to save changes");
			console.error("Failed to save changes: ", error);
		} finally {
			setSaving(false);
		}
	};

	const getDisplayHeight = () => {
		if (!height || height === "Not Set") return "Not Set";
		const cmValue = parseFloat(height.replace(/[^0-9.]/g, ""));
		if (isNaN(cmValue)) return height;

		if (isMetric) {
			return `${cmValue} cm`;
		} else {
			const totalInches = cmValue / 2.54;
			const feet = Math.floor(totalInches / 12);
			const inches = Math.round(totalInches % 12);
			return `${feet}' ${inches}"`;
		}
	};

	const getDisplayWeight = () => {
		if (!weight || weight === "Not Set") return "Not Set";
		const kgValue = parseFloat(weight.replace(/[^0-9.]/g, ""));
		if (isNaN(kgValue)) return weight;

		if (isMetric) {
			return `${kgValue} kg`;
		} else {
			const lbsValue = Math.round(kgValue * 2.20462);
			return `${lbsValue} lbs`;
		}
	};

	const getFormattedDate = () => {
		const y = parseInt(birthYear, 10);
		const m = parseInt(birthMonth, 10);
		const d = parseInt(birthDate, 10);
		if (!isValidDateParts(y, m, d)) return "Not Set";
		return `${MONTH_NAMES[m - 1]} ${String(d).padStart(2, "0")}, ${y}`;
	};

	const getAge = () => {
		const y = parseInt(birthYear, 10);
		const m = parseInt(birthMonth, 10);
		const d = parseInt(birthDate, 10);
		if (!isValidDateParts(y, m, d)) return "Not Set";

		const now = new Date();
		const todayYear = now.getFullYear();
		const todayMonth = now.getMonth() + 1;
		const todayDay = now.getDate();

		let age = todayYear - y;
		const monthDifference = todayMonth - m;

		if (monthDifference < 0 || (monthDifference === 0 && todayDay < d)) {
			age--;
		}
		return age.toString();
	};

	const getZodiacSign = () => {
		const y = parseInt(birthYear, 10);
		const month = parseInt(birthMonth, 10);
		const day = parseInt(birthDate, 10);
		if (!isValidDateParts(y, month, day)) return "Not Set";

		if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
		if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
		if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
		if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
		if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
		if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
		if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
		if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
		if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
		if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
		if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
		if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";

		return "Not Set";
	};

	const [keyboardHeight, setKeyboardHeight] = useState(0);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const showSub = Keyboard.addListener(showEvent, (e) => {
			setKeyboardHeight(e.endCoordinates.height);
		});
		const hideSub = Keyboard.addListener(hideEvent, () => {
			setKeyboardHeight(0);
		});

		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	const insets = useSafeAreaInsets();
	const bottomPad = 104 + (insets.bottom / 2);

	const handlePickImage = async () => {
		const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (!permissionResult.granted) {
			Alert.alert("Permission Required", "You need to allow access to your photos to change your profile picture.");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.3,
			base64: true,
		});

		if (!result.canceled && result.assets[0].base64) {
			const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
			setUserIcon(base64Image);
		}
	};

	useEffect(() => {
		setUserName("");
		setUserIcon("");
		setUserEmail("");
		setUserPhone("");
		setHeight("");
		setWeight("");
		setBloodType("");
		setAllergies("");
		setBirthYear("");
		setBirthMonth("");
		setBirthDate("");
		setTempFeet("");
		setTempInches("");
		setTempLbs("");
		originalDataRef.current = {};
	}, [profileId, cacheKey]);

	const [isLoaded, setIsLoaded] = useState(false);
	useFocusEffect(
		useCallback(() => {
			let isMounted = true;
			setIsLoaded(false);

			loadAllUserData().then(() => {
				if (isMounted) setIsLoaded(true);
			});

			return () => {
				isMounted = false;
			};
		}, [loadAllUserData])
	);

	if (!isLoaded) {
		return (
			<View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: themes.background }}>
				<ActivityIndicator color={themes.text} size="large" />
			</View>
		);
	}

	const handleDeleteProfile = () => {
		Alert.alert(
			`Nuke ${userName}?`,
			`Are you sure you want to nuke ${userName}? This action can't be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Nuke",
					style: "destructive",
					onPress: async () => {
						try {
							setSaving(true);
							const currentUser = auth.currentUser;
							if (!currentUser || !isSubProfile) return;

							const profileDocRef = doc(db, "users", currentUser.uid, "profiles", profileId as string);
							await deleteDoc(profileDocRef);

							await SecureStore.deleteItemAsync(cacheKey);

							Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
							router.back();
						} catch (error) {
							Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
							Alert.alert("Failed to nuke profile");
							console.error("Failed to nuke profile: ", error);
						} finally {
							setSaving(false);
						}
					},
				},
			]
		);
	};

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: themes.background }}
			edges={["left", "right", "bottom"]}
		>
			<TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
				<KeyboardAwareScrollView contentContainerStyle={[{ flexGrow: 1 }, { marginTop: spacing.one, paddingBottom: bottomPad }]} showsVerticalScrollIndicator={true} bounces={true} extraScrollHeight={spacing.ten}>
					<View style={[styles.container, { marginTop: -spacing.two }]}>
						<View style={{
							flexDirection: "column",
							alignItems: "center",
							marginBottom: spacing.none,
							gap: spacing.two,
						}}>
							<Pressable
								disabled={!editMode}
								onPress={handlePickImage}
								style={{
									backgroundColor: editMode ? "rgba(0, 0, 0, 0.5)" : "transparent",
									borderWidth: spacing.half,
									borderColor: themes.text,
									borderRadius: spacing.eight,
									overflow: "hidden",
								}}
							>
								<Image
									source={
										!userIcon || userIcon === "Not Set" || userIcon === ""
											? { uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNyV3QnQOwXP124try4wkWE0xXqxT6KZitbq4TerzfLkMDDY-v1CXzTGw&s=10" }
											: { uri: userIcon }
									}
									style={{
										width: 120,
										height: 120,
										opacity: editMode ? 0.5 : 1,
										alignItems: "center",
										justifyContent: "center"
									}}
								/>
								{editMode &&
									<Text style={{
										fontSize: fontsize.button,
										color: themes.text,
										fontFamily: "Body-Medium",
										opacity: 1,
										position: "absolute",
										top: 48,
										left: 46,
									}}>edit</Text>
								}
							</Pressable>
							<Text style={[styles.pageHeader, { color: themes.text, flex: 1 }]}>
								{userName.split(" ")[0]}
							</Text>
						</View>

						<View style={{ gap: spacing.three }}>

							<View style={{ gap: spacing.one }}>
								<Text style={{
									fontFamily: "Heading-Font",
									color: themes.text,
									fontSize: fontsize.header,
									marginTop: spacing.one,
								}}>
									Basic Information
								</Text>

								<View style={{ borderRadius: spacing.edge, overflow: "hidden" }}>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Name:
										</Text>
										{editMode ? (
											<View style={{ flex: 1 }}>
												<TextInput
													type="text"
													value={userName}
													onChangeText={setUserName}
													placeholder="Name"
													enabled={!saving}
												/>
											</View>
										) : (
											<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
												{userName}
											</Text>
										)}
									</View>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Birthday:
										</Text>
										{editMode ? (
											<View style={{ flex: 1, flexDirection: "row", gap: spacing.one }}>
												<View style={{ flex: 1 }}>
													<TextInput
														type="number"
														value={birthMonth}
														onChangeText={setBirthMonth}
														placeholder="MM"
														enabled={!saving}
													/>
												</View>
												<View style={{ flex: 1 }}>
													<TextInput
														type="number"
														value={birthDate}
														onChangeText={setBirthDate}
														placeholder="DD"
														enabled={!saving}
													/>
												</View>
												<View style={{ flex: 1 }}>
													<TextInput
														type="number"
														value={birthYear}
														onChangeText={setBirthYear}
														placeholder="YYYY"
														enabled={!saving}
													/>
												</View>
											</View>
										) : (
											<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
												{getFormattedDate()}
											</Text>
										)}
									</View>

									<View style={[styles.fixedFieldContainer, styles.notLast, { backgroundColor: themes.backgroundElement, borderTopLeftRadius: editMode ? spacing.edge : spacing.none, borderTopRightRadius: editMode ? spacing.edge : spacing.none }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Age:
										</Text>
										<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
											{getAge()}
										</Text>
									</View>

									<View style={[styles.fixedFieldContainer, { backgroundColor: themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Sun Sign:
										</Text>
										<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
											{getZodiacSign()}
										</Text>
									</View>
								</View>
							</View>

							<View style={{ gap: spacing.one }}>
								<Text style={{
									fontFamily: "Heading-Font",
									color: themes.text,
									fontSize: fontsize.header,
									marginTop: spacing.one,
								}}>
									Health Information
								</Text>

								<View style={{ borderRadius: spacing.edge, overflow: "hidden" }}>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Height:
										</Text>

										{editMode ? (
											!isMetric ? (
												<>
													<View style={{ flex: 1 }}>
														<TextInput
															type="number"
															value={tempFeet}
															placeholder="(ft)"
															onChangeText={setTempFeet}
															enabled={!saving}
														/>
													</View>

													<View style={{ flex: 1 }}>
														<TextInput
															type="number"
															value={tempInches}
															placeholder="(in)"
															onChangeText={setTempInches}
															enabled={!saving}
														/>
													</View>
												</>
											) : (
												<>
													<View style={{ flex: 1 }}>
														<TextInput
															type="number"
															value={height}
															placeholder="(cm)"
															onChangeText={setHeight}
															enabled={!saving}
														/>
													</View>
												</>
											)) : (
											<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
												{getDisplayHeight()}
											</Text>
										)}

									</View>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Weight:
										</Text>
										{editMode ? (
											<View style={{ flex: 1 }}>
												<TextInput
													type="number"
													value={isMetric ? weight : tempLbs}
													placeholder={isMetric ? "(kg)" : "(lb)"}
													enabled={!saving}
													onChangeText={(val) => {
														if (isMetric) {
															setWeight(val);
														} else {
															setTempLbs(val);
															const lbsNum = parseFloat(val);
															if (!isNaN(lbsNum) && lbsNum >= 0) {
																const computedKg = lbsNum / 2.20462;
																setWeight(String(Math.round(computedKg * 10) / 10));
															} else {
																setWeight("Not Set");
															}
														}
													}}
												/>
											</View>
										) : (
											<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
												{getDisplayWeight()}
											</Text>
										)}
									</View>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Blood Type:
										</Text>
										{editMode ? (
											<View style={{ flex: 1 }}>
												<Dropdown
													mode="default"
													data={bloodTypes}
													labelField="label"
													valueField="value"
													selectedTextStyle={{ color: themes.text, fontFamily: "Body-Medium" }}
													placeholder="Blood Type"
													placeholderStyle={{ color: themes.textInputPlaceholder }}
													value={bloodType}
													disable={saving}
													style={[
														styles.input
													]}
													containerStyle={{
														backgroundColor: themes.backgroundElement,
														borderRadius: spacing.edge,
														borderWidth: spacing.quarter,
														borderColor: themes.secondaryBttn,
														overflow: "hidden",
														gap: spacing.none,
														flex: 1,
													}}
													itemTextStyle={{
														color: themes.text,
														margin: spacing.none,
														padding: spacing.none,
														fontFamily: "Body-Medium"
													}}
													itemContainerStyle={{
														margin: spacing.none,
														marginHorizontal: spacing.none,
														padding: spacing.none,
														borderBottomWidth: spacing.quarter,
														borderColor: themes.secondaryBttn,
														flex: 1,
													}}
													activeColor={themes.primaryBttn}
													maxHeight={spacing.ten * 3}
													onChange={(item) => setBloodType(item.value)}
													autoScroll={false}
												/>
											</View>
										) : (
											<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
												{bloodTypes.find(bt => bt.value === bloodType)?.label ?? "Not Set"}
											</Text>
										)}
									</View>

									<View style={[styles.fixedFieldContainer, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Allergies:
										</Text>
										{editMode ? (
											<View style={{ flex: 1 }}>
												<TextInput
													type="text"
													value={allergies}
													onChangeText={setAllergies}
													placeholder="(e.g. peanuts)"
													enabled={!saving}
												/>
											</View>
										) : (
											<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
												{allergies}
											</Text>
										)}
									</View>
								</View>
							</View>

							<View style={{ flexDirection: "column", gap: spacing.one }}>
								<View style={{ flexDirection: "row", gap: spacing.one }}>
									{editMode &&
										<View style={{}}>
											<Button
												variant="secondary"
												label={hasUnsavedChanges() ? "Discard" : "Cancel"}
												onPress={() => { handleCancelEdit(); }}
												enabled={!saving}
											/>
										</View>
									}
									<View style={{ flex: 1 }}>
										<Button
											variant={editMode ? "primary" : "secondary"}
											label={editMode ? "Save" : "Edit Profile"}
											onPress={() => {
												if (!editMode) {
													Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
													setEditMode(true);
												} else {
													Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
													handleSaveChanges();
												}
											}}
											loading={saving}
											enabled={!saving}
										/>
									</View>
								</View>

								{editMode && isSubProfile &&
									<View style={{ flex: 1 }}>
										<Button variant="warn" label={`Nuke ${userName}`} onPress={handleDeleteProfile} enabled={!saving} />
									</View>
								}
							</View>
						</View>

					</View>
				</KeyboardAwareScrollView>
			</TouchableWithoutFeedback>
		</SafeAreaView >
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		width: "100%",
		paddingLeft: spacing.two,
		paddingRight: spacing.two,
		borderWidth: spacing.none,
		borderColor: "#fff",
		gap: spacing.three,
		paddingTop: spacing.three
	},
	fieldContainer: {
		gap: 4,
		width: "100%",
	},
	pageHeader: {
		fontSize: fontsize.title,
		fontFamily: "Body-Bold",
		color: themes.text,
		margin: spacing.none
	},
	infoLabel: {
		fontFamily: "Condensed-Bold",
		fontSize: fontsize.body,
		margin: spacing.none,
	},
	caption: {
		fontFeatureSettings: "Body-Medium",
		opacity: 0.8,
		fontSize: fontsize.caption
	},
	textInput: {
		width: "100%",
		minHeight: spacing.six,
		justifyContent: "center",
		paddingHorizontal: spacing.two,
		borderRadius: spacing.one,
	},
	fixedInfoLabel: {
		fontSize: fontsize.body,
		fontFamily: "Body-Medium"
	},
	fixedFieldContainer: {
		paddingHorizontal: spacing.two,
		paddingVertical: spacing.one,
		flexDirection: "row",
		gap: spacing.one,
		width: "100%",
		borderWidth: spacing.none,
		borderColor: themes.text,
		alignItems: "center",
		minHeight: spacing.seven
	},
	notLast: {
		borderBottomWidth: spacing.quarter,
		borderColor: themes.secondaryBttn
	},
	input: {
		height: spacing.six,
		borderWidth: spacing.quarter,
		paddingHorizontal: spacing.two,
		fontSize: fontsize.button,
		borderRadius: spacing.edge,
		color: themes.text,
		fontFamily: "Body-Medium",
		backgroundColor: themes.backgroundElement,
		borderColor: themes.textSecondary,
		borderStyle: "dashed"
	},
});