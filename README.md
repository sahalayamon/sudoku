# Sudoku

A calm, premium Sudoku for web and mobile. Offline-first, installable, with five genuinely different difficulty levels, a daily puzzle, progressive hints, statistics, achievements and optional sync.

> Clear your mind. One number at a time.

- **Next.js 16 (static export) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Framer Motion · Zustand · Lucide**
- **Supabase** for optional accounts and sync (schema, Row Level Security and server-side validation included)
- **231 automated tests**, including the SQL migration run against a real in-process Postgres

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # typecheck + lint + tests
npm run build        # static export to ./out, stamps the service worker
npm run serve        # serve ./out at http://localhost:4173 (test the PWA and offline mode)
```

Everything works with no configuration. Without Supabase keys the app is a fully functional guest experience; progress is stored on the device.

To enable accounts and sync, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then see [Backend](#backend-supabase).

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (also installs `window.__sudokuDev` QA helpers: `seed()`, `solveAllBut(n)`, `clear()`; development builds only) |
| `npm test` / `npm run test:db` | All tests / only the database tests |
| `npm run themes` | Regenerate the full-theme CSS from the table in `scripts/generate-themes.mjs` |
| `npm run icons` | Regenerate PWA icons from the SVG definition in `scripts/generate-icons.mjs` |
| `npm run android` / `android:release` | Build the Android app: a debug APK, or a signed release APK in `dist/` (see [Android app](#android-app)) |
| `npm run edge:sync` | Copy the engine into `supabase/functions/_shared` for the Deno edge function |
| `npm run format` | Prettier |

---

## How difficulty actually works

Difficulty is **not** the number of empty cells. Every puzzle is rated by solving it the way a person would, always applying the easiest technique that works, and the level is decided by the hardest technique the puzzle *requires*:

| Level | Requires at least one | Allowed ceiling | Typical clues |
| --- | --- | --- | --- |
| Beginner | Naked single | Naked singles only | 39–46 |
| Easy | Hidden single in a box | + box singles | 33–37 |
| Medium | Hidden single in a row/column | + line singles | 28–33 |
| Hard | Locked candidates, naked/hidden pairs or triples | + those | 26–30 |
| Expert | X-Wing, XY-Wing, XYZ-Wing or Swordfish | + those | 24–32 |

Generation (`src/lib/sudoku/generator.ts`):

1. Build a random solved grid (seeded PRNG, so the same seed always gives the same puzzle).
2. Carve cells in 180° symmetric pairs. A cell is removed **only if the puzzle stays fully solvable using the techniques allowed for the level**. Logical solvability implies a unique solution and caps the difficulty.
3. Rate the result independently. It is accepted only if it genuinely *needs* the level's signature technique.
4. Validate before it is ever shown: correct structure, no duplicate givens, exactly one solution, solution matches the backtracking solver.

The tests assert, for every level and several seeds, that the puzzle is solvable with the level's techniques, **not** solvable with the level below's, and that scores rise with level. Expert generation takes ~0.2–1.5 s, so it runs in a Web Worker, and a small pool of pre-generated puzzles makes "New game" instant.

The Daily puzzle is derived from the date alone (`daily-v1:YYYY-MM-DD`), so every device and the server agree on it with no coordination. Difficulty follows the weekday (gentle early in the week, Expert on Saturday).

### Engine API (`src/lib/sudoku`)

`generatePuzzle`, `solvePuzzle`, `validatePuzzle`, `hasUniqueSolution`, `calculateDifficulty`, `getHint`, `checkMove`, `generateCandidates`. The engine has no UI, DOM or store dependency and uses only erasable TypeScript: the same source runs in the browser, in a worker, in Node tests and on Deno.

### Hints

`getHint` solves forward from the *current* board, so the explanation always matches what is actually on screen:

1. **Look here**: highlights the cell and the row/column/box involved.
2. **Explain**: plain-language reasoning, e.g. *"Only 7 can fit here because 1, 2, 4, 5, 6, 8 and 9 already appear in this row, column, or box."* Harder patterns list each elimination first.
3. **Reveal**: places the number (never counted as a mistake).

If a wrong number is on the board, the hint says so first. Games that used hints are excluded from best times and "perfect" achievements.

---

## Architecture

```
src/
  app/                    Next.js routes (static export). (main)/ shares the app shell; play/ has its own chrome.
  components/
    ui/                   Button, Modal, Segmented, Switch, Tooltip, DropdownMenu, Toaster, ...
    layout/               AppProvider (boot), AppShell, Splash, SyncStatus, OfflineBanner
    sudoku/               SudokuBoard, SudokuCell, NumberPad, GameControls, GameTimer, PuzzleInfo, HintPanel, ...
  features/
    game/                 pure board mechanics, lifecycle actions, keyboard, per-cell view flags
    puzzle/               worker client, pre-generated pool, daily
    statistics/ achievements/ settings/ home/ history/ auth/ onboarding/
  lib/
    sudoku/               the puzzle engine (independent of everything else)
    storage/              safe localStorage, sanitising loaders, versioned repository
    sync/                 merge rules, row mapping, engine, controller
    supabase/ feedback/ ...
  stores/                 zustand: game, library, settings, meta, ui, auth
  types/ hooks/
