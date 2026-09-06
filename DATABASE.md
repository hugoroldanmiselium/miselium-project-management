# Database

Postgres schema hosted on Supabase project `xpxvreqnhrnwkrfdzymd`. Migrations were applied via
the Supabase Management API SQL endpoint (`POST /v1/projects/{ref}/database/query`) rather than
the Supabase CLI (not installed in this environment). The exact SQL that was run is committed
under `supabase/migrations/`:

- `001_schema.sql` — tables, FKs, indexes, `updated_at` trigger
- `002_rls.sql` — Row Level Security policies for every table
- `003_seed.sql` — demo auth users, profiles, clients, projects, project members, tasks,
  activity log entries
- `004_replace_demo_users.sql` — swaps placeholder demo accounts for the real team accounts
- `005_agency_features.sql` — time tracking, project `repo_url`/billing columns, in-app
  notifications (+ assignment trigger), task comments — see "Agency features" below
- `006_task_estimation_capacity.sql` — `tasks.estimated_hours`, `profiles.daily_available_hours`,
  plus the RLS policy change needed to protect the new profile column — see "Task estimation +
  daily capacity" below
- `007_organizations_and_role_tiers.sql` — new `organizations` table, `organization_id` on
  `profiles`/`clients`/`projects`, backfills everything onto a single "Miselium" org, and renames
  the role system from `ADMIN`/`DEVELOPER` to `ADMIN`/`PROJECT_MANAGER`/`COLLABORATOR` — see
  "Multi-tenancy + 3-tier roles (Fase 2)" below
- `008_org_scoped_rls.sql` — rewrites every RLS policy from `002`/`005`/`006` to also scope rows to
  the caller's organization, and introduces the `PROJECT_MANAGER` permission tier — see "Fase 2"
  below and `SECURITY.md` for the full policy table and live verification results
- `009_second_organization.sql` — onboards a second real tenant, "RD Consultorio Fiscal", with its
  own ADMIN (Rafael) and COLLABORATOR (Gustavo) user. Unlike `003`/`004`'s internal demo accounts,
  this migration file does NOT contain the real temporary passwords in git — it uses
  `__RAFAEL_TEMP_PASSWORD__`/`__GUSTAVO_TEMP_PASSWORD__` placeholders that were substituted only in
  memory at run time, since these are real external-client credentials, not internal demo data.
  Credentials were shared with the requester directly, not stored in the repo.

## Tables

### `organizations`
Added in `007_organizations_and_role_tiers.sql`. One row per tenant company.

| column     | type    | notes |
|------------|---------|-------|
| id         | uuid PK | default `gen_random_uuid()` |
| name       | text, not null |
| created_at | timestamptz |

Exactly one row exists today: "Miselium" (all existing data was backfilled onto it — see "Fase 2"
below). A second company ("Empresa B") will be created by hand once its real name/users are known;
there is no org-switcher UI yet (each user belongs to exactly one org).

### `profiles`
Mirrors `auth.users` 1:1 (`id` references `auth.users.id`, cascade delete).

| column     | type      | notes                              |
|------------|-----------|-------------------------------------|
| id         | uuid PK   | = auth.users.id                     |
| name       | text      |                                      |
| email      | text      |                                      |
| role       | text      | `'ADMIN' \| 'PROJECT_MANAGER' \| 'COLLABORATOR'`, checked (renamed from `'ADMIN' \| 'DEVELOPER'` in `007`) |
| created_at | timestamptz |                                    |
| daily_available_hours | numeric(4,2) | added in `006`; nullable, `check (daily_available_hours is null or (daily_available_hours > 0 and daily_available_hours <= 24))` |
| organization_id | uuid FK → organizations.id, not null | added in `007`; backfilled onto "Miselium" for all existing rows |

### `clients`
| column        | type    | notes |
|---------------|---------|-------|
| id            | uuid PK |
| name          | text    |
| contact_name  | text    |
| email         | text    |
| phone         | text    |
| notes         | text    |
| created_at    | timestamptz |
| organization_id | uuid FK → organizations.id, not null | added in `007`; backfilled onto "Miselium" |

### `projects`
| column       | type    | notes |
|--------------|---------|-------|
| id           | uuid PK |
| client_id    | uuid FK → clients.id, `on delete set null` |
| name         | text    |
| description  | text    |
| status       | text    | `'PLANNING' \| 'ACTIVE' \| 'ON_HOLD' \| 'COMPLETED'`, checked |
| start_date   | date    |
| due_date     | date    |
| created_at   | timestamptz |
| repo_url     | text    | added in `005_agency_features.sql`; optional, shown as a link on project detail |
| billing_type | text    | added in `005`; `'HOURLY' \| 'FIXED'`, checked, default `'HOURLY'` |
| hourly_rate  | numeric | added in `005`; nullable, only meaningful when `billing_type = 'HOURLY'` |
| organization_id | uuid FK → organizations.id, not null | added in `007`; backfilled onto "Miselium" |

Indexes: `idx_projects_client_id` on `client_id`, `idx_projects_organization_id` on `organization_id`.

### `project_members`
Composite relation, no surrogate key.

