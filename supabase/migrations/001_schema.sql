-- Miselium Operations v0.1 - Schema
-- Roles, tables, FKs, indexes

create extension if not exists "pgcrypto";

-- ===== profiles =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'DEVELOPER' check (role in ('ADMIN','DEVELOPER')),
  created_at timestamptz not null default now()
);

-- ===== clients =====
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- ===== projects =====
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'PLANNING' check (status in ('PLANNING','ACTIVE','ON_HOLD','COMPLETED')),
  start_date date,
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_projects_client_id on public.projects(client_id);

-- ===== project_members =====
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists idx_project_members_user_id on public.project_members(user_id);
create index if not exists idx_project_members_project_id on public.project_members(project_id);

-- ===== tasks =====
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','DONE')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);

-- ===== activity_log =====
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_log_project_id on public.activity_log(project_id);
create index if not exists idx_activity_log_user_id on public.activity_log(user_id);

-- updated_at trigger for tasks
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();
