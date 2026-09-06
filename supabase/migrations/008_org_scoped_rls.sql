-- Miselium Operations - Fase 2: org-scoped RLS + PROJECT_MANAGER permissions
--
-- Rewrites every existing RLS policy (from 002_rls.sql, 005_agency_features.sql,
-- 006_task_estimation_capacity.sql) so that, in addition to whatever role/
-- membership check already existed, rows are also scoped to the caller's
-- organization (current_org_id()) - directly via the organization_id column
-- on profiles/clients/projects, and via a join through project_id/user_id
-- for tasks/project_members/time_entries/notifications/task_comments/
-- activity_log. An ADMIN (or PROJECT_MANAGER) in org A must never see, list,
-- or modify org B's data - admin-ness is scoped per-organization, not global.
--
-- Also introduces the PROJECT_MANAGER tier: everywhere current_role_is_admin()
-- previously gated a *content* operation (clients/projects/tasks CRUD, task
-- assignment, project team management), the new current_role_is_admin_or_pm()
-- helper is used instead. The narrow admin-only slice - changing a user's
-- `role` or another user's `daily_available_hours` (profiles_update_admin) -
-- is intentionally left ADMIN-only, matching the sensitivity already
-- established for those two fields in 006_task_estimation_capacity.sql.
-- Policies are re-created with the same names as before (policies live in
-- the DB, not in a given migration file) so this is a clean superset/replace,
-- not a parallel set of rules.

-- ===== Helper functions =====

-- Returns the caller's organization_id. security definer, same style as
-- current_role_is_admin() / is_project_member(), to avoid the RLS-recursion
-- problem of a plain subquery against profiles inside another table's policy.
create or replace function public.current_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.organization_id from public.profiles p where p.id = auth.uid();
$$;

-- True for ADMIN or PROJECT_MANAGER - the "can manage content" tier used for
-- clients/projects/tasks CRUD and project team management. Does NOT cover
-- the ADMIN-only slice (role changes, daily_available_hours changes).
create or replace function public.current_role_is_admin_or_pm()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN', 'PROJECT_MANAGER')
  );
$$;

-- True if the given project belongs to the caller's organization. Used
-- everywhere a policy needs to org-scope an admin/PM-wide "see everything"
-- branch (tasks, project_members, activity_log all reach their org only via
-- project_id, since none of them carry their own organization_id column).
create or replace function public.is_project_in_org(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p_project_id and pr.organization_id = public.current_org_id()
  );
$$;

-- ===== profiles =====
-- Any authenticated user can read profiles, but only within their own org
-- (previously: every authenticated user, org-blind).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    auth.role() = 'authenticated' and organization_id = public.current_org_id()
  );

-- Only ADMIN can insert/delete profiles or change role/daily_available_hours
-- (unchanged tier - see file header). Org-scoped: an ADMIN can only manage
-- profiles within their own organization.
drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert with check (
    public.current_role_is_admin() and organization_id = public.current_org_id()
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (
    public.current_role_is_admin() and organization_id = public.current_org_id()
  )
  with check (
    public.current_role_is_admin() and organization_id = public.current_org_id()
  );

-- A user may update their own name, but not their own role, capacity, or
-- organization (the last is new here - a user must never move themselves
-- to a different org).
drop policy if exists profiles_update_self_name on public.profiles;
create policy profiles_update_self_name on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and daily_available_hours is not distinct from (select daily_available_hours from public.profiles where id = auth.uid())
    and organization_id = (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete using (
    public.current_role_is_admin() and organization_id = public.current_org_id()
  );

-- ===== clients =====
-- ADMIN/PROJECT_MANAGER: full access, scoped to their own org. COLLABORATOR:
-- read-only, only clients tied to projects they're a member of (unchanged).
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (
    (public.current_role_is_admin_or_pm() and organization_id = public.current_org_id())
    or exists (
      select 1 from public.projects pr
      where pr.client_id = clients.id
      and pr.organization_id = public.current_org_id()
      and public.is_project_member(pr.id)
    )
  );

drop policy if exists clients_insert_admin on public.clients;
create policy clients_insert_admin on public.clients
  for insert with check (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  );

drop policy if exists clients_update_admin on public.clients;
create policy clients_update_admin on public.clients
  for update using (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  )
  with check (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  );

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin on public.clients
  for delete using (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  );

-- ===== projects =====
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    (public.current_role_is_admin_or_pm() and organization_id = public.current_org_id())
    or public.is_project_member(id)
  );

drop policy if exists projects_insert_admin on public.projects;
create policy projects_insert_admin on public.projects
  for insert with check (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  );

drop policy if exists projects_update_admin on public.projects;
create policy projects_update_admin on public.projects
  for update using (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  )
  with check (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  );

drop policy if exists projects_delete_admin on public.projects;
create policy projects_delete_admin on public.projects
  for delete using (
    public.current_role_is_admin_or_pm() and organization_id = public.current_org_id()
  );

-- ===== project_members =====
-- No organization_id column here (derives org via project_id -> projects).
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (
    (public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id))
    or user_id = auth.uid()
    or public.is_project_member(project_id)
  );

