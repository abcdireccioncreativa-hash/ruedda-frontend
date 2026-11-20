-- Ruedda · aplicaciones al equipo fundador (ruedda.app/team)
-- Las inserta /api/team con la service key. Solo los superadmins las leen.
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
  estado text not null default 'nueva'
);
alter table public.team_solicitudes enable row level security;
drop policy if exists team_solicitudes_superadmin_select on public.team_solicitudes;
create policy team_solicitudes_superadmin_select on public.team_solicitudes
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'));
-- si la tabla ya existía sin la columna:
alter table public.team_solicitudes add column if not exists linkedin text;
