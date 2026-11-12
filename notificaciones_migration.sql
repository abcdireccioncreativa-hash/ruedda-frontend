-- notificaciones_migration.sql  (V220 · 2026-11-12)
-- Córrelo UNA VEZ en el SQL Editor de Supabase. Es idempotente: se puede volver a correr.
--
-- 1) Notificaciones para todo, hechas en la base de datos (no en el teléfono): salen
--    igual en la web, la web móvil, iOS y Android, y como push real, porque el trigger
--    de push_notifications_migration.sql ya manda un push por cada fila nueva.
--      · vistas de tu carro: 3, 10, 30, 50, 100, 300, 500, 1.000, 3.000, 5.000, 10.000
--      · alguien te empezó a seguir
--      · un perfil que sigues publicó un carro (cuando la publicación queda activa)
--      · me gusta en tu historia (tabla nueva story_likes)
--      · me gusta en tu subasta, en tu spot de carspotting y en tu comentario
--      · alguien guardó tu publicación en favoritos
--    Nada se repite: el mismo aviso para la misma persona no sale dos veces en 12 horas
--    (dar y quitar me gusta varias veces no te llena la bandeja).
-- 2) Correo y usuario repetidos al crear cuenta: email_en_uso() y username_en_uso().
--    La app revisa en cada paso del formulario y antes de crear la cuenta.
--
-- Reemplaza el trigger de view_milestones_migration.sql (10, 25, 50…) por los nuevos hitos.

-- ───────────────────────── helpers ─────────────────────────

-- "@usuario" (o el nombre) de quien hizo la acción
create or replace function public._rd_handle(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when coalesce(username, '') <> '' then '@' || username
                 when coalesce(nombre, '') <> '' then nombre end
       from public.users where id = p),
    'alguien')
$$;

