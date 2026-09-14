-- ============================================================================
-- RUEDDA REPUESTOS · 16_marketplace_entregas_ofertas.sql
-- ----------------------------------------------------------------------------
-- Corre esto en el SQL Editor de Supabase (proyecto ltodsegzbbdcaublkgtp),
-- DESPUÉS de 08–15. Idempotente.
--
--  1. Vendedores: tiendas y particulares, con KYC de Ruedda como puerta.
--  2. Condición del repuesto y control de seriales para piezas de alto robo.
--  3. Entregas por tienda: MRW, ZOOM, Mensajería por Yummy, Entrega personal.
--  4. Ofertas: el comprador ofrece, la tienda acepta / rechaza / contraoferta.
--  5. Mensajes privados: se reusa public.private_messages de Ruedda con
--     source_type = 'repuesto', y se ocultan teléfonos y correos hasta que
--     exista una orden entre las dos partes.
--  6. Señales reales para que la página se sienta viva (sin contadores
--     inventados): búsquedas, vendidos del mes, recién publicados, realtime.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. VENDEDORES Y KYC
-- ---------------------------------------------------------------------------
alter table repuestos.stores add column if not exists kind text not null default 'tienda';
alter table repuestos.stores add column if not exists city text;
do $$ begin
  alter table repuestos.stores add constraint ck_stores_kind check (kind in ('tienda','particular'));
exception when duplicate_object then null; end $$;

-- el KYC vive en Ruedda (public.users.kyc_verified, public.kyc_submissions):
-- una sola cola de revisión para las dos apps, la misma cuenta.
create or replace function repuestos.user_kyc_verified(p_uid uuid default auth.uid())
returns boolean language plpgsql stable security definer
set search_path = public, pg_catalog as $$
begin
  if p_uid is null then return false; end if;
  return coalesce((select u.kyc_verified from public.users u where u.id = p_uid), false);
exception when undefined_table or undefined_column then
  return false;
end $$;
grant execute on function repuestos.user_kyc_verified(uuid) to authenticated;

create or replace function repuestos.my_kyc_status()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $$
declare v_estado text;
begin
  if auth.uid() is null then return jsonb_build_object('verified', false, 'estado', null); end if;
  begin
    select k.estado into v_estado from public.kyc_submissions k
     where k.user_id = auth.uid() order by k.created_at desc limit 1;
  exception when undefined_table or undefined_column then v_estado := null;
  end;
  return jsonb_build_object('verified', repuestos.user_kyc_verified(auth.uid()), 'estado', v_estado);
end $$;
grant execute on function repuestos.my_kyc_status() to authenticated;

-- mismo formato que usa Ruedda para que su panel SuperAdmin lo apruebe igual
create or replace function repuestos.submit_kyc(p_doc_b64 text, p_selfie_b64 text)
returns jsonb language plpgsql volatile security definer
set search_path = public, pg_catalog as $$
begin
  if auth.uid() is null then raise exception 'inicia sesión para verificar tu identidad'; end if;
  if coalesce(length(p_doc_b64),0) < 1000 or coalesce(length(p_selfie_b64),0) < 1000 then
    raise exception 'sube la foto del documento y el selfie';
  end if;
  if coalesce(length(p_doc_b64),0) > 3000000 or coalesce(length(p_selfie_b64),0) > 3000000 then
    raise exception 'las fotos pesan demasiado, intenta con otras';
  end if;
  if repuestos.user_kyc_verified(auth.uid()) then
    return jsonb_build_object('verified', true, 'estado', 'aprobada');
  end if;
  if exists (select 1 from public.kyc_submissions where user_id = auth.uid() and estado = 'pendiente') then
    return jsonb_build_object('verified', false, 'estado', 'pendiente');
  end if;
  insert into public.kyc_submissions (user_id, doc_b64, selfie_b64, estado)
  values (auth.uid(), p_doc_b64, p_selfie_b64, 'pendiente');
  return jsonb_build_object('verified', false, 'estado', 'pendiente');
end $$;
grant execute on function repuestos.submit_kyc(text, text) to authenticated;

