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
| `profiles`       | any authenticated user (needed for assignee names, team page — no sensitive data in this table, including `daily_available_hours`) | only ADMIN can insert/delete/change role or `daily_available_hours`; a user can update their own `name` but a `with check` clause blocks changing their own `role` or `daily_available_hours` |
| `clients`        | ADMIN, or DEVELOPER whose project(s) belong to that client | ADMIN only |
| `projects`       | ADMIN, or DEVELOPER who is a `project_members` row for that project | ADMIN only |
| `project_members`| ADMIN, the member themself, or any member of that project | ADMIN only |
| `tasks`          | ADMIN, or DEVELOPER who is a member of the task's project | INSERT/DELETE: ADMIN only. UPDATE: ADMIN or the task's `assigned_to` user (lets a developer update their own task's status without letting them reassign someone else's task or touch other projects) |
| `activity_log`   | ADMIN, or DEVELOPER who is a member of that project | INSERT: any user, but only for themselves (`user_id = auth.uid()`) and only for a project they belong to (or ADMIN). No UPDATE. DELETE: ADMIN only |
| `time_entries`   | ADMIN, or the entry's own `user_id`, or a DEVELOPER who is a member of the task's project (so per-task/per-project totals are visible to teammates) | INSERT: `user_id` must equal `auth.uid()`, and the task must be assigned to that user (or ADMIN). UPDATE/DELETE: ADMIN or the entry's own `user_id` |
| `notifications`  | only the notification's own `user_id` — no ADMIN carve-out | No general INSERT policy for users; rows are inserted by the `notify_task_assignment()` security-definer trigger on `tasks`. UPDATE/DELETE: only the notification's own `user_id` (used to mark read) |
| `task_comments`  | ADMIN, or a DEVELOPER who is a member of the task's project | INSERT: `user_id = auth.uid()` and the task's project membership check. No UPDATE (append-only, like `activity_log`). DELETE: ADMIN or the comment's own `user_id` |

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

Using the project's live Supabase instance, this was tested end-to-end during the build. `dev1@miselium.com`
below was the original placeholder seed account; it was later deleted and replaced by
`gerardo@miselium.local` / `nikte@miselium.local` (migration `004_replace_demo_users.sql`) — the RLS
policies themselves are unchanged, so these results still hold for the current accounts:

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

## Agency features (v0.2) — live-tested RLS results

Tested end-to-end against the live project using real JWTs for `gerardo@miselium.local` and
`nikte@miselium.local` (`POST /auth/v1/token?grant_type=password`), then direct REST calls. All
test rows were deleted afterward.

**`time_entries`:**
1. Gerardo `POST /rest/v1/time_entries` for a task assigned to him, in a project he's a member
   of, under his own `user_id` — **succeeded**.
2. Gerardo `POST /rest/v1/time_entries` against a task assigned to Nikte (different project) —
   **rejected**, `42501 new row violates row-level security policy`.
3. Gerardo `POST /rest/v1/time_entries` with his own assigned task but `user_id` set to Nikte's id
   (impersonation attempt) — **rejected** the same way.
4. Nikte logged time on her own assigned task — **succeeded**.
5. Gerardo `GET /rest/v1/time_entries` returned only his own entry (not Nikte's, whose task is in
   a project Gerardo does not belong to) — confirming the "own + shared-project teammates" SELECT
   policy correctly excludes entries from projects he isn't on.

**`notifications`:**
1. Logged in as Hugo (ADMIN) and `PATCH`ed a task's `assigned_to` from Gerardo to Nikte via
   `/rest/v1/tasks` — the `notify_task_assignment()` trigger fired and inserted a notification row
   for Nikte (verified: message referenced the task title, `link` was `/app/tasks`).
2. Nikte `GET /rest/v1/notifications` returned that row; Gerardo's `GET` on the same endpoint
   returned `[]` — confirming a user only ever sees their own notifications.
