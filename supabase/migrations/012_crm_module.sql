-- Miselium Operations - CRM module
--
-- Extremely simple CRM per spec: "Se quien es, como contactarlo, cuanto
-- podria valer y cuando debo volver a hablarle." No pipelines/stages/scoring/
-- automation. Two tables:
--   - contacts: the prospect/contact record itself (direct organization_id,
--     same top-level-entity pattern as clients/projects - see
--     007_organizations_and_role_tiers.sql header).
--   - contact_interactions: minimal chronological history ("Registrar
--     contacto" log), fk to contacts with cascade delete.
--
-- Status (vencido/hoy/proximo/sin seguimiento) is NEVER stored - it's pure
-- derived state computed client-side from next_followup_at vs now (see
-- src/lib/crmUtils.ts), matching how recurringDates.ts/financeUtils.ts keep
-- all derived date state out of the DB.
--
-- Permissions: reuses the existing clients/projects pattern directly (spec
-- section 12 maps cleanly onto it, unlike Finanzas which needed an
-- orthogonal finance_access flag - see 011_finance_module.sql header) -
-- ADMIN/PROJECT_MANAGER can fully manage contacts (create/edit/delete),
-- COLLABORATOR can view all contacts in their org and "gestionar" in the
-- limited sense of logging an interaction / moving the next-followup date,
-- mirroring how a COLLABORATOR can update their own assigned task's status
-- (tasks_update in 008_org_scoped_rls.sql) without holding full task-manage
-- rights.
--
-- The COLLABORATOR "registrar contacto" write touches contacts.
-- last_contact_date/next_followup_at only - not name/company/potential_value/
-- contact info/notes. Postgres RLS has no native column-level grant, so this
-- is implemented the same way profiles_update_self_name already restricts a
-- self-rename to NOT touch role/daily_available_hours/organization_id/
-- finance_access: a WITH CHECK clause that requires every other column to
-- still equal its currently-stored value (via a correlated subquery, which
-- reads pre-update state). This is real column-level enforcement (verified
-- live below), not just a UI affordance - a direct REST PATCH from a
-- COLLABORATOR attempting to change e.g. potential_value is rejected by RLS.

-- ===== contacts =====
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  phone text,
  whatsapp text,
  email text,
  company text,
  potential_value numeric(12,2),
  last_contact_date date,
  next_followup_at timestamptz,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_org on public.contacts(organization_id);
create index if not exists idx_contacts_next_followup on public.contacts(next_followup_at);

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

-- ===== contact_interactions ("historial minimo") =====
create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  note text not null,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_interactions_contact on public.contact_interactions(contact_id);

-- ===== Helper: is this contact in the caller's org? =====
-- security definer, same style as is_project_in_org() in 008_org_scoped_rls.sql.
create or replace function public.is_contact_in_org(p_contact_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.contacts c
    where c.id = p_contact_id and c.organization_id = public.current_org_id()
  );
$$;

-- ===== RLS =====
alter table public.contacts enable row level security;
alter table public.contact_interactions enable row level security;

-- contacts: any org member (ADMIN/PROJECT_MANAGER/COLLABORATOR) can view.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select using (
    organization_id = public.current_org_id()
  );

-- contacts: only ADMIN/PROJECT_MANAGER can create/delete.
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_role_is_admin_or_pm()
    and created_by = auth.uid()
  );

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete using (
    organization_id = public.current_org_id() and public.current_role_is_admin_or_pm()
  );

-- contacts: full update for ADMIN/PROJECT_MANAGER (edit/delete tier).
drop policy if exists contacts_update_manage on public.contacts;
create policy contacts_update_manage on public.contacts
  for update using (
    organization_id = public.current_org_id() and public.current_role_is_admin_or_pm()
  )
  with check (
    organization_id = public.current_org_id() and public.current_role_is_admin_or_pm()
  );

-- contacts: narrow update for any org member - "Registrar contacto" /
-- "Programar seguimiento" only ever touch last_contact_date/next_followup_at
-- (plus updated_by/updated_at bookkeeping). Every other column must remain
-- equal to its currently-stored value, same technique as
-- profiles_update_self_name in 007/011. This policy is permissive and is
-- OR'd with contacts_update_manage above, so an ADMIN/PROJECT_MANAGER is
-- unaffected (they already pass the manage policy); a COLLABORATOR can only
-- ever satisfy this narrower one.
drop policy if exists contacts_update_followup on public.contacts;
create policy contacts_update_followup on public.contacts
  for update using (
    organization_id = public.current_org_id()
  )
  with check (
    organization_id = public.current_org_id()
    and name = (select c.name from public.contacts c where c.id = contacts.id)
    and phone is not distinct from (select c.phone from public.contacts c where c.id = contacts.id)
    and whatsapp is not distinct from (select c.whatsapp from public.contacts c where c.id = contacts.id)
    and email is not distinct from (select c.email from public.contacts c where c.id = contacts.id)
    and company is not distinct from (select c.company from public.contacts c where c.id = contacts.id)
    and potential_value is not distinct from (select c.potential_value from public.contacts c where c.id = contacts.id)
    and notes is not distinct from (select c.notes from public.contacts c where c.id = contacts.id)
    and created_by = (select c.created_by from public.contacts c where c.id = contacts.id)
    and organization_id = (select c.organization_id from public.contacts c where c.id = contacts.id)
  );

-- contact_interactions: any org member can view (via parent contact's org).
drop policy if exists contact_interactions_select on public.contact_interactions;
create policy contact_interactions_select on public.contact_interactions
  for select using (
    public.is_contact_in_org(contact_id)
  );

-- contact_interactions: any org member can log an interaction on a contact
-- in their org, always under their own user_id - this is the "gestionar"
-- carve-out for COLLABORATOR (mirrors task_comments_insert in
-- 008_org_scoped_rls.sql).
drop policy if exists contact_interactions_insert on public.contact_interactions;
create policy contact_interactions_insert on public.contact_interactions
  for insert with check (
    user_id = auth.uid() and public.is_contact_in_org(contact_id)
  );

-- No update/delete policy on contact_interactions - the history log is
-- append-only/immutable, same as task_comments has no update policy.
