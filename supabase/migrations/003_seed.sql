-- Miselium Operations v0.1 - Seed data
-- Demo auth users created directly in auth.users (bypassing Auth Admin API).
-- Passwords are bcrypt-hashed with crypt() using pgcrypto, matching Supabase Auth's expected format.

-- ===== Demo users =====
-- admin@miselium.com / Miselium2026!
-- dev1@miselium.com  / Miselium2026!
-- dev2@miselium.com  / Miselium2026!

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
  ('admin@miselium.com'),
  ('dev1@miselium.com'),
  ('dev2@miselium.com')
) as u(email)
where not exists (select 1 from auth.users where email = u.email);

-- identities row required for email/password login to work correctly
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), au.id::text, au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email),
  'email', now(), now(), now()
from auth.users au
where au.email in ('admin@miselium.com','dev1@miselium.com','dev2@miselium.com')
  and not exists (
    select 1 from auth.identities i where i.user_id = au.id and i.provider = 'email'
  );

-- profiles for demo users
insert into public.profiles (id, name, email, role)
select au.id, p.name, au.email, p.role
from auth.users au
join (values
  ('admin@miselium.com', 'Ana Ramirez', 'ADMIN'),
  ('dev1@miselium.com', 'Carlos Mendez', 'DEVELOPER'),
  ('dev2@miselium.com', 'Sofia Torres', 'DEVELOPER')
) as p(email, name, role) on p.email = au.email
where not exists (select 1 from public.profiles pr where pr.id = au.id);

-- ===== Clients =====
insert into public.clients (id, name, contact_name, email, phone, notes)
select gen_random_uuid(), c.name, c.contact_name, c.email, c.phone, c.notes
from (values
  ('ALTUM', 'Jorge Villareal', 'jorge@altum.com', '+52 55 1234 5678', 'Cliente estrategico, requiere reportes semanales.'),
  ('RD Consultorio Fiscal', 'Rosa Delgado', 'rosa@rdfiscal.mx', '+52 33 2345 6789', 'Consultoria fiscal, temporada alta en abril.'),
  ('Mayacorptrips', 'Luis Aguilar', 'luis@mayacorptrips.com', '+52 998 345 6789', 'Turismo, picos estacionales.'),
  ('Cliente Demo', 'Demo Contact', 'demo@example.com', '+52 55 0000 0000', 'Cuenta de demostracion interna.')
) as c(name, contact_name, email, phone, notes)
where not exists (select 1 from public.clients existing where existing.name = c.name);

-- ===== Projects =====
insert into public.projects (id, client_id, name, description, status, start_date, due_date)
select gen_random_uuid(), cl.id, p.name, p.description, p.status, p.start_date::date, p.due_date::date
from (values
  ('ALTUM LMS', 'ALTUM', 'Plataforma de aprendizaje interna para ALTUM.', 'ACTIVE', '2026-06-01', '2026-10-15'),
  ('ALTUM Website', 'ALTUM', 'Rediseno del sitio corporativo de ALTUM.', 'ON_HOLD', '2026-05-01', '2026-09-30'),
  ('RD Consultorio Fiscal', 'RD Consultorio Fiscal', 'Portal de clientes para RD Consultorio Fiscal.', 'PLANNING', '2026-08-01', '2026-12-01'),
  ('Mayacorptrips', 'Mayacorptrips', 'Sistema de reservaciones para Mayacorptrips.', 'ACTIVE', '2026-04-15', '2026-09-20'),
  ('ERP Demo', 'Cliente Demo', 'Demo interno de modulo ERP.', 'COMPLETED', '2026-01-10', '2026-04-01')
) as p(name, client_name, description, status, start_date, due_date)
join public.clients cl on cl.name = p.client_name
where not exists (select 1 from public.projects existing where existing.name = p.name);

-- ===== Project members =====
insert into public.project_members (project_id, user_id)
select pr.id, prof.id
from public.projects pr
join public.profiles prof on true
where (pr.name = 'ALTUM LMS' and prof.email in ('admin@miselium.com','dev1@miselium.com'))
   or (pr.name = 'ALTUM Website' and prof.email in ('admin@miselium.com','dev2@miselium.com'))
   or (pr.name = 'RD Consultorio Fiscal' and prof.email in ('admin@miselium.com','dev1@miselium.com','dev2@miselium.com'))
   or (pr.name = 'Mayacorptrips' and prof.email in ('admin@miselium.com','dev2@miselium.com'))
   or (pr.name = 'ERP Demo' and prof.email in ('admin@miselium.com','dev1@miselium.com'))
on conflict do nothing;