3. Gerardo `PATCH /rest/v1/notifications?id=eq.<nikte's notification>` (attempting to mark someone
   else's notification read) affected **0 rows**.
4. Gerardo `POST /rest/v1/notifications` (attempting to insert a notification for himself
   directly, bypassing the trigger) was **rejected** — there is no general INSERT policy for
   users, only the security-definer trigger can write these rows.
5. Nikte `PATCH`ing her own notification to `{"read": true}` — **succeeded**.

**`task_comments`** (spot-checked alongside the above):
1. Gerardo commented on a task in a project he's a member of — **succeeded**.
2. Gerardo commented on Nikte's task in a project he does not belong to — **rejected** with the
   same `42501` RLS error.

## Task estimation + daily capacity (v0.3) — live-tested RLS results

`006_task_estimation_capacity.sql` adds `tasks.estimated_hours` and `profiles.daily_available_hours`
(see `DATABASE.md`). No new tables, so no new helper functions — just one extended policy:
`profiles_update_self_name`'s `with check` clause now also requires `daily_available_hours` to be
unchanged, using the same "compare against the currently-stored value" technique already used to
block self-role-changes. `tasks_update` and `profiles_update_admin`/`profiles_select` were left
untouched (RLS is table-level, and the existing table-level rules already cover the new columns
correctly).

Tested end-to-end against the live project using real JWTs for `hugo@miselium.local` (ADMIN) and
`gerardo@miselium.local` (DEVELOPER) via `POST /auth/v1/token?grant_type=password`, then direct
REST calls:

1. Gerardo `PATCH /rest/v1/profiles?email=eq.gerardo@miselium.local` with
   `{"daily_available_hours": 9}` (attempting to set his own capacity) — **rejected**,
   `42501 new row violates row-level security policy for table "profiles"`, HTTP 403.
2. Hugo (ADMIN) `PATCH /rest/v1/profiles?email=eq.gerardo@miselium.local` with
   `{"daily_available_hours": 7}` — **succeeded**, HTTP 200, value persisted.
3. Gerardo `PATCH /rest/v1/tasks?id=eq.<a task assigned to him>` with `{"estimated_hours": 5}` —
   **succeeded**, HTTP 200 — confirming the deliberate choice to let a developer adjust the
   estimate on their own assigned task (unchanged `tasks_update` policy), not just an ADMIN.

Judgment calls made where the spec left room:
- **Dashboard "Capacidad diaria" role-scoping**: ADMIN sees the whole team's summed daily capacity
  (consistent with every other ADMIN-facing stat on the dashboard being team-wide); a DEVELOPER
  sees only their own value, matching the Team page's existing `canSeeWorkload` per-user scoping
  rather than exposing teammates' numbers on the dashboard.
- **Developer editing their own task's estimate**: allowed, via the unchanged `tasks_update`
  policy — the spec doesn't restrict estimation to ADMIN-only, and it lives in the same shared
  create/edit form as every other task field a developer can already touch for their own tasks.
- **`estimated_hours` 0-vs-required-positive**: the DB check constraint allows `>= 0` (never
  rejects a legitimate 0-hour placeholder row); "must be > 0" is enforced only in the create-task
  form's client-side validation, per the spec's own preference for flexibility at the DB layer.

One implementation detail worth calling out: the `time_entries` INSERT policy originally checked
"is this task assigned to me" with a plain SQL subquery against `tasks`, which is itself subject
to `tasks`'s own RLS (`tasks_select`). That subquery correctly returns nothing (and the insert is
rejected) for a task that's assigned to a user who somehow isn't a `project_members` row for that
project — an edge case surfaced by a stray seed task during testing. The final policy uses a
dedicated `security definer` helper (`is_task_assignee()`, mirroring the existing
`is_project_member()` pattern) so the assignment check isn't accidentally gated by project
membership.

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

## Known limitations / out of scope for v0.2 (agency features)

- "Due soon" notifications (task due within 2 days, not DONE) are computed client-side on page
  load from the current user's own tasks, not stored server-side or pushed in real time. There is
  no server to run a scheduled job against in this "$0 infra" app, and enabling `pg_cron` would be
  a new piece of infrastructure beyond what was scoped. This means a user only sees a "due soon"
  reminder after they load the app, not the instant it becomes true — an accepted v1 trade-off,
  documented in `src/hooks/useNotifications.ts`.
- Billing visibility is read-only math (hours logged x rate for hourly projects); there is no
  invoice generation, payment tracking, or editable line items.
- No webhook/commit integration for the repo link — it's a plain URL field.

## Known limitations / out of scope for v0.3 (task estimation + daily capacity)

- `estimated_hours` and `daily_available_hours` are pure data fields with a simple sum displayed
  on the dashboard — there is no scheduling algorithm, no workload/utilization calculation that
  cross-references the two, no auto-assignment based on remaining capacity, and no capacity
  calendar. That is a deliberate, explicit exclusion from this change's scope, not an oversight.
- No `actual_hours` field was added on tasks — actual time worked is tracked separately via the
  existing `time_entries` feature and intentionally kept un-merged with the new estimate field.