-- inserta la notificación (y con eso el push), sin repetir la misma en 12 horas
create or replace function public._rd_notify(
  p_user uuid, p_tipo text, p_titulo text, p_body text,
  p_source_id text, p_source_type text, p_icon text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_type text;
begin
  if p_user is null then return; end if;
  if exists (
    select 1 from public.notifications
     where user_id = p_user and tipo = p_tipo and body = p_body
       and coalesce(source_id::text, '') = coalesce(p_source_id, '')
       and created_at > now() - interval '12 hours'
  ) then return; end if;
  -- source_id puede ser uuid o text según cómo se creó la tabla: se castea a lo que sea
  select format_type(a.atttypid, a.atttypmod) into v_type
    from pg_attribute a
   where a.attrelid = 'public.notifications'::regclass and a.attname = 'source_id' and not a.attisdropped;
  execute format(
    'insert into public.notifications (user_id, tipo, titulo, body, source_id, source_type, icon)
     values ($1, $2, $3, $4, $5::%s, $6, $7)', coalesce(v_type, 'text'))
  using p_user, p_tipo, p_titulo, p_body, p_source_id, p_source_type, p_icon;
exception when others then
  -- un aviso nunca puede tumbar la acción original (seguir, dar me gusta, publicar…)
  raise warning '[rd_notify] %', sqlerrm;
end;
$$;

-- "Toyota FRS 2016"
create or replace function public._rd_carro(p_marca text, p_modelo text, p_year int)
returns text language sql immutable as $$
  select nullif(trim(concat_ws(' ', nullif(p_marca, ''), nullif(p_modelo, ''), p_year::text)), '')
$$;

-- ───────────────────────── vistas: 3, 10, 30… ─────────────────────────

create or replace function public.notify_view_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hit int;
  v_sub boolean := TG_TABLE_NAME = 'auctions';
  v_carro text;
begin
  if new.view_count is null or new.view_count <= coalesce(old.view_count, 0) or new.user_id is null then
    return new;
  end if;
  -- el hito más alto que se cruzó en este incremento
  select max(m) into v_hit
    from unnest(array[3,10,30,50,100,300,500,1000,3000,5000,10000]) m
   where m > coalesce(old.view_count, 0) and m <= new.view_count;
  if v_hit is null then return new; end if;
  v_carro := coalesce(public._rd_carro(new.marca, new.modelo, new.year), case when v_sub then 'subasta' else 'carro' end);
  perform public._rd_notify(
    new.user_id, 'vistas',
    case when v_sub then 'tu subasta llegó a ' else 'tu publicación llegó a ' end
      || to_char(v_hit, 'FM999G999') || ' vistas',
    v_hit || ' personas ya vieron tu ' || v_carro || '.',
    new.id::text, case when v_sub then 'auction' else 'listing' end, 'lime');
  return new;
end;
$$;

drop trigger if exists trg_view_milestone_listings on public.listings;
create trigger trg_view_milestone_listings
  after update of view_count on public.listings
  for each row execute function public.notify_view_milestone();

drop trigger if exists trg_view_milestone_auctions on public.auctions;
create trigger trg_view_milestone_auctions
  after update of view_count on public.auctions
  for each row execute function public.notify_view_milestone();

-- ───────────────────────── seguidores ─────────────────────────

create or replace function public.notify_new_follower()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.follower_id is null or new.followed_id is null or new.follower_id = new.followed_id then return new; end if;
  perform public._rd_notify(
    new.followed_id, 'follow', 'nuevo seguidor',
    public._rd_handle(new.follower_id) || ' empezó a seguirte.',
    new.follower_id::text, 'user', 'lime');
  return new;
end;
$$;

drop trigger if exists trg_notify_new_follower on public.user_follows;
create trigger trg_notify_new_follower
  after insert on public.user_follows
  for each row execute function public.notify_new_follower();

-- un perfil que sigues publicó un carro (al quedar activa: nueva o recién aprobada)
create or replace function public.notify_followers_new_listing()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_who text;
  v_carro text;
begin
  if new.user_id is null or new.estado is distinct from 'activa' or coalesce(new.vendido, false) then return new; end if;
  if TG_OP = 'UPDATE' and old.estado is not distinct from 'activa' then return new; end if;
  v_who := public._rd_handle(new.user_id);
  v_carro := coalesce(public._rd_carro(new.marca, new.modelo, new.year), 'un carro');
  for f in select distinct follower_id from public.user_follows
            where followed_id = new.user_id and follower_id <> new.user_id limit 2000 loop
    perform public._rd_notify(
      f.follower_id, 'market', v_who || ' publicó un carro',
      v_carro || ', ya está en ruedda.',
      new.id::text, 'listing', 'lime');
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_followers_new_listing on public.listings;
create trigger trg_notify_followers_new_listing
  after insert or update of estado on public.listings
  for each row execute function public.notify_followers_new_listing();

-- ───────────────────────── me gusta en historias (tabla nueva) ─────────────────────────

create table if not exists public.story_likes (
  story_id   uuid not null references public.stories(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_likes enable row level security;
drop policy if exists story_likes_select on public.story_likes;
create policy story_likes_select on public.story_likes for select using (true);
drop policy if exists story_likes_insert on public.story_likes;
create policy story_likes_insert on public.story_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists story_likes_delete on public.story_likes;
create policy story_likes_delete on public.story_likes for delete to authenticated using (user_id = auth.uid());
grant select on public.story_likes to anon, authenticated;
grant insert, delete on public.story_likes to authenticated;

create or replace function public.notify_story_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.stories where id = new.story_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  perform public._rd_notify(
    v_owner, 'like', 'le gustó tu historia',
    public._rd_handle(new.user_id) || ' le dio me gusta a tu historia.',
    new.user_id::text, 'user', 'red');
  return new;
end;
$$;

drop trigger if exists trg_notify_story_like on public.story_likes;
create trigger trg_notify_story_like
  after insert on public.story_likes
  for each row execute function public.notify_story_like();

-- ───────────────────────── me gusta en subastas, carspotting y comentarios ─────────────────────────

create or replace function public.notify_auction_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  select user_id, marca, modelo, year into a from public.auctions where id = new.auction_id;
  if a.user_id is null or a.user_id = new.user_id then return new; end if;
  perform public._rd_notify(
    a.user_id, 'like', 'le gustó tu subasta',
    public._rd_handle(new.user_id) || ' le dio me gusta a tu ' || coalesce(public._rd_carro(a.marca, a.modelo, a.year), 'subasta') || '.',
    new.auction_id::text, 'auction', 'red');
  return new;
end;
$$;

drop trigger if exists trg_notify_auction_like on public.auction_likes;
create trigger trg_notify_auction_like
  after insert on public.auction_likes
  for each row execute function public.notify_auction_like();

create or replace function public.notify_carspotting_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.carspotting where id = new.carspotting_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  perform public._rd_notify(
    v_owner, 'like', 'le gustó tu spot',
    public._rd_handle(new.user_id) || ' le dio me gusta a tu spot de carspotting.',
    new.carspotting_id::text, 'carspotting', 'red');
  return new;
end;
$$;

drop trigger if exists trg_notify_carspotting_like on public.carspotting_likes;
create trigger trg_notify_carspotting_like
  after insert on public.carspotting_likes
  for each row execute function public.notify_carspotting_like();

create or replace function public.notify_comment_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.comments where id = new.comment_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  perform public._rd_notify(
    v_owner, 'like', 'le gustó tu comentario',
    public._rd_handle(new.user_id) || ' le dio me gusta a tu comentario.',
    new.user_id::text, 'user', 'red');
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_like on public.comment_likes;
create trigger trg_notify_comment_like
  after insert on public.comment_likes
  for each row execute function public.notify_comment_like();

-- ───────────────────────── guardaron tu publicación ─────────────────────────
-- user_favorites.item_id = 'mkt-<uuid>' (publicación o subasta)

create or replace function public.notify_favorite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  r record;
  v_sub boolean := false;
begin
  if new.item_id is null or new.item_id::text !~* '^mkt-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return new; end if;
  v_id := substr(new.item_id::text, 5)::uuid;
  select user_id, marca, modelo, year into r from public.listings where id = v_id;
  if r.user_id is null then
    select user_id, marca, modelo, year into r from public.auctions where id = v_id;
    v_sub := r.user_id is not null;
  end if;
  if r.user_id is null or r.user_id = new.user_id then return new; end if;
  perform public._rd_notify(
    r.user_id, 'like', 'guardaron tu ' || case when v_sub then 'subasta' else 'publicación' end,
    public._rd_handle(new.user_id) || ' guardó tu ' || coalesce(public._rd_carro(r.marca, r.modelo, r.year), 'carro') || ' en favoritos.',
    v_id::text, case when v_sub then 'auction' else 'listing' end, 'red');
  return new;
end;
$$;

drop trigger if exists trg_notify_favorite on public.user_favorites;
create trigger trg_notify_favorite
  after insert on public.user_favorites
  for each row execute function public.notify_favorite();

-- ───────────────────────── correo y usuario repetidos ─────────────────────────

create or replace function public.email_en_uso(p_email text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)))
$$;

create or replace function public.username_en_uso(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users
                  where lower(username) = lower(trim(leading '@' from trim(p_username))))
$$;

revoke all on function public.email_en_uso(text) from public;
revoke all on function public.username_en_uso(text) from public;
grant execute on function public.email_en_uso(text) to anon, authenticated;
grant execute on function public.username_en_uso(text) to anon, authenticated;
revoke all on function public._rd_notify(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Listo. Las notificaciones salen solas (in-app + push) desde este momento.
