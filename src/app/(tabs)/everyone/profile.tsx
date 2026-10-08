import { FontSize as fontsize, Spacing as spacing, type ThemePalette } from "@/constants/theme";
import { confirmAction } from "../../../utils/platform-dialog";
import { useTheme } from "@/hooks/use-theme";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Dimensions,
	Image,
	ImageBackground,
	Keyboard,
	Pressable,
	StyleSheet,
	Text,
	View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";
import * as Haptics from "expo-haptics";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { saveUserProfile } from "@/services/user-profile";
import { accountErrorMessage } from "@/utils/account-errors";

import Button from "@/components/button";
import TextInput from "@/components/text-input";
import { Dropdown } from "react-native-element-dropdown";
import FormScrollView from "@/components/form-scroll-view";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../../firebase";


const { width: screenWidth } = Dimensions.get("window");

const bloodTypes = [
	{ label: "Not known", value: "" },
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

  const themes = useTheme();
  const styles = createStyles(themes);	const router = useRouter();

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

	// Unit preference is shared across the entire app.
	const { useMetric: isMetric } = useUserPreferences();

	// 4. UI Interaction State
	const [editMode, setEditMode] = useState(false);
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);

	const loadAllUserData = useCallback(async () => {
		try {
			const currentUser = auth.currentUser;
			if (!currentUser) return;

			const cachedHealth = await getLocalValue(cacheKey);
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
					height: localData.height || (localData.heightCm != null ? String(localData.heightCm) : ""),
					weight: localData.weight || (localData.weightKg != null ? String(localData.weightKg) : ""),
					bloodType: localData.bloodType || "",
					allergies: localData.allergies || "",
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

			let cloudData: any = null;
			if (isSubProfile) {
				const profileDocRef = doc(db, "users", currentUser.uid, "profiles", profileId as string);
				const profileDocSnap = await getDoc(profileDocRef);
				if (profileDocSnap.exists()) {
					cloudData = profileDocSnap.data();
				}
			} else {
				cloudData = await saveUserProfile(currentUser);
			}

			if (cloudData) {
				const nameVal = cloudData.name || "Guest";
				const iconVal = cloudData.icon || "Not Set";
				const emailVal = cloudData.email || "Not Set";
				const phoneVal = cloudData.phone || "Not Set";

				const bdayParts = extractBirthdayParts(cloudData);

				const heightVal = cloudData.heightCm != null ? `${cloudData.heightCm}` : (cloudData.height || "");
				const weightVal = cloudData.weightKg != null ? `${cloudData.weightKg}` : (cloudData.weight || "");
				const bloodVal = cloudData.bloodType || "";
				const allergyVal = cloudData.allergies || "";

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

				await setLocalValue(cacheKey, JSON.stringify(loadedCloudData));
			}
		} catch (error) {
			console.error("Error syncing cache with Firestore:", error);
		}
	}, [profileId, cacheKey, isSubProfile]);

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

		const yVal = birthYear.trim();
		const mVal = birthMonth.trim();
		const dVal = birthDate.trim();
		const hasBirthday = yVal !== "" || mVal !== "" || dVal !== "";

		if (hasBirthday) {
			if (yVal === "" || mVal === "" || dVal === "") return false;
			const y = parseInt(yVal, 10);
			const m = parseInt(mVal, 10);
			const d = parseInt(dVal, 10);
			if (!isValidDateParts(y, m, d)) return false;
			const today = new Date();
			const currentYear = today.getFullYear();
			if (y < 1900 || y > currentYear) return false;
			if (y === currentYear) {
				const currentMonth = today.getMonth() + 1;
				if (m > currentMonth || (m === currentMonth && d > today.getDate())) return false;
			}
		}

		if (isMetric) {
			const hVal = height.trim();
			const wVal = weight.trim();
			if (hVal !== "" && hVal !== "Not Set" && (isNaN(parseFloat(hVal)) || parseFloat(hVal) <= 0)) return false;
			if (wVal !== "" && wVal !== "Not Set" && (isNaN(parseFloat(wVal)) || parseFloat(wVal) <= 0)) return false;
		} else {
			const fVal = tempFeet.trim();
			const iVal = tempInches.trim();
			if (fVal !== "" || iVal !== "") {
				if (fVal === "") return false;
				const f = parseFloat(fVal);
				const i = parseFloat(iVal || "0");
				if (isNaN(f) || f < 0 || f > 10) return false;
				if (isNaN(i) || i < 0 || i >= 12) return false;
				if ((f * 12) + i <= 0) return false;
			}
			const lbsVal = tempLbs.trim();
			if (lbsVal !== "" && (isNaN(parseFloat(lbsVal)) || parseFloat(lbsVal) <= 0)) return false;
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

	useUnsavedChangesGuard(editMode && hasUnsavedChanges());

	const handleCancelEdit = async () => {
		if (hasUnsavedChanges()) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			const discard = await confirmAction({
				title: "Discard?",
				message: "You have unsaved changes. Discard?",
				confirmText: "Discard",
				destructive: true,
			});
			if (!discard) return;
			Keyboard.dismiss();
			loadAllUserData();
			setEditMode(false);
		} else {
			Keyboard.dismiss();
			setEditMode(false);
		}
	};

	const handleSaveChanges = async () => {
		if (!isFormValid || savingRef.current) return;
		Keyboard.dismiss();
		savingRef.current = true;

		try {
			setSaving(true);
			const currentUser = auth.currentUser;
			if (!currentUser) {
				Alert.alert("Log in required", "Please log in again before saving your profile.");
				return;
			}

			const y = parseInt(birthYear, 10);
			const m = parseInt(birthMonth, 10);
			const d = parseInt(birthDate, 10);
			const validBday = isValidDateParts(y, m, d);

			const normalizedBloodType = bloodType === "Not Set" ? "" : bloodType.trim();
			const normalizedAllergies = allergies === "None Stored" ? "" : allergies.trim();
			const cleanHeightNum = height && height !== "Not Set" ? parseFloat(height.replace(/[^0-9.]/g, "")) : null;
			const cleanWeightNum = weight && weight !== "Not Set" ? parseFloat(weight.replace(/[^0-9.]/g, "")) : null;
			const validHeightNum = cleanHeightNum !== null && !isNaN(cleanHeightNum) ? cleanHeightNum : null;
			const validWeightNum = cleanWeightNum !== null && !isNaN(cleanWeightNum) ? cleanWeightNum : null;

			const updatedProfile = {
				name: userName.trim(),
				icon: userIcon,
				email: userEmail,
				phone: userPhone,
				birthYear: validBday ? y : null,
				birthMonth: validBday ? m : null,
				birthDate: validBday ? d : null,
				height: validHeightNum !== null ? String(validHeightNum) : "",
				weight: validWeightNum !== null ? String(validWeightNum) : "",
				bloodType: normalizedBloodType,
				allergies: normalizedAllergies,
			};

			const firestorePayload: any = {
				name: userName.trim(),
				icon: userIcon,
				bloodType: normalizedBloodType || null,
				allergies: normalizedAllergies || null,
				birthYear: validBday ? y : null,
				birthMonth: validBday ? m : null,
				birthDate: validBday ? d : null,
				heightCm: validHeightNum,
				height: validHeightNum !== null ? String(validHeightNum) : null,
				weightKg: validWeightNum,
				weight: validWeightNum !== null ? String(validWeightNum) : null,
			};

			if (isSubProfile) {
				// Do not recreate a passenger profile deleted on another device.
				await updateDoc(doc(db, "users", currentUser.uid, "profiles", profileId as string), firestorePayload);
			} else {
				const saved = await saveUserProfile(currentUser, firestorePayload);
				updatedProfile.email = saved.email || "Not Set";
				updatedProfile.phone = saved.phone || "Not Set";
				setUserEmail(updatedProfile.email);
				setUserPhone(updatedProfile.phone);
			}
			// Only cache confirmed writes. A cache failure must not report a cloud save as failed.
			await setLocalValue(cacheKey, JSON.stringify(updatedProfile)).catch((error) => {
				console.warn("Profile saved, but local cache could not be updated:", error);
			});
			originalDataRef.current = updatedProfile;
			setEditMode(false);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		} catch (error) {
			Alert.alert("Failed to save changes", accountErrorMessage(error, "Your changes were not saved. Please try again."));
		} finally {
			savingRef.current = false;
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
		void confirmAction({
			title: `Delete ${userName}?`,
			message: `Are you sure you want to delete ${userName}? This action can't be undone.`,
			confirmText: "Delete",
			destructive: true,
		}).then(async (confirmed) => {
			if (!confirmed) return;
			try {
				setSaving(true);
				const currentUser = auth.currentUser;
				if (!currentUser || !isSubProfile) return;

				const profileDocRef = doc(db, "users", currentUser.uid, "profiles", profileId as string);
				await deleteDoc(profileDocRef);
				await deleteLocalValue(cacheKey);
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
				router.back();
			} catch (error) {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
				Alert.alert("Failed to delete profile");
				console.error("Failed to delete profile: ", error);
			} finally {
				setSaving(false);
			}
		});
	};

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: themes.background }}
			edges={["left", "right", "bottom"]}
		>
				<FormScrollView contentContainerStyle={[{ flexGrow: 1 }, { marginTop: spacing.one, paddingBottom: bottomPad }]} showsVerticalScrollIndicator={true} bounces={true}>
					<View style={styles.container}>
						<View style={styles.profileHero}>
							<Pressable
								disabled={!editMode}
								onPress={handlePickImage}
								style={styles.avatarButton}
							>
								{!userIcon || userIcon === "Not Set" || userIcon === "" ? (
									<View style={styles.avatarFallback}>
										<Text style={styles.avatarInitial}>{userName.trim().charAt(0).toUpperCase() || "?"}</Text>
									</View>
								) : (
									<Image source={{ uri: userIcon }} style={styles.avatarImage} />
								)}
								{editMode ? (
									<View style={styles.editPhotoBadge}><Text style={styles.editPhotoText}>EDIT</Text></View>
								) : null}
							</Pressable>
							<View style={styles.heroCopy}>
								<Text style={styles.heroEyebrow}>{isSubProfile ? "SAVED PERSON" : "MY DRIVER PROFILE"}</Text>
								<Text style={styles.pageHeader} numberOfLines={2}>{userName}</Text>
								<Text style={styles.heroSubhead}>{editMode ? "Edit the fields below, then save your changes." : isSubProfile ? "Saved passenger profile" : "Used when you assign yourself to the Driver seat."}</Text>
							</View>
						</View>

						{!isSubProfile ? (
							<Button
								variant="secondary"
								label="Emergency Contacts"
								onPress={() => router.push("/(tabs)/everyone" as any)}
								fullWidth
							/>
						) : null}

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
								<Text style={styles.sectionHint}>Name is required. Birthday is optional.</Text>

								<View style={styles.fieldGroup}>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Name · Required:
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
											Birthday · Optional:
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

									<View style={[styles.fixedFieldContainer, { backgroundColor: themes.backgroundElement, borderTopLeftRadius: editMode ? spacing.edge : spacing.none, borderTopRightRadius: editMode ? spacing.edge : spacing.none }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Age:
										</Text>
										<Text style={{ color: themes.text, fontFamily: "Body-Medium", fontSize: fontsize.body }}>
											{getAge()}
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
									Optional Health Information
								</Text>
								<Text style={styles.sectionHint}>These details are optional and are not required for seat assignment or monitoring.</Text>

								<View style={styles.fieldGroup}>

									<View style={[styles.fixedFieldContainer, !editMode && styles.notLast, { backgroundColor: editMode ? themes.background : themes.backgroundElement }]}>
										<Text style={[styles.fixedInfoLabel, { color: themes.primaryBttn }]}>
											Height · Optional:
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
											Weight · Optional:
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
											Blood Type · Optional:
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
											Allergies · Optional:
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
												{allergies.trim() || "Not Set"}
											</Text>
										)}
									</View>
								</View>
							</View>

							{editMode && !isFormValid ? (
								<Text style={styles.formValidationText}>Name is required. If you enter optional details, make sure they are complete and valid.</Text>
							) : null}

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
											enabled={!saving && (!editMode || isFormValid)}
										/>
									</View>
								</View>

								{editMode && isSubProfile &&
									<View style={{ flex: 1 }}>
										<Button variant="warn" label={`Delete ${userName}`} onPress={handleDeleteProfile} enabled={!saving} />
									</View>
								}
							</View>
						</View>

					</View>
				</FormScrollView>
		</SafeAreaView >
	);
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
	container: {
		flex: 1,
		width: "100%",
		paddingHorizontal: spacing.two,
		gap: spacing.two,
		paddingTop: spacing.two,
	},
	profileHero: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.two,
		padding: spacing.two,
		borderRadius: 20,
		backgroundColor: themes.backgroundElement,
		borderWidth: 1,
		borderColor: themes.divider,
	},
	avatarButton: { width: 86, height: 86, borderRadius: 25, overflow: "hidden", borderWidth: 1.5, borderColor: themes.primaryBorder, backgroundColor: themes.primarySoft },
	avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: themes.primarySoft },
	avatarInitial: { color: themes.primaryBttn, fontSize: 31, fontFamily: "Body-Bold" },
	avatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
	editPhotoBadge: { position: "absolute", left: 7, right: 7, bottom: 7, paddingVertical: 4, borderRadius: 999, alignItems: "center", backgroundColor: themes.overlay },
	editPhotoText: { color: "#FFFFFF", fontSize: 9.5, letterSpacing: 0.7, fontFamily: "Body-Bold" },
	heroCopy: { flex: 1, minWidth: 0, gap: 3 },
	heroEyebrow: { color: themes.primaryBttn, fontSize: 10.5, letterSpacing: 1, fontFamily: "Body-Bold" },
	heroSubhead: { color: themes.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: "Body-Regular" },
	sectionHint: { color: themes.textMuted, fontSize: 10, lineHeight: 14, fontFamily: "Body-Regular", marginTop: -4 },
	formValidationText: { color: themes.lightOrange, fontSize: 10, lineHeight: 14, fontFamily: "Body-Medium" },
	fieldContainer: {
		gap: 4,
		width: "100%",
	},
	pageHeader: {
		fontSize: 24,
		lineHeight: 29,
		fontFamily: "Body-Bold",
		color: themes.text,
		margin: spacing.none,
	},
	fieldGroup: {
		borderRadius: spacing.edge,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: themes.divider,
		backgroundColor: themes.backgroundElement,
	},
	infoLabel: {
		fontFamily: "Condensed-Bold",
		fontSize: fontsize.body,
		margin: spacing.none,
	},
	caption: {
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
