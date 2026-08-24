import type { SupabaseClient } from "@supabase/supabase-js";
import { File } from "expo-file-system";
import { requireBackend } from "../config/supabase";
import { Photo, Trip, VisitedMap } from "../types";
import { newId } from "../data/trips";

/**
 * Everything that talks to the backend, in one place.
 *
 * Screens never import the Supabase client directly — they go through these
 * functions, which convert between the server's row shapes and the app's own types.
 * That boundary is what kept the swap from local-only to synced from touching the UI.
 */

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: string;
  countryCount: number;
  /** null when there's no relationship yet. */
  friendshipStatus: "pending" | "accepted" | "blocked" | null;
  requestedBy: string | null;
}

export type AuthErrorCode =
  | "username_taken"
  | "username_reserved"
  | "username_invalid"
  | "email_in_use"
  | "invalid_credentials"
  | "user_not_found"
  | "cannot_friend_self"
  | "blocked"
  | "unknown";

export class SocialError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function validateUsername(raw: string): string | null {
  const username = raw.trim().replace(/^@/, "");
  if (!USERNAME_RE.test(username)) return null;
  return username;
}

/**
 * Map Postgres and GoTrue errors onto codes the UI can phrase itself.
 * Raw database messages ("duplicate key value violates unique constraint
 * profiles_username_key") must never reach a user.
 */
function toSocialError(error: { message?: string; code?: string } | null): SocialError {
  const message = error?.message ?? "";
  if (/username_reserved/.test(message)) {
    return new SocialError("username_reserved", "That username isn't available.");
  }
  if (/profiles_username_key|duplicate key/i.test(message)) {
    return new SocialError("username_taken", "That username is already taken.");
  }
  if (/username_format/.test(message)) {
    return new SocialError("username_invalid", "Usernames are 3–20 letters, numbers or underscores.");
  }
  if (/already registered|already been registered/i.test(message)) {
    return new SocialError("email_in_use", "There's already an account with that email.");
  }
  if (/invalid login credentials/i.test(message)) {
    return new SocialError("invalid_credentials", "That email and password don't match.");
  }
  if (/user_not_found/.test(message)) {
    return new SocialError("user_not_found", "No one's using that username.");
  }
  if (/cannot_friend_self/.test(message)) {
    return new SocialError("cannot_friend_self", "That's you.");
  }
  if (/blocked/.test(message)) {
    return new SocialError("blocked", "That request can't be sent.");
  }
  return new SocialError("unknown", "Something went wrong. Try again in a moment.");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signUp(email: string, password: string, username: string, displayName: string) {
  const sb = requireBackend();
  const clean = validateUsername(username);
  if (!clean) {
    throw new SocialError("username_invalid", "Usernames are 3–20 letters, numbers or underscores.");
  }

  // Check first for a fast, friendly error. This is a courtesy, not the guard — the
  // real protection is the unique constraint, which is the only thing that holds when
  // two people submit the same handle at once.
  const { data: taken } = await sb
    .from("profiles")
    .select("id")
    .ilike("username", clean)
    .maybeSingle();
  if (taken) throw new SocialError("username_taken", "That username is already taken.");

  const { error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    // Read by the on_auth_user_created trigger, which creates the profile row. Doing
    // it server-side means an auth user never exists without a profile.
    options: { data: { username: clean, display_name: displayName.trim() || "Traveller" } },
  });
  if (error) throw toSocialError(error);
}

export async function signIn(email: string, password: string) {
  const sb = requireBackend();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toSocialError(error);
}

export async function signOut() {
  await requireBackend().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  const { error } = await requireBackend().auth.resetPasswordForEmail(email.trim());
  if (error) throw toSocialError(error);
}

/** Guideline 5.1.1(v): account deletion has to be reachable from inside the app. */
export async function deleteAccount() {
  const sb = requireBackend();
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw toSocialError(error);
  await sb.auth.signOut();
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

const PROFILE_COLUMNS = "id, username, display_name, avatar_emoji, avatar_color, country_count";

function rowToProfile(row: Record<string, unknown>): PublicProfile {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name ?? "Traveller"),
    avatarEmoji: String(row.avatar_emoji ?? "🧭"),
    avatarColor: String(row.avatar_color ?? "#DDA83F"),
    countryCount: Number(row.country_count ?? 0),
    friendshipStatus: (row.friendship_status as PublicProfile["friendshipStatus"]) ?? null,
    requestedBy: (row.requested_by as string | null) ?? null,
  };
}

export async function fetchMyProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await requireBackend()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw toSocialError(error);
  return data ? rowToProfile(data) : null;
}

export async function updateMyProfile(
  userId: string,
  patch: { displayName?: string; username?: string; bio?: string; avatarEmoji?: string; avatarColor?: string }
) {
  const sb = requireBackend();
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.bio !== undefined) row.bio = patch.bio || null;
  if (patch.avatarEmoji !== undefined) row.avatar_emoji = patch.avatarEmoji;
  if (patch.avatarColor !== undefined) row.avatar_color = patch.avatarColor;
  if (patch.username !== undefined) {
    const clean = validateUsername(patch.username);
    if (!clean) {
      throw new SocialError("username_invalid", "Usernames are 3–20 letters, numbers or underscores.");
    }
    row.username = clean;
  }

  const { error } = await sb.from("profiles").update(row).eq("id", userId);
  if (error) throw toSocialError(error);
}

