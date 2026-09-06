-- Miselium Operations v0.4 - Onboard a second organization (RD Consultorio Fiscal)
-- Creates a new, fully isolated tenant with its own ADMIN and COLLABORATOR user.
-- Does NOT touch the existing "Miselium" organization or its users' passwords.

-- ===== New users =====
-- rafael@rdconsultoriofiscal.local  / (temporary password, shared out-of-band)  ADMIN
-- gustavo@rdconsultoriofiscal.local / (temporary password, shared out-of-band)  COLLABORATOR
--
-- SECURITY NOTE: unlike the earlier internal demo-user migrations (003/004), these are real
-- credentials for a real external client, so the temp passwords are intentionally NOT committed
-- here. __RAFAEL_TEMP_PASSWORD__ / __GUSTAVO_TEMP_PASSWORD__ below are placeholders substituted
-- at run time only, never written to git history.

insert into organizations (id, name)
select gen_random_uuid(), 'RD Consultorio Fiscal'
where not exists (select 1 from organizations where name = 'RD Consultorio Fiscal');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  u.email, crypt(u.temp_password, gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('rafael@rdconsultoriofiscal.local', '__RAFAEL_TEMP_PASSWORD__'),
  ('gustavo@rdconsultoriofiscal.local', '__GUSTAVO_TEMP_PASSWORD__')
) as u(email, temp_password)
where not exists (select 1 from auth.users where email = u.email);

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), au.id::text, au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email),
  'email', now(), now(), now()
from auth.users au
where au.email in ('rafael@rdconsultoriofiscal.local', 'gustavo@rdconsultoriofiscal.local')
  and not exists (
    select 1 from auth.identities i where i.user_id = au.id and i.provider = 'email'
  );

insert into public.profiles (id, organization_id, name, email, role)
select au.id, o.id, p.name, au.email, p.role
from auth.users au
join (values
  ('rafael@rdconsultoriofiscal.local', 'Rafael', 'ADMIN'),
  ('gustavo@rdconsultoriofiscal.local', 'Gustavo', 'COLLABORATOR')
) as p(email, name, role) on p.email = au.email
join organizations o on o.name = 'RD Consultorio Fiscal'
where not exists (select 1 from public.profiles pr where pr.id = au.id);
