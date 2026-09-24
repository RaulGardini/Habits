@AGENTS.md

# Habits — project conventions

Free, local-first habit tracker + planner (iOS, Android, web). No login, no ads, no paid services.
Built in phases; see "Roadmap". **Do not start a new phase without the owner's approval.**

## Language

- The app ships in **pt-BR and English** (`src/i18n`). Code, identifiers, comments and commit
  messages: **English**.
- Translation keys are the pt-BR strings themselves: `t('Concluir')`, `t('{count} eventos', { count })`.
  Write new UI strings in pt-BR, wrap them in `t()` and add the entry to `src/i18n/en.ts`
  (a missing entry falls back to Portuguese).
- `t` is a plain function (no hook), so it works in `src/core` too; the root layout remounts the
  tree on a language change (`key={language}`), which is why module-level option arrays must be
  functions (see `THEME_OPTIONS()`), not constants.
- Dates: `formatWith(date, ptPattern, enPattern)` and `dateLocale()`; never import `ptBR` directly.
- The language lives in the settings store (synced setting `language`), defaulting to the device
  locale. Android/iOS home screen widgets are still pt-BR only.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).

## Commands

```bash
npm run web          # dev server (web) — http://localhost:8081
npm start            # dev server (Expo Go / dev build)
npm run check        # lint + typecheck + tests (+ time zones, SQL) — run before every commit
npm run test:tz      # date tests once per device time zone (Jest cannot switch zones in a run)
npm run db:generate  # generate a migration after editing src/db/schema.ts
npm run format       # prettier
npm run assets       # regenerate icon/splash/favicon/widget previews (scripts/generate-assets.mjs)
npm run legal        # rebuild public/privacidade.html from src/features/legal/privacy.json
```

Always add Expo packages with `npx expo install <pkg>` (SDK-compatible versions).

## Architecture (dependency direction: top → bottom only)

```
src/app/          Expo Router routes. Thin: import a screen from features/ and render it.
src/features/     Screens + feature components (habits/, today/, settings/…).
src/ui/           Generic design-system components (AppText, Button, Card, Screen…).
src/stores/       Zustand stores. Call repositories; hold loaded state; optimistic updates.
src/repositories/ Data-access interfaces (types.ts) + implementations (drizzle/, memory/).
src/db/           Drizzle schema, client, migrations, bootstrap.
src/core/         PURE business logic (no React/RN imports). Fully unit-tested.
src/theme/        Tokens, habit color palette, ThemeProvider.
src/lib/          Small platform helpers (ids, haptics, navigation).
```

- UI and stores never import Drizzle or `src/db` — only `@/repositories`.
- Two store styles: cached state with optimistic updates (`habitsStore`, `entriesStore`) for the
  hot paths (`entriesStore` also caches date ranges — `useEntriesInRange` — patched in memory on
  save, so a check never reloads years of history; the day on screen loads before long ranges), and "query + version" hooks (`plannerStore`: `useEvents`, `useGoals`…) that refetch
  after any write made through `plannerActions`. Writes must go through the actions.
- Business rules (what is due on a day, progress, streaks…) live in `src/core` as pure functions.
- Platform-specific code uses file extensions (`foo.web.ts` next to `foo.ts`), e.g. `ui/dialogs`, `lib/haptics`.
- Path alias: `@/` → `src/`.

## Data rules

- Every synced table has `id` (UUID via `expo-crypto`), `created_at`, `updated_at`, `deleted_at`.
- **Soft delete only** (`deleted_at`); every read filters `deleted_at IS NULL`.
- Instants are ISO-8601 UTC strings (`nowIso()`); **calendar days are local `YYYY-MM-DD` strings**
  (`LocalDate`, `src/core/dates/localDate.ts`). Never store a day as a timestamp. Day arithmetic
  is integer calendar math (`dayNumber`), never `Date` math, so time zones and DST cannot shift it.
- `useNow`/`useToday` tick on minute boundaries and refresh on foreground (midnight rollover).
  UI that acts on a day keeps the day it was opened for (see `HabitActionTarget.date`).
- `habit_entries` has a unique `(habit_id, date)`; upserts revive soft-deleted rows.
- Habit colors are stored as palette keys (`"violet"`), resolved per theme by `resolveHabitColor`.
- Schema change → edit `src/db/schema.ts` → `npm run db:generate` → commit the generated files.
  Migrations run at startup (`prepareDatabase` in `src/db/migrate.ts`: `PRAGMA foreign_keys = ON`
  + one transaction per migration), the same code path the tests use.