create or replace function repuestos.create_my_seller(
  p_kind text, p_name text, p_whatsapp text, p_rif text default null, p_city text default null
) returns jsonb
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare s repuestos.stores%rowtype; v_uid uuid := auth.uid(); v_wa text;
begin
  if v_uid is null then raise exception 'inicia sesión para vender'; end if;
  if p_kind not in ('tienda','particular') then raise exception 'tipo de vendedor inválido'; end if;
  if exists (select 1 from repuestos.stores where owner_id = v_uid) then
    raise exception 'ya tienes un perfil de vendedor';
  end if;
  if length(btrim(coalesce(p_name,''))) < 2 then raise exception 'escribe el nombre'; end if;
  v_wa := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  if length(v_wa) < 10 or length(v_wa) > 15 then raise exception 'el WhatsApp lleva de 10 a 15 dígitos'; end if;
  if p_kind = 'tienda' and length(regexp_replace(coalesce(p_rif,''), '[^0-9A-Za-z]', '', 'g')) < 9 then
    raise exception 'la tienda necesita RIF';
  end if;

  insert into repuestos.stores (owner_id, name, whatsapp, rif, status, kind, city)
  values (v_uid, btrim(p_name), v_wa, nullif(btrim(coalesce(p_rif,'')), ''),
          (case when p_kind = 'particular' and repuestos.user_kyc_verified(v_uid)
                then 'approved' else 'pending' end)::repuestos.store_status,
          p_kind, nullif(btrim(coalesce(p_city,'')), ''))
  returning * into s;

  insert into repuestos.members (user_id, role) values (v_uid, 'seller')
  on conflict (user_id) do update set role = 'seller' where repuestos.members.role = 'buyer';

  perform repuestos.log_audit('store', s.id::text, 'create');
  return to_jsonb(s);
end $$;
grant execute on function repuestos.create_my_seller(text, text, text, text, text) to authenticated;

-- un particular con KYC aprobado queda activo sin esperar al equipo
create or replace function repuestos.refresh_my_seller()
returns jsonb language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare s repuestos.stores%rowtype;
begin
  if auth.uid() is null then return null; end if;
  update repuestos.stores set status = 'approved'
   where owner_id = auth.uid() and kind = 'particular' and status = 'pending'
     and repuestos.user_kyc_verified(auth.uid());
  select * into s from repuestos.stores where owner_id = auth.uid();
  return jsonb_build_object('store', case when s.id is null then null else to_jsonb(s) end,
                            'kyc', repuestos.my_kyc_status());
end $$;
grant execute on function repuestos.refresh_my_seller() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. CONDICIÓN Y SERIALES
-- ---------------------------------------------------------------------------
alter table repuestos.products add column if not exists condition text not null default 'nuevo';
do $$ begin
  alter table repuestos.products add constraint ck_products_condition check (condition in ('nuevo','usado','remanufacturado'));
exception when duplicate_object then null; end $$;
alter table repuestos.products add column if not exists serial text;
alter table repuestos.products add column if not exists serial_norm text
  generated always as (nullif(upper(regexp_replace(coalesce(serial,''), '[^A-Za-z0-9]', '', 'g')), '')) stored;
create index if not exists idx_products_serial_norm on repuestos.products(serial_norm) where serial_norm is not null;

create or replace function repuestos.tg_products_seller_gate()
returns trigger language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_store repuestos.stores%rowtype; v_n int; v_serial text;
begin
  -- SQL Editor / service role (seed, soporte) y administradores no pasan por la puerta
  if auth.uid() is null or repuestos.is_admin() then return new; end if;

  select * into v_store from repuestos.stores where id = new.store_id;
  v_serial := nullif(upper(regexp_replace(coalesce(new.serial,''), '[^A-Za-z0-9]', '', 'g')), '');

  if tg_op = 'INSERT' then
    if not repuestos.user_kyc_verified(v_store.owner_id) then
      raise exception 'Verifica tu identidad para publicar repuestos';
    end if;
    if v_store.kind = 'particular' then
      select count(*) into v_n from repuestos.products
       where store_id = new.store_id and status <> 'rejected';
      if v_n >= 10 then raise exception 'Un particular puede tener hasta 10 publicaciones activas'; end if;
    end if;
  end if;

  if v_store.kind = 'particular'
     and new.part_category_id in ('pc-baterias','pc-cauchos','pc-ilum','pc-encendido')
     and v_serial is null then
    raise exception 'Para baterías, cauchos, faros y piezas eléctricas indica el serial';
  end if;

  if v_serial is not null and exists (
       select 1 from repuestos.products p
        where p.serial_norm = v_serial and p.store_id <> new.store_id and p.status <> 'rejected') then
    raise exception 'Ese serial ya lo publicó otro vendedor. Si la pieza es tuya, escríbenos a soporte.';
  end if;
  return new;
