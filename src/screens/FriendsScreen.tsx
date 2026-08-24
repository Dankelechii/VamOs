import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useThemeColors } from "../context/ThemeContext";
import { RootStackParamList } from "../navigation/types";
import {
  acceptFriendRequest,
  blockUser,
  fetchFriends,
  FriendEdge,
  PublicProfile,
  removeFriend,
  searchProfiles,
  sendFriendRequest,
  SocialError,
} from "../services/social";
import { ColorPalette } from "../theme/colors";
import SignInScreen from "./SignInScreen";

export default function FriendsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { backendConfigured, loading: authLoading, userId } = useAuth();

  const [edges, setEdges] = useState<FriendEdge[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setEdges(await fetchFriends(userId));
    } catch {
      // Offline or a transient failure — keep whatever's on screen rather than
      // blanking the list out from under someone.
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced, so typing a username doesn't fire a query per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchProfiles(q);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!backendConfigured) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Friends aren't set up yet</Text>
          <Text style={styles.emptyBody}>
            This build has no backend configured, so the app is running entirely on this
            device. See supabase/README.md to connect one.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) return <SignInScreen />;

  const accepted = edges.filter((e) => e.status === "accepted");
  const incoming = edges.filter((e) => e.status === "pending" && e.incoming);
  const outgoing = edges.filter((e) => e.status === "pending" && !e.incoming);

  const handleAdd = async (profile: PublicProfile) => {
    try {
      const status = await sendFriendRequest(profile.username);
      await load();
      setQuery("");
      setResults([]);
      Alert.alert(
        status === "accepted" ? "You're now friends" : "Request sent",
        status === "accepted"
          ? `You and @${profile.username} can see each other's maps.`
          : `@${profile.username} will see your request.`
      );
    } catch (e) {
      Alert.alert("Couldn't send that", e instanceof SocialError ? e.message : "Try again.");
    }
  };

  const handleAccept = async (edge: FriendEdge) => {
    try {
      await acceptFriendRequest(edge.profile.id);
      await load();
    } catch (e) {
      Alert.alert("Couldn't accept", e instanceof SocialError ? e.message : "Try again.");
    }
  };

  // Guideline 1.2: any app with user-generated content and a social graph needs a way
  // to block and report people. This is the mechanism.
  const handleMore = (profile: PublicProfile) => {
    Alert.alert(`@${profile.username}`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove friend",
        onPress: async () => {
          if (!userId) return;
          await removeFriend(userId, profile.id).catch(() => {});
          load();
        },
      },
      {
        text: "Block and report",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Block this person?",
            "They won't be able to find you, send you requests, or see your map. Blocking also reports them to us for review.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: async () => {
                  await blockUser(profile.id).catch(() => {});
                  load();
                },
              },
            ]
          );
        },
      },
    ]);
  };

  const renderPerson = (
    profile: PublicProfile,
    right: React.ReactNode,
    onPress?: () => void
  ) => (
    <Pressable key={profile.id} style={styles.row} onPress={onPress} disabled={!onPress}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: profile.avatarColor + "33", borderColor: profile.avatarColor },
        ]}
      >
        <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {profile.displayName}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          @{profile.username} · {profile.countryCount}{" "}
          {profile.countryCount === 1 ? "country" : "countries"}
        </Text>
      </View>
      {right}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.accent}
            />
          }
        >
          <Text style={styles.title}>Friends</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Find someone by username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>

          {query.trim().length >= 2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Results</Text>
              {results.length === 0 && !searching ? (
                <Text style={styles.emptyLine}>No one found with that username.</Text>
              ) : (
                results.map((p) =>
                  renderPerson(
                    p,
                    p.friendshipStatus === "accepted" ? (
                      <Text style={styles.statusText}>Friends</Text>
                    ) : p.friendshipStatus === "pending" ? (
                      <Text style={styles.statusText}>
                        {p.requestedBy === userId ? "Requested" : "Asked you"}
                      </Text>
                    ) : (
                      <Button
                        label="Add"
                        size="small"
                        fullWidth={false}
                        onPress={() => handleAdd(p)}
                      />
                    )
                  )
                )
              )}
            </View>
          )}

          {incoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requests</Text>
              {incoming.map((e) =>
                renderPerson(
                  e.profile,
                  <Button
                    label="Accept"
                    size="small"
                    fullWidth={false}
                    onPress={() => handleAccept(e)}
                  />
                )
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Your friends{accepted.length > 0 ? ` (${accepted.length})` : ""}
            </Text>
            {accepted.length === 0 ? (
              <Text style={styles.emptyLine}>
                Search for someone's username above to send your first request.
              </Text>
            ) : (
              accepted.map((e) =>
                renderPerson(
                  e.profile,
                  <Pressable onPress={() => handleMore(e.profile)} hitSlop={10}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                  </Pressable>,
                  () => navigation.navigate("FriendProfile", { friendId: e.profile.id })
                )
              )
            )}
          </View>

          {outgoing.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sent</Text>
              {outgoing.map((e) =>
                renderPerson(e.profile, <Text style={styles.statusText}>Requested</Text>)
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
    title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", marginBottom: 16 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 11 },
    section: { marginTop: 26 },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarEmoji: { fontSize: 18 },
    rowBody: { flex: 1 },
    rowName: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
    rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    statusText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    emptyLine: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
    emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
    emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" },
  });
}