supabase/
  migrations/0001_init.sql        schema, RLS, validation functions, sync_game()
  functions/generate-daily/       edge function that registers upcoming Daily puzzles
tests/                    engine, stores, persistence, sync, SQL (PGlite)
```

**State and performance.** The board never re-renders as a whole. Each of the 81 cells subscribes only to its own value, notes and a single "flags" bitmask (selected / related / same number / invalid / hint ...), so entering a number re-renders a handful of cells. The timer is the only ticking component and writes straight to the DOM. Moves are stored as reversible patches, which makes undo/redo exact (including auto-removed notes) and cheap to persist.

**Persistence.** Local storage is wrapped so a blocked or full store never throws (it degrades to memory for the session). Every record read from disk, from another device or from an imported file is validated and repaired or dropped rather than trusted. The game autosaves after every move (debounced), on a 10 s heartbeat, on `pagehide`, and when the tab is hidden. The timer uses timestamps, not interval counts, and auto-pauses when the tab is hidden.

**Offline-first.** `public/sw.js` is stamped at build time with every file in the export, so the whole app (including the puzzle worker and fonts) is cached on first visit. Navigation is network-first with a cache fallback; hashed assets are cache-first. New versions are offered through a toast and never swap assets under a game in progress.

**Sync.** Local data is always the source of truth and play never waits on the network. A sync pass pulls changes (cursor on the server clock), merges with explicit rules, pushes what the server lacks through the validated `sync_game` RPC, then reconciles settings (last write wins) and achievements (union). Conflict rules (`src/lib/sync/merge.ts`, unit-tested):

- A finished game always beats an in-progress copy; completed > failed > abandoned.
- Two in-progress sessions: the most recent edit wins; within two seconds, the one with more progress.
- The game currently being played is never replaced from the server.

### Android app

The same static export runs inside a Capacitor shell (`android/`, app id `app.sudoku.play`). Everything is packaged in the APK, so it works with no network at all.

```bash
npm run android            # debug APK    -> dist/Sudoku-debug.apk
npm run android:release    # signed APK   -> dist/Sudoku.apk   (the one to install or share)
npm run android:bundle     # signed AAB   -> dist/Sudoku.aab   (for Google Play)
npm run android:open       # open the project in Android Studio
```

The script (`scripts/android.mjs`) finds Android Studio's JDK and the Android SDK, builds the web app, runs `cap sync`, then Gradle. The first `android:release` generates a signing key at `android/keystore/` and `android/keystore.properties` (both git-ignored). **Back them up**: updates must be signed with the same key. The version comes from `package.json`.

To install on a phone: copy `dist/Sudoku.apk` over, open it, and allow "install unknown apps" for the app you opened it from. Or with USB debugging: `adb install -r dist/Sudoku.apk`.

**Offline data.** Games, history, statistics, achievements and settings live in the WebView's localStorage, and every write is mirrored to the native Capacitor Preferences store (`src/lib/storage/native-mirror.ts`). If Android ever clears the WebView's storage, the app restores everything from the native copy on the next start. The game is flushed whenever the app goes to the background, and the Settings backup file is shared through the system share sheet.

The service worker is skipped inside the native shell. The shell also handles the hardware back button, edge-to-edge system bars that follow the theme, the splash screen, and native haptics.

---

## Backend (Supabase)

1. Create a project and run `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`).
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. (Recommended) deploy the Daily registrar:

```bash
npm run edge:sync
supabase functions deploy generate-daily --no-verify-jwt
```

Schedule it daily (SQL editor; needs `pg_cron` and `pg_net`):

```sql
select cron.schedule('generate-daily', '5 0 * * *', $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/generate-daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR-SERVICE-ROLE-KEY')
  );