| column     | type    |
|------------|---------|
| project_id | uuid FK → projects.id, `on delete cascade` |
| user_id    | uuid FK → profiles.id, `on delete cascade` |
| created_at | timestamptz |

Primary key: `(project_id, user_id)`. Indexes on both FK columns individually as well.

### `tasks`
| column      | type    | notes |
|-------------|---------|-------|
| id          | uuid PK |
| project_id  | uuid FK → projects.id, `on delete cascade`, not null |
| assigned_to | uuid FK → profiles.id, `on delete set null` |
| title       | text, not null |
| description | text    |
| status      | text    | `'TODO' \| 'IN_PROGRESS' \| 'DONE'`, checked |
| priority    | text    | `'LOW' \| 'MEDIUM' \| 'HIGH'`, checked |
| due_date    | date    |
| created_at  | timestamptz |
| updated_at  | timestamptz | auto-updated via `set_updated_at()` trigger |
| estimated_hours | numeric(5,2) | added in `006`; nullable, `check (estimated_hours is null or estimated_hours >= 0)` |

Indexes: `project_id`, `assigned_to`, `status`.

### `activity_log`
| column     | type    |
|------------|---------|
| id         | uuid PK |
| user_id    | uuid FK → profiles.id, `on delete set null` |
| project_id | uuid FK → projects.id, `on delete cascade` |
| action     | text, not null |
| created_at | timestamptz |

Indexes: `project_id`, `user_id`.

## Agency features (`005_agency_features.sql`)

### `time_entries`
| column     | type    | notes |
|------------|---------|-------|
| id         | uuid PK |
| task_id    | uuid FK → tasks.id, `on delete cascade`, not null |
| user_id    | uuid FK → profiles.id, `on delete cascade`, not null |
| hours      | numeric, not null | `check (hours > 0)` |
| note       | text    | optional |
| entry_date | date, not null | defaults to `current_date` |
| created_at | timestamptz |

Indexes: `task_id`, `user_id`, `entry_date`. Used for per-task/per-project time totals (Project
Detail, task detail modal) and per-developer "hours this week" on the Team page.

### `notifications`
| column     | type    | notes |
|------------|---------|-------|
| id         | uuid PK |
| user_id    | uuid FK → profiles.id, `on delete cascade`, not null |
| message    | text, not null |
| link       | text    | optional route path the bell dropdown navigates to on click |
| read       | boolean, not null, default `false` |
| created_at | timestamptz |

Index: `user_id`. Rows are inserted by the `notify_task_assignment()` trigger (fires on task
insert/reassignment) — there is no general INSERT policy for regular users. "Due soon" reminders
are **not** stored here; see `SECURITY.md` / `README.md` for why.

### `task_comments`
| column     | type    | notes |
|------------|---------|-------|
| id         | uuid PK |
| task_id    | uuid FK → tasks.id, `on delete cascade`, not null |
| user_id    | uuid FK → profiles.id, `on delete cascade`, not null |
| body       | text, not null |
| created_at | timestamptz |

Index: `task_id`. Append-only (like `activity_log`): no UPDATE policy.

### `notify_task_assignment()` trigger
`after insert or update of assigned_to on tasks`, `security definer`. When a task is created with
an assignee, or an existing task's `assigned_to` changes, inserts a `notifications` row for the
new assignee — unless the assignee is the one making the change (`auth.uid()`). Security definer
is required because RLS on `notifications` otherwise only lets a user write their own rows.

## Task estimation + daily capacity (`006_task_estimation_capacity.sql`)

