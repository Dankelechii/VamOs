import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { pushVisited } from "../services/social";
import { VisitedMap } from "../types";

export type SyncState = "idle" | "syncing" | "synced" | "error";

/**
 * Keeps the signed-in user's map mirrored to the server.
 *
 * Local-first on purpose: AsyncStorage stays the source of truth, edits apply
 * instantly offline, and this pushes up afterwards. The app never blocks on the
 * network, and a failed sync degrades to "we'll try again" rather than to a broken
 * screen — which matters for an app people use in airports and on planes.
 *
 * Debounced, because a burst of edits (marking five countries in a row) should be one
 * request, not five. The ref comparison also skips a push when nothing actually
 * changed, so re-renders don't cause traffic.
 */
export function useMapSync(visited: VisitedMap, loaded: boolean) {
  const { userId } = useAuth();
  const [state, setState] = useState<SyncState>("idle");
  const lastPushed = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !loaded) return;

    const payload = JSON.stringify(visited);
    if (payload === lastPushed.current) return;

    const timer = setTimeout(async () => {
      setState("syncing");
      try {
        await pushVisited(userId, visited);
        lastPushed.current = payload;
        setState("synced");
      } catch {
        setState("error");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [userId, loaded, visited]);

  // Signing out must clear this, or signing back in as someone else would skip the
  // first push because the payload happened to match.
  useEffect(() => {
    if (!userId) {
      lastPushed.current = null;
      setState("idle");
    }
  }, [userId]);

  return state;
}
