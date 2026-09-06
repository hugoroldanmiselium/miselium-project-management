# Security

## Authentication

Supabase Auth, email/password. Session persisted via `@supabase/supabase-js` (localStorage under
the hood), auto-refreshed. `AuthContext` subscribes to `supabase.auth.onAuthStateChange` so the
UI reacts immediately to login/logout in any tab.

All `/app/*` routes are wrapped in `<ProtectedRoute>` (`src/routes/ProtectedRoute.tsx`), which
redirects to `/login` if there is no active session. `/login` itself redirects to
`/app/dashboard` if a session already exists.

## Authorization: Row Level Security, not UI hiding

The spec requires permissions to be enforced via Postgres RLS, not just hidden buttons in the
UI. Every table has RLS **enabled** and explicit policies — see `supabase/migrations/002_rls.sql`
for the full SQL. Summary:

Two `security definer` helper functions avoid infinite-recursion problems that come from RLS
policies on `profiles`/`project_members` querying themselves:

- `current_role_is_admin()` — true if the logged-in user's `profiles.role = 'ADMIN'`.
- `is_project_member(project_id)` — true if the logged-in user has a `project_members` row for
  that project.

| Table            | SELECT                                              | INSERT/UPDATE/DELETE |
|------------------|------------------------------------------------------|------------------------|
| `profiles`       | any authenticated user (needed for assignee names, team page — no sensitive data in this table) | only ADMIN can insert/delete/change role; a user can update their own `name` but a `with check` clause blocks changing their own `role` |
| `clients`        | ADMIN, or DEVELOPER whose project(s) belong to that client | ADMIN only |
| `projects`       | ADMIN, or DEVELOPER who is a `project_members` row for that project | ADMIN only |
| `project_members`| ADMIN, the member themself, or any member of that project | ADMIN only |
| `tasks`          | ADMIN, or DEVELOPER who is a member of the task's project | INSERT/DELETE: ADMIN only. UPDATE: ADMIN or the task's `assigned_to` user (lets a developer update their own task's status without letting them reassign someone else's task or touch other projects) |
| `activity_log`   | ADMIN, or DEVELOPER who is a member of that project | INSERT: any user, but only for themselves (`user_id = auth.uid()`) and only for a project they belong to (or ADMIN). No UPDATE. DELETE: ADMIN only |

## What this actually prevents

- A DEVELOPER querying `/rest/v1/projects` directly (bypassing the UI entirely) only ever gets
  rows for projects they're a member of — never all projects.
- A DEVELOPER cannot `PATCH` their own `profiles.role` to `'ADMIN'` — the `with check` clause on
  `profiles_update_self_name` requires the new row's `role` to equal what's already stored.
- A DEVELOPER cannot `POST` a new `clients` row, `projects` row, or reassign someone else's task
  — those policies require `current_role_is_admin()`.
- A DEVELOPER cannot see clients/tasks/activity belonging to projects they are not a member of,
  even though the anon key (a public, non-secret credential) is shared across all users.

## Verified with live SQL/REST calls (not just written and assumed correct)

Using the project's live Supabase instance, this was tested end-to-end during the build:

1. Logged in as `dev1@miselium.com` via `POST /auth/v1/token?grant_type=password` to get a real
   user JWT.
2. `GET /rest/v1/projects?select=name` with that JWT returned exactly the 3 projects `dev1` is a
   member of (`ALTUM LMS`, `RD Consultorio Fiscal`, `ERP Demo`) — not all 5.
3. `GET /rest/v1/clients?select=name` returned exactly 3 clients (not `Mayacorptrips`, which
   `dev1` has no project under) — confirming the clients policy correctly derives visibility
   from project membership rather than exposing the whole client list.
4. `PATCH /rest/v1/profiles?email=eq.dev1@miselium.com` with body `{"role":"ADMIN"}` was
   **rejected** by Postgres with `42501 new row violates row-level security policy for table
   "profiles"` — privilege escalation is blocked at the database level, not just the UI.
5. `POST /rest/v1/clients` with a new client body as `dev1` was **rejected** the same way —
   confirming developers cannot create clients even via direct API calls.

These are exactly the checks called for in the spec's Definition of Done ("verified by SQL
role-switch test, not just UI").

## Frontend-side authorization

The frontend also hides admin-only actions (New Project / New Task / New Client buttons, Edit/
Delete buttons, role dropdowns, task-status editing on tasks not assigned to the current user)
via `useAuth().isAdmin` and per-task `assigned_to === profile.id` checks. This is a UX
convenience only — RLS is what actually enforces the boundary, so even if a button were shown by
mistake, the underlying write would still be rejected by Postgres.

## Secrets handling

- `.env.local` (gitignored) holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — both
  safe to expose in a frontend bundle by design (RLS is what makes the anon key safe).
- The Supabase **service_role key** is never used anywhere in this repo.
- The Supabase **Management API personal access token** (used only transiently, via `curl`, to
  run the SQL migrations during setup) was never written to any file in the repository, never
  committed, and is not present in `.env.local`, `.env.example`, or any source file.

## Input validation

Client-side: required-field checks in every form modal (`ProjectFormModal`, `TaskFormModal`,
`ClientFormModal`) before submission, with inline error text. Database-side: `not null`
constraints and `check` constraints on all enum-like columns (`role`, `status`, `priority`) mean
invalid values are rejected by Postgres even if the frontend validation were bypassed.

## Known limitations / out of scope for v0.1

- No email verification / password reset flow (demo users are pre-confirmed).
- No rate limiting beyond what Supabase provides by default.
- No audit trail on `profiles` role changes beyond the general `activity_log` (which currently
  logs project-scoped actions, not role changes) — a natural v0.2 addition.