-- ===== Tasks =====
-- Mix of statuses, priorities, and due dates spread across past/present/future (today = 2026-09-06)
insert into public.tasks (project_id, assigned_to, title, description, status, priority, due_date)
select pr.id, prof.id, t.title, t.description, t.status, t.priority, t.due_date::date
from (values
  ('ALTUM LMS', 'dev1@miselium.com', 'Disenar esquema de base de datos', 'Definir tablas de cursos, usuarios y progreso.', 'DONE', 'HIGH', '2026-06-20'),
  ('ALTUM LMS', 'dev1@miselium.com', 'Implementar modulo de autenticacion', 'Login/registro con roles alumno/instructor.', 'DONE', 'HIGH', '2026-07-10'),
  ('ALTUM LMS', 'dev1@miselium.com', 'Construir reproductor de video', 'Soporte para streaming y progreso de leccion.', 'IN_PROGRESS', 'MEDIUM', '2026-09-10'),
  ('ALTUM LMS', 'dev1@miselium.com', 'Panel de administracion de cursos', 'CRUD de cursos y lecciones para instructores.', 'TODO', 'MEDIUM', '2026-09-25'),
  ('ALTUM LMS', 'dev1@miselium.com', 'Corregir bug de certificados', 'Los certificados PDF no se generan correctamente.', 'TODO', 'HIGH', '2026-08-30'),

  ('ALTUM Website', 'dev2@miselium.com', 'Wireframes de home', 'Explorar 3 layouts alternativos.', 'DONE', 'MEDIUM', '2026-05-20'),
  ('ALTUM Website', 'dev2@miselium.com', 'Migrar contenido a CMS', 'Mover copy actual a nuevo CMS headless.', 'TODO', 'LOW', '2026-09-15'),
  ('ALTUM Website', 'dev2@miselium.com', 'Optimizar performance', 'Lighthouse score debajo de 70, requiere optimizacion.', 'TODO', 'MEDIUM', '2026-08-25'),

  ('RD Consultorio Fiscal', 'dev1@miselium.com', 'Levantamiento de requerimientos', 'Reunion inicial con RD para definir alcance.', 'DONE', 'HIGH', '2026-08-05'),
  ('RD Consultorio Fiscal', 'dev2@miselium.com', 'Disenar portal de clientes', 'Mockups de dashboard de clientes fiscales.', 'IN_PROGRESS', 'HIGH', '2026-09-12'),
  ('RD Consultorio Fiscal', 'dev1@miselium.com', 'Definir integracion con SAT', 'Investigar APIs disponibles para validacion fiscal.', 'TODO', 'MEDIUM', '2026-10-01'),

  ('Mayacorptrips', 'dev2@miselium.com', 'Modulo de busqueda de viajes', 'Filtros por fecha, destino y precio.', 'DONE', 'HIGH', '2026-05-01'),
  ('Mayacorptrips', 'dev2@miselium.com', 'Integracion de pagos', 'Conectar pasarela de pagos con reservaciones.', 'IN_PROGRESS', 'HIGH', '2026-09-08'),
  ('Mayacorptrips', 'dev2@miselium.com', 'Notificaciones por correo', 'Confirmaciones y recordatorios automaticos.', 'TODO', 'LOW', '2026-09-05'),
  ('Mayacorptrips', 'dev2@miselium.com', 'Corregir calculo de disponibilidad', 'Bug reportado por doble reservacion.', 'TODO', 'HIGH', '2026-09-01'),

  ('ERP Demo', 'dev1@miselium.com', 'Modulo de inventario', 'CRUD de productos y stock.', 'DONE', 'MEDIUM', '2026-02-15'),
  ('ERP Demo', 'dev1@miselium.com', 'Modulo de facturacion', 'Generacion de facturas basicas.', 'DONE', 'MEDIUM', '2026-03-10'),
  ('ERP Demo', 'dev1@miselium.com', 'Reporte final de demo', 'Documentar resultados para presentacion.', 'DONE', 'LOW', '2026-03-28')
) as t(project_name, assignee_email, title, description, status, priority, due_date)
join public.projects pr on pr.name = t.project_name
join public.profiles prof on prof.email = t.assignee_email
where not exists (
  select 1 from public.tasks existing where existing.project_id = pr.id and existing.title = t.title
);

-- ===== Activity log =====
insert into public.activity_log (user_id, project_id, action)
select prof.id, pr.id, a.action
from (values
  ('ALTUM LMS', 'admin@miselium.com', 'Creo el proyecto ALTUM LMS'),
  ('ALTUM LMS', 'dev1@miselium.com', 'Completo la tarea "Implementar modulo de autenticacion"'),
  ('RD Consultorio Fiscal', 'dev2@miselium.com', 'Actualizo el estado del portal de clientes a en progreso'),
  ('Mayacorptrips', 'dev2@miselium.com', 'Reporto un bug en calculo de disponibilidad'),
  ('ERP Demo', 'admin@miselium.com', 'Marco el proyecto ERP Demo como completado')
) as a(project_name, user_email, action)
join public.projects pr on pr.name = a.project_name
join public.profiles prof on prof.email = a.user_email
where not exists (
  select 1 from public.activity_log existing
  where existing.project_id = pr.id and existing.action = a.action
);
