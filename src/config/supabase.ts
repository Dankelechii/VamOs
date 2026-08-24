import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

/**
 * The Supabase client, or null when no backend is configured.
 *
 * Credentials come from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
 * (see .env.example). If either is missing the app runs exactly as it did before —
 * fully local, no accounts, no network. That is deliberate: the backend is additive,
 * so a broken or absent config degrades to the working offline app rather than to a
 * broken one, and anyone cloning the repo gets something that runs immediately.
 *
 * The anon key is *designed* to ship in the client. It grants nothing on its own —
 * every table is behind row-level security, so what a holder of this key can read is
 * exactly what the policies in supabase/schema.sql allow. The service-role key is the
 * one that must never appear in an app bundle; it is not used anywhere in this
 * project.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isBackendConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        // AsyncStorage rather than SecureStore: session tokens are short-lived and
        // SecureStore has a 2KB per-item limit that Supabase's session payload can
        // exceed, which fails silently and logs people out at random.
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No deep-link callback is wired up, so URL-based session detection would
        // only ever misfire here.
        detectSessionInUrl: false,
      },
    })
  : null;

/** Narrowing helper so call sites don't repeat the null check. */
export function requireBackend(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and " +
        "EXPO_PUBLIC_SUPABASE_ANON_KEY — see supabase/README.md."
    );
  }
  return supabase;
}
