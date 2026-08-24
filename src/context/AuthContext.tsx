import type { Session } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isBackendConfigured, supabase } from "../config/supabase";
import { fetchMyProfile, PublicProfile } from "../services/social";

interface AuthContextValue {
  /** False when no Supabase credentials are set — the app runs local-only. */
  backendConfigured: boolean;
  /** True until the stored session has been checked, so nothing flashes signed-out. */
  loading: boolean;
  session: Session | null;
  userId: string | null;
  account: PublicProfile | null;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    // Fires on sign-in, sign-out and every token refresh, which is what keeps a
    // long-lived install signed in without the app polling anything.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setAccount(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refreshAccount = async () => {
    if (!userId) {
      setAccount(null);
      return;
    }
    try {
      setAccount(await fetchMyProfile(userId));
    } catch {
      // A failed profile read must not sign anyone out or block the UI — the local
      // map still works, and the next refresh will pick it up.
      setAccount(null);
    }
  };

  useEffect(() => {
    refreshAccount();
  }, [userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      backendConfigured: isBackendConfigured,
      loading,
      session,
      userId,
      account,
      refreshAccount,
    }),
    [loading, session, userId, account]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
