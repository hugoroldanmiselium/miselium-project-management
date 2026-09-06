-- Miselium Operations v0.1 - Replace demo users with real team members
-- Removes admin@miselium.com / dev1@miselium.com / dev2@miselium.com and
-- replaces them with Hugo Roldan (ADMIN), Gerardo Roldan (DEVELOPER), Nikte (DEVELOPER).
-- These accounts use synthetic @miselium.local addresses purely as Supabase Auth
-- login identifiers (no real inbox) since only username/password were requested.

-- ===== New users =====
-- hugo@miselium.local    / Miselium2026!  (ADMIN)
-- gerardo@miselium.local / Miselium2026!  (DEVELOPER)
-- nikte@miselium.local   / Miselium2026!  (DEVELOPER)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  u.email, crypt('Miselium2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('hugo@miselium.local'),
  ('gerardo@miselium.local'),
  ('nikte@miselium.local')
) as u(email)
where not exists (select 1 from auth.users where email = u.email);

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), au.id::text, au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email),
  'email', now(), now(), now()
from auth.users au
where au.email in ('hugo@miselium.local','gerardo@miselium.local','nikte@miselium.local')
  and not exists (
    select 1 from auth.identities i where i.user_id = au.id and i.provider = 'email'
  );

insert into public.profiles (id, name, email, role)
select au.id, p.name, au.email, p.role
from auth.users au
join (values
  ('hugo@miselium.local', 'Hugo Roldan', 'ADMIN'),
  ('gerardo@miselium.local', 'Gerardo Roldan', 'DEVELOPER'),
  ('nikte@miselium.local', 'Nikte', 'DEVELOPER')
) as p(email, name, role) on p.email = au.email
where not exists (select 1 from public.profiles pr where pr.id = au.id);

-- ===== Move existing data off the old demo users onto the new ones =====
-- admin@miselium.com -> hugo@miselium.local
-- dev1@miselium.com  -> gerardo@miselium.local
-- dev2@miselium.com  -> nikte@miselium.local

update public.project_members pm
set user_id = new.id
from public.profiles old, public.profiles new
where pm.user_id = old.id
  and old.email = 'admin@miselium.com' and new.email = 'hugo@miselium.local';

update public.project_members pm
set user_id = new.id
from public.profiles old, public.profiles new
where pm.user_id = old.id
  and old.email = 'dev1@miselium.com' and new.email = 'gerardo@miselium.local';

update public.project_members pm
set user_id = new.id
from public.profiles old, public.profiles new
where pm.user_id = old.id
  and old.email = 'dev2@miselium.com' and new.email = 'nikte@miselium.local';

update public.tasks t
set assigned_to = new.id
from public.profiles old, public.profiles new
where t.assigned_to = old.id
  and old.email = 'admin@miselium.com' and new.email = 'hugo@miselium.local';

update public.tasks t
set assigned_to = new.id
from public.profiles old, public.profiles new
where t.assigned_to = old.id
  and old.email = 'dev1@miselium.com' and new.email = 'gerardo@miselium.local';

update public.tasks t
set assigned_to = new.id
from public.profiles old, public.profiles new
where t.assigned_to = old.id
  and old.email = 'dev2@miselium.com' and new.email = 'nikte@miselium.local';

update public.activity_log a
set user_id = new.id
from public.profiles old, public.profiles new
where a.user_id = old.id
  and old.email = 'admin@miselium.com' and new.email = 'hugo@miselium.local';

update public.activity_log a
set user_id = new.id
from public.profiles old, public.profiles new
where a.user_id = old.id
  and old.email = 'dev1@miselium.com' and new.email = 'gerardo@miselium.local';

update public.activity_log a
set user_id = new.id
from public.profiles old, public.profiles new
where a.user_id = old.id
  and old.email = 'dev2@miselium.com' and new.email = 'nikte@miselium.local';

-- ===== Remove old demo users entirely =====
-- profiles cascade-delete with auth.users; project_members cascade-delete with profiles;
-- tasks.assigned_to / activity_log.user_id are already reassigned above, so nothing is lost.
delete from auth.users where email in ('admin@miselium.com', 'dev1@miselium.com', 'dev2@miselium.com');
