-- Cúbica · solicitudes de proyectos desde cubica-group.vercel.app (lib/cubica.js inserta con la service key)
create table if not exists public.cubica_solicitudes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  plan        text,
  nombre      text not null,
  empresa     text not null,
  contacto    text not null,
  mensaje     text,
  origen      text,
  estado      text not null default 'nueva' check (estado in ('nueva','en conversacion','propuesta','cerrada','descartada')),
  notas       text
);
alter table public.cubica_solicitudes enable row level security;
-- nadie lee ni escribe desde el navegador salvo los superadmins de Ruedda (Control)
drop policy if exists cubica_superadmin on public.cubica_solicitudes;
create policy cubica_superadmin on public.cubica_solicitudes
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'superadmin'));
create index if not exists cubica_solicitudes_created_idx on public.cubica_solicitudes (created_at desc);
