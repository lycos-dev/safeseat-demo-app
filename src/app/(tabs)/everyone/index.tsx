import addXml from "@expo/material-symbols/add.xml";
import { Spacing as spacing, FontSize as fontsize, type ThemePalette } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Host, Icon } from "@expo/ui";
import { useFocusEffect, useRouter } from "expo-router";
import {
	Dimensions,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	SectionList,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";

// Import doc, getDoc, collection, and getDocs
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../../../firebase";

import AddContactModal from "@/components/add-contact-modal";
import AddProfileModal from "@/components/add-profile-modal";
import ContactCard from "@/components/contact-card";
import ProfileCard from "@/components/profile-card";
import MiniTab from "@/components/mini-tab";

import {
	buttonBorderShape,
	buttonStyle,
	controlSize,
} from "@expo/ui/swift-ui/modifiers";
import TextInput from "@/components/text-input";
import Button from "@/components/button";

const { width: screenWidth } = Dimensions.get("window");

interface UserProfile {
	id: string;
	name: string;
	img?: string;
	createdBy: string;
}

interface EmergencyContact {
	id: string;
	name: string;
	phone: string;
	hierarchy: number;
}

interface ProfileSection {
	title: string;
	data: UserProfile[];
}

export default function Everyone() {

  const themes = useTheme();
  const styles = createStyles(themes);	const router = useRouter();
	const insets = useSafeAreaInsets();

	const [userName, setUserName] = useState<string>("Guest");
	const [userEmail, setUserEmail] = useState<string>("Not Set");
	const [userPhone, setUserPhone] = useState<string>("Not Set");
	const [userImg, setUserImg] = useState<string>("");

	const [refreshing, setRefreshing] = useState(false);

	const [sections, setSections] = useState<ProfileSection[]>([]);
	const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

	const [addProfileVisible, setAddProfileVisible] = useState(false);
	const [addContactVisible, setAddContactVisible] = useState(false);

	const searchInputRef = useRef<any>(null);

	const loadAllUserData = useCallback(async () => {
		setRefreshing(true);
		try {
			const cachedHealth = await SecureStore.getItemAsync("user_health_profile");
			if (cachedHealth) {
				const localData = JSON.parse(cachedHealth);
				if (localData.name) setUserName(localData.name);
				if (localData.email) setUserEmail(localData.email);
				if (localData.phone) setUserPhone(localData.phone);
				if (localData.img) setUserImg(localData.img);
			}

			const currentUser = auth.currentUser;
			if (currentUser) {
				const userDocRef = doc(db, "users", currentUser.uid);
				const userDocSnap = await getDoc(userDocRef);

				let freshUserName = userName;
				let freshUserImg = userImg;

				if (userDocSnap.exists()) {
					const cloudData = userDocSnap.data();

					if (cloudData.name) {
						setUserName(cloudData.name);
						freshUserName = cloudData.name;
					}
					if (cloudData.email) setUserEmail(cloudData.email);
					if (cloudData.phone) setUserPhone(cloudData.phone);
					if (cloudData.img) {
						setUserImg(cloudData.img);
						freshUserImg = cloudData.img;
					}

					const combinedProfile = {
						name: cloudData.name || "",
						email: cloudData.email || "",
						phone: cloudData.phone || "",
						img: cloudData.icon || "",
						birthday: cloudData.birthday || "",
						height: cloudData.height || "",
						weight: cloudData.weight || "",
						bloodType: cloudData.bloodType || "",
						allergies: cloudData.allergies || "",
					};

					await SecureStore.setItemAsync(
						"user_health_profile",
						JSON.stringify(combinedProfile),
					);

				}

				const subcollectionRef = collection(db, "users", currentUser.uid, "profiles");
				const querySnapshot = await getDocs(subcollectionRef);

				const loadedProfiles: UserProfile[] = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					name: doc.data().name || "Unnamed Profile",
					img: doc.data().icon || doc.data().img,
					createdBy: currentUser.uid,
				}));

				loadedProfiles.sort((a, b) => a.name.localeCompare(b.name));

				const groups: { [key: string]: UserProfile[] } = {};
				loadedProfiles.forEach((profile) => {
					const firstLetter = profile.name.charAt(0).toUpperCase();
					const key = /^[A-Z]$/.test(firstLetter) ? firstLetter : "#";
					if (!groups[key]) {
						groups[key] = [];
					}
					groups[key].push(profile);
				});

				const sortedGroupSections: ProfileSection[] = Object.keys(groups)
					.sort((a, b) => {
						if (a === "#") return 1;
						if (b === "#") return -1;
						return a.localeCompare(b);
					})
					.map((key) => ({
						title: key,
						data: groups[key],
					}));

				const ownerSection: ProfileSection = {
					title: "Me",
					data: [
						{
							id: "owner-profile",
							name: `${freshUserName} (Me)`,
							img: freshUserImg || "",
							createdBy: currentUser.uid,
						},
					],
				};

				setSections([ownerSection, ...sortedGroupSections]);

				const contactsRef = collection(db, "users", currentUser.uid, "emergencyContacts");
				const contactsSnap = await getDocs(contactsRef);

				const loadedContacts: EmergencyContact[] = contactsSnap.docs.map((doc) => {
					const data = doc.data();
					return {
						id: doc.id,
						name: data.name || "Unknown Name",
						phone: data.phone || "No Phone Number",
						hierarchy:
							data.hierarchy != null &&
								!isNaN(Number(data.hierarchy)) &&
								Number(data.hierarchy) > 0
								? Number(data.hierarchy)
								: 0,
					};
				});

				loadedContacts.sort((a, b) => {
					if (a.hierarchy === 0 && b.hierarchy === 0) return 0;
					if (a.hierarchy === 0) return 1;
					if (b.hierarchy === 0) return -1;
					return a.hierarchy - b.hierarchy;
				});
				setEmergencyContacts(loadedContacts);
			}
		} catch (error) {
			console.error("Error syncing cache with Firestore collections:", error);
		} finally {
			setRefreshing(false);
		}
	}, [userName, userImg]);

	useFocusEffect(
		useCallback(() => {
			loadAllUserData();
		}, [loadAllUserData]),
	);

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");

	const filteredSections = useMemo(() => {
		if (!searchQuery.trim()) {
			return sections;
		}

		const query = searchQuery.toLowerCase();

		return sections
			.map((section) => {
				const filteredData = section.data.filter((profile) =>
					profile.name.toLowerCase().includes(query),
				);
				return {
					...section,
					data: filteredData,
				};
			})
			.filter((section) => section.data.length > 0);
	}, [sections, searchQuery]);

	return (
		<View style={{ flex: 1, backgroundColor: themes.background }}>
			<SafeAreaView style={[styles.safeArea, { backgroundColor: themes.background }]} edges={["left", "right", "bottom"]}>
				<View style={styles.container}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							marginBottom: spacing.one,
							paddingRight: spacing.none,
						}}
					>
						<Text style={[styles.pageHeader, { color: themes.text, flex: 1 }]}>
							Profiles
						</Text>
					</View>
					<View style={{ paddingBottom: spacing.one }}>
						<MiniTab
							values={["People", "Emergency Contacts"]}
							selectedIndex={selectedIndex}
							onChange={(index: number) => {
								Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
								setSelectedIndex(index);
							}}
						/>
					</View>

					{selectedIndex === 0 ? (
						<View style={styles.peopleTools}>
							<View style={styles.toolRow}>
								<Pressable style={{ flex: 1 }} onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); searchInputRef.current?.focus(); }}>
									<TextInput ref={searchInputRef} placeholder="Search people" value={searchQuery} onChangeText={setSearchQuery} enabled />
								</Pressable>
								<Button variant="primary" label="Add Person" onPress={() => setAddProfileVisible(true)} style={styles.addButton} />
							</View>
						</View>
					) : (
						<View style={styles.peopleTools}>
							<Button variant="primary" label="Add Emergency Contact" onPress={() => setAddContactVisible(true)} fullWidth />
						</View>
					)}

					{selectedIndex === 0 ? (
						<View style={{ flex: 1, borderWidth: spacing.none, borderColor: themes.text }}>
							<SectionList
								sections={filteredSections}
								keyExtractor={(item) => item.id}
								onRefresh={loadAllUserData}
								refreshing={refreshing}
								contentContainerStyle={{
									marginTop: spacing.none,
									paddingBottom: 100 + insets.bottom,
								}}
								stickySectionHeadersEnabled={true}
								showsVerticalScrollIndicator={false}
								showsHorizontalScrollIndicator={false}
								renderItem={({ item, index, section }) => (
									<View
										style={{
											backgroundColor: themes.backgroundElement,
											overflow: "hidden",
											borderTopLeftRadius: index === 0 ? spacing.edge : spacing.none,
											borderTopRightRadius: index === 0 ? spacing.edge : spacing.none,
											borderBottomLeftRadius:
												index === section.data.length - 1 ? spacing.edge : spacing.none,
											borderBottomRightRadius:
												index === section.data.length - 1 ? spacing.edge : spacing.none,
										}}
									>
										<ProfileCard
											name={item.name}
											img={item.img}
											isLast={index === section.data.length - 1}
											onPress={() => {
												Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
												if (item.id === "owner-profile") {
													// @ts-ignore
													router.push("/(tabs)/everyone/profile");
												} else {
													router.push({
														// @ts-ignore
														pathname: "/(tabs)/everyone/profile",
														params: { profileId: item.id },
													});
												}
											}}
										/>
									</View>
								)}
								renderSectionHeader={({ section: { title } }) => (
									<View
										style={[
											styles.sectionHeaderContainer,
											{ backgroundColor: themes.background },
										]}
									>
										<Text
											style={[
												styles.sectionHeaderTitle,
												{ color: themes.textSecondary },
											]}
										>
											{title}
										</Text>
									</View>
								)}
								renderSectionFooter={() => (
									<View style={[styles.sectionFooterSpacer]} />
								)}
								ListEmptyComponent={() => (
									<View style={styles.emptyState}>
										<Text style={styles.emptyStateTitle}>No saved people yet</Text>
										
									</View>
								)}
							/>
						</View>
					) : (
						<View style={{ flex: 1 }}>
							<FlatList
								data={emergencyContacts}
								keyExtractor={(item) => item.id}
								onRefresh={loadAllUserData}
								refreshing={refreshing}
								showsVerticalScrollIndicator={false}
								contentContainerStyle={{
									paddingBottom: 100 + insets.bottom,
									gap: spacing.one,
								}}
								renderItem={({ item, index }) => (
									<View
										style={{
											backgroundColor: themes.backgroundElement,
											overflow: "hidden",
											borderTopLeftRadius: index === 0 ? spacing.edge : spacing.none,
											borderTopRightRadius: index === 0 ? spacing.edge : spacing.none,
											borderBottomLeftRadius:
												index === emergencyContacts.length - 1 ? spacing.edge : spacing.none,
											borderBottomRightRadius:
												index === emergencyContacts.length - 1 ? spacing.edge : spacing.none,
										}}
									>
										<ContactCard
											name={item.name}
											phone={item.phone}
											order={
												item.hierarchy === 1
													? "primary"
													: item.hierarchy === 2
														? "secondary"
														: item.hierarchy === 3
															? "tertiary"
															: item.hierarchy === 4
																? "quaternary"
																: item.hierarchy === 5
																	? "quinary"
																	: "none"
											}
											onPress={() => {
												Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
												router.push({
													// @ts-ignore
													pathname: "/(tabs)/everyone/contact",
													params: { contactId: item.id },
												});
											}}
										/>
									</View>
								)}
								ListEmptyComponent={() => (
									<View style={styles.emptyState}>
										<Text style={styles.emptyStateTitle}>No emergency contacts yet</Text>
										
									</View>
								)}
							/>
						</View>
					)}

					<KeyboardAvoidingView
						behavior={Platform.OS == "ios" ? "padding" : "height"}
					>
						<AddProfileModal
							visible={addProfileVisible}
							onClose={() => {
								setAddProfileVisible(false);
								loadAllUserData();
							}}
						/>
					</KeyboardAvoidingView>

					<AddContactModal
						visible={addContactVisible}
						onClose={() => {
							setAddContactVisible(false);
							void loadAllUserData();
						}}
					/>
				</View>
			</SafeAreaView>
		</View>
	);
}

