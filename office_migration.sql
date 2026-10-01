-- office_migration.sql — RUEDDA OFFICE (www.ruedda.app/office)
-- Corre esto UNA VEZ en el SQL Editor de Supabase (proyecto ltodsegzbbdcaublkgtp).
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- Qué crea:
--   · office_members    → quién entra (debe tener cargo en la empresa), avatar, puntos, monedas
--   · office_config     → distribución de oficinas, relojes, NPC, autos, frases (todo editable)
--   · office_catalog    → tienda de decoración (precios editables)
--   · office_decor      → decoración colocada en el mapa
--   · office_notes      → post-its en los escritorios
--   · office_positions  → última posición (x, y) de cada jugador
--   · office_strokes    → trazos de la pizarra general
--   · office_events     → bitácora (reuniones de emergencia, acelerar proyecto, ventas…)
--   · RPCs con validación en servidor y políticas de Realtime para el canal privado.
--
-- Acceso: solo miembros con cargo, o superadmins de Ruedda (users.role = 'superadmin').
-- Ninguna tabla es legible por anon.

-- ════════════ TABLAS ════════════
create table if not exists public.office_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  slot         text unique,                       -- oficina asignada (null = sin oficina)
  display_name text not null,
  cargo        text not null check (length(trim(cargo)) > 0),   -- rol en la empresa (obligatorio)
  is_admin     boolean not null default false,
  avatar       jsonb not null default '{}'::jsonb,
  points       integer not null default 0,        -- productividad acumulada (ranking)
  coins        integer not null default 100,      -- saldo para la tienda
  last_checkin date,
  created_at   timestamptz not null default now()
);

