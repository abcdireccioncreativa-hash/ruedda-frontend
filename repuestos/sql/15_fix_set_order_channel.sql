-- ============================================================================
-- RUEDDA REPUESTOS · 15_fix_set_order_channel.sql
-- ----------------------------------------------------------------------------
-- Bug real en 03_rpc.sql (parte del Fase 1 original, no de esta sesion): el
-- CASE que arma el nuevo estado de la orden solo tenia literales de texto sin
-- cast, y Postgres resuelve ese CASE como tipo `text` — no coincide con la
-- columna `status`, que es el enum repuestos.order_status. Por eso "Pagar
-- ahora" fallaba con:
--   ERROR: column "status" is of type order_status but expression is of type text
-- Unico cambio: se agrega el cast ::repuestos.order_status que faltaba.
-- Corre esto en el SQL Editor de Supabase — reemplaza la funcion entera, no
-- rompe nada mas.
-- ============================================================================

create or replace function repuestos.set_order_channel(
  p_order_id uuid, p_channel text, p_token uuid default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = repuestos, pg_catalog as $$
declare v_o repuestos.orders%rowtype;
begin
  select * into v_o from repuestos.orders where id = p_order_id;
  if not found then raise exception 'orden no existe'; end if;

  if not (v_o.access_token = p_token or v_o.buyer_id = auth.uid()
          or repuestos.owns_store(v_o.store_id) or repuestos.is_admin()) then
    raise exception 'no autorizado';
  end if;
  if p_channel not in ('pay_now','whatsapp') then raise exception 'canal invalido'; end if;

  update repuestos.orders
     set channel = p_channel::repuestos.order_channel,
         status  = (case when p_channel = 'pay_now' then 'pending_payment' else 'whatsapp' end)::repuestos.order_status
   where id = p_order_id returning * into v_o;

  insert into repuestos.transactions (type, order_id, store_id, amount_usd, channel, actor)
  values ((case when p_channel = 'pay_now' then 'payment' else 'order' end)::repuestos.tx_type,
          v_o.id, v_o.store_id, v_o.total_usd, v_o.channel, auth.uid());

  return jsonb_build_object('id', v_o.id, 'status', v_o.status, 'channel', v_o.channel);
end $$;

grant execute on function repuestos.set_order_channel(uuid, text, uuid) to anon, authenticated;