const createStyles = (themes: ThemePalette) => StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: themes.background,
	},
	container: {
		flex: 1,
		width: "100%",
		paddingHorizontal: spacing.two,
		backgroundColor: themes.background,
	},
	bottomBarWrapper: {
		position: "absolute",
		left: spacing.two,
		right: spacing.two,
		zIndex: 10,
		backgroundColor: "transparent",
	},
	bottomBarInner: {
		flexDirection: "row",
		gap: spacing.one,
		width: "100%",
		alignItems: "center",
	},
	pageHeader: {
		fontSize: fontsize.pageHeader,
		fontFamily: "Logo-Font",
	},
	pageSubhead: {
		color: themes.textSecondary,
		fontSize: 13,
		lineHeight: 19,
		fontFamily: "Body-Regular",
		marginBottom: spacing.two,
	},
	peopleTools: { gap: spacing.one, paddingBottom: spacing.one },
	toolRow: { flexDirection: "row", gap: spacing.one, alignItems: "center" },
	addButton: { minHeight: spacing.six, paddingHorizontal: spacing.one + 4 },
	infoStrip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.one + 2, paddingVertical: 9, borderRadius: 14, backgroundColor: themes.primarySoft, borderWidth: 1, borderColor: themes.primaryBorder },
	emergencyInfoStrip: { backgroundColor: "rgba(255,103,111,0.055)", borderColor: "rgba(255,103,111,0.18)" },
	infoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: themes.primaryBttn },
	infoStripText: { flex: 1, color: themes.textSecondary, fontSize: 9.5, lineHeight: 13.5, fontFamily: "Body-Medium" },
	emptyState: { paddingVertical: spacing.four, paddingHorizontal: spacing.two, alignItems: "center" },
	emptyStateTitle: { color: themes.text, fontSize: 15, fontFamily: "Body-Bold", textAlign: "center" },
	emptyStateText: { color: themes.textMuted, fontSize: 10.5, lineHeight: 15, fontFamily: "Body-Regular", textAlign: "center", marginTop: 5, maxWidth: 280 },
	sectionHeaderContainer: {
		paddingVertical: spacing.one,
		marginTop: spacing.none,
		justifyContent: "center",
	},
	sectionHeaderTitle: {
		fontSize: fontsize.caption,
		fontFamily: "Body-Bold",
		textTransform: "uppercase",
	},
	sectionFooterSpacer: {
		height: spacing.one,
	},
});