create table if not exists public.office_config (
  id          integer primary key default 1 check (id = 1),
  data        jsonb not null default '{}'::jsonb,
  channel_key text not null default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.office_catalog (
  item     text primary key,
  name     text not null,
  price    integer not null default 50 check (price >= 0),
  category text not null default 'deco',
  active   boolean not null default true,
  sort     integer not null default 0
);

create table if not exists public.office_decor (
  id         bigserial primary key,
  item       text not null,
  x          integer not null,
  y          integer not null,
  placed_by  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.office_notes (
  id         bigserial primary key,
  to_user    uuid not null references auth.users(id) on delete cascade,
  from_user  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 500),
  color      text not null default '#e6f03b',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists office_notes_to_idx on public.office_notes(to_user, read_at);

create table if not exists public.office_positions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  x          real not null,
  y          real not null,
  dir        text not null default 'down',
  room       text,
  updated_at timestamptz not null default now()
);

create table if not exists public.office_strokes (
  id         bigserial primary key,
  board      text not null default 'main',
  color      text not null,
  size       integer not null default 4,
  pts        jsonb not null,
  author     uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists office_strokes_board_idx on public.office_strokes(board, id);

create table if not exists public.office_events (
  id         bigserial primary key,
  kind       text not null,
  actor      uuid references auth.users(id) on delete set null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_events_kind_idx on public.office_events(kind, actor, created_at desc);

-- Chat global de la oficina (con historial)
create table if not exists public.office_chat (
  id         bigserial primary key,
  author     uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists office_chat_created_idx on public.office_chat(created_at desc);

-- ════════════ DATOS INICIALES ════════════
-- Oficinas por defecto: tú (el superadmin que entre primero) + @ruben, @ivan, @felipe.
-- "username" enlaza la oficina con la cuenta de Ruedda: al entrar, quien tenga ese
-- @usuario queda como miembro automáticamente. Todo se cambia luego desde el panel.
insert into public.office_config (id, data) values (1, jsonb_build_object(
  'offices', jsonb_build_array(
    jsonb_build_object('slot','yo',    'username','',       'name','Dirección', 'cargo','Dirección',  'theme','nogal',    'pos',0, 'owner_superadmin', true),
    jsonb_build_object('slot','ruben', 'username','ruben',  'name','Rubén',     'cargo','Socio',      'theme','madera',   'pos',1),
    jsonb_build_object('slot','ivan',  'username','ivan',   'name','Iván',      'cargo','Socio',      'theme','alfombra', 'pos',2),
    jsonb_build_object('slot','felipe','username','felipe', 'name','Felipe',    'cargo','Socio',      'theme','concreto', 'pos',3)
  )
)) on conflict (id) do nothing;

insert into public.office_catalog (item, name, price, category, sort) values
  ('planta','Planta',20,'plantas',1), ('planta_grande','Palmera',35,'plantas',2), ('bonsai','Bonsái',40,'plantas',3),
  ('silla','Silla',25,'muebles',10), ('escritorio','Escritorio',60,'muebles',11), ('sofa','Sofá',80,'muebles',12),
  ('puff','Puff',25,'muebles',13), ('estanteria','Estantería',55,'muebles',14), ('mesa','Mesa café',50,'muebles',15),
  ('monitor','Monitor',45,'tech',20), ('tv','Pantalla',90,'tech',21), ('servidor','Servidor',110,'tech',22),
  ('arcade','Arcade',150,'ocio',30), ('cafetera','Cafetera',70,'ocio',31), ('dispensador','Dispensador',35,'ocio',32),
  ('maquina_snacks','Snacks',85,'ocio',33), ('pecera','Pecera',130,'ocio',34),
  ('lampara','Lámpara',30,'deco',40), ('alfombra','Alfombra',40,'deco',41), ('cuadro','Cuadro',50,'deco',42),
  ('neon','Neón Ruedda',100,'deco',43), ('trofeo','Trofeo',120,'deco',44), ('estatua_oro','Estatua de oro',500,'deco',45)
on conflict (item) do nothing;

-- ════════════ FUNCIONES DE ACCESO ════════════
create or replace function public.office_is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'superadmin');
$$;

create or replace function public.office_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.office_members where user_id = auth.uid() and length(trim(cargo)) > 0)
      or public.office_is_superadmin();
$$;

create or replace function public.office_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.office_members where user_id = auth.uid() and is_admin)
      or public.office_is_superadmin();
$$;

-- Entrar: devuelve la fila del miembro. Si no existe todavía:
--   · superadmin → se crea como admin y toma la oficina 'owner_superadmin' libre
--   · @usuario configurado en una oficina → se crea con esa oficina y su cargo
--   · cualquier otro → sin acceso
create or replace function public.office_join() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.office_members;
  u record;
  cfg jsonb;
  o jsonb;
  pick jsonb := null;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'no_session'); end if;
  select * into m from public.office_members where user_id = uid;
  if found then
    if length(trim(m.cargo)) = 0 and not public.office_is_superadmin() then
      return jsonb_build_object('ok', false, 'reason', 'no_role');
    end if;
    return jsonb_build_object('ok', true, 'member', to_jsonb(m));
  end if;

  select id, nombre, username, role into u from public.users where id = uid;
  select data into cfg from public.office_config where id = 1;

  for o in select value from jsonb_array_elements(coalesce(cfg->'offices', '[]'::jsonb)) loop
    if exists(select 1 from public.office_members where slot = o->>'slot') then continue; end if;
    if coalesce(o->>'username','') <> '' and lower(o->>'username') = lower(coalesce(u.username,'')) then
      pick := o; exit;
    end if;
  end loop;
  if pick is null and u.role = 'superadmin' then
    for o in select value from jsonb_array_elements(coalesce(cfg->'offices', '[]'::jsonb)) loop
      if coalesce((o->>'owner_superadmin')::boolean, false)
         and not exists(select 1 from public.office_members where slot = o->>'slot') then
        pick := o; exit;
      end if;
    end loop;
  end if;

  if pick is null and coalesce(u.role,'') <> 'superadmin' then
    return jsonb_build_object('ok', false, 'reason', 'no_role');
  end if;

  insert into public.office_members (user_id, slot, display_name, cargo, is_admin)
  values (
    uid,
    pick->>'slot',
    coalesce(nullif(trim(coalesce(u.nombre,'')),''), nullif(u.username,''), 'Ruedda'),
    coalesce(nullif(trim(coalesce(pick->>'cargo','')),''), case when u.role = 'superadmin' then 'Dirección' else 'Equipo Ruedda' end),
    coalesce(u.role,'') = 'superadmin'
  )
  returning * into m;
  return jsonb_build_object('ok', true, 'member', to_jsonb(m), 'new', true);
