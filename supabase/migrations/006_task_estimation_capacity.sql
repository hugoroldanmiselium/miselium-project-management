-- Miselium Operations - Task effort estimation + per-user daily capacity
-- Adds: tasks.estimated_hours, profiles.daily_available_hours.
-- Pure data fields with simple aggregate display only — explicitly NOT a
-- scheduling/workload algorithm, NOT actual-hours timesheets (that's the
-- existing time_entries feature, left untouched), NOT auto-assignment, NOT
-- capacity calendars. See README.md / SECURITY.md for the full writeup.

-- ===== tasks: estimated_hours =====
-- Nullable so existing tasks keep NULL rather than an invented value. DB
-- allows 0 for flexibility (e.g. an admin placeholder task); the "should be
-- > 0" requirement from the spec is enforced only in the create-task form
-- (client-side validation), not as a hard DB constraint, so a legitimate
-- 0-hour row is never rejected at the database level.
alter table public.tasks
  add column if not exists estimated_hours numeric(5,2)
  check (estimated_hours is null or estimated_hours >= 0);

-- ===== profiles: daily_available_hours =====
-- Nullable so existing users are left unset rather than backfilled with a
-- fake value. Required for active users going forward is enforced in the
-- ADMIN user-edit UI (Team page), not at the DB level, since retroactively
-- forcing a value here would have no real data to backfill with.
alter table public.profiles
  add column if not exists daily_available_hours numeric(4,2)
  check (daily_available_hours is null or (daily_available_hours > 0 and daily_available_hours <= 24));

-- ===== RLS: profiles =====
-- profiles_select (any authenticated user) and profiles_update_admin (ADMIN
-- can update any column on any profile) already cover the new column with no
-- changes needed — see 002_rls.sql. The one policy that needs extending is
-- profiles_update_self_name: a user updating their own `name` must not be
-- able to sneak in a change to `daily_available_hours` (or `role`, already
-- blocked) in the same request. Re-create the policy with the same name so
-- it replaces the one from 002_rls.sql (policies live in the DB, not in a
-- given migration file).
drop policy if exists profiles_update_self_name on public.profiles;
create policy profiles_update_self_name on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and daily_available_hours is not distinct from (select daily_available_hours from public.profiles where id = auth.uid())
  );

-- ===== RLS: tasks =====
-- No change. `estimated_hours` is an ordinary column on `tasks`; Postgres RLS
-- is table-level (not column-level) unless something clever with views/
-- triggers is layered on top, and nothing like that exists here. The
-- existing tasks_update policy (ADMIN, or the task's own `assigned_to` user)
-- already covers writes to this new column — a developer editing their own
-- assigned task can also set/adjust its estimate, which is the simplest
-- correct choice since the spec doesn't restrict estimation to ADMIN-only
-- and it appears in the same shared create/edit form used for everything
-- else on a task.