end $$;

drop trigger if exists trg_b_products_seller_gate on repuestos.products;
create trigger trg_b_products_seller_gate
before insert or update of serial, part_category_id on repuestos.products
for each row execute function repuestos.tg_products_seller_gate();

-- ---------------------------------------------------------------------------
-- 3. ENTREGAS POR TIENDA
-- ---------------------------------------------------------------------------
create table if not exists repuestos.store_delivery_options (
  store_id   uuid not null references repuestos.stores(id) on delete cascade,
  method     text not null check (method in ('mrw','zoom','yummy','personal')),
  active     boolean not null default true,
  cities     text[] not null default '{}',
  eta_text   text,
  notes      text,
  updated_at timestamptz not null default now(),
  primary key (store_id, method)
);
alter table repuestos.store_delivery_options enable row level security;
grant select on repuestos.store_delivery_options to anon, authenticated;
grant insert, update, delete on repuestos.store_delivery_options to authenticated;

drop policy if exists p_sdo_read on repuestos.store_delivery_options;
create policy p_sdo_read on repuestos.store_delivery_options for select to anon, authenticated
  using (active or repuestos.owns_store(store_id) or repuestos.is_admin());
drop policy if exists p_sdo_write on repuestos.store_delivery_options;
create policy p_sdo_write on repuestos.store_delivery_options for all to authenticated
  using (repuestos.owns_store(store_id) or repuestos.is_admin())
  with check (repuestos.owns_store(store_id) or repuestos.is_admin());

alter table repuestos.orders add column if not exists delivery_method text;
alter table repuestos.orders add column if not exists delivery jsonb not null default '{}'::jsonb;
do $$ begin
  alter table repuestos.orders add constraint ck_orders_delivery_method
    check (delivery_method is null or delivery_method in ('mrw','zoom','yummy','personal'));
exception when duplicate_object then null; end $$;

create or replace function repuestos.set_order_delivery(
  p_order_id uuid, p_token uuid, p_method text, p_data jsonb
) returns jsonb
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare
  v_o repuestos.orders%rowtype;
  v_opt repuestos.store_delivery_options%rowtype;
  d jsonb := coalesce(p_data, '{}'::jsonb);
  v_city text := btrim(coalesce(d->>'city',''));
  v_clean jsonb;
  L text[] := array['Encomienda MRW','Encomienda ZOOM','Mensajería por Yummy','Entrega personal'];
