-- ============================================================================
-- RUEDDA REPUESTOS · 08_reviews_push.sql
-- ----------------------------------------------------------------------------
-- Corre esto DESPUES de 01_schema.sql..07_bootstrap_admin.sql (~/Downloads/
-- RueddaRepuestosManual/) en el SQL Editor de Supabase (ltodsegzbbdcaublkgtp).
-- Idempotente: se puede correr varias veces sin romper nada.
--
-- Dos cosas en este archivo:
--   1. Calificaciones de producto y de tienda — "solo califica quien pago",
--      igual que el principio ya usado en la Red de mecanicos (ver 09_rta).
--   2. El puente de push: repuestos vive en su propio schema, pero las
--      push notifications YA estan montadas en `public` (mismo proyecto,
--      mismo dominio ruedda.app) — ver push_notifications_migration.sql en
--      la raiz del repo. En vez de duplicar push_subscriptions y el envio
--      web-push aqui, repuestos.notify() solo inserta en public.notifications
--      y el trigger que ya existe ahi dispara el push real. Cero cambios
--      en /api/send-push.js ni en sw.js.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CALIFICACIONES
-- ---------------------------------------------------------------------------
create table if not exists repuestos.product_reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references repuestos.products(id) on delete cascade,
  order_id   uuid not null references repuestos.orders(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  constraint uq_product_review_order unique (order_id, product_id)
);
create index if not exists idx_product_reviews_product on repuestos.product_reviews(product_id, created_at desc);

create table if not exists repuestos.store_reviews (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references repuestos.stores(id) on delete cascade,
  order_id   uuid not null references repuestos.orders(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  constraint uq_store_review_order unique (order_id, store_id)
);
create index if not exists idx_store_reviews_store on repuestos.store_reviews(store_id, created_at desc);

alter table repuestos.product_reviews enable row level security;
alter table repuestos.store_reviews   enable row level security;

grant usage on schema repuestos to anon, authenticated;
grant select on repuestos.product_reviews, repuestos.store_reviews to anon, authenticated;

create policy "cualquiera lee calificaciones de producto" on repuestos.product_reviews
  for select using (true);
create policy "cualquiera lee calificaciones de tienda" on repuestos.store_reviews
  for select using (true);

-- el insert NUNCA es directo: siempre por RPC (valida que la orden este
-- pagada y sea del propio comprador antes de dejar calificar).
revoke insert, update, delete on repuestos.product_reviews from anon, authenticated;
revoke insert, update, delete on repuestos.store_reviews   from anon, authenticated;

create or replace function repuestos.submit_product_review(p_order_id uuid, p_product_id uuid, p_rating smallint, p_comment text)
returns repuestos.product_reviews
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_o repuestos.orders%rowtype; v_row repuestos.product_reviews%rowtype;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'calificacion invalida'; end if;
  select * into v_o from repuestos.orders where id = p_order_id;
  if v_o.id is null then raise exception 'orden no encontrada'; end if;
  if v_o.buyer_id is distinct from auth.uid() then raise exception 'esta orden no es tuya'; end if;
  if v_o.status not in ('paid','packing','shipped','fulfilled') then
    raise exception 'solo puedes calificar una orden ya pagada';
  end if;
  if not exists (select 1 from repuestos.order_items where order_id = p_order_id and product_id = p_product_id) then
    raise exception 'ese producto no esta en esta orden';
  end if;

  insert into repuestos.product_reviews(product_id, order_id, user_id, rating, comment)
  values (p_product_id, p_order_id, auth.uid(), p_rating, nullif(trim(coalesce(p_comment,'')),''))
  on conflict (order_id, product_id) do update
    set rating = excluded.rating, comment = excluded.comment
  returning * into v_row;
  return v_row;
end $$;

create or replace function repuestos.submit_store_review(p_order_id uuid, p_rating smallint, p_comment text)
returns repuestos.store_reviews
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_o repuestos.orders%rowtype; v_row repuestos.store_reviews%rowtype;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'calificacion invalida'; end if;
  select * into v_o from repuestos.orders where id = p_order_id;
  if v_o.id is null then raise exception 'orden no encontrada'; end if;
  if v_o.buyer_id is distinct from auth.uid() then raise exception 'esta orden no es tuya'; end if;
  if v_o.status not in ('paid','packing','shipped','fulfilled') then
    raise exception 'solo puedes calificar una orden ya pagada';
  end if;

  insert into repuestos.store_reviews(store_id, order_id, user_id, rating, comment)
  values (v_o.store_id, p_order_id, auth.uid(), p_rating, nullif(trim(coalesce(p_comment,'')),''))
  on conflict (order_id, store_id) do update
    set rating = excluded.rating, comment = excluded.comment
  returning * into v_row;
  return v_row;
end $$;

grant execute on function repuestos.submit_product_review(uuid, uuid, smallint, text) to authenticated;
grant execute on function repuestos.submit_store_review(uuid, smallint, text) to authenticated;

-- resumen (promedio + conteo) por producto y por tienda, para pintar
-- las estrellas sin traer todas las filas al cliente
create or replace function repuestos.product_rating_summary(p_product_id uuid)
returns table(avg_rating numeric, total bigint)
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
  from repuestos.product_reviews where product_id = p_product_id;
$$;

create or replace function repuestos.store_rating_summary(p_store_id uuid)
returns table(avg_rating numeric, total bigint)
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
  from repuestos.store_reviews where store_id = p_store_id;
$$;

grant execute on function repuestos.product_rating_summary(uuid) to anon, authenticated;
grant execute on function repuestos.store_rating_summary(uuid)   to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. PUENTE DE NOTIFICACIONES PUSH (reusa public.notifications de ruedda)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque repuestos no tiene permiso de escritura directo
-- sobre el schema public de ruedda; esta funcion es la unica puerta.
create or replace function repuestos.notify(
  p_user_id uuid, p_titulo text, p_body text, p_tipo text,
  p_source_id uuid default null, p_source_type text default 'repuestos'
) returns void
language plpgsql security definer
set search_path = public, pg_catalog as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications(user_id, tipo, titulo, body, source_id, source_type)
  values (p_user_id, p_tipo, p_titulo, p_body, p_source_id, p_source_type);
exception when undefined_table then
  -- ruedda (public.notifications) no esta desplegado en este proyecto todavia;
  -- no tumbar la transaccion de repuestos por eso.
  raise notice 'public.notifications no existe todavia — push omitido';
end $$;

grant execute on function repuestos.notify(uuid, text, text, text, uuid, text) to authenticated, anon;

-- Listo. A partir de aqui, cualquier flujo de repuestos (pedidos, mecanicos,
-- solicitudes) puede llamar `select repuestos.notify(...)` y el comprador
-- recibe push real si ya activo notificaciones — sin tocar push_subscriptions
-- ni /api/send-push.js, que ya existen para ruedda.
