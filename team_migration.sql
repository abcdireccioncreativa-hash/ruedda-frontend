-- Ruedda · aplicaciones al equipo fundador (ruedda.app/team)
-- Las inserta /api/team con la service key. Solo los superadmins las ven y gestionan en Control → Equipo fundador.
create table if not exists public.team_solicitudes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  contacto text not null,
  ciudad text not null,
  areas text[] not null default '{}',
  area_otra text,
  logros text not null,
  motivo text not null,
  disponibilidad text check (disponibilidad in ('completo','medio','proyecto')),
  linkedin text,
  portafolio text,
  respuestas jsonb not null default '{}'::jsonb,
  estado text not null default 'nueva',
  notas text
);
-- por si la tabla ya existía de antes
alter table public.team_solicitudes add column if not exists linkedin text;
alter table public.team_solicitudes add column if not exists notas text;
alter table public.team_solicitudes drop constraint if exists team_solicitudes_estado_check;
alter table public.team_solicitudes add constraint team_solicitudes_estado_check
  check (estado in ('nueva','revisando','entrevista','adentro','descartada'));

alter table public.team_solicitudes enable row level security;
drop policy if exists team_solicitudes_superadmin_select on public.team_solicitudes;
drop policy if exists team_solicitudes_superadmin on public.team_solicitudes;
create policy team_solicitudes_superadmin on public.team_solicitudes
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'));
create index if not exists team_solicitudes_created_idx on public.team_solicitudes (created_at desc);
