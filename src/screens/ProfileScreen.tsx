import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RootStackParamList } from "../navigation/types";
import BadgeRow from "../components/BadgeRow";
import Button from "../components/Button";
import PhotoWheelCarousel from "../components/PhotoWheelCarousel";
import TripTimeline from "../components/TripTimeline";
import StatBadge from "../components/StatBadge";
import { useTheme, useThemeColors } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useTravel } from "../context/TravelContext";
import { getVisitedContinents } from "../data/badges";
import { DEFAULT_PROFILE } from "../data/mockData";
import { useMapSync } from "../hooks/useMapSync";
import { deleteAccount, signOut } from "../services/social";
import { allTrips } from "../data/trips";
import { ColorPalette } from "../theme/colors";
import { darken, lighten } from "../theme/colorUtils";

const THEME_OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function ProfileScreen() {
  const {
    profile,
    visited,
    visitedCount,
    totalCountries,
    updateProfile,
    loadSampleData,
    clearMap,
    loaded,
  } = useTravel();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { preference, setPreference } = useTheme();
  const { backendConfigured, userId, account } = useAuth();
  const syncState = useMapSync(visited, loaded);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [igModalVisible, setIgModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [handleDraft, setHandleDraft] = useState(profile.handle);
  const [bioDraft, setBioDraft] = useState(profile.bio ?? "");
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [igDraft, setIgDraft] = useState(profile.instagramHandle ?? "");

  const pct = totalCountries > 0 ? Math.round((visitedCount / totalCountries) * 100) : 0;
  const continentCount = useMemo(() => getVisitedContinents(visited).size, [visited]);

  // Photos live on trips now, so they're flattened out of the timeline rather than
  // read off the country. Each carries its country so the wheel can draw that
  // country's outline as the photo's frame.
  const timeline = useMemo(() => allTrips(visited), [visited]);

  const recentPhotos = useMemo(
    () =>
      timeline
        .flatMap(({ trip, countryId }) =>
          trip.photos.map((p) => ({
            photo: p,
            countryId,
            _sort: p.takenAt ?? trip.startDate ?? "",
          }))
        )
        .sort((a, b) => (b._sort > a._sort ? 1 : -1)),
    [timeline]
  );

  const confirmClearMap = () => {
    Alert.alert(
      "Clear your map?",
      "This deletes every country, trip, note and photo you've added. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear everything", style: "destructive", onPress: clearMap },
      ]
    );
  };

  const confirmLoadSample = () => {
    Alert.alert(
      "Load example trips?",
      "This fills your map with a set of sample trips so you can see how everything works. It replaces anything already on your map.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load examples", onPress: loadSampleData },
      ]
    );
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "Your map stays on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", onPress: () => signOut().catch(() => {}) },
    ]);
  };

  // Guideline 5.1.1(v): once an app has accounts, deleting one has to be possible
  // from inside the app — not by emailing support.
  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account, your username, your synced trips and your friendships. Trips saved on this device are kept. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              Alert.alert("Account deleted", "Your account and everything on our servers is gone.");
            } catch {
              Alert.alert("Couldn't delete that", "Try again in a moment.");
            }
          },
        },
      ]
    );
  };

  const openEditModal = () => {
    setNameDraft(profile.name);
    setHandleDraft(profile.handle);
    setBioDraft(profile.bio ?? "");
    setEditModalVisible(true);
  };

  const saveProfile = () => {
    const name = nameDraft.trim();
    const handle = handleDraft.trim().replace(/^@/, "");
    updateProfile({
      // Falling back rather than allowing a blank name: the map header greets you by it.
      name: name || DEFAULT_PROFILE.name,
      handle: handle ? `@${handle}` : DEFAULT_PROFILE.handle,
      bio: bioDraft.trim() || undefined,
    });
    setEditModalVisible(false);
  };

  const openInstagramModal = () => {
    setIgDraft(profile.instagramHandle ?? "");
    setIgModalVisible(true);
  };

  const saveInstagram = () => {
    const handle = igDraft.trim().replace(/^@/, "");
    updateProfile({ instagramHandle: handle || undefined });
    setIgModalVisible(false);
  };

  const disconnectInstagram = () => {
    Alert.alert("Disconnect Instagram?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => updateProfile({ instagramHandle: undefined }) },
    ]);
  };

  const openInstagramProfile = () => {
    if (!profile.instagramHandle) return;
    Linking.openURL(`https://instagram.com/${profile.instagramHandle}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.headerRow} onPress={openEditModal} accessibilityLabel="Edit your profile">
          <View style={[styles.avatar, { backgroundColor: profile.avatarColor + "33", borderColor: profile.avatarColor }]}>
            <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.handle}>{profile.handle}</Text>
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          <View style={styles.editHint}>
            <Ionicons name="pencil" size={11} color={colors.accent} />
            <Text style={styles.editHintText}>Edit profile</Text>
          </View>
        </Pressable>

        <View style={styles.statsRow}>
          <StatBadge value={visitedCount} label="Countries" />
          <View style={styles.statDivider} />
          <StatBadge value={timeline.length} label="Trips" />
          <View style={styles.statDivider} />
          <StatBadge value={`${pct}%`} label="of the world" />
          <View style={styles.statDivider} />
          <StatBadge value={recentPhotos.length} label="Photos" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Appearance</Text>
        </View>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => (
            <ThemeOption
              key={opt.value}
              opt={opt}
              active={preference === opt.value}
              onPress={() => setPreference(opt.value)}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Continent badges</Text>
        </View>
        <View style={styles.card}>
          <BadgeRow continentCount={continentCount} ownerLabel="You've" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Instagram</Text>
        </View>
        <View style={styles.card}>
          {profile.instagramHandle ? (
            <View style={styles.igConnectedRow}>
              <Pressable onPress={openInstagramProfile} style={styles.igHandleButton}>
                <Ionicons name="logo-instagram" size={18} color={colors.accent} />
                <Text style={styles.igHandleText}>@{profile.instagramHandle}</Text>
              </Pressable>
              <Button variant="text-danger" size="small" label="Disconnect" onPress={disconnectInstagram} />
            </View>
          ) : (
            <Button icon="logo-instagram" label="Connect Instagram" onPress={openInstagramModal} />
          )}
          <Text style={styles.igHint}>
            Link your handle to share trip photos straight to Instagram from any country page.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trip timeline</Text>
          {timeline.length > 0 && (
            <Text style={styles.sectionHint}>
              {timeline.length} trip{timeline.length === 1 ? "" : "s"}
            </Text>
          )}
        </View>
        <TripTimeline
          entries={timeline}
          maxEntries={timelineExpanded ? timeline.length : 8}
          onShowMore={() => setTimelineExpanded(true)}
          onPressTrip={({ countryId }) =>
            navigation.navigate("CountryDetail", { countryId, ownerId: "me" })
          }
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent photos</Text>
          {recentPhotos.length > 0 && <Text style={styles.sectionHint}>Spin through your trips</Text>}
        </View>
        <PhotoWheelCarousel items={recentPhotos} />

        {backendConfigured && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account</Text>
              {!!userId && (
                <Text style={styles.sectionHint}>
                  {syncState === "syncing"
                    ? "Syncing…"
                    : syncState === "error"
                      ? "Will sync when back online"
                      : syncState === "synced"
                        ? "Synced"
                        : ""}
                </Text>
              )}
            </View>
            <View style={styles.card}>
              {userId ? (
                <>
                  <Text style={styles.accountLine}>
                    Signed in{account ? ` as @${account.username}` : ""}. Your map is backed
                    up and visible to friends you've accepted.
                  </Text>
                  <View style={styles.accountActions}>
                    <Button
                      variant="outline"
                      size="small"
                      fullWidth={false}
                      label="Sign out"
                      onPress={confirmSignOut}
                    />
                    <Button
                      variant="text-danger"
                      size="small"
                      fullWidth={false}
                      label="Delete account"
                      onPress={confirmDeleteAccount}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.accountLine}>
                  You're not signed in. The app works fully without an account — sign in
                  from the Friends tab to back up your map and add people.
                </Text>
              )}
            </View>
          </>
        )}

        <View style={styles.footerActions}>
          {visitedCount === 0 && (
            <Pressable style={styles.footerButton} onPress={confirmLoadSample}>
              <Text style={styles.footerButtonText}>Load example trips</Text>
            </Pressable>
          )}
          {visitedCount > 0 && (
            <Pressable style={styles.footerButton} onPress={confirmClearMap}>
              <Text style={[styles.footerButtonText, { color: colors.danger }]}>Clear my map</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Your profile</Text>
            <Text style={styles.modalSubtitle}>
              This is just for you — nothing leaves your phone.
            </Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              maxLength={40}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Handle</Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalAt}>@</Text>
              <TextInput
                style={styles.modalInput}
                value={handleDraft.replace(/^@/, "")}
                onChangeText={setHandleDraft}
                placeholder="handle"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
            </View>

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              value={bioDraft}
              onChangeText={setBioDraft}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              maxLength={120}
              multiline
            />

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                size="small"
                fullWidth={false}
                label="Cancel"
                onPress={() => setEditModalVisible(false)}
              />
              <Button size="small" fullWidth={false} label="Save" onPress={saveProfile} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={igModalVisible} transparent animationType="fade" onRequestClose={() => setIgModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect Instagram</Text>
            <Text style={styles.modalSubtitle}>Enter your Instagram username to link your profile.</Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalAt}>@</Text>
              <TextInput
                style={styles.modalInput}
                value={igDraft}
                onChangeText={setIgDraft}
                placeholder="username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                size="small"
                fullWidth={false}
                label="Cancel"
                onPress={() => setIgModalVisible(false)}
              />
              <Button
                size="small"
                fullWidth={false}
                label="Save"
                onPress={saveInstagram}
                disabled={!igDraft.trim()}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingBottom: 48 },
    headerRow: { alignItems: "center", paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarEmoji: { fontSize: 38 },
    name: { color: colors.textPrimary, fontSize: 22, fontWeight: "800" },
    handle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    bio: { color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: "center" },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
    },
    statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.cardBorder },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginTop: 20,
      marginBottom: 10,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 11,
      fontStyle: "italic",
    },
    card: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
    },
    themeRow: { flexDirection: "row", marginHorizontal: 20, gap: 8 },
    themeOptionFlex: { flex: 1 },
    themeOptionShadowWrap: {
      borderRadius: 12,
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    themeOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    themeOptionActive: { borderWidth: 0 },
    themeOptionSheen: { position: "absolute", top: 0, left: 0, right: 0, height: "55%" },
    themeOptionText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    themeOptionTextActive: { color: "#182242", fontWeight: "800" },
    igConnectedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    igHandleButton: { flexDirection: "row", alignItems: "center", gap: 8 },
    igHandleText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
    igHint: { color: colors.textMuted, fontSize: 12, marginTop: 10, lineHeight: 16 },
    accountLine: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    accountActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
    footerActions: { alignItems: "center", marginTop: 28 },
    footerButton: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 16 },
    footerButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    editHint: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
    editHintText: { color: colors.accent, fontSize: 11, fontWeight: "700" },
    modalBackdrop: { flex: 1, backgroundColor: "#000000AA", justifyContent: "center", alignItems: "center", padding: 24 },
    modalCard: { width: "100%", backgroundColor: colors.bgElevated, borderRadius: 18, padding: 20 },
    modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "800" },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 6,
    },
    fieldInput: {
      color: colors.textPrimary,
      fontSize: 15,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fieldInputMultiline: { minHeight: 60, textAlignVertical: "top" },
    modalSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
    modalInputRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
    },
    modalAt: { color: colors.textMuted, fontSize: 15, marginRight: 2 },
    modalInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 12 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  });
}

type ThemeOpt = { value: "light" | "dark" | "system"; label: string; icon: keyof typeof Ionicons.glyphMap };

function ThemeOption({
  opt,
  active,
  onPress,
  colors,
  styles,
}: {
  opt: ThemeOpt;
  active: boolean;
  onPress: () => void;
  colors: ColorPalette;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <Animated.View
      style={[styles.themeOptionFlex, active && styles.themeOptionShadowWrap, { transform: [{ scale }] }]}
    >
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        {active ? (
          <LinearGradient
            colors={[lighten(colors.accent, 0.3), colors.accent, darken(colors.accent, 0.22)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.themeOption, styles.themeOptionActive]}
          >
            <LinearGradient
              colors={["#FFFFFF80", "#FFFFFF00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.themeOptionSheen}
              pointerEvents="none"
            />
            <Ionicons name={opt.icon} size={16} color="#182242" />
            <Text style={[styles.themeOptionText, styles.themeOptionTextActive]}>{opt.label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.themeOption}>
            <Ionicons name={opt.icon} size={16} color={colors.textSecondary} />
            <Text style={styles.themeOptionText}>{opt.label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
