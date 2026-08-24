import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import TripCard from "../components/TripCard";
import { useThemeColors } from "../context/ThemeContext";
import { useTravel } from "../context/TravelContext";
import { getCurrentBadge, getNextBadge, getVisitedContinents } from "../data/badges";
import { countryPhotoCount, sortTrips } from "../data/trips";
import { fetchVisited } from "../services/social";
import { RootStackParamList } from "../navigation/types";
import { ColorPalette } from "../theme/colors";
import { WORLD_COUNTRIES } from "../data/worldCountries";
import { Photo, VisitedCountry } from "../types";
import { isoToFlagEmoji } from "../utils/flag";
import { shareToInstagram } from "../utils/share";

const SCREEN_PADDING = 20;
const CARD_PADDING = 14;

export default function CountryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "CountryDetail">>();
  const { countryId, ownerId } = route.params;
  const isMe = !ownerId || ownerId === "me";
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  const {
    visited,
    markVisited,
    unmarkVisited,
    addTrip,
    updateTrip,
    removeTrip,
    addPhoto,
    removePhoto,
  } = useTravel();

  const country = useMemo(() => WORLD_COUNTRIES.find((c) => c.id === countryId), [countryId]);

  // A friend's trips are fetched on demand rather than held in local state. The server
  // only returns them if the friendship is accepted, so there's no way for this screen
  // to display something the policies wouldn't allow.
  const [friendRecord, setFriendRecord] = useState<VisitedCountry | undefined>(undefined);
  useEffect(() => {
    if (isMe || !ownerId) return;
    let cancelled = false;
    fetchVisited(ownerId)
      .then((map) => {
        if (!cancelled) setFriendRecord(map[countryId]);
      })
      .catch(() => {
        if (!cancelled) setFriendRecord(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [isMe, ownerId, countryId]);

  const record = isMe ? visited[countryId] : friendRecord;
  const trips = useMemo(() => sortTrips(record?.trips ?? []), [record]);
  const photoCount = countryPhotoCount(record);

  const [viewerPhoto, setViewerPhoto] = useState<{ photo: Photo; tripId: string } | null>(null);
  const [sharing, setSharing] = useState(false);

  if (!country) return null;

  const flag = isoToFlagEmoji(country.iso2);
  const hasVisited = trips.length > 0;
  const contentWidth = width - SCREEN_PADDING * 2 - CARD_PADDING * 2 - 2;

  const pickPhotoFor = async (tripId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to add trip photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    addPhoto(countryId, tripId, {
      id: `${Date.now()}`,
      uri: asset.uri,
      takenAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleMarkVisited = () => {
    const priorContinents = getVisitedContinents(visited);
    const isNewContinent = !priorContinents.has(country.continent);
    markVisited(countryId);
    if (isNewContinent) {
      const newCount = priorContinents.size + 1;
      const badge = getCurrentBadge(newCount);
      if (badge) {
        const next = getNextBadge(newCount);
        Alert.alert(
          `🏅 ${badge.name} badge unlocked!`,
          badge.id === "platinum"
            ? `You've now visited all 7 continents — every badge collected. Legendary traveler!`
            : `You've now visited ${newCount} continent${newCount === 1 ? "" : "s"}. Next up: the ${next?.name} badge at ${next?.threshold} continents.`
        );
      }
    }
  };

  const confirmRemoveCountry = () => {
    Alert.alert(
      `Remove ${country.name}?`,
      trips.length > 1
        ? `This deletes all ${trips.length} trips and their photos.`
        : "This clears its visited status and photos.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            unmarkVisited(countryId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const confirmRemoveTrip = (tripId: string) => {
    const isLast = trips.length === 1;
    Alert.alert(
      "Delete this trip?",
      isLast
        ? `It's the only trip to ${country.name}, so the country comes off your map too.`
        : "Its dates, notes and photos will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            removeTrip(countryId, tripId);
            if (isLast) navigation.goBack();
          },
        },
      ]
    );
  };

  const confirmRemovePhoto = (photo: Photo, tripId: string) => {
    Alert.alert("Delete photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removePhoto(countryId, tripId, photo.id) },
    ]);
  };

  const handleShareToInstagram = async (photo: Photo) => {
    setSharing(true);
    try {
      await shareToInstagram(photo.uri);
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        {!isMe && (
          <Text style={styles.viewingAs} numberOfLines={1}>
            Viewing a friend's trips
          </Text>
        )}
      </View>

      {/* iOS only — Android resizes for the keyboard itself. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.flag}>{flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.countryName}>{country.name}</Text>
            {hasVisited ? (
              <Text style={styles.visitedSummary}>
                {trips.length} trip{trips.length === 1 ? "" : "s"}
                {photoCount > 0 ? ` · ${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""}
              </Text>
            ) : (
              <Text style={styles.notVisited}>
                {isMe ? "Not marked as visited yet" : "They haven't been here"}
              </Text>
            )}
          </View>
        </View>

        {isMe && !hasVisited && (
          <Button
            label={`Mark ${country.name} as visited`}
            icon="flag"
            onPress={handleMarkVisited}
            style={styles.primaryButtonSpacing}
          />
        )}

        {trips.map((trip, i) => (
          <TripCard
            key={trip.id}
            trip={trip}
            index={i + 1}
            total={trips.length}
            editable={isMe}
            contentWidth={contentWidth}
            onChange={(patch) => updateTrip(countryId, trip.id, patch)}
            onAddPhoto={() => pickPhotoFor(trip.id)}
            onPressPhoto={(photo) => setViewerPhoto({ photo, tripId: trip.id })}
            onDelete={() => confirmRemoveTrip(trip.id)}
          />
        ))}

        {isMe && hasVisited && (
          <>
            <Button
              label="Add another trip"
              icon="add"
              variant="outline"
              onPress={() => addTrip(countryId)}
              style={styles.addTripButton}
            />
            <View style={styles.dangerButtonWrap}>
              <Button label="Remove from visited" variant="text-danger" onPress={confirmRemoveCountry} />
            </View>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!viewerPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerPhoto(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerPhoto(null)}>
          {viewerPhoto && (
            <View style={styles.viewerContent}>
              <Image source={{ uri: viewerPhoto.photo.uri }} style={styles.viewerImage} resizeMode="contain" />
              {!!viewerPhoto.photo.caption && (
                <Text style={styles.viewerCaption}>{viewerPhoto.photo.caption}</Text>
              )}
              <View style={styles.viewerActions}>
                <Button
                  variant="chip"
                  size="small"
                  icon="logo-instagram"
                  label={sharing ? "Preparing…" : "Share to Instagram"}
                  disabled={sharing}
                  onPress={() => handleShareToInstagram(viewerPhoto.photo)}
                />
                {isMe && (
                  <Button
                    variant="chip"
                    size="small"
                    icon="trash-outline"
                    label="Delete"
                    tint={colors.danger}
                    onPress={() => {
                      const { photo, tripId } = viewerPhoto;
                      setViewerPhoto(null);
                      confirmRemovePhoto(photo, tripId);
                    }}
                  />
                )}
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    backButton: { paddingVertical: 4, paddingRight: 8 },
    backText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
    viewingAs: { color: colors.textSecondary, fontSize: 13, flexShrink: 1 },
    scrollContent: { padding: SCREEN_PADDING, paddingTop: 4, paddingBottom: 48 },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
    flag: { fontSize: 44, marginRight: 14 },
    countryName: { color: colors.textPrimary, fontSize: 26, fontWeight: "800" },
    visitedSummary: { color: colors.accent2, fontSize: 13, marginTop: 4, fontWeight: "600" },
    notVisited: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
    primaryButtonSpacing: { marginBottom: 8 },
    addTripButton: { alignSelf: "center", marginTop: 4 },
    dangerButtonWrap: { marginTop: 24, alignItems: "center" },
    viewerBackdrop: { flex: 1, backgroundColor: "#000000DD", justifyContent: "center", alignItems: "center" },
    viewerContent: { width: "100%", paddingHorizontal: 16 },
    viewerImage: { width: "100%", height: 420, borderRadius: 12 },
    viewerCaption: { color: colors.white, textAlign: "center", marginTop: 12, fontSize: 14 },
    viewerActions: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 18 },
  });
}