begin
  select * into v_o from repuestos.orders where id = p_order_id;
  if not found then raise exception 'orden no existe'; end if;
  if not (v_o.access_token = p_token or v_o.buyer_id = auth.uid()
          or repuestos.owns_store(v_o.store_id) or repuestos.is_admin()) then
    raise exception 'no autorizado';
  end if;

  select * into v_opt from repuestos.store_delivery_options
   where store_id = v_o.store_id and method = p_method and active;
  if not found then raise exception 'esa forma de entrega no la ofrece esta tienda'; end if;

  if p_method in ('mrw','zoom') then
    if length(btrim(coalesce(d->>'state',''))) < 3 or length(v_city) < 3
       or length(btrim(coalesce(d->>'agency',''))) < 3 then
      raise exception 'indica estado, ciudad y agencia de destino';
    end if;
    if length(btrim(coalesce(d->>'receiver_name',''))) < 3 then raise exception 'indica quién retira el paquete'; end if;
    if length(regexp_replace(coalesce(d->>'receiver_ci',''), '\D', '', 'g')) < 6 then
      raise exception 'indica la cédula de quien retira';
    end if;
  else
    if cardinality(v_opt.cities) > 0 and not exists (
         select 1 from unnest(v_opt.cities) c where repuestos.norm(c) = repuestos.norm(v_city)) then
      raise exception 'la tienda no hace esta entrega en %', coalesce(nullif(v_city,''), 'esa ciudad');
    end if;
    if p_method = 'yummy' and length(btrim(coalesce(d->>'address',''))) < 8 then
      raise exception 'indica la dirección exacta';
    end if;
    if p_method = 'personal' and length(btrim(coalesce(d->>'meeting_point',''))) < 4 then
      raise exception 'indica el punto de entrega';
    end if;
  end if;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'state',          nullif(left(btrim(coalesce(d->>'state','')), 60), ''),
    'city',           nullif(left(v_city, 60), ''),
    'agency',         nullif(left(btrim(coalesce(d->>'agency','')), 120), ''),
    'receiver_name',  nullif(left(btrim(coalesce(d->>'receiver_name','')), 80), ''),
    'receiver_ci',    nullif(regexp_replace(coalesce(d->>'receiver_ci',''), '\D', '', 'g'), ''),
    'pay_on_arrival', case when p_method in ('mrw','zoom') then coalesce((d->>'pay_on_arrival')::boolean, false) end,
    'address',        nullif(left(btrim(coalesce(d->>'address','')), 200), ''),
    'reference',      nullif(left(btrim(coalesce(d->>'reference','')), 120), ''),
    'meeting_point',  nullif(left(btrim(coalesce(d->>'meeting_point','')), 120), ''),
    'time_slot',      nullif(left(btrim(coalesce(d->>'time_slot','')), 60), ''),
    'notes',          nullif(left(btrim(coalesce(d->>'notes','')), 200), '')));

  update repuestos.orders set delivery_method = p_method, delivery = v_clean
   where id = p_order_id returning * into v_o;

  perform repuestos.notify(
    (select owner_id from repuestos.stores where id = v_o.store_id),
    'Orden con entrega por ' || L[array_position(array['mrw','zoom','yummy','personal'], p_method)],
    'Tienes una orden nueva por $' || v_o.total_usd || '. Revisa los datos de entrega.',
    'order_delivery', v_o.id, 'order');

  return jsonb_build_object('id', v_o.id, 'delivery_method', v_o.delivery_method, 'delivery', v_o.delivery);
end $$;
grant execute on function repuestos.set_order_delivery(uuid, uuid, text, jsonb) to anon, authenticated;

-- la búsqueda pública por código ahora devuelve la entrega, sin datos personales
create or replace function repuestos.find_invoice_public(p_code text)
returns jsonb
language plpgsql stable security definer
set search_path = repuestos, pg_catalog as $$
declare v_o repuestos.orders%rowtype; v_inv repuestos.invoices%rowtype; v_items jsonb;
begin
  select * into v_inv from repuestos.invoices where upper(code) = upper(btrim(p_code));
  if not found then return null; end if;

  select * into v_o from repuestos.orders where id = v_inv.order_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', product_id, 'name', name_snapshot, 'qty', qty, 'unit_price_usd', unit_price_usd)), '[]'::jsonb)
    into v_items from repuestos.order_items where order_id = v_o.id;

  return jsonb_build_object(
    'invoice', jsonb_build_object('code', v_inv.code, 'issued_at', v_inv.issued_at),
    'order', jsonb_build_object(
      'id', v_o.id, 'status', v_o.status, 'total_usd', v_o.total_usd, 'created_at', v_o.created_at,
      'updated_at', v_o.updated_at, 'buyer_id', v_o.buyer_id,
      'buyer_name', split_part(coalesce(v_o.guest_name,''), ' ', 1),
      'phone_tail', right(coalesce(v_o.guest_phone,''), 4),
      'tracking_code', v_o.tracking_code,
      'delivery_method', v_o.delivery_method,
      'delivery', jsonb_strip_nulls(jsonb_build_object(
        'city', v_o.delivery->>'city', 'agency', v_o.delivery->>'agency',
        'meeting_point', v_o.delivery->>'meeting_point', 'time_slot', v_o.delivery->>'time_slot',
        'pay_on_arrival', v_o.delivery->'pay_on_arrival'))),
    'items', v_items,
    'store', (select jsonb_build_object('id', s.id, 'name', s.name, 'whatsapp', s.whatsapp, 'rif', s.rif,
                                        'owner_id', s.owner_id, 'kind', s.kind)
                from repuestos.stores s where s.id = v_o.store_id));
