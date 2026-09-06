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

**As of Fase 2 (`007_organizations_and_role_tiers.sql` + `008_org_scoped_rls.sql`)** the role system
is 3 tiers (`ADMIN`, `PROJECT_MANAGER`, `COLLABORATOR` — `COLLABORATOR` is a rename of the old
`DEVELOPER`, same permissions) and every table is additionally scoped to the caller's
organization. The table below reflects the *current* policies; see "Multi-tenancy + 3-tier roles
(Fase 2)" further down for what changed and how it was verified live.

Helper functions (`security definer`, to avoid infinite-recursion problems that come from RLS
policies on `profiles`/`project_members` querying themselves):

- `current_role_is_admin()` — true if the logged-in user's `profiles.role = 'ADMIN'`.
- `current_role_is_admin_or_pm()` — true if `profiles.role` is `'ADMIN'` or `'PROJECT_MANAGER'`.
  This is the "can manage content" tier used for clients/projects/tasks CRUD, task assignment, and
  project team management. It does **not** cover the one ADMIN-only slice that survived Fase 2:
  changing a user's `role` or another user's `daily_available_hours`.
- `current_org_id()` — the logged-in user's `profiles.organization_id`.
- `is_project_member(project_id)` — true if the logged-in user has a `project_members` row for
  that project.
- `is_project_in_org(project_id)` — true if the given project's `organization_id` matches
  `current_org_id()`. Used to org-scope the admin/PM-wide branch of policies on tables that reach
  their org only via `project_id` (`tasks`, `project_members`, `activity_log`), since those tables
  don't carry their own `organization_id` column (see `DATABASE.md` for why).

