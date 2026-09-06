# Miselium Operations v0.1

Internal operations tool for Miselium: clients, projects, tasks, assignees, statuses, dates,
progress, a role-scoped dashboard, and 3-tier permissions. Not a full ERP/CRM/Jira — deliberately
minimal. As of Fase 2, the app is also multi-tenant: every organization's clients/projects/tasks/
team are isolated from every other organization at the database (RLS) level, not just hidden in
the UI — see "Multi-tenancy" below and `SECURITY.md`.

## Multi-tenancy (Fase 2)

Data is scoped to an `organizations` row via `organization_id` on `profiles`/`clients`/`projects`
(the three "top-level" entities — everything else derives its org through those). Today there is
exactly one organization, "Miselium", holding all existing data; a second company will be added
later once it exists. There is no org-switcher UI in this phase — each user belongs to exactly one
organization for the life of their session. See `DATABASE.md` for the schema and `SECURITY.md` for
the RLS policies and live cross-org isolation test results.

## Agency features (v0.2)

Added on top of the v0.1 base, still $0 infrastructure (same Supabase project, no new services):

- **Time tracking** — log hours against a task you're assigned to (click any task to open its
  detail modal). Totals shown per task and per project.
- **Workload view** — the Team page shows open tasks and hours logged this week per team member
  (ADMIN/PROJECT_MANAGER see everyone's, COLLABORATOR only their own row).
- **Git repo link** — an optional `repo_url` per project, shown as a link on the project page.
- **Basic billing visibility** — `billing_type` (hourly/fixed) + `hourly_rate` per project, with a
  computed total (hours logged x rate) shown for hourly projects. Visibility only, not invoicing.
- **In-app notifications** — a bell in the header with an unread badge. Task-assignment
  notifications are inserted by a Postgres trigger (`notify_task_assignment` in
  `supabase/migrations/005_agency_features.sql`). "Due soon" (due within 2 days, not DONE)
  notifications are computed client-side on page load from the user's own tasks — there's no
  server to run a scheduled job, so this is a v1 approximation rather than a persisted,
  server-pushed notification. See `src/hooks/useNotifications.ts`.
- **Task comments** — a comments thread inside the task detail modal, scoped to project members.

See `DATABASE.md` for the new tables/columns and `SECURITY.md` for the RLS policies and live
verification results.

## Task estimation + daily capacity (v0.3)

- **Task effort estimation** — an optional `estimated_hours` field on every task (shown on the
  task list, task detail, and the create/edit form), required when creating a new task.
- **Per-user daily capacity** — an optional `daily_available_hours` field per profile, editable
  only by ADMIN (Team page "Disponibilidad" column). Purely a data field with a simple team-wide
  (or per-person) sum on the dashboard — not a scheduling algorithm, not a workload calculator,
  not auto-assignment. See `DATABASE.md` / `SECURITY.md` for the schema and RLS details.

## Multi-tenancy + 3-tier roles (Fase 2)

- **Organizations** — see "Multi-tenancy" above.
- **3-tier roles** — `DEVELOPER` was renamed to `COLLABORATOR` (identical permissions), and a new
  `PROJECT_MANAGER` tier was added in between `COLLABORATOR` and `ADMIN`: it can do everything
  ADMIN can operationally (create/edit projects, create and assign tasks, manage clients, manage
  the team, view metrics/reports), except changing a user's role or another user's daily capacity,
  which stays ADMIN-only. See "Roles" below and `SECURITY.md` for the full policy table and live
  verification.

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Routing:** react-router-dom (client-side, no full reloads)
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Icons:** lucide-react
- **Styling:** hand-written CSS design system (tokens + typography + component classes), no CSS
  framework
- **Deploy target:** Cloudflare Pages (static SPA build) — see `DEPLOYMENT.md`

## Login credentials

Seeded directly into Supabase Auth. Password is the same for all three accounts. Emails are
synthetic `@miselium.local` login identifiers (no real inbox behind them) since only
username/password were requested — not `@miselium.com.mx` addresses.

| Name          | Role        | Email                    | Password        |
|---------------|-------------|---------------------------|-----------------|
| Hugo Roldan   | ADMIN       | hugo@miselium.local      | `Miselium2026!` |
| Gerardo Roldan| COLLABORATOR| gerardo@miselium.local   | `Miselium2026!` |
| Nikte         | COLLABORATOR| nikte@miselium.local     | `Miselium2026!` |

All three belong to the "Miselium" organization. Log in as Hugo to see the full admin view (all
clients/projects/tasks, team management). Log in as Gerardo or Nikte to see the scoped collaborator
view (only their assigned projects/tasks). No one is currently a PROJECT_MANAGER — the human will
promote someone via the Team page's role dropdown when ready.

## Running locally

```bash
npm install
npm run dev
```

The app expects a `.env.local` file (already present in this repo, gitignored) with:

```
VITE_SUPABASE_URL=https://xpxvreqnhrnwkrfdzymd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

See `.env.example` for the template. Only the anon/public key belongs here — never the
service_role key or the Supabase Management API token.

## Building for production

```bash
npm run build
```

Runs `tsc -b` (type-check) then `vite build`. Output goes to `dist/`. Verified to build cleanly
with zero TypeScript errors.

```bash
npm run preview   # serve the production build locally
npm run lint       # oxlint (warnings only, no errors)
```

## Project structure

```
src/
  design-system/     tokens.css, typography.css — shared design tokens
  components/        reusable UI library (Button, Input, Modal, Table, Chart, TaskDetailModal, ...)
  components/forms/  domain form modals (ProjectFormModal, TaskFormModal, ClientFormModal)
  contexts/          AuthContext (session + profile + role)
  hooks/             useSupabaseQuery — generic loading/error/data/refetch hook
                      useNotifications — merges persisted + client-computed "due soon" notifications
  layouts/           AppLayout (sidebar + header shell)
  routes/            ProtectedRoute (auth guard)
  lib/                supabase client, typed query functions
  pages/             one file per route (Dashboard, Today, Projects, ProjectDetail, Tasks,
                      Clients, ClientDetail, Team, Login, NotFound)
  types/database.ts  hand-written row types matching the Postgres schema
supabase/migrations/ SQL run against the live project (schema, RLS, seed)
```

See `ARCHITECTURE.md`, `DATABASE.md`, and `SECURITY.md` for deeper detail on each area, and
`DEPLOYMENT.md` for the exact remaining steps to ship this to Cloudflare Pages.

## Sitemap

```
/login
/app/dashboard
/app/today
/app/projects
/app/projects/:id
/app/tasks
/app/clients
/app/clients/:id
/app/team
```

## Roles

- **ADMIN** — full CRUD on clients/projects/tasks, assigns tasks, manages team/roles, sees
  everything within their organization.
- **PROJECT_MANAGER** — same operational reach as ADMIN within their organization (create/edit
  projects, create and assign tasks, manage clients, manage the team, view metrics/reports), except
  changing a user's role or another user's daily capacity, which stays ADMIN-only.
- **COLLABORATOR** — sees only projects they're a member of and tasks assigned to them, can update
  the status of their own tasks, log time, and comment; cannot manage users/roles or modify
  projects/clients they don't belong to. (Renamed from `DEVELOPER` — identical permissions.)

Permissions are enforced by Postgres Row Level Security, not just UI hiding, and are additionally
scoped per-organization (an ADMIN or PROJECT_MANAGER in one organization can never see or modify
another organization's data) — see `SECURITY.md` for the policies and how they were tested.
