-- Miselium Operations v0.1 - RLS policies

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_log enable row level security;

-- Helper functions (security definer to avoid recursive RLS lookups)
create or replace function public.current_role_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.user_id = auth.uid()
  );
$$;

-- ===== profiles =====
-- Everyone authenticated can read all profiles (needed for assignee names, team page).
-- No finance/sensitive data in profiles, so this is safe for developers too.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.role() = 'authenticated');

-- Only admins can insert/update/delete profiles (role changes, team management).
-- Users may update their own name (not role).
drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert with check (public.current_role_is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.current_role_is_admin())
  with check (public.current_role_is_admin());

drop policy if exists profiles_update_self_name on public.profiles;
create policy profiles_update_self_name on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete using (public.current_role_is_admin());

-- ===== clients =====
-- Admins: full access. Developers: read-only, only clients tied to projects they're a member of.
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (
    public.current_role_is_admin()
    or exists (
      select 1 from public.projects pr
      where pr.client_id = clients.id
      and public.is_project_member(pr.id)
    )
  );

drop policy if exists clients_insert_admin on public.clients;
create policy clients_insert_admin on public.clients
  for insert with check (public.current_role_is_admin());

drop policy if exists clients_update_admin on public.clients;
create policy clients_update_admin on public.clients
  for update using (public.current_role_is_admin()) with check (public.current_role_is_admin());

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin on public.clients
  for delete using (public.current_role_is_admin());

-- ===== projects =====
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (
    public.current_role_is_admin() or public.is_project_member(id)
  );

drop policy if exists projects_insert_admin on public.projects;
create policy projects_insert_admin on public.projects
  for insert with check (public.current_role_is_admin());

drop policy if exists projects_update_admin on public.projects;
create policy projects_update_admin on public.projects
  for update using (public.current_role_is_admin()) with check (public.current_role_is_admin());

drop policy if exists projects_delete_admin on public.projects;
create policy projects_delete_admin on public.projects
  for delete using (public.current_role_is_admin());

-- ===== project_members =====
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (
    public.current_role_is_admin() or user_id = auth.uid() or public.is_project_member(project_id)
  );

drop policy if exists project_members_insert_admin on public.project_members;
create policy project_members_insert_admin on public.project_members
  for insert with check (public.current_role_is_admin());

drop policy if exists project_members_update_admin on public.project_members;
create policy project_members_update_admin on public.project_members
  for update using (public.current_role_is_admin()) with check (public.current_role_is_admin());

drop policy if exists project_members_delete_admin on public.project_members;
create policy project_members_delete_admin on public.project_members
  for delete using (public.current_role_is_admin());

-- ===== tasks =====
-- Admins: full access to all tasks.
-- Developers: read tasks in their projects; update only tasks assigned to them (status/description etc, not reassign).
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    public.current_role_is_admin() or public.is_project_member(project_id)
  );

drop policy if exists tasks_insert_admin on public.tasks;
create policy tasks_insert_admin on public.tasks
  for insert with check (public.current_role_is_admin());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (
    public.current_role_is_admin() or assigned_to = auth.uid()
  )
  with check (
    public.current_role_is_admin() or assigned_to = auth.uid()
  );

drop policy if exists tasks_delete_admin on public.tasks;
create policy tasks_delete_admin on public.tasks
  for delete using (public.current_role_is_admin());

-- ===== activity_log =====
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select using (
    public.current_role_is_admin() or public.is_project_member(project_id)
  );

drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log
  for insert with check (
    auth.uid() = user_id
    and (public.current_role_is_admin() or public.is_project_member(project_id))
  );

-- no update/delete policies for activity_log (append-only); admins can still delete via no policy... add admin delete
drop policy if exists activity_log_delete_admin on public.activity_log;
create policy activity_log_delete_admin on public.activity_log
  for delete using (public.current_role_is_admin());
