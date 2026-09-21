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

- Use `useTheme()` colors/tokens; no hard-coded colors outside `src/theme`.
- Touch targets ≥ 44px (`MIN_TOUCH_SIZE`). Every icon-only button has an `accessibilityLabel`.
- Checkable rows use `accessibilityRole="checkbox"` + `accessibilityState`.
- Reanimated shared values: use `.get()` / `.set()` (React Compiler is enabled).
- Wide screens (≥ 768px): sidebar navigation; content column max 720px (`Screen`).

## Testing

- Jest (`jest-expo`). Tests live next to the code: `foo.test.ts`.
- Pure logic in `src/core` must have tests. Stores are tested against `createMemoryRepositories()`.
- Test builders: `src/core/habits/testing.ts` (`makeHabit`, `makeEntry`).

## Roadmap

1. ✅ Setup + habit CRUD + Today screen (yes/no)
2. Quantity & timer habits, all frequencies, streaks, tests
3. Statistics & heatmaps
4. Planner (daily / monthly / yearly) + goals
5. Local notifications, JSON backup/import, settings
6. Widgets (iOS/Android, dev build)
7. (Optional) Supabase sync, last-write-wins by `updated_at`
8. Store release prep
