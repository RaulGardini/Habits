@AGENTS.md

# Habits — project conventions

Free, local-first habit tracker + planner (iOS, Android, web). No login, no ads, no paid services.
Built in phases; see "Roadmap". **Do not start a new phase without the owner's approval.**

## Language

- UI text: **pt-BR**. Code, identifiers, comments and commit messages: **English**.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).

## Commands

```bash
npm run web          # dev server (web) — http://localhost:8081
npm start            # dev server (Expo Go / dev build)
npm run check        # lint + typecheck + tests — run before every commit
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
  hot paths, and "query + version" hooks (`plannerStore`: `useTasks`, `useGoals`…) that refetch
  after any write made through `plannerActions`. Writes must go through the actions.
- Business rules (what is due on a day, progress, streaks…) live in `src/core` as pure functions.
- Platform-specific code uses file extensions (`foo.web.ts` next to `foo.ts`), e.g. `ui/dialogs`, `lib/haptics`.
- Path alias: `@/` → `src/`.

## Data rules

- Every synced table has `id` (UUID via `expo-crypto`), `created_at`, `updated_at`, `deleted_at`.
- **Soft delete only** (`deleted_at`); every read filters `deleted_at IS NULL`.
- Instants are ISO-8601 UTC strings (`nowIso()`); **calendar days are local `YYYY-MM-DD` strings**
  (`LocalDate`, `src/core/dates/localDate.ts`). Never store a day as a timestamp.
- `habit_entries` has a unique `(habit_id, date)`; upserts revive soft-deleted rows.
- Habit colors are stored as palette keys (`"violet"`), resolved per theme by `resolveHabitColor`.
- Schema change → edit `src/db/schema.ts` → `npm run db:generate` → commit the generated files.
  Migrations run at startup (`src/db/migrate.ts`).

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

- Use `useTheme()` colors/tokens; no hard-coded colors outside `src/theme`.
- Touch targets ≥ 44px (`MIN_TOUCH_SIZE`). Every icon-only button has an `accessibilityLabel`.
- Checkable rows use `accessibilityRole="checkbox"` + `accessibilityState`.
- Reanimated shared values: use `.get()` / `.set()` (React Compiler is enabled).
- Charts use `react-native-svg`. Don't put `onPress` on SVG shapes (leaks responder props to the
  DOM on web); wrap the SVG in one `Pressable` and hit-test the position (see `stats/Heatmap.tsx`).
- Heatmap colors: one hue per series (habit color / primary) at 4 opacity levels; days that do
  not count are outlined only. Rules for what counts live in `src/core/stats/stats.ts`.
- `typedRoutes` is disabled: on Windows the dev server's incremental typegen registers non-route
  files and breaks `tsc`. Route strings are therefore not type-checked — double-check paths.
- Wide screens (≥ 768px): sidebar navigation; content column max 720px (`Screen`).

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
  the SQLite DB. The app writes a JSON snapshot to the App Group `group.dev.habits.app`
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
- Engine: `runSync` (`src/sync/engine.ts`) = push rows with `updatedAt > lastPushedAt`, then pull
  rows with `server_updated_at > cursor` per table and merge with the backup's `importMerge`.
  Device-only settings (`activeTimer`, `syncState`) never sync (`LOCAL_ONLY_SETTINGS`).
- `useSyncStore` owns auth + sync status; bootstrap triggers sync on start, foreground and
  4 s after local changes. After a backup import call `requestFullSync()`.

## Testing

- Jest (`jest-expo`). Tests live next to the code: `foo.test.ts`.
- Pure logic in `src/core` must have tests. Stores are tested against `createMemoryRepositories()`.
- Drizzle repositories are integration-tested against real SQLite in memory (`sql.js`) with the
  app's migrations: `createTestDatabase()` in `src/db/testing.ts` (see `drizzle.test.ts`).
- Test builders: `src/core/habits/testing.ts` (`makeHabit`, `makeEntry`).
- Sync: `src/sync/engine.test.ts` (two sql.js devices + `createFakeRemote()`), and
  `npm run test:sql` (runs `supabase/schema.sql` on PGlite). `npm run check` runs both.

## Release (docs/PUBLISHING.md)

- Icons, splash, favicon and widget previews are generated from SVG by `npm run assets`
  (resvg). Edit the script, not the PNGs.
- Privacy policy source: `src/features/legal/privacy.json` → in-app `/privacy` screen and
  `public/privacidade.html` (`npm run legal`). Keep the text in sync with what the app collects.
- `eas.json` profiles: `development` (dev client), `preview` (internal APK), `production`
  (auto-increment, remote app version). No `projectId` yet: the owner runs `eas init`.
- Bundle id / package `dev.habits.app` and App Group `group.dev.habits.app` are **provisional**;
  changing them means app.json + `src/widgets/iosPayload.ts` + `targets/widget/Snapshot.swift`.
- `public/_redirects` makes SPA routes work on Netlify/Cloudflare Pages.

## Roadmap

1. ✅ Setup + habit CRUD + Today screen (yes/no)
2. ✅ Quantity & timer habits, all frequencies, streaks, tests
3. ✅ Statistics & heatmaps
4. ✅ Planner (daily / monthly / yearly) + goals
5. ✅ Local notifications, JSON backup/import, settings
6. ✅ Widgets (iOS/Android, dev build)
7. ✅ (Optional) Supabase sync, last-write-wins by `updated_at`
8. ✅ Store release prep (icon, splash, privacy policy, EAS, store checklists)