drop policy if exists project_members_insert_admin on public.project_members;
create policy project_members_insert_admin on public.project_members
  for insert with check (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  );

drop policy if exists project_members_update_admin on public.project_members;
create policy project_members_update_admin on public.project_members
  for update using (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  )
  with check (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  );

drop policy if exists project_members_delete_admin on public.project_members;
create policy project_members_delete_admin on public.project_members
  for delete using (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  );

-- ===== tasks =====
-- ADMIN/PROJECT_MANAGER: full access to all tasks in their org.
-- COLLABORATOR: read tasks in their projects; update only tasks assigned to
-- them (unchanged behavior, just renamed from "developer").
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    (public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id))
    or public.is_project_member(project_id)
  );

drop policy if exists tasks_insert_admin on public.tasks;
create policy tasks_insert_admin on public.tasks
  for insert with check (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (
    (public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id))
    or assigned_to = auth.uid()
  )
  with check (
    (public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id))
    or assigned_to = auth.uid()
  );

drop policy if exists tasks_delete_admin on public.tasks;
create policy tasks_delete_admin on public.tasks
  for delete using (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  );

-- ===== activity_log =====
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select using (
    (public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id))
    or public.is_project_member(project_id)
  );

drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log
  for insert with check (
    auth.uid() = user_id
    and (
      (public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id))
      or public.is_project_member(project_id)
    )
  );

drop policy if exists activity_log_delete_admin on public.activity_log;
create policy activity_log_delete_admin on public.activity_log
  for delete using (
    public.current_role_is_admin_or_pm() and public.is_project_in_org(project_id)
  );

-- ===== time_entries =====
-- is_task_project_member() (below) now folds in both the PROJECT_MANAGER
-- tier and the org-scoping join through tasks -> projects, so it replaces
-- the separate "current_role_is_admin() or ..." branch that used to appear
-- inline in these policies.
create or replace function public.is_task_project_member(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    join public.projects pr on pr.id = t.project_id
    where t.id = p_task_id
    and pr.organization_id = public.current_org_id()
    and (public.current_role_is_admin_or_pm() or public.is_project_member(t.project_id))
  );
$$;

drop policy if exists time_entries_select on public.time_entries;
create policy time_entries_select on public.time_entries
  for select using (
    user_id = auth.uid() or public.is_task_project_member(task_id)
  );

-- Insert: a user may only log time against a task assigned to them (or
-- ADMIN/PROJECT_MANAGER logging on behalf of the team), always under their
-- own user_id, and only for a task whose project is in their own org.
drop policy if exists time_entries_insert on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      join public.projects pr on pr.id = t.project_id
      where t.id = task_id and pr.organization_id = public.current_org_id()
    )
    and (public.current_role_is_admin_or_pm() or public.is_task_assignee(task_id))
  );

drop policy if exists time_entries_update on public.time_entries;
create policy time_entries_update on public.time_entries
  for update using (
    user_id = auth.uid() or (public.current_role_is_admin_or_pm() and public.is_task_project_member(task_id))
  )
  with check (
    user_id = auth.uid() or (public.current_role_is_admin_or_pm() and public.is_task_project_member(task_id))
  );

drop policy if exists time_entries_delete on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete using (
    user_id = auth.uid() or (public.current_role_is_admin_or_pm() and public.is_task_project_member(task_id))
  );

-- ===== notifications =====
-- No change: scoped only by user_id = auth.uid(), with no admin carve-out at
-- all (see 005_agency_features.sql). Since a user only ever sees their own
-- rows, there is no cross-org leakage possible here regardless of org, so
-- nothing needs rewriting.

-- ===== task_comments =====
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select using (public.is_task_project_member(task_id));

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert with check (user_id = auth.uid() and public.is_task_project_member(task_id));

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete using (
    user_id = auth.uid() or (public.current_role_is_admin_or_pm() and public.is_task_project_member(task_id))
  );
