-- ============================================================================
-- RUEDDA REPUESTOS · 12_alquiler_herramientas.sql
-- ----------------------------------------------------------------------------
-- Alquiler de herramienta: "Sabes de mecanica? Alquila las herramientas para
-- instalar esto." — un CTA en cada publicacion de repuesto que abre el
-- catalogo de herramientas en alquiler de esa categoria. Si todavia no hay
-- ninguna cargada (caso normal al lanzar: la tabla arranca vacia), el front
-- muestra "Proximamente" en vez de un catalogo vacio.
-- ============================================================================

create table if not exists repuestos.tool_rentals (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid references repuestos.stores(id) on delete cascade,
  name          text not null,
  description   text,
  category      text references repuestos.part_categories(id) on update cascade on delete set null,
  price_usd_day numeric(12,2) not null check (price_usd_day >= 0),
  deposit_usd   numeric(12,2) not null default 0,
  zone          text,
  image_url     text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_toolrentals_category on repuestos.tool_rentals(category) where active;
create index if not exists idx_toolrentals_store on repuestos.tool_rentals(store_id);

alter table repuestos.tool_rentals enable row level security;
grant usage on schema repuestos to anon, authenticated;
grant select on repuestos.tool_rentals to anon, authenticated;

create policy "cualquiera ve herramientas activas" on repuestos.tool_rentals
  for select using (active = true or repuestos.owns_store(store_id) or repuestos.is_admin());

create policy "la tienda dueña o el admin administran sus herramientas" on repuestos.tool_rentals
  for all using (repuestos.owns_store(store_id) or repuestos.is_admin())
  with check (repuestos.owns_store(store_id) or repuestos.is_admin());