Pure data fields with simple aggregate display only — not a scheduling/workload algorithm, not
actual-hours timesheets (that's the pre-existing `time_entries` feature, left untouched), not
auto-assignment, not capacity calendars.

- `tasks.estimated_hours` (`numeric(5,2)`, nullable) — existing tasks were left `NULL` rather than
  backfilled with an invented value. The DB check constraint only requires `>= 0` (a legitimate
  0-hour placeholder task is never rejected by Postgres); the "should be greater than 0" rule from
  the spec is enforced only in `TaskFormModal`'s create-time validation, not at the DB level.
- `profiles.daily_available_hours` (`numeric(4,2)`, nullable, `check (> 0 and <= 24)`) — existing
  users were left `NULL` rather than backfilled with a fake value. Editable only by ADMIN (Team
  page, inline input in the "Disponibilidad" column) — enforced by RLS, not just UI hiding; see
  `SECURITY.md`.
- RLS change: `profiles_update_self_name` was extended so a user updating their own `name` can no
  longer sneak a change to `daily_available_hours` into the same request (the existing `role`
  self-protection is untouched, just joined by the same technique for the new column).
  `tasks_update` was left unchanged — a developer editing their own assigned task can also set its
  `estimated_hours`, since Postgres RLS is table-level and nothing column-specific was layered on
  top.

## Multi-tenancy + 3-tier roles (Fase 2: `007_organizations_and_role_tiers.sql` + `008_org_scoped_rls.sql`)

**Multi-tenancy.** `organization_id` was added only to the three "top-level" entities -
`profiles`, `clients`, `projects` - not to `tasks`, `project_members`, `time_entries`,
`notifications`, `task_comments`, or `activity_log`. Those already scope through `project_id` or
`user_id`, and duplicating `organization_id` onto them would create a class of bug where the FK
chain and the copied column could disagree (e.g. a task whose project gets reassigned to a
different org while the task's own stale copy doesn't follow). Instead, RLS on those tables joins
up to `projects`/`profiles` to derive org membership - see `SECURITY.md` for the exact policies and
the new `is_project_in_org()` / `current_org_id()` helper functions.

One real organization, "Miselium", was created and every existing `profiles`/`clients`/`projects`
row was backfilled onto it (`update ... set organization_id = <Miselium's id> where
organization_id is null`), then the column was set `not null`. No second organization was
invented - the human will create "Empresa B" by hand once its real name/users exist. A throwaway
org + user were created purely to verify cross-org isolation via live REST calls (see
`SECURITY.md`), then fully deleted before this change was considered done.

**3-tier roles.** `role` was renamed from a 2-value enum (`ADMIN`/`DEVELOPER`) to a 3-value one
(`ADMIN`/`PROJECT_MANAGER`/`COLLABORATOR`): the check constraint was dropped and re-added, existing
`DEVELOPER` rows were updated to `COLLABORATOR` (same permissions, new name) in between - order
matters here, since the old constraint would reject `'COLLABORATOR'` and the new one would reject
`'DEVELOPER'`. `PROJECT_MANAGER` can do everything `ADMIN` can operationally (clients/projects/
tasks CRUD, task assignment, project team management) except the narrow ADMIN-only slice that
already existed pre-Fase-2: changing a user's `role` or another user's `daily_available_hours`
(`profiles_update_admin` policy, unchanged in scope, just newly org-scoped). No user was placed in
`PROJECT_MANAGER` during this migration - Hugo stayed `ADMIN`, Gerardo and Nikte became
`COLLABORATOR` - the human will promote someone later.

## Seed data

Clients: ALTUM, RD Consultorio Fiscal, Mayacorptrips, Cliente Demo.

Projects: ALTUM LMS (ACTIVE), ALTUM Website (ON_HOLD), RD Consultorio Fiscal (PLANNING),
Mayacorptrips (ACTIVE), ERP Demo (COMPLETED) — one per client except ALTUM, which has two.

18 tasks spread across all five projects with a mix of TODO/IN_PROGRESS/DONE status, LOW/MEDIUM/
HIGH priority, and due dates spanning past (overdue), today, and future — so the dashboard KPIs
(active projects, pending, overdue, completed, delivery %) all render non-trivial numbers.

3 users (`hugo@miselium.local` ADMIN, `gerardo@miselium.local` / `nikte@miselium.local`
COLLABORATOR - renamed from DEVELOPER in `007_organizations_and_role_tiers.sql`) created directly
via `auth.users` + `auth.identities` + `profiles` inserts (see "How the demo users were created"
below), assigned as `project_members` and task `assigned_to` values so both roles have meaningful,
realistic data to look at. (An earlier seed used placeholder demo users
`admin@miselium.com`/`dev1@miselium.com`/`dev2@miselium.com` — migration
`004_replace_demo_users.sql` deleted those and reassigned their data to the real accounts above.)
All three belong to the single "Miselium" organization created in `007`.

5 `activity_log` rows tied to specific projects/users for the dashboard's recent-activity feed.

## How the demo users were created

The Supabase Auth Admin API (which would normally be used to create users server-side) needs the
service_role key from a trusted backend context. Since this environment only had SQL access via
the Management API, demo users were instead inserted directly into `auth.users` (with a bcrypt
password hash via `pgcrypto`'s `crypt()`, matching the format Supabase Auth expects) plus a
matching `auth.identities` row (required for password-grant login to succeed), then a `profiles`
row. This was verified end-to-end by calling
`POST /auth/v1/token?grant_type=password` directly against the project's Auth REST endpoint with
each demo user's credentials and confirming a valid access token comes back.

## Re-running migrations

If the schema needs to be reapplied (e.g. against a fresh Supabase project), run the SQL files in
order (`001` through `008`) against the Management API SQL endpoint:

```bash
curl -s -X POST \
  -H "Authorization: Bearer <management-api-token>" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat supabase/migrations/001_schema.sql | sed 's/"/\\"/g')\"}" \
  "https://api.supabase.com/v1/projects/<project-ref>/database/query"
```

(repeat for `002_rls.sql`, then `003_seed.sql`, `004_replace_demo_users.sql`, `005_agency_features.sql`,
`006_task_estimation_capacity.sql`, `007_organizations_and_role_tiers.sql`, `008_org_scoped_rls.sql`,
in order). All files are idempotent-ish — schema uses
`create table if not exists` / `create index if not exists`, RLS policies use `drop policy if
exists` before `create policy`, and seed inserts guard with `where not exists (...)` — so they
can be safely re-run without duplicating data (though re-running against a project that already
has different data could still conflict on unique-ish values like client/project names, since
there are no unique constraints on those columns by design — kept intentionally simple per the
spec's "don't over-normalize" instruction).
