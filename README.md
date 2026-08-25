# VamOs

A social travel app: fill in countries on a world map as you visit them, save photos from each trip, and see where your friends have been.

The map, trips, notes and checklist work fully offline on device storage (`AsyncStorage`) — no account needed. Accounts, usernames, friend requests, and map sync — including trip photos — are real, running against Supabase (see `supabase/README.md` for setup); the Friends tab explains plainly when no backend is configured and falls back to local-only.

**Try it in your browser:** [dankelechii.github.io/VamOs](https://dankelechii.github.io/VamOs/) — same real app, running on `react-native-web`. A couple of things behave differently on web: Instagram sharing falls back to whatever your browser's share sheet offers (or nothing, on browsers without one), and pinch-to-zoom on the map is built for touch, so mouse/trackpad panning feels different. Everything else — accounts, friends, trip logging, photos — works the same as on a phone.

## What's in here

- **Map tab** — a stylized, pinch-to-zoom/pan world map (177 countries). Unvisited countries are dark ("blacked out"); tap one to view it, mark it visited, add notes, and attach photos from your camera roll.
- **Friends tab** — real accounts: search by username, send/accept friend requests, block and report. An accepted friend's map (visited countries, trip notes/dates) loads live from Supabase, gated by row-level security.
- **Profile tab** — your stats (countries visited, % of the world, photo count), a grid of your recent trip photos, theme, and account management (sign out / delete account).
- All your changes (visited countries, notes, photos) persist locally between app launches. There's a "Load example trips" button on the Profile tab if you want to see how everything works.

## Known limitations

- **Reports have no admin UI.** Blocking someone inserts a row into `reports` (see schema), but nothing alerts a human yet — check `select * from reports where reviewed_at is null` manually until that's wired up.
- **No restore-on-new-device for your own account.** Signing in on a fresh install pushes local data up but doesn't pull your previously-synced trips back down yet — friends' data already works this way (see `fetchVisited` in `src/services/social.ts`), your own account just doesn't call it on sign-in yet.

## Running it

You'll need [Node.js](https://nodejs.org) (18+) and the **Expo Go** app on your phone (App Store / Play Store).

```bash
npm install
npx expo start
```

Scan the QR code that appears with your phone's camera (iOS) or the Expo Go app (Android). The app will load over your local network — make sure your phone and computer are on the same Wi-Fi.

> **iOS note:** this project tracks a very current Expo SDK. If Expo Go says the
> project "requires a newer version of Expo Go," that's Apple's App Store review
> lagging behind Expo's release, not something wrong with the app — the App Store
> build of Expo Go periodically falls a version or two behind. Android isn't affected
> (Play Store review is faster). Workarounds: the iOS Simulator (needs a Mac), or
> `eas go` (needs a paid Apple Developer account) — see Expo's changelog for current
> status.

## Project structure

```
App.tsx                        entry point (providers + navigation)
src/
  data/
    worldCountries.ts          generated SVG country paths (see below)
    mockData.ts                default local profile + sample trips ("Load example trips")
  context/TravelContext.tsx    app state: visited countries, notes, photos (persisted)
  navigation/                  React Navigation setup (bottom tabs + stack)
  screens/                     Map, CountryDetail, Friends, FriendProfile, Profile
  components/                  WorldMapSvg, PhotoGrid, StatBadge
  theme/colors.ts               color palette
  utils/flag.ts                 country flag emoji + date formatting
```

`src/data/worldCountries.ts` was generated from Natural Earth boundary data (via `d3-geo` + `world-atlas`), projected to SVG paths. If you ever want to regenerate it (e.g. swap the projection or resolution), the generator script is available on request — it's not part of the app bundle.

## Branding

Real logo/icon assets are in `assets/` (wordmark, icon, splash, Android adaptive icon layers) and wired up in `app.json` and `LandingScreen.tsx`.

## Suggested next steps

- Wire an alert (email/Slack) on new `reports` rows instead of relying on someone to check the table.
- Add search/filter on the map and a country list view as an alternative to tapping the map directly.
- Add a social feed (e.g. "Priya just checked in to Vietnam").

## Feedback & collaboration

This is a real, working app, pre-App-Store-release, and I'd genuinely like to hear
from anyone who tries it — and I'm open to collaborators, not just bug reports. Most
useful right now:

- **Bugs** — anything that crashes, looks wrong, or behaves unexpectedly. [Open an issue](../../issues/new).
- **Confusing UX** — if a screen made you pause and think "wait, what?", that's worth
  reporting even if nothing technically broke.
- **Feature thoughts, general reactions, "have you considered..."** — [Discussions](../../discussions)
  is the right place for anything more open-ended than a bug report.
- **Pull requests** — genuinely welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for
  what to check before opening one, and the "Known limitations" and "Suggested next
  steps" sections above for concrete places to start.

Screenshots/screen recordings are always welcome and make bug reports much faster to
act on. If you spot something security- or privacy-related, please open an issue
rather than a public Discussion so it can be looked at before it's widely visible.
