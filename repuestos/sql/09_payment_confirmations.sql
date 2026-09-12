-- ============================================================================
-- RUEDDA REPUESTOS · 09_payment_confirmations.sql
-- ----------------------------------------------------------------------------
-- Pasarela de pago profesional: Venezuela no tiene un procesador de tarjetas
-- accesible para marketplaces chicos, asi que el pago sigue siendo manual
-- (Pago Movil / Zelle / Binance / Zinli / transferencia / efectivo, ver
-- repuestos.payment_methods en 01_schema.sql) — lo que cambia es que ahora
-- el comprador deja un COMPROBANTE (referencia + monto) despues de pagar, en
-- vez de solo un boton "ya pague" que no quedaba registrado en ningun lado.
-- La tienda/admin sigue siendo quien de verdad marca la orden como pagada
-- (ORD_NEXT en el front) — esto NO automatiza esa decision, solo le da
-- evidencia para tomarla mas rapido.
-- ============================================================================

do $$ begin create type repuestos.payment_confirmation_status as enum ('pending','verified','rejected');
exception when duplicate_object then null; end $$;

create table if not exists repuestos.payment_confirmations (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references repuestos.orders(id) on delete cascade,
  kind         repuestos.payment_kind not null,
  reference    text not null,
  amount_bs    numeric(14,2),
  status       repuestos.payment_confirmation_status not null default 'pending',
  created_at   timestamptz not null default now(),
  verified_by  uuid references auth.users(id) on delete set null,
  verified_at  timestamptz
);
create index if not exists idx_payconf_order on repuestos.payment_confirmations(order_id, created_at desc);

alter table repuestos.payment_confirmations enable row level security;
grant usage on schema repuestos to anon, authenticated;
revoke insert, update, delete on repuestos.payment_confirmations from anon, authenticated;

create policy "dueno de la orden o tienda o admin ve los comprobantes" on repuestos.payment_confirmations
  for select using (
    exists (select 1 from repuestos.orders o where o.id = order_id and (
      o.buyer_id = auth.uid() or repuestos.owns_store(o.store_id) or repuestos.is_admin()
    ))
  );

-- el comprador (con cuenta o via access_token de invitado) reporta su pago
create or replace function repuestos.submit_payment_confirmation(
  p_order_id uuid, p_token uuid, p_kind repuestos.payment_kind, p_reference text, p_amount_bs numeric
) returns repuestos.payment_confirmations
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_o repuestos.orders%rowtype; v_row repuestos.payment_confirmations%rowtype;
begin
  select * into v_o from repuestos.orders where id = p_order_id;
  if v_o.id is null then raise exception 'orden no encontrada'; end if;
  if not (v_o.access_token = p_token or v_o.buyer_id = auth.uid()) then
    raise exception 'no autorizado';
  end if;
  if length(trim(coalesce(p_reference,''))) < 3 then
    raise exception 'escribe el numero de referencia del pago';
  end if;

  insert into repuestos.payment_confirmations(order_id, kind, reference, amount_bs)
  values (p_order_id, p_kind, trim(p_reference), p_amount_bs)
  returning * into v_row;

  -- se avisa a la tienda (push, si ya lo activo) — no cambia el estado de la orden
  perform repuestos.notify(
    (select owner_id from repuestos.stores where id = v_o.store_id),
    'Comprobante de pago recibido',
    'La orden tiene un pago reportado, revisalo para confirmarlo.',
    'payment_reported', v_o.id, 'order'
  );

  return v_row;
end $$;

grant execute on function repuestos.submit_payment_confirmation(uuid, uuid, repuestos.payment_kind, text, numeric) to anon, authenticated;

create or replace function repuestos.list_payment_confirmations(p_order_id uuid)
returns setof repuestos.payment_confirmations
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select * from repuestos.payment_confirmations
  where order_id = p_order_id
    and exists (select 1 from repuestos.orders o where o.id = p_order_id and (
      repuestos.owns_store(o.store_id) or repuestos.is_admin() or o.buyer_id = auth.uid()
    ))
  order by created_at desc;
$$;

grant execute on function repuestos.list_payment_confirmations(uuid) to anon, authenticated;

-- la tienda/admin marca el comprobante como verificado o rechazado (esto es
-- lo que de verdad decide si el dinero llego, no un automatismo)
create or replace function repuestos.set_payment_confirmation_status(p_id uuid, p_status repuestos.payment_confirmation_status)
returns repuestos.payment_confirmations
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.payment_confirmations%rowtype; v_store uuid;
begin
  select order_id into v_row from repuestos.payment_confirmations where id = p_id;
  select store_id into v_store from repuestos.orders where id = v_row.order_id;
  if not (repuestos.owns_store(v_store) or repuestos.is_admin()) then raise exception 'no autorizado'; end if;

  update repuestos.payment_confirmations
    set status = p_status, verified_by = auth.uid(), verified_at = now()
    where id = p_id
  returning * into v_row;
  return v_row;
end $$;

grant execute on function repuestos.set_payment_confirmation_status(uuid, repuestos.payment_confirmation_status) to authenticated;
