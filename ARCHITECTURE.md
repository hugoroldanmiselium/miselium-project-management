# Architecture

## Overview

Miselium Operations is a client-side single-page app (Vite + React + TypeScript) that talks
directly to Supabase (Postgres + Auth) over the `@supabase/supabase-js` client using the anon
key. There is no custom backend server — all authorization is enforced by Postgres Row Level
Security policies (see `SECURITY.md` and `DATABASE.md`).

```
Browser (React SPA)
   │  anon key, user JWT after login
   ▼
Supabase Auth  ──►  Postgres (RLS-protected tables)
```

## Why no backend server

The spec calls for "no paid services, no VPS, minimal dependencies," and Supabase's RLS model is
designed for exactly this: the frontend is trusted with the anon key (safe to expose — RLS
enforces per-row access), and all business rules (who can see/edit what) live in SQL policies,
not in application code that could be bypassed by calling the REST API directly.

## Layering

- **`src/lib/supabase.ts`** — single Supabase client instance, reads `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` from `import.meta.env`.
- **`src/lib/queries.ts`** — one typed async function per read/write operation (e.g.
  `fetchProjects()`, `createTask()`, `updateTaskStatus()`). Pages never call `supabase.from(...)`
  directly except in a couple of narrow spots — this keeps query shape changes centralized.
- **`src/hooks/useSupabaseQuery.ts`** — generic hook wrapping a query function with
  `{ data, loading, error, refetch }`. Every page uses this so loading/error/empty states are
  handled uniformly.
- **`src/contexts/AuthContext.tsx`** — wraps `supabase.auth`, exposes `session`, `profile`
  (the `profiles` row for the logged-in user), `isAdmin`, `signIn`, `signOut`. Loads the profile
  on session change so role-based UI decisions (`isAdmin`) are available app-wide.
- **`src/routes/ProtectedRoute.tsx`** — redirects to `/login` if there's no session; used to
  wrap the entire `/app/*` route tree in `App.tsx`.
- **`src/layouts/AppLayout.tsx`** — persistent sidebar + header shell rendered around every
  `/app/*` page via `<Outlet />`.
- **`src/pages/*`** — one component per route. Each page: fetches its own data via
  `useSupabaseQuery`, renders Loading/Error/Empty/Success states explicitly, and — for
  create/edit — opens a modal form rather than navigating to a separate page (per the UX spec:
  "few steps, not a separate page flow").
- **`src/components/*`** — the shared UI library (Button, Input/Select/Textarea, Modal, Badge,
  Table, StatCard, TaskItem, ProjectCard, ProjectProgress, Chart, Sidebar, Header, States
  (Loading/Empty/Error/Unauthorized/NotFound), ConfirmDialog). Domain form modals
  (Project/Task/Client) live under `src/components/forms/`.
- **`src/design-system/`** — `tokens.css` (colors, spacing, radius) and `typography.css` (type
  scale). `src/components/components.css` consumes the tokens and defines every shared class
  used across pages (`.btn`, `.card`, `.table`, `.badge-*`, `.stat-card`, layout classes, etc.)
  so there is no page-specific bespoke CSS.

## Data fetching pattern

Every list/detail page follows the same shape:

```tsx
const { data, loading, error, refetch } = useSupabaseQuery(() => fetchProjects());

if (loading) return <LoadingState />;
if (error) return <ErrorState description={error} onRetry={refetch} />;
if (!data || data.length === 0) return <EmptyState .../>;
// render data
```

RLS means the *same* query (`select * from projects`) returns different rows depending on who is
logged in — an ADMIN sees all projects, a DEVELOPER sees only the ones they're a member of. The
frontend does not need to (and does not) duplicate that filtering logic — see `SECURITY.md`.

## State management

No global state library. `AuthContext` is the only app-wide context. Everything else is
component-local state (`useState`) plus the `useSupabaseQuery` hook per page, which is simple
enough at this scope (a handful of tables, no complex cross-page caching requirements) and keeps
the dependency list to just `react`, `react-router-dom`, `@supabase/supabase-js`, and
`lucide-react` as specified.

## Build

`npm run build` runs `tsc -b` (project-wide type-check, no emit) followed by `vite build`
(bundling + minification to `dist/`). This is verified to complete with zero TypeScript errors
and zero build errors.