$$);
```

### Schema

| Table | Purpose |
| --- | --- |
| `users` | Profile, 1:1 with `auth.users` (created by trigger) |
| `puzzles` | Puzzle definition (givens, difficulty, score). Shared, no personal data |
| `puzzle_solutions` | Solutions, **unreachable from clients** (RLS on, no policy) |
| `daily_puzzles` | One puzzle per date; future dates are not released |
| `games` | One row per play: outcome, time, mistakes, hints |
| `game_sessions` | The mutable board of a game still in progress |
| `statistics` | Server-maintained aggregates (totals, best/avg time, streaks, per difficulty) |
| `achievement_definitions`, `achievements` | Catalogue and per-user unlocks |
| `user_settings` | Preferences, last write wins |

### Security model

- **RLS everywhere.** Users can read only their own games, sessions, statistics, settings and achievements.
- **No direct writes to game data.** `insert`/`update` on `games`, `game_sessions`, `statistics`, `puzzles`, `puzzle_solutions` and `daily_puzzles` are revoked for clients. Every write goes through `sync_game()`, which re-validates on the server: givens contain no duplicates, the board agrees with the givens, a "completed" grid is a *valid complete solution* that keeps every given (equivalent to matching the unique solution, without exposing it), the time is plausible (at least 0.25 s per empty cell), timestamps are clamped to "now", a finished game is never replaced by an unfinished one, and a Daily must be the server's puzzle for that date whenever the server has one.
- Statistics and streaks are computed on the server from `games`, not accepted from the client.

Honest limits: puzzle generation is deterministic open-source code, so a determined user could compute a Daily solution locally; the server therefore validates results rather than hiding puzzles. Difficulty of non-Daily puzzles is self-reported by the device, which only affects that user's own statistics. Achievements are inserted by the client (own rows only, against a fixed catalogue). There are no global leaderboards, which keeps these trade-offs harmless.

---

## Testing

```bash
npm test
```

| Area | Covered |
| --- | --- |
| Engine | parsing, backtracking solver, uniqueness (including a deadly-rectangle case), validation, candidates, move checks, every technique on hand-built states, difficulty rating |
| Generation | all five levels × several seeds: valid, unique, rated at the requested level by an independent calculation, requires the signature technique but not a harder one, reproducible from the seed |
| Hints | explanation text, wrong-number detection, preferred cell, full-puzzle hint walk to completion at every level |
| Game state | placing, notes, auto-cleanup, undo/redo, mistake limit, completion, personal best, pause/resume, visibility, save and restore round-trip |
| Persistence | repository round-trips, corrupt data dropped, recoverable damage repaired, export/import |
| Sync | merge rules, row mapping, a full sync pass against a fake client (push, pull, conflicts, settings, achievements, rejected vs. transient errors) |
| Database | the real migration on PGlite: validation functions, `sync_game`, server-side streaks, RLS, blocked direct writes, solutions never exposed |

## Themes

The palette icon in the navbar (and in the game bar) opens a theme picker with three choices:

- **Appearance**: System, Light or Dark. It applies to whichever colour or theme is chosen.
- **Colour** (accent only): Verdigris, Indigo, Ocean, Plum, Graphite. These re-colour selection, your numbers, primary buttons and progress on top of the default neutrals.
- **Themes** (complete looks, each with a light and a dark version): Sage (green-grey, **the default**), Midnight (navy), Sepia (parchment), Slate (cool grey) and Contrast (pure black and white with strong borders, for low vision).

The choice is saved with your settings, syncs when signed in, and is applied before first paint so there is no flash. The browser's status-bar colour follows the theme.

Where things live: the swatch list is `src/lib/palettes.ts`; accent palettes are written by hand in `src/app/globals.css`; full themes are generated from one table by `npm run themes` (`scripts/generate-themes.mjs`). Tests (`tests/palettes.test.ts`) keep the CSS and the swatches in sync and check **WCAG AA contrast for every palette in both modes** (text, secondary text, your numbers, button labels, errors, hints, board lines; Contrast is held to a stricter bar). To add a theme, add a swatch entry and a table entry, then run `npm run themes`.

## Accessibility

Full keyboard play (`?` lists the shortcuts), roving focus on the `grid`, descriptive `aria-label` on every cell, a live region for mistakes and hints, visible focus rings, `prefers-reduced-motion` honoured, errors never rely on colour alone (a corner dot accompanies the red), 44 px touch targets for primary controls, and AA contrast in both themes.

## Keyboard shortcuts

`1`–`9` enter a number · `⇧1`–`⇧9` toggle a note · arrows move · `⌫` erase · `N` notes · `H` hint (again to go deeper) · `Z` / `⇧Z` undo / redo · `Space` pause · `Enter` next empty cell or next hint step · `Esc` clear selection or close a hint · `?` help