export async function searchProfiles(query: string): Promise<PublicProfile[]> {
  const q = query.trim().replace(/^@/, "");
  if (q.length < 2) return [];
  const { data, error } = await requireBackend().rpc("search_profiles", { q, max_results: 20 });
  if (error) throw toSocialError(error);
  return (data ?? []).map(rowToProfile);
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export interface FriendEdge {
  profile: PublicProfile;
  status: "pending" | "accepted" | "blocked";
  /** True when they asked us, so the UI knows to offer Accept rather than Requested. */
  incoming: boolean;
}

export async function fetchFriends(userId: string): Promise<FriendEdge[]> {
  const sb = requireBackend();
  const { data, error } = await sb
    .from("friendships")
    .select(
      `user_a, user_b, status, requested_by,
       a:profiles!friendships_user_a_fkey(${PROFILE_COLUMNS}),
       b:profiles!friendships_user_b_fkey(${PROFILE_COLUMNS})`
    )
    .neq("status", "blocked");
  if (error) throw toSocialError(error);

  return (data ?? []).map((row: Record<string, any>) => {
    // The row is ordered by uuid, so which side is "them" has to be worked out.
    const other = row.user_a === userId ? row.b : row.a;
    return {
      profile: rowToProfile(Array.isArray(other) ? other[0] : other),
      status: row.status,
      incoming: row.requested_by !== userId,
    };
  });
}

export async function sendFriendRequest(username: string): Promise<string> {
  const { data, error } = await requireBackend().rpc("send_friend_request", {
    target_username: username.trim().replace(/^@/, ""),
  });
  if (error) throw toSocialError(error);
  return String(data);
}

export async function acceptFriendRequest(otherUserId: string) {
  const { error } = await requireBackend().rpc("accept_friend_request", { other_user: otherUserId });
  if (error) throw toSocialError(error);
}

export async function removeFriend(userId: string, otherUserId: string) {
  const [a, b] = [userId, otherUserId].sort();
  const { error } = await requireBackend()
    .from("friendships")
    .delete()
    .eq("user_a", a)
    .eq("user_b", b);
  if (error) throw toSocialError(error);
}

export async function blockUser(otherUserId: string) {
  const { error } = await requireBackend().rpc("block_user", { other_user: otherUserId });
  if (error) throw toSocialError(error);
}

// ---------------------------------------------------------------------------
// Trip sync
// ---------------------------------------------------------------------------

interface TripRow {
  client_id: string;
  country_id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

function visitedToRows(userId: string, visited: VisitedMap): (TripRow & { user_id: string })[] {
  const rows: (TripRow & { user_id: string })[] = [];
  for (const record of Object.values(visited)) {
    for (const trip of record.trips) {
      rows.push({
        user_id: userId,
        client_id: trip.id,
        country_id: record.countryId,
        title: trip.title ?? null,
        start_date: trip.startDate ?? null,
        end_date: trip.endDate ?? null,
        notes: trip.notes ?? null,
      });
    }
  }
  return rows;
}

function rowsToVisited(rows: TripRow[], photosByTrip: Map<string, Photo[]>): VisitedMap {
  const out: VisitedMap = {};
  for (const row of rows) {
    const trip: Trip = {
      id: row.client_id || newId("trip"),
      title: row.title ?? undefined,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      notes: row.notes ?? undefined,
      photos: photosByTrip.get(row.client_id) ?? [],
    };
    const existing = out[row.country_id];
    out[row.country_id] = {
      countryId: row.country_id,
      trips: existing ? [...existing.trips, trip] : [trip],
    };
  }
  return out;
}

interface LocalPhotoRow {
  client_id: string;
  trip_client_id: string;
  caption: string | null;
  taken_at: string | null;
  uri: string;
}

function visitedToPhotoRows(visited: VisitedMap): LocalPhotoRow[] {
  const rows: LocalPhotoRow[] = [];
  for (const record of Object.values(visited)) {
    for (const trip of record.trips) {
      for (const photo of trip.photos) {
        rows.push({
          client_id: photo.id,
          trip_client_id: trip.id,
          caption: photo.caption ?? null,
          taken_at: photo.takenAt ?? null,
          uri: photo.uri,
        });
      }
    }
  }
  return rows;
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Uploads any local-only photos to the `trip-photos` bucket and rows them in
 * `trip_photos`, then removes remote photos that no longer exist locally.
 *
 * Best-effort per photo: an unreadable file or a flaky upload must not stop the trip
 * data pushVisited already sent from counting as synced, so failures here are
 * swallowed rather than thrown — the next sync pass retries whatever didn't land,
 * since "already on the server" is judged solely by client_id membership.
 */
async function pushPhotos(
  sb: SupabaseClient,
  userId: string,
  visited: VisitedMap,
  tripIdByClientId: Map<string, string>
) {
  const local = visitedToPhotoRows(visited);
  const localIds = new Set(local.map((p) => p.client_id));

  const { data: existing, error: fetchError } = await sb
    .from("trip_photos")
    .select("client_id, storage_path")
    .eq("user_id", userId);
  if (fetchError) return;

  const existingIds = new Set((existing ?? []).map((r) => r.client_id));
  const toUpload = local.filter((p) => !existingIds.has(p.client_id));

  for (const photo of toUpload) {
    const tripId = tripIdByClientId.get(photo.trip_client_id);
    if (!tripId) continue;
    try {
      const file = new File(photo.uri);
      const bytes = await file.arrayBuffer();
      const path = `${userId}/${photo.client_id}`;
      const ext = file.extension.replace(/^\./, "").toLowerCase();
      const { error: uploadError } = await sb.storage
        .from("trip-photos")
        .upload(path, bytes, { contentType: EXTENSION_MIME[ext] ?? "image/jpeg", upsert: true });
      if (uploadError) continue;

      await sb.from("trip_photos").upsert(
        {
          user_id: userId,
          trip_id: tripId,
          client_id: photo.client_id,
          storage_path: path,
          caption: photo.caption,
          taken_at: photo.taken_at,
        },
        { onConflict: "user_id,client_id" }
      );
    } catch {
      // Unreadable file or a network hiccup — the next sync retries it.
    }
  }

  const toRemove = (existing ?? []).filter((r) => !localIds.has(r.client_id));
  if (toRemove.length > 0) {
    try {
      await sb.storage.from("trip-photos").remove(toRemove.map((r) => r.storage_path));
      await sb
        .from("trip_photos")
        .delete()
        .eq("user_id", userId)
        .in("client_id", toRemove.map((r) => r.client_id));
    } catch {
      // Leftover objects/rows are harmless; cleanup retries next sync.
    }
  }
}

interface PhotoRow {
  client_id: string;
  caption: string | null;
  taken_at: string | null;
  storage_path: string;
  trip: { client_id: string } | { client_id: string }[] | null;
}

/** Signed URLs are private-bucket-only and time-limited — an hour comfortably outlives
 * a single screen visit without leaving photos reachable indefinitely if leaked. */
async function fetchPhotosByTrip(sb: SupabaseClient, userId: string): Promise<Map<string, Photo[]>> {
  const byTrip = new Map<string, Photo[]>();
  const { data, error } = await sb
    .from("trip_photos")
    .select("client_id, caption, taken_at, storage_path, trip:trips(client_id)")
    .eq("user_id", userId);
  if (error || !data || data.length === 0) return byTrip;

  const paths = (data as unknown as PhotoRow[]).map((r) => r.storage_path);
  const { data: signed } = await sb.storage.from("trip-photos").createSignedUrls(paths, 3600);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  for (const row of data as unknown as PhotoRow[]) {
    const trip = Array.isArray(row.trip) ? row.trip[0] : row.trip;
    const url = row.storage_path ? urlByPath.get(row.storage_path) : null;
    if (!trip || !url) continue;
    const photo: Photo = {
      id: row.client_id,
      uri: url,
      caption: row.caption ?? undefined,
      takenAt: row.taken_at ?? undefined,
    };
    const list = byTrip.get(trip.client_id);
    if (list) list.push(photo);
    else byTrip.set(trip.client_id, [photo]);
  }
  return byTrip;
}

/**
 * Push the whole local map up.
 *
 * Upserts on (user_id, client_id) — the device's own trip id — so syncing the same
 * trip repeatedly updates one row instead of creating duplicates, which is what makes
 * this safe to run after an offline stretch. Trips deleted locally are then removed
 * server-side by the same key, so a delete propagates too. Photos follow the same
 * upsert-by-client_id shape, one layer down — see pushPhotos.
 */
export async function pushVisited(userId: string, visited: VisitedMap) {
  const sb = requireBackend();
  const rows = visitedToRows(userId, visited);

  const tripIdByClientId = new Map<string, string>();
  if (rows.length > 0) {
    const { data, error } = await sb
      .from("trips")
      .upsert(rows, { onConflict: "user_id,client_id" })
      .select("id, client_id");
    if (error) throw toSocialError(error);
    for (const row of data ?? []) tripIdByClientId.set(row.client_id, row.id);
  }

  const keep = rows.map((r) => r.client_id);
  const remove = sb.from("trips").delete().eq("user_id", userId);
  const { error: deleteError } = keep.length
    ? await remove.not("client_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`)
    : await remove;
  if (deleteError) throw toSocialError(deleteError);

  await pushPhotos(sb, userId, visited, tripIdByClientId);
}

/** Pull a user's trips and photos. Works for yourself or, thanks to RLS, an accepted friend. */
export async function fetchVisited(userId: string): Promise<VisitedMap> {
  const sb = requireBackend();
  const [{ data, error }, photosByTrip] = await Promise.all([
    sb.from("trips").select("client_id, country_id, title, start_date, end_date, notes").eq("user_id", userId),
    fetchPhotosByTrip(sb, userId),
  ]);
  if (error) throw toSocialError(error);
  return rowsToVisited((data ?? []) as TripRow[], photosByTrip);
}
