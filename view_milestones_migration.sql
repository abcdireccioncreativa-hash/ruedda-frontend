-- view_milestones_migration.sql
-- Corre esto UNA VEZ en el SQL Editor de Supabase (proyecto ltodsegzbbdcaublkgtp).
--
-- [pedido explícito] "más de 10 personas vieron tu vehículo" — le avisa al
-- dueño de una publicación/subasta cuando cruza un umbral real de vistas
-- (10, 25, 50, 100, 250, 500, 1000, 2500, 5000). Usa el view_count REAL
-- (el que ya lleva registrar_vista, con deduplicación por sesión) — NO el
-- número inflado que se muestra en la app (VIEW_DISPLAY_FACTOR), porque
-- esto es una alerta para el dueño sobre tracción real, no un chip de FOMO.
--
-- No toca registrar_vista ni ninguna función existente — es un trigger
-- nuevo y separado sobre view_count. Reutiliza la tabla notifications y el
-- trigger de push ya montado en push_notifications_migration.sql: en
-- cuanto corras esto, sale como push real sin tocar nada más.

create or replace function public.notify_view_milestone()
returns trigger
language plpgsql
security definer
as $$
declare
  v_milestones int[] := array[10,25,50,100,250,500,1000,2500,5000];
  v_hit int;
  v_owner uuid;
  v_titulo text;
  v_body text;
  v_tabla text := TG_TABLE_NAME;
begin
  if new.view_count is null or old.view_count is null or new.view_count <= old.view_count then
    return new;
  end if;

  -- el umbral más alto que se cruzó justo en este incremento (por si el
  -- contador saltara de golpe varios números de un solo tiro)
  select max(m) into v_hit
  from unnest(v_milestones) as m
  where m > old.view_count and m <= new.view_count;

  if v_hit is null then
    return new;
  end if;

  v_owner := new.user_id;
  if v_owner is null then
    return new;
  end if;

  v_titulo := 'más de ' || v_hit || ' personas vieron tu vehículo';
  v_body := case
    when v_tabla = 'auctions' then 'tu subasta ya superó las ' || v_hit || ' vistas reales — sigue así.'
    else 'tu publicación ya superó las ' || v_hit || ' vistas reales — sigue así.'
  end;

  insert into public.notifications(user_id, tipo, titulo, body, source_id, source_type)
  values (
    v_owner, 'system', v_titulo, v_body, new.id,
    case when v_tabla = 'auctions' then 'auction' else 'listing' end
  );

  return new;
end;
$$;

drop trigger if exists trg_view_milestone_listings on public.listings;
create trigger trg_view_milestone_listings
  after update of view_count on public.listings
  for each row
  execute function public.notify_view_milestone();

drop trigger if exists trg_view_milestone_auctions on public.auctions;
create trigger trg_view_milestone_auctions
  after update of view_count on public.auctions
  for each row
  execute function public.notify_view_milestone();

-- Listo. A partir de aquí, cada vez que view_count de un listing o una
-- subasta cruce uno de los umbrales de arriba, el dueño recibe una
-- notificación real (in-app + push, si ya activó push notifications).
