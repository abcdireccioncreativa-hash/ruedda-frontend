-- Ruedda Academy · solicitudes de cupo desde ruedda.app/academy (lib/academy.js inserta con la service key)
create table if not exists public.academy_solicitudes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  programa    text not null check (programa in ('mecanica','mujeres','jovenes','compra','diagnostico','venta')),
  para        text not null default 'yo' check (para in ('yo','hijo','empresa')),
  nombre      text not null,
  whatsapp    text not null,
  correo      text,
  ciudad      text,
  mensaje     text,
  estado      text not null default 'nueva' check (estado in ('nueva','contactada','inscrita','descartada'))
);
alter table public.academy_solicitudes enable row level security;
-- sin políticas para anon/authenticated: nadie lee ni escribe desde el navegador.
-- solo superadmins leen y actualizan (mismo criterio que postulaciones).
drop policy if exists academy_superadmin on public.academy_solicitudes;
create policy academy_superadmin on public.academy_solicitudes
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'));
create index if not exists academy_solicitudes_created_idx on public.academy_solicitudes (created_at desc);
