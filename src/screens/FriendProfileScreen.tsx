import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BadgeRow from "../components/BadgeRow";
import StatBadge from "../components/StatBadge";
import Globe3D from "../components/Globe3D";
import { useThemeColors } from "../context/ThemeContext";
import { useTravel } from "../context/TravelContext";
import { getVisitedContinents } from "../data/badges";
import { RootStackParamList } from "../navigation/types";
import { fetchVisited, fetchMyProfile, PublicProfile } from "../services/social";
import { ColorPalette } from "../theme/colors";
import { VisitedMap } from "../types";

export default function FriendProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "FriendProfile">>();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { totalCountries } = useTravel();
  const friendId = route.params.friendId;
  const [pinnedCountryId, setPinnedCountryId] = useState<string | null>(null);

  // A friend's map is fetched, not held locally. Row-level security is what makes this
  // safe: the same query returns nothing unless the friendship is accepted, so the
  // screen can't show data the server wouldn't hand over.
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [visitedMap, setVisitedMap] = useState<VisitedMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, v] = await Promise.all([fetchMyProfile(friendId), fetchVisited(friendId)]);
        if (!cancelled) {
          setProfile(p);
          setVisitedMap(v);
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friendId]);

  const visitedIds = useMemo(() => new Set(Object.keys(visitedMap)), [visitedMap]);
  const continentCount = useMemo(() => getVisitedContinents(visitedMap).size, [visitedMap]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        </View>
        <View style={styles.loading}>
          <Text style={styles.unavailable}>This profile isn't available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const friend = {
    id: profile.id,
    name: profile.displayName,
    handle: `@${profile.username}`,
    avatarEmoji: profile.avatarEmoji,
    avatarColor: profile.avatarColor,
    bio: undefined as string | undefined,
  };
  const count = visitedIds.size;
  const pct = Math.round((count / totalCountries) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: friend.avatarColor + "33", borderColor: friend.avatarColor },
            ]}
          >
            <Text style={styles.avatarEmoji}>{friend.avatarEmoji}</Text>
          </View>
          <Text style={styles.name}>{friend.name}</Text>
          <Text style={styles.handle}>{friend.handle}</Text>
          {!!friend.bio && <Text style={styles.bio}>{friend.bio}</Text>}
        </View>

        <View style={styles.statsRow}>
          <StatBadge value={count} label="Visited" />
          <View style={styles.statDivider} />
          <StatBadge value={`${pct}%`} label="of the world" />
        </View>

        <View style={styles.badgeCard}>
          <BadgeRow continentCount={continentCount} ownerLabel={`${friend.name.split(" ")[0]}'s`} />
        </View>

        <View style={styles.mapCard}>
          <Globe3D
            visitedIds={visitedIds}
            colors={{
              ocean: colors.ocean,
              unvisited: colors.unvisited,
              visited: friend.avatarColor,
              selected: colors.visitedSelected,
              border: colors.unvisitedStroke,
            }}
            selectedId={pinnedCountryId}
            onSelectCountry={(id) => {
              setPinnedCountryId(id);
              navigation.navigate("CountryDetail", { countryId: id, ownerId: friend.id });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    unavailable: { color: colors.textMuted, fontSize: 14 },
    topBar: { paddingHorizontal: 16, paddingVertical: 10 },
    backText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
    scrollContent: { paddingBottom: 40 },
    headerRow: { alignItems: "center", paddingHorizontal: 20, marginBottom: 8 },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarEmoji: { fontSize: 34 },
    name: { color: colors.textPrimary, fontSize: 20, fontWeight: "800" },
    handle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    bio: { color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: "center" },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
    },
    statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.cardBorder },
    badgeCard: {
      marginHorizontal: 20,
      marginBottom: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
    },
    mapCard: {
      marginHorizontal: 12,
      aspectRatio: 1,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
  });
}