| Table            | SELECT                                              | INSERT/UPDATE/DELETE |
|------------------|------------------------------------------------------|------------------------|
| `organizations`  | only the caller's own org row (`id = current_org_id()` via a direct subquery, not the helper, to avoid the helper's own dependency loop) | no policy for regular users — created via migration only |
| `profiles`       | any authenticated user, **within their own org** (needed for assignee names, team page — no sensitive data in this table, including `daily_available_hours`) | only ADMIN can insert/delete/change role or `daily_available_hours`, and only within their own org; a user can update their own `name` but a `with check` clause blocks changing their own `role`, `daily_available_hours`, or `organization_id` |
| `clients`        | (ADMIN or PROJECT_MANAGER) in the client's org, or COLLABORATOR whose project(s) belong to that client | ADMIN or PROJECT_MANAGER, scoped to their own org |
| `projects`       | (ADMIN or PROJECT_MANAGER) in the project's org, or COLLABORATOR who is a `project_members` row for that project | ADMIN or PROJECT_MANAGER, scoped to their own org |
| `project_members`| (ADMIN or PROJECT_MANAGER) whose org owns the project, the member themself, or any member of that project | ADMIN or PROJECT_MANAGER, scoped to the project's org |
| `tasks`          | (ADMIN or PROJECT_MANAGER) whose org owns the project, or COLLABORATOR who is a member of the task's project | INSERT/DELETE: ADMIN or PROJECT_MANAGER, scoped to the project's org. UPDATE: that same admin/PM check, or the task's `assigned_to` user (lets a collaborator update their own task's status without letting them reassign someone else's task or touch other projects) |
| `activity_log`   | (ADMIN or PROJECT_MANAGER) whose org owns the project, or COLLABORATOR who is a member of that project | INSERT: any user, but only for themselves (`user_id = auth.uid()`) and only for a project they belong to (or admin/PM in that project's org). No UPDATE. DELETE: ADMIN or PROJECT_MANAGER, org-scoped |
| `time_entries`   | the entry's own `user_id`, or anyone covered by `is_task_project_member()` (admin/PM in the task's org, or a project member) | INSERT: `user_id` must equal `auth.uid()`, the task's project must be in the caller's org, and the task must be assigned to that user (or admin/PM). UPDATE/DELETE: the entry's own `user_id`, or admin/PM scoped to the task's org |
| `notifications`  | only the notification's own `user_id` — no admin/PM carve-out (unchanged; no cross-org risk since a user only ever sees their own rows regardless of org) | No general INSERT policy for users; rows are inserted by the `notify_task_assignment()` security-definer trigger on `tasks`. UPDATE/DELETE: only the notification's own `user_id` (used to mark read) |
| `task_comments`  | anyone covered by `is_task_project_member()` (admin/PM in the task's org, or a project member) | INSERT: `user_id = auth.uid()` and the task's project membership check. No UPDATE (append-only, like `activity_log`). DELETE: the comment's own `user_id`, or admin/PM scoped to the task's org |

## What this actually prevents

- A COLLABORATOR querying `/rest/v1/projects` directly (bypassing the UI entirely) only ever gets
  rows for projects they're a member of — never all projects.
- A COLLABORATOR cannot `PATCH` their own `profiles.role` to `'ADMIN'` — the `with check` clause on
  `profiles_update_self_name` requires the new row's `role` to equal what's already stored (it also
  now blocks changing `daily_available_hours` or `organization_id` the same way).
- A COLLABORATOR cannot `POST` a new `clients` row, `projects` row, or reassign someone else's task
  — those policies require `current_role_is_admin_or_pm()`.
- A COLLABORATOR cannot see clients/tasks/activity belonging to projects they are not a member of,
  even though the anon key (a public, non-secret credential) is shared across all users.
- As of Fase 2: an ADMIN or PROJECT_MANAGER in one organization cannot see, list, or modify
  another organization's clients/projects/tasks/team/profiles/anything, even though they hold the
  same "can manage content" role bit — every admin/PM policy branch additionally requires
  `organization_id = current_org_id()` (or the equivalent join-based check for tables without their
  own `organization_id` column). See the live verification below.

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

## Multi-tenancy + 3-tier roles (Fase 2) — live-tested RLS results

`007_organizations_and_role_tiers.sql` adds the `organizations` table and `organization_id` on
`profiles`/`clients`/`projects`, and renames the role system to `ADMIN`/`PROJECT_MANAGER`/
`COLLABORATOR`. `008_org_scoped_rls.sql` rewrites every policy from `002`/`005`/`006` to add
org-scoping on top of the existing role/membership checks, and swaps the ADMIN-only content
policies to `current_role_is_admin_or_pm()` so PROJECT_MANAGER gets the same operational reach as
ADMIN, minus the one ADMIN-only slice (role / `daily_available_hours` changes — unchanged from
`006`, just newly org-scoped).

Tested end-to-end against the live project:

**Same-org regression (existing users, unchanged behavior expected):**
1. Hugo (`hugo@miselium.local`, ADMIN, Miselium org) — `GET /rest/v1/projects`,
   `/rest/v1/tasks`, `/rest/v1/clients` all still return the full Miselium data set (5 projects,
   18 tasks, 4 clients) exactly as before Fase 2.
2. Gerardo (`gerardo@miselium.local`, now COLLABORATOR — was DEVELOPER) — same scoped view as
   before (3 projects he's a member of, 11 tasks visible), confirming the DEVELOPER→COLLABORATOR
   rename didn't change any RLS outcome.

**Cross-org isolation (new organization + user created purely for this test, deleted afterward):**
1. Created organization `Throwaway Org QA` and user `throwaway-qa@example.local` (role ADMIN,
   `organization_id` = the throwaway org) directly via `auth.users` + `auth.identities` +
   `profiles` inserts, same technique as the real demo users (see `DATABASE.md`).
2. Logged in as the throwaway user via `POST /auth/v1/token?grant_type=password`.
3. `GET /rest/v1/projects`, `/rest/v1/clients`, `/rest/v1/tasks` as the throwaway user all
   returned `[]` — despite being an ADMIN, none of Miselium's data is visible from a different org.
4. `GET /rest/v1/profiles` as the throwaway user returned only their own row (not Hugo/
   Gerardo/Nikte).
5. `GET /rest/v1/organizations` as the throwaway user returned only `Throwaway Org QA` (not
   `Miselium`).
6. `POST /rest/v1/projects` as the throwaway user with `organization_id` set to **Miselium's**
   org id (an impersonation attempt) was **rejected**: `42501 new row violates row-level security
   policy for table "projects"`, HTTP 403.
7. `POST /rest/v1/projects` as the throwaway user with `organization_id` set to their **own** org
   — **succeeded**, HTTP 201, confirming the rejection above was specifically about org mismatch,
   not a blanket denial.
8. `GET /rest/v1/organizations` as Hugo (Miselium ADMIN) returned only `Miselium` — the reverse
   direction of isolation also holds; an ADMIN in one org cannot enumerate other orgs either.
9. `GET /rest/v1/profiles` as Hugo returned only the 3 Miselium users — the throwaway profile
   never appeared.
10. Cleanup: deleted the throwaway project (from step 7), the throwaway `auth.users` row (cascades
    to its `profiles` row), and the throwaway `organizations` row. Verified afterward with a
    row-count query that `organizations` has exactly 1 row (`Miselium`) and every other table's row
    count matches the pre-Fase-2 baseline (`profiles` 3, `clients` 4, `projects` 5,
    `project_members` 11, `tasks` 18, `time_entries` 0, `notifications` 1, `task_comments` 0,
    `activity_log` 5) with no null `organization_id` anywhere.

Judgment calls made where the spec left room:
- **PROJECT_MANAGER / ADMIN boundary**: the spec named exactly one ADMIN-only slice explicitly —
  role changes and `daily_available_hours` changes — and said to default there if the line wasn't
  obvious elsewhere. Since those are the *only* two things `profiles_update_admin` ever covered
  (there's no other ADMIN-only profile field), the simplest correct implementation was to leave
  `profiles_update_admin` untouched (still `current_role_is_admin()` only) and swap every other
  previously-ADMIN-only policy (`clients`, `projects`, `project_members`, `tasks`,
  `activity_log` admin-wide branches) to `current_role_is_admin_or_pm()`. No new profile-level
  carve-out was needed for PROJECT_MANAGER because there was nothing else on `profiles` for them
  to unlock.
- **`time_entries`/`task_comments` admin-wide branches**: extended to PROJECT_MANAGER via the
  updated `is_task_project_member()` helper, on the theory that "view metrics/reports" and "manage
  team" for a PM should include seeing/moderating time logs and comments across their org's
  projects, same as ADMIN could before.
- **Dashboard/Team workload scoping**: `isAdmin`-gated team-wide views (Dashboard's "Capacidad
  diaria", Team's `canSeeWorkload`) were widened to the new `canManage` (ADMIN or PROJECT_MANAGER)
  flag, consistent with "view metrics/reports" being an explicit PROJECT_MANAGER permission.
- **`organizations` table has no INSERT/UPDATE/DELETE policy for any role** — creating a second org
  is a migration-only operation for now (no org-switcher or org-creation UI in this phase), so
  there was nothing to scope by role yet.

## Frontend-side authorization

The frontend also hides admin/PM-only actions (New Project / New Task / New Client buttons, Edit/
Delete buttons, task-status editing on tasks not assigned to the current user) via
`useAuth().canManage` (true for ADMIN or PROJECT_MANAGER), and the one remaining ADMIN-only
surface (role dropdown, `daily_available_hours` input on the Team page) via `useAuth().isAdmin`,
plus per-task `assigned_to === profile.id` checks. This is a UX convenience only — RLS is what
actually enforces the boundary, so even if a button were shown by mistake, the underlying write
would still be rejected by Postgres.

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

## Known limitations / out of scope for Fase 2 (multi-tenancy + 3-tier roles)

- No org-switcher UI, no org-creation UI, no way for a user to belong to more than one
  organization — each logged-in session has exactly one org context, matching the current single-
  org-per-user reality. A second real organization ("Empresa B") will be created by hand via
  migration once its name/users exist.
- `organizations` has no INSERT/UPDATE/DELETE RLS policy for any role — creating one is a
  migration-only operation in this phase.
- Phases/milestones/dependencies/risks/budget/templates/calendar/documents were explicitly out of
  scope for this change and were not touched.
