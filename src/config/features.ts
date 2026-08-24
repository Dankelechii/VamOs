/**
 * Feature flags for things that are built but not shippable yet.
 *
 * These exist so an unfinished feature can be taken out of a release without
 * deleting its code — flip the flag back when the thing it depends on lands.
 */
export const FEATURES = {
  /**
   * The Friends tab.
   *
   * On, now that it's real: accounts, username search and friend requests all run
   * against Supabase (see supabase/schema.sql). It was off while friends were mock
   * data, because shipping five hardcoded people reads as an incomplete app.
   *
   * The tab still degrades honestly — with no backend configured it explains that
   * rather than showing anything fake, so a local-only build is fine to ship.
   */
  friends: true,
} as const;
