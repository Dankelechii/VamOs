# Contributing to VamOs

Thanks for taking a look. This is a working, pre-release app, and community feedback
and contributions are genuinely welcome — this isn't a formality.

## Ways to help

- **Try it and report what breaks.** The fastest way to contribute right now is just
  running the app (see the README's "Running it" section) and [opening an issue](../../issues/new)
  for anything that crashes, looks wrong, or confuses you.
- **Open-ended ideas or questions** belong in [Discussions](../../discussions) rather
  than Issues — things like "have you thought about X" or "why does Y work this way."
- **Pull requests** are welcome, for bug fixes, small features, or the items already
  listed under "Suggested next steps" in the README. For anything larger than a small
  fix, open an issue or a Discussion first to talk through the approach before you put
  the work in — saves both of us time if the direction needs adjusting.

## Before you open a PR

- `npx tsc --noEmit` should pass with no errors.
- `npx expo-doctor` should report no issues.
- If you touch `supabase/schema.sql`, run `./supabase/tests/run.sh` (needs a local
  PostgreSQL) — it stands up a throwaway database and checks the row-level security
  policies actually hold. This matters more than it sounds like: the security model is
  the whole point of that file.
- Keep the tone of code comments consistent with what's already there — they explain
  *why*, not *what*. If a comment would be obvious from reading the code, it probably
  shouldn't be there.

## Project structure

See the "Project structure" section in the [README](README.md) — it maps out where
things live.

## Code of conduct

Be respectful, assume good faith, and keep feedback about the code, not the person.
Anything else, flag it and it'll be dealt with.