end $$;
grant execute on function repuestos.find_invoice_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. OFERTAS
-- ---------------------------------------------------------------------------
create table if not exists repuestos.product_offers (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references repuestos.products(id) on delete cascade,
  store_id    uuid not null references repuestos.stores(id) on delete cascade,
  buyer_id    uuid not null references auth.users(id) on delete cascade,
  qty         int not null default 1 check (qty between 1 and 99),
  amount_usd  numeric(12,2) not null check (amount_usd > 0),
  counter_usd numeric(12,2) check (counter_usd > 0),
  message     text,
  status      text not null default 'pending'
              check (status in ('pending','countered','accepted','rejected','expired','cancelled','converted')),
  order_id    uuid references repuestos.orders(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '48 hours'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_offers_buyer on repuestos.product_offers(buyer_id, created_at desc);
create index if not exists idx_offers_store on repuestos.product_offers(store_id, created_at desc);
alter table repuestos.product_offers enable row level security;
grant select on repuestos.product_offers to authenticated;
drop policy if exists p_offers_read on repuestos.product_offers;
create policy p_offers_read on repuestos.product_offers for select to authenticated
  using (buyer_id = auth.uid() or repuestos.owns_store(store_id) or repuestos.is_admin());

create or replace function repuestos._expire_offers()
returns void language sql volatile security definer
set search_path = repuestos, pg_catalog as $$
  update repuestos.product_offers set status = 'expired', updated_at = now()
   where status in ('pending','countered','accepted') and expires_at < now();
$$;

create or replace function repuestos.make_offer(p_product_id uuid, p_amount numeric, p_qty int, p_message text)
returns repuestos.product_offers
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare p repuestos.products%rowtype; v_owner uuid; v_floor numeric; v_row repuestos.product_offers%rowtype;
begin
  if auth.uid() is null then raise exception 'inicia sesión para hacer una oferta'; end if;
  perform repuestos._expire_offers();
  select * into p from repuestos.products where id = p_product_id and status = 'published';
  if not found then raise exception 'el producto ya no está disponible'; end if;
  select owner_id into v_owner from repuestos.stores where id = p.store_id;
  if v_owner = auth.uid() then raise exception 'no puedes ofertar en tu propio producto'; end if;
  if coalesce(p_qty, 1) < 1 or coalesce(p_qty, 1) > p.stock then raise exception 'cantidad no disponible'; end if;
  v_floor := round(p.price_usd * 0.70, 2);
  if p_amount is null or p_amount < v_floor then
    raise exception 'la oferta mínima es $% por unidad', v_floor;
  end if;
  if p_amount >= p.price_usd then raise exception 'tu oferta es igual o mayor al precio: cómpralo directo'; end if;
  if exists (select 1 from repuestos.product_offers
              where product_id = p_product_id and buyer_id = auth.uid()
                and status in ('pending','countered','accepted')) then
    raise exception 'ya tienes una oferta abierta en este producto';
  end if;

  insert into repuestos.product_offers (product_id, store_id, buyer_id, qty, amount_usd, message)
  values (p.id, p.store_id, auth.uid(), coalesce(p_qty, 1), round(p_amount, 2),
          nullif(left(btrim(coalesce(p_message,'')), 300), ''))
  returning * into v_row;

  perform repuestos.notify(v_owner, 'Nueva oferta',
    'Te ofrecen $' || v_row.amount_usd || ' c/u por ' || p.name || ' (precio $' || p.price_usd || ').',
    'offer', v_row.id, 'offer');
  return v_row;
end $$;
grant execute on function repuestos.make_offer(uuid, numeric, int, text) to authenticated;

create or replace function repuestos.respond_offer(p_offer_id uuid, p_action text, p_counter numeric default null)
returns repuestos.product_offers
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare o repuestos.product_offers%rowtype; p repuestos.products%rowtype;
begin
  perform repuestos._expire_offers();
  select * into o from repuestos.product_offers where id = p_offer_id for update;
  if not found then raise exception 'la oferta no existe'; end if;
  if not (repuestos.owns_store(o.store_id) or repuestos.is_admin()) then raise exception 'no autorizado'; end if;
  if o.status <> 'pending' then raise exception 'esta oferta ya no está pendiente'; end if;
  select * into p from repuestos.products where id = o.product_id;

  if p_action = 'accept' then
    update repuestos.product_offers set status = 'accepted', expires_at = now() + interval '48 hours', updated_at = now()
     where id = o.id returning * into o;
    perform repuestos.notify(o.buyer_id, 'Aceptaron tu oferta',
      'Tu oferta de $' || o.amount_usd || ' por ' || p.name || ' fue aceptada. Tienes 48 horas para comprar.', 'offer', o.id, 'offer');
  elsif p_action = 'reject' then
    update repuestos.product_offers set status = 'rejected', updated_at = now() where id = o.id returning * into o;
    perform repuestos.notify(o.buyer_id, 'Oferta rechazada',
      'La tienda no aceptó tu oferta por ' || p.name || '.', 'offer', o.id, 'offer');
  elsif p_action = 'counter' then
    if p_counter is null or p_counter <= o.amount_usd or p_counter >= p.price_usd then
      raise exception 'la contraoferta tiene que estar entre $% y $%', o.amount_usd, p.price_usd;
    end if;
    update repuestos.product_offers
       set status = 'countered', counter_usd = round(p_counter, 2), expires_at = now() + interval '48 hours', updated_at = now()
     where id = o.id returning * into o;
    perform repuestos.notify(o.buyer_id, 'Te hicieron una contraoferta',
      'Por ' || p.name || ' te proponen $' || o.counter_usd || ' c/u.', 'offer', o.id, 'offer');
  else
    raise exception 'acción inválida';
  end if;
  return o;
end $$;
grant execute on function repuestos.respond_offer(uuid, text, numeric) to authenticated;

create or replace function repuestos.buyer_offer_action(p_offer_id uuid, p_action text)
returns repuestos.product_offers
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare o repuestos.product_offers%rowtype; v_owner uuid;
begin
  perform repuestos._expire_offers();
  select * into o from repuestos.product_offers where id = p_offer_id for update;
  if not found or o.buyer_id is distinct from auth.uid() then raise exception 'no autorizado'; end if;
  select owner_id into v_owner from repuestos.stores where id = o.store_id;

  if p_action = 'accept_counter' then
    if o.status <> 'countered' then raise exception 'no hay contraoferta vigente'; end if;
    update repuestos.product_offers
       set status = 'accepted', amount_usd = o.counter_usd, expires_at = now() + interval '48 hours', updated_at = now()
     where id = o.id returning * into o;
    perform repuestos.notify(v_owner, 'Aceptaron tu contraoferta', 'El comprador aceptó $' || o.amount_usd || ' c/u.', 'offer', o.id, 'offer');
  elsif p_action in ('reject_counter','cancel') then
    if o.status not in ('pending','countered','accepted') then raise exception 'esta oferta ya está cerrada'; end if;
    update repuestos.product_offers set status = 'cancelled', updated_at = now() where id = o.id returning * into o;
  else
    raise exception 'acción inválida';
  end if;
  return o;
end $$;
grant execute on function repuestos.buyer_offer_action(uuid, text) to authenticated;

-- compra al precio acordado: misma forma de respuesta que create_order
create or replace function repuestos.create_order_from_offer(p_offer_id uuid, p_buyer jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare
  o repuestos.product_offers%rowtype;
  p repuestos.products%rowtype;
  v_rate numeric;
  v_uid uuid := auth.uid();
  v_name  text := btrim(coalesce(p_buyer->>'name',''));
  v_ci    text := regexp_replace(coalesce(p_buyer->>'ci',''), '\D', '', 'g');
  v_phone text := regexp_replace(coalesce(p_buyer->>'phone',''), '\D', '', 'g');
  v_city  text := btrim(coalesce(p_buyer->>'city',''));
  v_order repuestos.orders%rowtype;
  v_code text; v_try int := 0; v_total numeric;
begin
  perform repuestos._expire_offers();
  select * into o from repuestos.product_offers where id = p_offer_id for update;
  if not found or o.buyer_id is distinct from v_uid then raise exception 'no autorizado'; end if;
  if o.status <> 'accepted' then raise exception 'la oferta no está aceptada o ya venció'; end if;
  if length(v_name) < 3 then raise exception 'falta el nombre del comprador'; end if;
  if length(v_ci) < 6 or length(v_ci) > 9 then raise exception 'cédula inválida'; end if;
  if length(v_phone) < 10 or length(v_phone) > 15 then raise exception 'teléfono inválido'; end if;
  if length(v_city) < 3 then raise exception 'falta la ciudad'; end if;

  select * into p from repuestos.products where id = o.product_id and status = 'published' for update;
  if not found then raise exception 'el producto ya no está disponible'; end if;
  if p.stock < o.qty then raise exception 'de "%" solo quedan %', p.name, p.stock; end if;

  select bs_rate into v_rate from repuestos.app_config where id = 1;
  v_total := round(o.amount_usd * o.qty, 2);

  insert into repuestos.orders (buyer_id, store_id, guest_name, guest_ci, guest_phone, guest_city, total_usd, bs_rate, status)
  values (v_uid, p.store_id, v_name, v_ci, v_phone, v_city, v_total, v_rate, 'created')
  returning * into v_order;

  insert into repuestos.order_items (order_id, product_id, qty, unit_price_usd, name_snapshot, part_snapshot)
  values (v_order.id, p.id, o.qty, o.amount_usd, p.name, p.part_number);

  update repuestos.products set stock = stock - o.qty where id = p.id;

  loop
    begin
      v_code := repuestos.gen_invoice_code();
      insert into repuestos.invoices (order_id, code, qr_url) values (v_order.id, v_code, '/f/' || v_code);
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise exception 'no se pudo generar el código de la orden'; end if;
    end;
  end loop;

  insert into repuestos.transactions (type, order_id, store_id, amount_usd, amount_bs, actor)
  values ('order', v_order.id, p.store_id, v_total, round(v_total * v_rate, 2), v_uid);

  update repuestos.product_offers set status = 'converted', order_id = v_order.id, updated_at = now() where id = o.id;

  perform repuestos.notify((select owner_id from repuestos.stores where id = p.store_id),
    'Compraron con oferta', 'Nueva orden por $' || v_total || ' al precio acordado.', 'order', v_order.id, 'order');

  return jsonb_build_array(jsonb_build_object(
    'order', jsonb_build_object('id', v_order.id, 'store_id', v_order.store_id, 'total_usd', v_order.total_usd,
                                'status', v_order.status, 'created_at', v_order.created_at,
                                'access_token', v_order.access_token, 'bs_rate', v_rate),
    'invoice', jsonb_build_object('code', v_code, 'qr_url', '/f/' || v_code, 'issued_at', now()),
    'items', jsonb_build_array(jsonb_build_object('product_id', p.id, 'qty', o.qty, 'unit_price_usd', o.amount_usd,
                                                  'name', p.name, 'part_number', p.part_number)),
    'store', (select jsonb_build_object('id', s.id, 'name', s.name, 'rif', s.rif, 'whatsapp', s.whatsapp, 'verified', s.verified)
                from repuestos.stores s where s.id = p.store_id)));
end $$;
grant execute on function repuestos.create_order_from_offer(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. MENSAJES: se reusa public.private_messages (source_type = 'repuesto')
-- ---------------------------------------------------------------------------
do $mask$
begin
  execute $f$
    create or replace function public.tg_mask_repuestos_contact()
    returns trigger language plpgsql security definer
    set search_path = public, repuestos, pg_catalog as $b$
    begin
      if new.source_type = 'repuesto' and not exists (
           select 1 from repuestos.orders o join repuestos.stores s on s.id = o.store_id
            where o.status <> 'cancelled'
              and o.buyer_id in (new.sender_id, new.receiver_id)
              and s.owner_id in (new.sender_id, new.receiver_id)) then
        new.text := regexp_replace(new.text,
          '(\+?58[\s.\-]?|0)?(4(12|14|16|22|24|26)|2\d{2})[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}',
          '[teléfono oculto hasta que haya una orden]', 'g');
        new.text := regexp_replace(new.text,
          '[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}',
          '[correo oculto hasta que haya una orden]', 'g');
      end if;
      return new;
    end $b$;
  $f$;
  execute 'drop trigger if exists trg_mask_repuestos_contact on public.private_messages';
  execute 'create trigger trg_mask_repuestos_contact before insert on public.private_messages
           for each row execute function public.tg_mask_repuestos_contact()';
exception when undefined_table then
  raise notice 'public.private_messages no existe: mensajes de repuestos omitidos';
end $mask$;

-- ---------------------------------------------------------------------------
-- 6. SEÑALES REALES: búsquedas, vendidos, recién publicados, realtime
-- ---------------------------------------------------------------------------
create table if not exists repuestos.search_log (
  id         bigserial primary key,
  q          text not null check (length(q) between 2 and 80),
  results    int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_search_log_time on repuestos.search_log(created_at desc);
alter table repuestos.search_log enable row level security;
grant insert on repuestos.search_log to anon, authenticated;
grant usage on sequence repuestos.search_log_id_seq to anon, authenticated;
drop policy if exists p_search_log_insert on repuestos.search_log;
create policy p_search_log_insert on repuestos.search_log for insert to anon, authenticated with check (true);

create or replace function repuestos.top_searches(p_days int default 7, p_limit int default 8)
returns table(q text, n bigint) language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select lower(btrim(s.q)) as q, count(*) as n
    from repuestos.search_log s
   where s.created_at > now() - make_interval(days => least(greatest(coalesce(p_days,7), 1), 30))
     and s.results > 0
   group by 1 having count(*) >= 2
   order by 2 desc limit least(greatest(coalesce(p_limit,8), 1), 20);
$$;
grant execute on function repuestos.top_searches(int, int) to anon, authenticated;

create or replace function repuestos.search_misses(p_days int default 30)
returns table(q text, n bigint, last_at timestamptz) language plpgsql stable security definer
set search_path = repuestos, pg_catalog as $$
begin
  if not repuestos.is_admin() then raise exception 'no autorizado'; end if;
  return query
    select lower(btrim(s.q)), count(*), max(s.created_at)
      from repuestos.search_log s
     where s.results = 0 and s.created_at > now() - make_interval(days => least(greatest(p_days,1), 180))
     group by 1 order by 2 desc limit 100;
end $$;
grant execute on function repuestos.search_misses(int) to authenticated;

create or replace function repuestos.product_activity(p_product_id uuid)
returns jsonb language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select jsonb_build_object(
    'sold_30d', coalesce((select sum(oi.qty) from repuestos.order_items oi
                           join repuestos.orders o on o.id = oi.order_id
                          where oi.product_id = p_product_id
                            and o.status in ('paid','packing','shipped','fulfilled')
                            and o.created_at > now() - interval '30 days'), 0),
    'published_at', (select created_at from repuestos.products where id = p_product_id and status = 'published'),
    'updated_at',   (select updated_at from repuestos.products where id = p_product_id and status = 'published'),
    'open_offers',  (select count(*) from repuestos.product_offers
                      where product_id = p_product_id and status in ('pending','countered') and expires_at > now()));
$$;
grant execute on function repuestos.product_activity(uuid) to anon, authenticated;

create or replace function repuestos.live_stats()
returns jsonb language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select jsonb_build_object(
    'products',     (select count(*) from repuestos.products where status = 'published'),
    'new_7d',       (select count(*) from repuestos.products where status = 'published' and created_at > now() - interval '7 days'),
    'sellers',      (select count(*) from repuestos.stores where status in ('approved','licensed')),
    'paid_30d',     (select count(*) from repuestos.orders where status in ('paid','packing','shipped','fulfilled')
                                                        and created_at > now() - interval '30 days'));
$$;
grant execute on function repuestos.live_stats() to anon, authenticated;

-- realtime de productos (precio y stock cambian en pantalla sin recargar)
do $$ begin
  alter publication supabase_realtime add table repuestos.products;
exception when duplicate_object then null;
          when undefined_object then raise notice 'publicación supabase_realtime no existe';
end $$;