end $$;

-- Guardar avatar (el propio, o el de cualquiera si eres admin)
create or replace function public.office_save_avatar(target uuid, av jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if target is distinct from auth.uid() and not public.office_is_admin() then raise exception 'no autorizado'; end if;
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  update public.office_members set avatar = coalesce(av, '{}'::jsonb) where user_id = target;
end $$;

-- Premios con tope diario validado en servidor
create or replace function public.office_award(kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  amt int; cap int; used int;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select a, c into amt, cap from (values
    ('checkin',10,1), ('highfive',2,10), ('deal',5,10), ('note',1,10), ('whiteboard',1,5), ('coffee',1,3), ('arcade',1,3)
  ) t(k,a,c) where k = kind;
  if amt is null then raise exception 'premio desconocido'; end if;
  select count(*) into used from public.office_events
   where office_events.kind = 'award:' || office_award.kind and actor = uid and created_at >= date_trunc('day', now());
  if used >= cap then return jsonb_build_object('ok', false, 'reason', 'cap'); end if;
  insert into public.office_events(kind, actor, payload) values ('award:' || kind, uid, jsonb_build_object('amount', amt));
  update public.office_members set points = points + amt, coins = coins + amt where user_id = uid;
  return jsonb_build_object('ok', true, 'amount', amt);
end $$;

-- "Acelerar proyecto": puntos para todos los participantes, con enfriamiento global
create or replace function public.office_boost(participants uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cfg jsonb; cd int; pts int; v_last timestamptz; n int;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select data into cfg from public.office_config where id = 1;
  cd  := greatest(1, coalesce((cfg->>'boost_cooldown_min')::int, 10));
  pts := greatest(0, least(500, coalesce((cfg->>'boost_points')::int, 15)));
  select max(created_at) into v_last from public.office_events where kind = 'boost';
  if v_last is not null and v_last > now() - make_interval(mins => cd) then
    return jsonb_build_object('ok', false, 'reason', 'cooldown', 'retry_at', v_last + make_interval(mins => cd));
  end if;
  participants := array(select distinct x from unnest(coalesce(participants, '{}') || array[uid]) x
                        where x in (select user_id from public.office_members));
  n := coalesce(array_length(participants, 1), 1);
  update public.office_members set points = points + pts * n, coins = coins + pts * n where user_id = any(participants);
  insert into public.office_events(kind, actor, payload)
  values ('boost', uid, jsonb_build_object('participants', to_jsonb(participants), 'points', pts * n));
  return jsonb_build_object('ok', true, 'points', pts * n, 'count', n);
end $$;

-- Comprar y colocar decoración (descuenta monedas de forma atómica)
create or replace function public.office_buy(p_item text, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.office_catalog; bal int; d public.office_decor;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select * into c from public.office_catalog where item = p_item and active;
  if not found then raise exception 'artículo no disponible'; end if;
  update public.office_members set coins = coins - c.price where user_id = uid and coins >= c.price returning coins into bal;
  if bal is null then return jsonb_build_object('ok', false, 'reason', 'saldo'); end if;
  insert into public.office_decor(item, x, y, placed_by) values (p_item, p_x, p_y, uid) returning * into d;
  insert into public.office_events(kind, actor, payload) values ('buy', uid, jsonb_build_object('item', p_item, 'name', c.name, 'price', c.price));
  return jsonb_build_object('ok', true, 'decor', to_jsonb(d), 'coins', bal);
end $$;

-- Borrar la pizarra
create or replace function public.office_clear_board(p_board text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  delete from public.office_strokes where board = coalesce(p_board, 'main');
  insert into public.office_events(kind, actor, payload) values ('board_clear', auth.uid(), '{}'::jsonb);
end $$;

-- Admin: dar/quitar monedas
create or replace function public.office_grant(target uuid, amount int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.office_is_admin() then raise exception 'no autorizado'; end if;
  update public.office_members set coins = greatest(0, coins + amount) where user_id = target;
end $$;

-- Admin: buscar cuentas de Ruedda para asignarlas a una oficina
create or replace function public.office_find_users(q text) returns table(id uuid, nombre text, username text, email text, role text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.office_is_admin() then raise exception 'no autorizado'; end if;
  return query
    select u.id, u.nombre::text, u.username::text, a.email::text, u.role::text
      from public.users u join auth.users a on a.id = u.id
     where q is not null and length(trim(q)) >= 2
       and (u.username ilike '%' || trim(leading '@' from q) || '%' or u.nombre ilike '%' || q || '%' or a.email ilike '%' || q || '%')
     order by u.username nulls last
     limit 12;
end $$;

-- Admin: crear/editar miembro (asignar cuenta, oficina, cargo, admin)
create or replace function public.office_upsert_member(target uuid, p_slot text, p_name text, p_cargo text, p_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.office_is_admin() then raise exception 'no autorizado'; end if;
  if length(trim(coalesce(p_cargo,''))) = 0 then raise exception 'el cargo es obligatorio'; end if;
  update public.office_members set slot = null where slot = nullif(p_slot,'') and user_id <> target;
  insert into public.office_members(user_id, slot, display_name, cargo, is_admin)
  values (target, nullif(p_slot,''), coalesce(nullif(trim(p_name),''), 'Ruedda'), trim(p_cargo), coalesce(p_admin,false))
  on conflict (user_id) do update
    set slot = excluded.slot, display_name = excluded.display_name, cargo = excluded.cargo, is_admin = excluded.is_admin;
end $$;

-- ════════════ RLS ════════════
alter table public.office_members   enable row level security;
alter table public.office_config    enable row level security;
alter table public.office_catalog   enable row level security;
alter table public.office_decor     enable row level security;
alter table public.office_notes     enable row level security;
alter table public.office_positions enable row level security;
alter table public.office_strokes   enable row level security;
alter table public.office_events    enable row level security;
alter table public.office_chat      enable row level security;

do $$ declare t text; begin
  foreach t in array array['office_members','office_config','office_catalog','office_decor','office_notes','office_positions','office_strokes','office_events','office_chat'] loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

drop policy if exists office_members_sel on public.office_members;
drop policy if exists office_members_adm on public.office_members;
create policy office_members_sel on public.office_members for select to authenticated using (public.office_is_member());
create policy office_members_adm on public.office_members for all to authenticated using (public.office_is_admin()) with check (public.office_is_admin());

drop policy if exists office_config_sel on public.office_config;
drop policy if exists office_config_upd on public.office_config;
create policy office_config_sel on public.office_config for select to authenticated using (public.office_is_member());
create policy office_config_upd on public.office_config for update to authenticated using (public.office_is_admin()) with check (public.office_is_admin());

drop policy if exists office_catalog_sel on public.office_catalog;
drop policy if exists office_catalog_adm on public.office_catalog;
create policy office_catalog_sel on public.office_catalog for select to authenticated using (public.office_is_member());
create policy office_catalog_adm on public.office_catalog for all to authenticated using (public.office_is_admin()) with check (public.office_is_admin());

drop policy if exists office_decor_sel on public.office_decor;
drop policy if exists office_decor_ins on public.office_decor;
drop policy if exists office_decor_upd on public.office_decor;
drop policy if exists office_decor_del on public.office_decor;
create policy office_decor_sel on public.office_decor for select to authenticated using (public.office_is_member());
create policy office_decor_ins on public.office_decor for insert to authenticated with check (public.office_is_admin());
create policy office_decor_upd on public.office_decor for update to authenticated
  using (public.office_is_admin() or (placed_by = auth.uid() and public.office_is_member()))
  with check (public.office_is_admin() or (placed_by = auth.uid() and public.office_is_member()));
create policy office_decor_del on public.office_decor for delete to authenticated
  using (public.office_is_admin() or (placed_by = auth.uid() and public.office_is_member()));

drop policy if exists office_notes_sel on public.office_notes;
drop policy if exists office_notes_ins on public.office_notes;
drop policy if exists office_notes_upd on public.office_notes;
drop policy if exists office_notes_del on public.office_notes;
create policy office_notes_sel on public.office_notes for select to authenticated
  using ((to_user = auth.uid() or from_user = auth.uid()) and public.office_is_member());
create policy office_notes_ins on public.office_notes for insert to authenticated
  with check (from_user = auth.uid() and public.office_is_member()
              and exists(select 1 from public.office_members where user_id = to_user));
create policy office_notes_upd on public.office_notes for update to authenticated
  using (to_user = auth.uid()) with check (to_user = auth.uid());
create policy office_notes_del on public.office_notes for delete to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists office_positions_sel on public.office_positions;
drop policy if exists office_positions_own on public.office_positions;
create policy office_positions_sel on public.office_positions for select to authenticated using (public.office_is_member());
create policy office_positions_own on public.office_positions for all to authenticated
  using (user_id = auth.uid() and public.office_is_member()) with check (user_id = auth.uid() and public.office_is_member());

drop policy if exists office_strokes_sel on public.office_strokes;
drop policy if exists office_strokes_ins on public.office_strokes;
create policy office_strokes_sel on public.office_strokes for select to authenticated using (public.office_is_member());
create policy office_strokes_ins on public.office_strokes for insert to authenticated
  with check (author = auth.uid() and public.office_is_member());

drop policy if exists office_events_sel on public.office_events;
drop policy if exists office_events_ins on public.office_events;
create policy office_events_sel on public.office_events for select to authenticated using (public.office_is_member());
create policy office_events_ins on public.office_events for insert to authenticated
  with check (actor = auth.uid() and public.office_is_member() and kind not like 'award:%' and kind <> 'boost');

drop policy if exists office_chat_sel on public.office_chat;
drop policy if exists office_chat_ins on public.office_chat;
drop policy if exists office_chat_del on public.office_chat;
create policy office_chat_sel on public.office_chat for select to authenticated using (public.office_is_member());
create policy office_chat_ins on public.office_chat for insert to authenticated with check (author = auth.uid() and public.office_is_member());
create policy office_chat_del on public.office_chat for delete to authenticated using (author = auth.uid() or public.office_is_admin());

-- Solo las RPCs; nada de anon
do $$ declare f text; begin
  foreach f in array array['office_join()','office_save_avatar(uuid,jsonb)','office_award(text)','office_boost(uuid[])',
                           'office_buy(text,integer,integer)','office_clear_board(text)','office_grant(uuid,integer)',
                           'office_find_users(text)','office_upsert_member(uuid,text,text,text,boolean)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

-- ════════════ REALTIME ════════════
-- Cambios de tablas en vivo (RLS se respeta: cada quien solo recibe sus notas)
do $$ declare t text; begin
  foreach t in array array['office_members','office_config','office_catalog','office_decor','office_notes','office_events','office_chat'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Canal privado 'office:main' (movimiento, presencia, pizarra, chat): solo miembros
drop policy if exists office_rt_read on realtime.messages;
drop policy if exists office_rt_write on realtime.messages;
create policy office_rt_read on realtime.messages for select to authenticated
  using (realtime.topic() = 'office:main' and public.office_is_member());
create policy office_rt_write on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'office:main' and public.office_is_member());
