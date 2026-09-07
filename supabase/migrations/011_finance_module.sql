-- Miselium Operations - Finanzas module
--
-- Adds a per-organization finance module: income (ingresos), expenses
-- (egresos - "Gastos" in the spec is just this same table analyzed/grouped
-- by category client-side, not a separate table), tax provisions
-- (impuestos - explicitly a financial ESTIMATE/PROVISION, never an official
-- tax filing), and a small category table shared by incomes/expenses.
--
-- "Cuentas por cobrar" / "Cuentas por pagar" are NOT separate tables - they
-- are just incomes/expenses filtered to status = 'PENDIENTE', with
-- dias-pendientes computed client-side from due_date (see
-- src/lib/recurringDates.ts-style date math in src/lib/financeUtils.ts).
--
-- Permission model: finance access is orthogonal to the existing 3-tier role
-- system (ADMIN/PROJECT_MANAGER/COLLABORATOR), so this does NOT add a 4th
-- role. Instead: profiles.finance_access (boolean, default false). An ADMIN
-- always has implicit full finance access (no need for the flag). A
-- PROJECT_MANAGER or COLLABORATOR only has finance access if their
-- finance_access flag is explicitly granted by an ADMIN - mirrors the
-- existing daily_available_hours/role self-modification guard, extended a
-- third time on profiles_update_self_name.
--
-- Delete permission: any user with finance access (ADMIN or
-- finance_access = true) may delete their own org's finance rows - the spec
-- does not distinguish a narrower delete tier, so this matches the same
-- "Finanzas: crear/editar/consultar" grant already used for insert/update.

-- ===== profiles: finance_access =====
alter table public.profiles
  add column if not exists finance_access boolean not null default false;

-- Extend the self-update guard (2nd time: daily_available_hours in
-- 006_task_estimation_capacity.sql, 3rd column added here: finance_access
-- and organization_id already guarded in 008_org_scoped_rls.sql) so a user
-- can never grant themselves finance access while renaming themselves.
drop policy if exists profiles_update_self_name on public.profiles;
create policy profiles_update_self_name on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and daily_available_hours is not distinct from (select daily_available_hours from public.profiles where id = auth.uid())
    and organization_id = (select organization_id from public.profiles where id = auth.uid())
    and finance_access = (select finance_access from public.profiles where id = auth.uid())
  );

-- ===== has_finance_access() helper =====
-- security definer, same style as current_role_is_admin() / current_org_id().
create or replace function public.has_finance_access()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role_is_admin() or coalesce(
    (select p.finance_access from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ===== finance_categories =====
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  type text not null check (type in ('INCOME', 'EXPENSE')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, type, name)
);

create index if not exists idx_finance_categories_org on public.finance_categories(organization_id);

-- ===== incomes (ingresos) =====
create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  date date not null,
  concept text not null,
  client_id uuid references public.clients(id),
  category_id uuid references public.finance_categories(id),
  subtotal numeric(12,2) not null,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text,
  status text not null default 'PENDIENTE' check (status in ('COBRADO', 'PENDIENTE')),
  due_date date,
  collected_date date,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incomes_org on public.incomes(organization_id);
create index if not exists idx_incomes_date on public.incomes(date);
create index if not exists idx_incomes_status on public.incomes(status);

drop trigger if exists trg_incomes_updated_at on public.incomes;
create trigger trg_incomes_updated_at
before update on public.incomes
for each row execute function public.set_updated_at();

-- ===== expenses (egresos) =====
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  date date not null,
  concept text not null,
  vendor text,
  category_id uuid references public.finance_categories(id),
  subtotal numeric(12,2) not null,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text,
  status text not null default 'PENDIENTE' check (status in ('PAGADO', 'PENDIENTE')),
  due_date date,
  paid_date date,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_org on public.expenses(organization_id);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_expenses_status on public.expenses(status);

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- ===== tax_provisions (impuestos) =====
-- Explicitly a financial ESTIMATE / provision, never an official tax filing
-- (SAT declaration, CFDI, etc.) - labeled as such in the UI, per spec.
create table if not exists public.tax_provisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  date date not null,
  tax_type text not null,
  period text not null,
  base numeric(12,2),
  iva_trasladado numeric(12,2),
  iva_acreditable numeric(12,2),
  iva_por_pagar numeric(12,2),
  isr_estimado numeric(12,2),
  total_provisioned numeric(12,2) not null,
  total_paid numeric(12,2) default 0,
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'PAGADO')),
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tax_provisions_org on public.tax_provisions(organization_id);
create index if not exists idx_tax_provisions_date on public.tax_provisions(date);

