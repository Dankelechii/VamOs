# VamOs — App Store Connect listing draft

Copy-paste source for App Store Connect. Every field here is grounded in what the app
actually does today — nothing promises a feature that isn't built. Replace the
bracketed placeholders before submitting.

## App name (30 char max)

```
VamOs
```

## Subtitle (30 char max)

```
Map every trip you've taken
```
(28 chars. Alternates: "Your world map of travels" (26), "Track trips, see friends' too" (30).)

## Promotional text (170 char max — editable anytime without a new review)

```
Fill in countries as you visit them, log trips with photos and notes, and see where your friends have been. Works fully offline — no account required.
```

## Description (4000 char max)

```
VamOs turns your travel history into a world map you actually fill in.

Tap any country you've visited to mark it, add the trip's dates and notes, and attach
photos — every trip gets its own entry, so going back somewhere is a new chapter, not
an edit of the old one. Your map fills in as you go, with a running count of how much
of the world you've covered and badges for each continent.

EVERYTHING WORKS OFFLINE
No account, no sign-up, no data collection required. Your map, trips, notes, and
photos live on your device from the moment you open the app.

SEE WHERE YOUR FRIENDS HAVE BEEN
Create a free account to search for friends by username, send requests, and once
accepted, browse their map, trips, and photos — the same way they'll see yours.
Blocking is one tap and takes effect immediately.

BUILT FOR THE DETAILS
- A travel checklist for the boring-but-important stuff: passport expiry, visas,
  travel insurance, telling your bank.
- Continent badges as you branch out from your home region.
- Light, dark, or system appearance.
- Share any trip photo straight to Instagram.

VamOs is for people who'd rather look at where they've actually been than fill out a
spreadsheet about it.

---
[Add 2–3 sentences here about who's behind VamOs, if you want a "why we made this"
closing paragraph — optional, and the app doesn't need one to read as complete.]
```

## Keywords (100 char max, comma-separated, no spaces after commas needed)

```
travel,map,trip log,travel journal,world map,visited countries,travel tracker,friends,trip planner,bucket list
```
(Apple already indexes the app name/subtitle — don't repeat "VamOs" or exact subtitle words here.)

## What's New in This Version (for v1.0, keep it short — first release)

```
First release: fill in your world map, log trips with photos and notes, and connect
with friends to see where they've been.
```

## Category

- **Primary:** Travel
- **Secondary:** Social Networking (accounts + friend requests are a real, load-bearing
  feature, not decoration — this is the honest secondary category, not Lifestyle)

## Support URL / Marketing URL

```
Support URL: [REQUIRED — a page or even a mailto: users can reach for help]
Marketing URL: [OPTIONAL]
Privacy Policy URL: [REQUIRED — host the finished privacy policy and paste its URL here;
                      see vamos-privacy-policy artifact]
```

## Copyright

```
© [YEAR] [YOUR LEGAL NAME OR COMPANY NAME]
```

## Age rating questionnaire — how to answer honestly

Apple's rating comes from a questionnaire, not a number you pick, but here's how
VamOs's actual features map onto it so you're not guessing blind:

- **User-generated content: Yes.** Trip notes, captions, and profile fields are
  free text a user writes. Photos are user-selected from their own library.
- **Users can communicate with other users: not really** — there's no chat, no
  comments, no messaging. The only "communication" is a friend request/accept and a
  block, which is much lower-risk than open messaging. Answer the messaging question
  "No" if there's genuinely no text channel between users beyond that.
- Because there's a working block-and-report flow (see the app's Friends tab and the
  `reports` table in `supabase/schema.sql`), you can honestly answer "yes, we have a
  mechanism to filter/block/report" where the questionnaire asks — this typically
  keeps UGC-driven apps out of the highest age tiers rather than pushing them into one.
- Expect somewhere in the 12+ range for "infrequent/mild" unmoderated UGC exposure,
  but let Apple's questionnaire output decide the actual number — don't hardcode 12+
  or 17+ in App Store Connect without running it.

## App Privacy ("nutrition label") — data types to declare

Based on exactly what `supabase/schema.sql` and `src/services/social.ts` collect:

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Email Address | Yes (if account created) | Yes | No | App Functionality |
| User ID | Yes (if account created) | Yes | No | App Functionality |
| Photos | Yes (if account created and you attach trip photos) | Yes | No | App Functionality |
| Other User Content (trip notes, checklist text) | Yes (synced only if account created) | Yes | No | App Functionality |
| Precise/Coarse Location | **No** — the app never requests location | — | — | — |
| Identifiers (advertising/device ID) | **No** | — | — | — |
| Usage Data / Analytics | **No** — no analytics SDK is present in the app | — | — | — |
| Contacts | **No** | — | — | — |

Declare **"Data Not Linked to You"** as not applicable and **"Data Used to Track You"**
as **none** — there is no ad SDK, no cross-app tracking, no IDFA usage anywhere in the
codebase (verified: no analytics/tracking packages in `package.json`).

## Screenshots

Not something this document can produce — capture these from a real device/simulator
once `eas build` is running:
1. Map tab with a partially filled-in world map (make sure some countries are visited
   before capturing — an empty map undersells the feature).
2. Country detail screen showing a trip with a photo and notes.
3. Friends tab showing a friend's profile/map.
4. Profile tab with stats and continent badges.
5. (Optional) The checklist.

Required sizes depend on device — App Store Connect will tell you exactly which are
missing when you try to submit.