- Any write of more than one row/table goes in `db.transaction` (use `tx` inside, never `db`).
  Every statement goes through one queue (`createSerializedDatabase`, `src/db/transactions.ts`)
  and a transaction holds it until COMMIT: nothing else can run inside (and vanish with) it.
- Editing a `.sql` migration after it was bundled: clear caches (`npx jest --clearCache`,
  `npx expo start -c`); both inline the SQL at transform time.
- Every hot query must use an index; `src/db/load.test.ts` checks the plans (`EXPLAIN QUERY PLAN`)
  on 40 habits × 3 years (`generateSeedData`, `src/db/seed.ts`). A partial index only works when
  the query repeats its predicate as a literal (see `events_series_idx`).

## Web / SQLite (important)

- We use Drizzle's **`sqlite-proxy` driver over expo-sqlite's async API** on all platforms
  (`src/db/client.ts`). Do NOT switch to `drizzle-orm/expo-sqlite`: it uses the sync API, which is
  broken on web in expo-sqlite 57 (results > 255 bytes are truncated, short timeouts).
- expo-sqlite on web needs cross-origin isolation (`SharedArrayBuffer`). Headers required:
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`.
  - Dev server: added in `metro.config.js` (Expo serves index.html before Metro middleware).
  - Hosting: `public/_headers` (Netlify / Cloudflare Pages) and the `expo-router` plugin
    `headers` in `app.json` (EAS Hosting). Other hosts need equivalent config.
- `web.output` is `single` (SPA): the app reads local data, so there is nothing to pre-render.
- `react-native-web`'s `Alert` is a no-op → use `confirm` / `showError` from `@/ui/dialogs`.

## UI conventions

- Zustand v5: a selector must not build new objects/arrays (`state.habits.filter(...)` loops
  forever). Select the raw value and derive with `useMemo`, or use hooks like `useActiveHabits()`.

- Use `useTheme()` colors/tokens; no hard-coded colors outside `src/theme`. Brand = yellow:
  `primary` is for fills (buttons, selected chips, progress, heatmap) with `onPrimary` text;
  use `accent` for brand-colored text/icons on surfaces (yellow text is unreadable on light).
- Look: warm neutrals, Nunito (`fonts`/`typography`, loaded in the root layout), borderless
  cards with `softShadow()`, pill buttons, sentence-case headings, short kind copy. Avoid
  bordered boxes, ALL-CAPS labels and icon-per-heading decoration.
- Liquid Glass floats above content only (add buttons, nav pills, segmented-control tracks,
  the habit sheet), never on cards or full screens. On iOS the stack headers are transparent
  with the system blur, so `Screen`'s ScrollView uses `contentInsetAdjustmentBehavior="automatic"`.
- Liquid Glass: iOS tabs use `NativeTabs` (`expo-router/unstable-native-tabs`, system glass bar);
  Android/web keep JS `Tabs` (frosted bar on web). Floating controls use `<Glass>` (`src/ui/Glass`):
  native `GlassView` on iOS 26+, frosted CSS on web, translucent surface on Android. Never set
  opacity 0 on a `Glass` or its parents.
- Touch targets ≥ 44px (`MIN_TOUCH_SIZE`). Every icon-only button has an `accessibilityLabel`.
- Sheets/buttons that save do it once per opening (see `HabitActionSheet` `once`). Saves of the
  same entry are ordered and the newest tap wins (`entriesStore.save`); timer actions are queued
  (`timerStore.toggle`).
- Haptics (`src/lib/haptics.ts`, no-op `.web.ts` — keep both in sync): `hapticSelection` for
  picking (chips, segmented controls, changing day/period, opening the habit sheet),
  `hapticLight` for value changes, `hapticSuccess` on save/complete, and `hapticWarning` /
  `hapticError` fired by `confirm({ destructive })` / `showError`.
- Checkable rows use `accessibilityRole="checkbox"` + `accessibilityState`.
- Reanimated shared values: use `.get()` / `.set()` (React Compiler is enabled).
- Charts use `react-native-svg`. Don't put `onPress` on SVG shapes (leaks responder props to the
  DOM on web); wrap the SVG in one `Pressable` and hit-test the position (see `stats/Heatmap.tsx`).
- Heatmap colors: one hue per series (habit color / primary) at 4 opacity levels; days that do
  not count are outlined only. Rules for what counts live in `src/core/stats/stats.ts`.
- `typedRoutes` is disabled: on Windows the dev server's incremental typegen registers non-route
  files and breaks `tsc`. Route strings are therefore not type-checked — double-check paths.
- Wide screens (≥ 768px): sidebar navigation; content column max 720px (`Screen`).

## Today screen (`src/features/today`)

- Habits are circles (`HabitBubble`): a diagonal gradient of the habit color (`resolveHabitColor`
  → `gradient`, built with `shade()`), its icon, an animated SVG ring (spring; hidden at zero so
  the round cap does not draw a dot; full when done), name below and a check badge; five per row
  on phones, grouped by time of day.
- A tap opens `HabitActionSheet` (RN `Modal`): confirm/undo for yes/no, a stepper for quantity,
  start/stop for timers, plus "pular hoje" and "nota e mais" (the `/entry` route). Long press
  opens `/entry` directly.
- `Celebration` (confetti, deterministic so the React Compiler stays happy) fires when the last
  habit of the day is completed — never when merely opening an already-finished day.
- `TodayAgenda` shows the day's events under the habits (up to 4) with links to the Agenda.
- Perfect-day streak: `perfectStreak` (`src/core/habits/perfectStreak.ts`) counts consecutive days
  where every due habit was done — days with nothing due are neutral and an unfinished today never
  breaks it. `FLAME_TIERS` (0/5/10/30/50/100/200/300/500/1000) pick the colors in
  `src/theme/flameColors.ts`; `<Flame>` is an animated SVG (no emoji) living in the daily progress
  card, and tapping it opens `StreakSheet` with the whole ladder.
- The greeting uses the optional `displayName` setting ("Bom dia, Raul"), edited in Settings.
- `Celebration` also fires on streak milestones (7/30/100/365) with fewer confetti pieces.
- Light theme only: a tiled paper grain behind every `Screen` (`assets/images/paper-texture.png`,
  generated by `npm run assets`); dark screens stay flat so it does not read as noise.

## Agenda (`src/features/agenda`, logic in `src/core/planner/agenda.ts`)

- The old planner's tasks and day notes are no longer in the UI; their tables/repositories stay
  (existing data remains in backups and sync). Goals live on the Habits screen.
- Events: one row per series. `repeat` none/daily/weekly/monthly/yearly from `date`, optional
  `repeat_until`, `excluded_dates` (comma-separated days removed via "only this day"), `all_day`,
  `location`, `reminder_minutes` (all-day: before 09:00). `listByRange` also returns series that
  started before the range; `expandOccurrences` turns them into per-day occurrences.
- Event reminders are one-off notifications in the same plan as habits (`planReminders(..., events)`);
  re-planned by `rescheduleReminders()` (`src/stores/reminders.ts`) after habit/agenda changes.

## Cloud backups (`src/core/backup/cloudBackup.ts`, `src/stores/cloudBackupStore.ts`)

- The free Supabase plan has no restorable backups, so the app keeps its own: a full snapshot in
  `public.cloud_backups` every 7 days (checked after each successful sync), keeping the latest 8.
- Device-only settings are stripped (`pushableRows`). A restore stamps every row with the restore
  time so it wins the LWW merge everywhere, then syncs; the current state is snapshotted first.
- Settings shows the list with "Fazer backup agora" / "Restaurar" while signed in.

## Notifications & backup

- Reminders are **local notifications only** (`src/lib/notifications.ts`; no-op `.web.ts`).
  The whole set is re-planned by `planReminders` (pure, `src/core/reminders/plan.ts`) and
  rescheduled at startup and after any habit change: daily/weekly repeating triggers, one-off
  date triggers for "every X days" (21-day horizon), capped at 60 (iOS limit is 64).
- Backup = JSON of every table's raw rows (incl. soft-deleted). Import **merges** with
  last-write-wins by `updatedAt` (`planMerge`), matching entries by (habit, day) and notes by day.
  File I/O is platform-specific (`src/lib/backupFile.ts` / `.web.ts`).
- "Delete all data" hard-deletes every table (user-initiated, double confirmation).

## Widgets (need a development build — not Expo Go)

- Data for widgets is computed in TS: `buildWidgetSnapshot` (`src/core/widgets/snapshot.ts`),
  loaded by `src/widgets/data.ts`. Quick actions: toggle yes/no, +step quantity, timers open app.
- **Android** (`react-native-android-widget`): widgets are JSX rendered by a headless JS task
  (`src/widgets/android/`), registered from the custom entry `index.js`. The task opens the DB
  itself (`initRepositories()`) and writes taps directly. Widget sizes/labels: `app.json` plugin.
  That library crashes on import in Expo Go → only `require` it lazily behind `isExpoGo`.
  Every widget component must start with `'use no memo'` (the library calls components as plain
  functions; React Compiler hooks crash them — a module-level directive is NOT enough).
- **iOS** (`@bacons/apple-targets`, `targets/widget/*.swift`): SwiftUI cannot run JS or open
  the SQLite DB. The app writes a JSON snapshot to the App Group `group.com.raulgardini.habits`
  (`src/widgets/sync.ios.ts`); widget taps (AppIntent, iOS 17+) append to a queue that the app
  applies on start/foreground (`consumePendingWidgetActions`). Keep `Snapshot.swift` in sync
  with `src/widgets/iosPayload.ts`.
- The app redraws widgets after any habit/entry/settings change (`updateWidgets`, bootstrap).
- Native changes: `npx expo prebuild --clean`, then `npm run android` / EAS build.
- Local Android build (Windows): needs `ANDROID_HOME` and **JDK 17/21** (`JAVA_HOME` = Android
  Studio `jbr`); JDK 24+ breaks the CMake step. Fast emulator build:
  `./gradlew assembleRelease -PreactNativeArchitectures=x86_64 -x lintVitalAnalyzeRelease
-x lintVitalReportRelease -x lintVitalRelease`. If JS changes don't show up in a release APK,
  delete `android/app/build/generated/assets/react` (Gradle may reuse a stale bundle).

## Cloud sync (optional — docs/SUPABASE.md)

- Enabled only when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exist
  (`.env.local`, EAS env). Otherwise `syncConfigured` is false and the app stays offline-only.
- Remote schema: `supabase/schema.sql` (snake_case mirror + `user_id` + `server_updated_at`,
  RLS per user, `lww_guard` trigger, `delete_my_account()`). **Any local schema change must be
  mirrored there** (and in `REMOTE_TABLES`), then re-run it in the Supabase SQL editor.
- Conflicts: **last write to reach the server wins** (server clock, `server_updated_at`); client
  `updated_at` never decides (device clocks can be wrong). `lww_guard` only stamps the server time.
- Pending changes live in `sync_outbox`, filled by SQLite triggers (migration 0005) in the same
  transaction as each write — any write path (repos, import, restore) is queued automatically.
  Rows pulled from the cloud are applied with the triggers paused (`sync_pause`).
- Engine: `runSync` (`src/sync/engine.ts`) = push the outbox (`pendingChanges`, then
  `markPushed(upTo)`), then pull rows with `server_updated_at > cursor` per table and
  `applyRemote` them (`planRemoteApply`: server order wins, except rows still in the outbox).
  Device-only settings (`activeTimer`, `syncState`) never sync (`LOCAL_ONLY_SETTINGS`).
- Auth security: the Supabase session lives in the Keychain/Keystore (`src/lib/authStorage.ts`,
  chunked; `.web.ts` = localStorage), `flowType: 'pkce'`. E-mail links come back to
  `/auth/callback` (`authRedirectUrl`, must be in the Supabase Redirect URLs allow list) and are
  finished by `completeAuthLink`; password reset → `/auth/new-password`. Rules in
  `src/core/auth/auth.ts` (8+ chars, sign-in throttling, link errors); leaked passwords via
  `isPwnedPassword` (HIBP k-anonymity). Sign-out syncs, then deletes tokens and local data
  (asks first when changes could not be sent); an expired session only stops sync (`notice`).
- `useSyncStore` owns auth + sync status; bootstrap triggers sync on start, foreground and
  4 s after local changes. One round at a time (a request during a round runs another after);
  failures retry with exponential backoff (`retryDelayMs`). The first sync of the device with an
  account (`SyncState.userId`) queues every row (`enqueueAll`).

## Testing

- Jest (`jest-expo`). Tests live next to the code: `foo.test.ts`.
- Pure logic in `src/core` must have tests. Stores are tested against `createMemoryRepositories()`.
- Drizzle repositories are integration-tested against real SQLite in memory (`sql.js`) with the
  app's migrations: `createTestDatabase()` in `src/db/testing.ts` (see `drizzle.test.ts`).
- Test builders: `src/core/habits/testing.ts` (`makeHabit`, `makeEntry`).
- Load test on a real screen: `npm run web` and open `/?loadtest` (dev, or a web export built with
  `EXPO_PUBLIC_LOADTEST=1`): a separate `habits-loadtest.db` seeded with 3 years of data; cloud
  sync is disabled in that mode.
- Sync: `src/sync/engine.test.ts` (two sql.js devices + `createFakeRemote()`), and
  `npm run test:sql` (runs `supabase/schema.sql` on PGlite). `npm run check` runs both.

## Data on the device

- Never `console.*` in `src/` (ESLint `no-console`): use `logError` (`src/lib/log.ts`), which in
  production logs only the context and error type/code — error messages may carry query
  parameters or rows with personal data.
- No SQLCipher (not available in Expo Go): the DB relies on the OS sandbox + file encryption,
  as the privacy policy says. Revisit (`expo-sqlite` `useSQLCipher`) once store builds replace
  Expo Go.
- Optional app lock: `useAppLockStore` + `AppLockGate` (root layout) + `src/lib/localAuth.ts`
  (`.web.ts`: not offered). Device-only setting `appLock` (in `LOCAL_ONLY_SETTINGS`). Locks on
  cold start and after 30 s in the background (`shouldLockOnReturn`); covers the content in the
  app switcher. Face ID text comes from the `expo-local-authentication` plugin; keep it listed
  BEFORE `expo-secure-store` (`faceIDPermission: false`), which would otherwise remove it.
- Backup import: `parseBackup` checks format, version and every value (`invalidColumn`:
  enums, dates, times, numbers, JSON settings); `importMerge` is one transaction.
- `ios.infoPlist.NSAppTransportSecurity` pins `NSAllowsArbitraryLoads: false` (HTTPS only).

## Remote database security & backup (docs/SUPABASE.md)

- RLS on every table (`own rows`, `user_id = auth.uid()` in `using` and `with check`),
  `user_id default auth.uid()`, owner never changes (`lww_guard`), `anon` has no privileges.
  `npm run test:sql` checks it on PGlite (with Supabase's default grants emulated);
  `node --env-file=.env.local scripts/pentest-supabase.mjs` attacks the real project with the
  public key (and, with two test accounts in `PENTEST_*`, user B against user A).
- Only the publishable key ships in the app; never the secret/service_role key. `.env*` is
  git-ignored except `.env.example`.
- The free plan has no Postgres backups: `.github/workflows/db-backup.yml` (weekly, encrypted,
  secrets `SUPABASE_DB_URL` + `BACKUP_PASSPHRASE`), `scripts/db-restore.sh`, and
  `scripts/db-backup-drill.sh` (full dump → wipe → restore on a local Supabase).

## Release (docs/PUBLISHING.md)

- Icons, splash, favicon and widget previews are generated from SVG by `npm run assets`
  (resvg). Edit the script, not the PNGs.
- Privacy policy source: `src/features/legal/privacy.json` → in-app `/privacy` screen and
  `public/privacidade.html` (`npm run legal`). Keep the text in sync with what the app collects.
- `eas.json` profiles: `development` (dev client), `preview` (internal APK), `production`
  (auto-increment, remote app version), `apk` (production-signed APK for direct install, no store).
- Bundle id / package `com.raulgardini.habits`, App Group `group.com.raulgardini.habits` (final;
  they live in app.json + `src/widgets/iosPayload.ts` + `targets/widget/Snapshot.swift`). Cloud sync is **on**: Supabase project
  `jjmgidotiujptltxpfls`; URL + publishable key in `.env.local` (local/web export) and in EAS env
  (development/preview/production, used by `eas update --environment production`).
- `public/_redirects` makes SPA routes work on Netlify/Cloudflare Pages.
- The owner uses the app on iPhone through **Expo Go + EAS Update** (no paid Apple account):
  `npm run publish:go` publishes the iOS JS bundle to channel `production`; Expo Go opens
  `exp://u.expo.dev/<projectId>?channel-name=production&runtime-version=exposdk:57.0.0`.
  That requires `runtimeVersion.policy = "sdkVersion"` (Expo Go only loads `exposdk:*` runtimes)
  and only Expo Go-compatible native modules. After an SDK upgrade, republish. Switch the policy
  to `fingerprint`/`appVersion` if real store builds start using EAS Update.

## Roadmap

1. ✅ Setup + habit CRUD + Today screen (yes/no)
2. ✅ Quantity & timer habits, all frequencies, streaks, tests
3. ✅ Statistics & heatmaps
4. ✅ Planner (daily / monthly / yearly) + goals
5. ✅ Local notifications, JSON backup/import, settings
6. ✅ Widgets (iOS/Android, dev build)
7. ✅ (Optional) Supabase sync, last-write-wins by server time
8. ✅ Store release prep (icon, splash, privacy policy, EAS, store checklists)
9. ✅ Redesign: yellow brand, cozy UI, Liquid Glass on iOS, Planner → Agenda
