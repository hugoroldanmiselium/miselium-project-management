-- Miselium Operations - Agency features
-- Adds: time tracking, repo link + billing visibility on projects,
-- in-app notifications (task assignment trigger), task comments.

-- ===== projects: new columns =====
alter table public.projects add column if not exists repo_url text;
alter table public.projects add column if not exists billing_type text not null default 'HOURLY' check (billing_type in ('HOURLY','FIXED'));
alter table public.projects add column if not exists hourly_rate numeric;

-- ===== time_entries =====
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hours numeric not null check (hours > 0),
  note text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_time_entries_task_id on public.time_entries(task_id);
create index if not exists idx_time_entries_user_id on public.time_entries(user_id);
create index if not exists idx_time_entries_entry_date on public.time_entries(entry_date);

-- ===== notifications =====
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_id on public.notifications(user_id);

-- ===== task_comments =====
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_comments_task_id on public.task_comments(task_id);

-- ===== RLS enable =====
alter table public.time_entries enable row level security;
alter table public.notifications enable row level security;
alter table public.task_comments enable row level security;

-- Helper: is the current user a member of the project that owns a given task
-- (or admin). Reuses the existing is_project_member() helper from 002_rls.sql.
create or replace function public.is_task_project_member(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
    and (public.current_role_is_admin() or public.is_project_member(t.project_id))
  );
$$;

-- ===== time_entries policies =====
-- A developer can insert/see their own time entries, plus see entries logged
-- by teammates on projects they belong to (so per-project/per-task totals are
-- accurate). ADMIN sees/manages all.
drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select using (
    public.current_role_is_admin()
    or user_id = auth.uid()
    or public.is_task_project_member(task_id)
  );

-- Helper: is the current user the assignee of a given task. security definer
-- so it isn't itself gated by the tasks table's own RLS (a plain subquery
-- inside a WITH CHECK clause would be subject to tasks_select, which could
-- spuriously fail for an assigned-but-not-yet-project-member edge case).
create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.assigned_to = auth.uid()
  );
$$;

-- Insert: a user may only log time against a task assigned to them (or ADMIN
-- logging on behalf of the team), and only under their own user_id.
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert with check (
    user_id = auth.uid()
    and (public.current_role_is_admin() or public.is_task_assignee(task_id))
  );

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update using (public.current_role_is_admin() or user_id = auth.uid())
  with check (public.current_role_is_admin() or user_id = auth.uid());

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete using (public.current_role_is_admin() or user_id = auth.uid());

-- ===== notifications policies =====
-- A user can only see/update their own notifications. Rows are inserted by
-- the security-definer trigger below (bypasses RLS), so no general INSERT
-- policy is needed for normal users.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

-- ===== task_comments policies =====
-- Any project member (or ADMIN) can read/write comments on tasks belonging
-- to projects they are a member of. Append-only (like activity_log): no
-- update policy; delete restricted to the author or ADMIN.
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select using (public.is_task_project_member(task_id));

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert with check (user_id = auth.uid() and public.is_task_project_member(task_id));

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete using (public.current_role_is_admin() or user_id = auth.uid());

-- ===== Notification trigger: task assignment =====
-- Fires whenever a task is created with an assignee, or an existing task's
-- assignee changes. Notifies the new assignee, unless they are the one
-- making the change. security definer so it can insert a notification row
-- for a *different* user than the one making the request (RLS on
-- notifications otherwise only allows a user to touch their own rows).
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null
     and (TG_OP = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and new.assigned_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  then
    insert into public.notifications (user_id, message, link)
    values (
      new.assigned_to,
      'Se te asigno la tarea "' || new.title || '"',
      '/app/tasks'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_assignment on public.tasks;
create trigger trg_notify_task_assignment
after insert or update of assigned_to on public.tasks
for each row execute function public.notify_task_assignment();

-- ===== "Due soon" notifications =====
-- Not implemented as stored rows / a scheduled job: this project has no
-- server to run a cron trigger on, and Postgres has no wall-clock cron
-- built in without the pg_cron extension (not part of the "$0 infra, no new
-- services" constraint here). Instead, "due soon" notifications are computed
-- client-side on page load from the current user's own tasks (already RLS-
-- scoped) — see src/hooks/useNotifications.ts — and merged into the bell
-- dropdown alongside the persisted assignment notifications above. This is
-- documented here and in README.md / SECURITY.md.
