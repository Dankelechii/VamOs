import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StatBadge from "../components/StatBadge";
import TravelChecklist from "../components/TravelChecklist";
import Globe3D from "../components/Globe3D";
import CountrySearch from "../components/CountrySearch";
import { useThemeColors } from "../context/ThemeContext";
import { useTravel } from "../context/TravelContext";
import { RootStackParamList } from "../navigation/types";
import { ColorPalette } from "../theme/colors";

export default function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { visited, visitedCount, totalCountries, profile } = useTravel();
  const [pinnedCountryId, setPinnedCountryId] = useState<string | null>(null);

  const visitedIds = useMemo(() => new Set(Object.keys(visited)), [visited]);
  const pct = totalCountries > 0 ? Math.round((visitedCount / totalCountries) * 100) : 0;

  const selectCountry = (id: string) => {
    setPinnedCountryId(id);
    navigation.navigate("CountryDetail", { countryId: id, ownerId: "me" });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* iOS only: Android resizes the window for the keyboard on its own, and doing
          both double-counts the inset. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      {/* keyboardShouldPersistTaps so the checklist's add button fires on the first
          tap while its input still has focus, rather than the tap being eaten by the
          keyboard dismiss. */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Image
            source={require("../../assets/logo-mark-transparent.png")}
            style={styles.brandMark}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>VamOs</Text>
        </View>

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey {profile.name} 👋</Text>
            <Text style={styles.title}>Your world map</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBadge value={visitedCount} label="Visited" />
          <View style={styles.statDivider} />
          <StatBadge value={totalCountries - visitedCount} label="Remaining" />
          <View style={styles.statDivider} />
          <StatBadge value={`${pct}%`} label="of the world" />
        </View>

        <View style={styles.searchWrap}>
          <CountrySearch onSelectCountry={selectCountry} />
        </View>

        <View style={styles.mapCard}>
          <Globe3D
            visitedIds={visitedIds}
            selectedId={pinnedCountryId}
            onSelectCountry={selectCountry}
            colors={{
              ocean: colors.ocean,
              unvisited: colors.unvisited,
              visited: colors.visited,
              selected: colors.visitedSelected,
              border: colors.unvisitedStroke,
            }}
          />
        </View>

        {visitedCount === 0 && (
          <View style={styles.emptyNudge}>
            <Text style={styles.emptyTitle}>Your map is empty</Text>
            <Text style={styles.emptyBody}>
              Pinch to zoom in, then tap any country you've been to and it fills in. Every
              trip you add builds up the picture.
            </Text>
          </View>
        )}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.visited }]} />
            <Text style={styles.legendText}>Visited</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.unvisited }]} />
            <Text style={styles.legendText}>Not yet — pinch to zoom, tap to fill it in</Text>
          </View>
        </View>

        <TravelChecklist />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 6,
      gap: 8,
    },
    // Explicit width/height, not aspectRatio: on RN Web an <Image> with only one
    // dimension set falls back to the asset's intrinsic width, which blows the
    // header row apart. The mark is very nearly square (597x594).
    brandMark: {
      width: 28,
      height: 28,
    },
    brandName: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    greeting: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
    title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800" },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      marginBottom: 12,
    },
    statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.cardBorder },
    searchWrap: { paddingHorizontal: 20, marginBottom: 12 },
    mapCard: {
      marginHorizontal: 12,
      aspectRatio: 1,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    emptyNudge: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    emptyTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 4 },
    emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 20,
      marginTop: 16,
      gap: 16,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { color: colors.textSecondary, fontSize: 12, flexShrink: 1 },
  });
}