drop trigger if exists trg_tax_provisions_updated_at on public.tax_provisions;
create trigger trg_tax_provisions_updated_at
before update on public.tax_provisions
for each row execute function public.set_updated_at();

-- ===== RLS =====
alter table public.finance_categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.tax_provisions enable row level security;

-- finance_categories
drop policy if exists finance_categories_select on public.finance_categories;
create policy finance_categories_select on public.finance_categories
  for select using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists finance_categories_insert on public.finance_categories;
create policy finance_categories_insert on public.finance_categories
  for insert with check (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists finance_categories_update on public.finance_categories;
create policy finance_categories_update on public.finance_categories
  for update using (
    organization_id = public.current_org_id() and public.has_finance_access()
  )
  with check (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists finance_categories_delete on public.finance_categories;
create policy finance_categories_delete on public.finance_categories
  for delete using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

-- incomes
drop policy if exists incomes_select on public.incomes;
create policy incomes_select on public.incomes
  for select using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists incomes_insert on public.incomes;
create policy incomes_insert on public.incomes
  for insert with check (
    organization_id = public.current_org_id()
    and public.has_finance_access()
    and created_by = auth.uid()
  );

drop policy if exists incomes_update on public.incomes;
create policy incomes_update on public.incomes
  for update using (
    organization_id = public.current_org_id() and public.has_finance_access()
  )
  with check (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists incomes_delete on public.incomes;
create policy incomes_delete on public.incomes
  for delete using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

-- expenses
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (
    organization_id = public.current_org_id()
    and public.has_finance_access()
    and created_by = auth.uid()
  );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update using (
    organization_id = public.current_org_id() and public.has_finance_access()
  )
  with check (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

-- tax_provisions
drop policy if exists tax_provisions_select on public.tax_provisions;
create policy tax_provisions_select on public.tax_provisions
  for select using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists tax_provisions_insert on public.tax_provisions;
create policy tax_provisions_insert on public.tax_provisions
  for insert with check (
    organization_id = public.current_org_id()
    and public.has_finance_access()
    and created_by = auth.uid()
  );

drop policy if exists tax_provisions_update on public.tax_provisions;
create policy tax_provisions_update on public.tax_provisions
  for update using (
    organization_id = public.current_org_id() and public.has_finance_access()
  )
  with check (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

drop policy if exists tax_provisions_delete on public.tax_provisions;
create policy tax_provisions_delete on public.tax_provisions
  for delete using (
    organization_id = public.current_org_id() and public.has_finance_access()
  );

-- ===== Seed default categories for both existing real organizations =====
-- Category LABELS are structural/config data (not fabricated financial
-- data), so it's fine to seed these for real organizations - no rows are
-- created in incomes/expenses/tax_provisions.
insert into public.finance_categories (organization_id, type, name)
select o.id, c.type, c.name
from public.organizations o
cross join (values
  ('INCOME', 'Venta de servicios'),
  ('INCOME', 'Venta de productos'),
  ('INCOME', 'Suscripciones'),
  ('INCOME', 'Proyectos'),
  ('INCOME', 'Otros ingresos'),
  ('EXPENSE', 'Nomina'),
  ('EXPENSE', 'Software'),
  ('EXPENSE', 'Hosting'),
  ('EXPENSE', 'Marketing'),
  ('EXPENSE', 'Renta'),
  ('EXPENSE', 'Servicios'),
  ('EXPENSE', 'Transporte'),
  ('EXPENSE', 'Comisiones'),
  ('EXPENSE', 'Honorarios'),
  ('EXPENSE', 'Equipamiento'),
  ('EXPENSE', 'Operacion'),
  ('EXPENSE', 'Otros')
) as c(type, name)
where o.name in ('Miselium', 'RD Consultorio Fiscal')
on conflict (organization_id, type, name) do nothing;
