-- Miselium Operations - Fase 2: multi-tenancy (organizations) + 3-tier roles
-- Adds: organizations table, organization_id on profiles/clients/projects
-- (the three "top-level" entities), and renames the 2-role system
-- (ADMIN/DEVELOPER) to 3 tiers (ADMIN/PROJECT_MANAGER/COLLABORATOR).
--
-- organization_id is deliberately NOT added to tasks, project_members,
-- time_entries, notifications, task_comments, activity_log: those already
-- scope through project_id or user_id, and RLS on them (see
-- 008_org_scoped_rls.sql) derives organization membership by joining up to
-- projects/profiles rather than duplicating the column. Storing the column
-- redundantly on every child table would let the FK and the derived org
-- disagree (e.g. a task's project reassigned to a different org while the
-- task's own copy of organization_id stays stale) - joining avoids that
-- entire class of bug.

-- ===== organizations =====
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.organizations (name)
select 'Miselium'
where not exists (select 1 from public.organizations where name = 'Miselium');

-- ===== organization_id on the three top-level entities =====
alter table public.profiles add column if not exists organization_id uuid references public.organizations(id);
alter table public.clients add column if not exists organization_id uuid references public.organizations(id);
alter table public.projects add column if not exists organization_id uuid references public.organizations(id);

-- Backfill all existing rows onto the single "Miselium" org.
update public.profiles set organization_id = (select id from public.organizations where name = 'Miselium')
where organization_id is null;

update public.clients set organization_id = (select id from public.organizations where name = 'Miselium')
where organization_id is null;

update public.projects set organization_id = (select id from public.organizations where name = 'Miselium')
where organization_id is null;

-- Now that every row is backfilled, enforce not-null going forward.
alter table public.profiles alter column organization_id set not null;
alter table public.clients alter column organization_id set not null;
alter table public.projects alter column organization_id set not null;

create index if not exists idx_profiles_organization_id on public.profiles(organization_id);
create index if not exists idx_clients_organization_id on public.clients(organization_id);
create index if not exists idx_projects_organization_id on public.projects(organization_id);

-- ===== 3-tier roles: ADMIN / PROJECT_MANAGER / COLLABORATOR =====
-- Drop the old check constraint first (it would reject 'COLLABORATOR'),
-- rename existing DEVELOPER rows to COLLABORATOR (same permissions, new
-- name), then add the new constraint (which would reject 'DEVELOPER').
alter table public.profiles drop constraint if exists profiles_role_check;

update public.profiles set role = 'COLLABORATOR' where role = 'DEVELOPER';

alter table public.profiles add constraint profiles_role_check
  check (role in ('ADMIN', 'PROJECT_MANAGER', 'COLLABORATOR'));
alter table public.profiles alter column role set default 'COLLABORATOR';

-- ===== organizations RLS =====
-- A user may only read their own organization's row (no org-switcher UI in
-- this phase, so this is just enough for e.g. showing the org name later).
-- No insert/update/delete policy for regular users - organizations are
-- created via migration only for now.
alter table public.organizations enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select using (
    id = (select p.organization_id from public.profiles p where p.id = auth.uid())
  );
