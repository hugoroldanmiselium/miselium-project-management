# Database

Postgres schema hosted on Supabase project `xpxvreqnhrnwkrfdzymd`. Migrations were applied via
the Supabase Management API SQL endpoint (`POST /v1/projects/{ref}/database/query`) rather than
the Supabase CLI (not installed in this environment). The exact SQL that was run is committed
under `supabase/migrations/`:

- `001_schema.sql` — tables, FKs, indexes, `updated_at` trigger
- `002_rls.sql` — Row Level Security policies for every table
- `003_seed.sql` — demo auth users, profiles, clients, projects, project members, tasks,
  activity log entries

## Tables

### `profiles`
Mirrors `auth.users` 1:1 (`id` references `auth.users.id`, cascade delete).

| column     | type      | notes                              |
|------------|-----------|-------------------------------------|
| id         | uuid PK   | = auth.users.id                     |
| name       | text      |                                      |
| email      | text      |                                      |
| role       | text      | `'ADMIN' \| 'DEVELOPER'`, checked   |
| created_at | timestamptz |                                    |

### `clients`
| column        | type    |
|---------------|---------|
| id            | uuid PK |
| name          | text    |
| contact_name  | text    |
| email         | text    |
| phone         | text    |
| notes         | text    |
| created_at    | timestamptz |

### `projects`
| column      | type    | notes |
|-------------|---------|-------|
| id          | uuid PK |
| client_id   | uuid FK → clients.id, `on delete set null` |
| name        | text    |
| description | text    |
| status      | text    | `'PLANNING' \| 'ACTIVE' \| 'ON_HOLD' \| 'COMPLETED'`, checked |
| start_date  | date    |
| due_date    | date    |
| created_at  | timestamptz |

Index: `idx_projects_client_id` on `client_id`.

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

## Seed data

Clients: ALTUM, RD Consultorio Fiscal, Mayacorptrips, Cliente Demo.

Projects: ALTUM LMS (ACTIVE), ALTUM Website (ON_HOLD), RD Consultorio Fiscal (PLANNING),
Mayacorptrips (ACTIVE), ERP Demo (COMPLETED) — one per client except ALTUM, which has two.

18 tasks spread across all five projects with a mix of TODO/IN_PROGRESS/DONE status, LOW/MEDIUM/
HIGH priority, and due dates spanning past (overdue), today, and future — so the dashboard KPIs
(active projects, pending, overdue, completed, delivery %) all render non-trivial numbers.

3 users (`hugo@miselium.local` ADMIN, `gerardo@miselium.local` / `nikte@miselium.local`
DEVELOPER) created directly via `auth.users` + `auth.identities` + `profiles` inserts (see "How
the demo users were created" below), assigned as `project_members` and task `assigned_to` values
so both roles have meaningful, realistic data to look at. (An earlier seed used placeholder demo
users `admin@miselium.com`/`dev1@miselium.com`/`dev2@miselium.com` — migration
`004_replace_demo_users.sql` deleted those and reassigned their data to the real accounts above.)

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

If the schema needs to be reapplied (e.g. against a fresh Supabase project), run the three SQL
files in order against the Management API SQL endpoint:

```bash
curl -s -X POST \
  -H "Authorization: Bearer <management-api-token>" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat supabase/migrations/001_schema.sql | sed 's/"/\\"/g')\"}" \
  "https://api.supabase.com/v1/projects/<project-ref>/database/query"
```

(repeat for `002_rls.sql`, then `003_seed.sql`). All three files are idempotent-ish — schema uses
`create table if not exists` / `create index if not exists`, RLS policies use `drop policy if
exists` before `create policy`, and seed inserts guard with `where not exists (...)` — so they
can be safely re-run without duplicating data (though re-running against a project that already
has different data could still conflict on unique-ish values like client/project names, since
there are no unique constraints on those columns by design — kept intentionally simple per the
spec's "don't over-normalize" instruction).
