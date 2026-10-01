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

alter table public.office_decor add column if not exists rot integer not null default 0;

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

-- Notas escritas en la pizarra (se pueden mover)
create table if not exists public.office_board_notes (
  id         bigserial primary key,
  board      text not null default 'main',
  body       text not null check (length(body) between 1 and 300),
  x          integer not null default 100,
  y          integer not null default 100,
  color      text not null default '#fff27a',
  author     uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Chat global de la oficina (con historial)
create table if not exists public.office_chat (
  id         bigserial primary key,
  author     uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists office_chat_created_idx on public.office_chat(created_at desc);

-- Usuarios autorizados (login solo con usuario). Solo los lee el servidor (/api/office-login) y los admins por RPC.
create table if not exists public.office_accounts (
  username     text primary key check (username ~ '^[a-z0-9._-]{2,40}$'),
  display_name text not null,
  slot         text,
  cargo        text not null default 'Equipo Ruedda',
  is_admin     boolean not null default false,
  active       boolean not null default true,
  user_id      uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
insert into public.office_accounts (username, display_name, slot, cargo, is_admin) values
  ('clubdemonopolio', 'Jesús',  'yo',     'Dirección', true),
  ('ivan',            'Iván',   'ivan',   'Socio',     false),
  ('ruben',           'Rubén',  'ruben',  'Socio',     false),
  ('felipe',          'Felipe', 'felipe', 'Socio',     false)
on conflict (username) do nothing;
-- limpieza de nombres de prueba anteriores (solo si nunca entraron)
delete from public.office_accounts where username in ('jesus', 'rueddaco') and user_id is null;

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
insert into public.office_catalog (item, name, price, category, sort) values
  ('flores','Flores',25,'plantas',4), ('cactus','Cactus',20,'plantas',5), ('palmera_neon','Palmera neón',90,'plantas',6),
  ('sillon_gamer','Silla gamer',70,'muebles',16), ('banca','Banca',45,'muebles',17), ('standing','Escritorio de pie',75,'muebles',18), ('archivador','Archivador',40,'muebles',19),
  ('impresora','Impresora',45,'tech',23), ('globo','Globo terráqueo',35,'tech',24),
  ('billar','Mesa de billar',220,'ocio',35), ('futbolito','Futbolito',160,'ocio',36), ('piano','Piano',260,'ocio',37), ('bici','Bici estática',90,'ocio',38),
  ('nevera','Nevera',80,'cocina',50), ('microondas','Microondas',40,'cocina',51), ('flotador','Flotador',15,'piscina',60),
  ('reloj_pie','Reloj de pie',110,'deco',46), ('poster','Póster Ruedda',30,'deco',47), ('extintor','Extintor',10,'deco',48), ('telescopio','Telescopio',95,'deco',49)
on conflict (item) do nothing;
-- carros, carreras y pisos
insert into public.office_catalog (item, name, price, category, sort) values
  ('llantas','Pila de llantas',120,'carreras',200), ('cono','Cono',35,'carreras',201), ('bandera','Bandera a cuadros',90,'carreras',202),
  ('semaforo','Semáforo de largada',260,'carreras',203), ('surtidor','Surtidor de gasolina',340,'carreras',204), ('kart','Kart',650,'carreras',205),
  ('moto','Moto deportiva',900,'carreras',206), ('casco','Casco en vitrina',220,'carreras',207), ('motor_v8','Motor V8',780,'carreras',208),
  ('simulador','Simulador de carreras',1200,'carreras',209), ('herramientas','Caja de herramientas',180,'carreras',210), ('gato','Gato hidráulico',140,'carreras',211),
  ('barril_aceite','Barril de aceite',90,'carreras',212), ('trofeo_copa','Copa de campeón',480,'carreras',213), ('letrero_racing','Letrero Ruedda Motorsport',520,'carreras',214),
  ('auto_mini','Auto de colección',2500,'carreras',215),
  ('piso_meta','Línea de meta (piso)',160,'pisos',300), ('piso_cuadros','Piso a cuadros',220,'pisos',301), ('piso_ruedda','Tapete Ruedda',260,'pisos',302),
  ('piso_persa','Alfombra persa',300,'pisos',303), ('piso_redondo','Tapete redondo',180,'pisos',304), ('piso_pista','Tramo de pista',240,'pisos',305),
  ('piso_flechas','Flechas de pista',120,'pisos',306), ('piso_madera','Parqué',200,'pisos',307)
on conflict (item) do nothing;

-- muebles y plantas de Kenney (CC0)
insert into public.office_catalog (item, name, price, category, sort) values
  ('k_maceta','Maceta tropical',45,'plantas',100),
  ('k_maceta2','Maceta azul',45,'plantas',101),
  ('k_arbusto','Arbusto',60,'plantas',102),
  ('k_brote','Brote',25,'plantas',103),
  ('k_hongos','Hongos',30,'plantas',104),
  ('k_arbol','Arbolito',95,'plantas',105),
  ('k_arbol_otono','Arbolito de otoño',95,'plantas',106),
  ('k_arbol_alto','Árbol alto',160,'plantas',107),
  ('k_arbol_alto_otono','Árbol de otoño',160,'plantas',108),
  ('k_tapete','Tapete naranja',90,'deco',109),
  ('k_tapete_verde','Tapete verde',120,'deco',110),
  ('k_cuadro_oro','Cuadro dorado',110,'deco',111),
  ('k_retrato','Retrato',90,'deco',112),
  ('k_espejo','Espejo',80,'deco',113),
  ('k_jarron','Jarrón dorado',140,'deco',114),
  ('k_jarron_plata','Jarrón plateado',120,'deco',115),
  ('k_candelabro','Candelabro',85,'deco',116),
  ('k_escudo','Escudo',70,'deco',117),
  ('k_barra_bebidas','Barra de bebidas',220,'cocina',118),
  ('k_estufa','Cocina',150,'cocina',119),
  ('k_fregadero','Fregadero',110,'cocina',120),
  ('k_vitrina','Vitrina',130,'muebles',121),
  ('k_mesa_larga','Mesa larga',160,'muebles',122),
  ('k_mesa_oval','Mesa ovalada',120,'muebles',123),
  ('k_mesa_redonda','Mesa redonda',75,'muebles',124),
  ('k_mesita','Mesita de noche',65,'muebles',125),
  ('k_taburete','Taburete',40,'muebles',126),
  ('k_silla_madera','Silla de madera',45,'muebles',127),
  ('k_parlante','Bocina',120,'tech',128),
  ('k_barril','Barril de agua',50,'deco',129),
  ('k_letrero','Letrero',35,'deco',130),
  ('k_colmena','Colmena',55,'deco',131)
on conflict (item) do nothing;
-- precios más altos (una sola vez; después los maneja el admin desde la tienda)
do $$ begin
  if not coalesce((select (data->>'prices_v2')::boolean from public.office_config where id = 1), false) then
    update public.office_catalog set price = (round(price * 2.5 / 5.0) * 5)::int where item not like 'k\_%';
    update public.office_config set data = data || '{"prices_v2": true}'::jsonb where id = 1;
  end if;
end $$;

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
  if public.office_in_other_office(p_x, p_y) and not public.office_is_admin() then raise exception 'no puedes decorar la oficina de otra persona'; end if;
  if public.office_in_my_office(p_x, p_y) then   -- en tu oficina es gratis
    insert into public.office_decor(item, x, y, placed_by) values (p_item, p_x, p_y, uid) returning * into d;
    return jsonb_build_object('ok', true, 'decor', to_jsonb(d), 'coins', (select coins from public.office_members where user_id = uid), 'free', true);
  end if;
  update public.office_members set coins = coins - c.price where user_id = uid and coins >= c.price returning coins into bal;
  if bal is null then return jsonb_build_object('ok', false, 'reason', 'saldo'); end if;
  insert into public.office_decor(item, x, y, placed_by) values (p_item, p_x, p_y, uid) returning * into d;
  insert into public.office_events(kind, actor, payload) values ('buy', uid, jsonb_build_object('item', p_item, 'name', c.name, 'price', c.price));
  return jsonb_build_object('ok', true, 'decor', to_jsonb(d), 'coins', bal);
end $$;

-- Máquina de lotería: gratis, 25 tiradas al día. 1 de cada 4 gana monedas y puntos; 1 % premio mayor.
create or replace function public.office_lottery() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); used int; r float8; win boolean := false; jack boolean := false; c int := 0; p int := 0;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select count(*) into used from public.office_events where kind = 'lottery' and actor = uid and created_at >= date_trunc('day', now());
  if used >= 25 then return jsonb_build_object('ok', false, 'reason', 'limite', 'left', 0); end if;
  r := random();
  if r < 0.01 then win := true; jack := true; c := 1000; p := 100;
  elsif r < 0.25 then win := true; c := 40 + floor(random() * 161)::int; p := 5 + floor(random() * 16)::int;
  end if;
  insert into public.office_events(kind, actor, payload) values ('lottery', uid, jsonb_build_object('win', win, 'jackpot', jack, 'coins', c, 'points', p));
  if win then update public.office_members set coins = coins + c, points = points + p where user_id = uid; end if;
  return jsonb_build_object('ok', true, 'win', win, 'jackpot', jack, 'coins', c, 'points', p, 'left', 24 - used);
end $$;

-- Tirar billetes en el club: cuesta monedas (las descuenta el servidor)
create or replace function public.office_tip(p_amount int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); amt int := greatest(5, least(500, coalesce(p_amount, 25))); bal int;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  update public.office_members set coins = coins - amt where user_id = uid and coins >= amt returning coins into bal;
  if bal is null then return jsonb_build_object('ok', false, 'reason', 'saldo'); end if;
  insert into public.office_events(kind, actor, payload) values ('tip', uid, jsonb_build_object('amount', amt));
  return jsonb_build_object('ok', true, 'coins', bal, 'amount', amt);
end $$;

-- Borrar la pizarra
create or replace function public.office_clear_board(p_board text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  delete from public.office_strokes where board = coalesce(p_board, 'main');
  delete from public.office_board_notes where board = coalesce(p_board, 'main');
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

-- ════════════ CADA QUIEN EDITA SU OFICINA ════════════
-- ¿La celda (x, y) está dentro de la oficina asignada a quien llama? (4 oficinas de 13×9 en x = 1, 15, 29, 43)
create or replace function public.office_in_my_office(px int, py int) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s text; p int; x0 int;
begin
  select slot into s from public.office_members where user_id = auth.uid();
  if s is null then return false; end if;
  select (o->>'pos')::int into p from public.office_config c, jsonb_array_elements(c.data->'offices') o where c.id = 1 and o->>'slot' = s limit 1;
  if p is null or p < 0 or p > 3 then return false; end if;
  x0 := (array[1, 15, 29, 43])[p + 1];
  return px between x0 and x0 + 12 and py between 1 and 9;
end $$;

-- ¿La celda cae dentro de la oficina de OTRA persona? (las áreas comunes son de todos)
create or replace function public.office_in_other_office(px int, py int) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if py < 1 or py > 9 then return false; end if;
  if not ((px between 1 and 13) or (px between 15 and 27) or (px between 29 and 41) or (px between 43 and 55)) then return false; end if;
  return not public.office_in_my_office(px, py);
end $$;

-- Nombre, piso y muebles base de MI oficina (sin tocar el resto de la configuración)
create or replace function public.office_update_my_office(p_title text, p_theme text, p_bare boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select slot into s from public.office_members where user_id = auth.uid();
  if s is null then raise exception 'no tienes oficina asignada'; end if;
  if p_theme not in ('nogal','madera','alfombra','concreto','marmol','neon','ruedda','verde') then raise exception 'piso inválido'; end if;
  update public.office_config set
    data = jsonb_set(data, '{offices}', (
      select jsonb_agg(case when o->>'slot' = s
                            then o || jsonb_build_object('title', left(coalesce(trim(p_title), ''), 24), 'theme', p_theme, 'bare', coalesce(p_bare, false))
                            else o end order by ord)
      from jsonb_array_elements(data->'offices') with ordinality t(o, ord))),
    updated_at = now(), updated_by = auth.uid()
  where id = 1;
end $$;

-- Mover MI escritorio dentro de mi oficina (posición relativa guardada en offices[].desk)
create or replace function public.office_set_my_desk(px int, py int) returns void
language plpgsql security definer set search_path = public as $$
declare s text; p int; x0 int;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select slot into s from public.office_members where user_id = auth.uid();
  select (o->>'pos')::int into p from public.office_config c, jsonb_array_elements(c.data->'offices') o where c.id = 1 and o->>'slot' = s limit 1;
  if p is null then raise exception 'no tienes oficina asignada'; end if;
  x0 := (array[1, 15, 29, 43])[p + 1];
  if px < x0 or px > x0 + 10 or py < 2 or py > 8 then raise exception 'el escritorio debe quedar dentro de tu oficina'; end if;
  update public.office_config set
    data = jsonb_set(data, '{offices}', (
      select jsonb_agg(case when o->>'slot' = s then o || jsonb_build_object('desk', jsonb_build_array(px - x0, py)) else o end order by ord)
      from jsonb_array_elements(data->'offices') with ordinality t(o, ord))),
    updated_at = now(), updated_by = auth.uid()
  where id = 1;
end $$;

-- "Soltar" los muebles base de MI oficina: pasan a ser decoración normal (se mueven y se quitan)
create or replace function public.office_unpack_base() returns void
language plpgsql security definer set search_path = public as $$
declare s text; p int; x0 int; bare boolean;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  select slot into s from public.office_members where user_id = auth.uid();
  select (o->>'pos')::int, coalesce((o->>'bare')::boolean, false) into p, bare
    from public.office_config c, jsonb_array_elements(c.data->'offices') o where c.id = 1 and o->>'slot' = s limit 1;
  if p is null then raise exception 'no tienes oficina asignada'; end if;
  if bare then return; end if;
  x0 := (array[1, 15, 29, 43])[p + 1];
  insert into public.office_decor(item, x, y, placed_by) values
    ('estanteria', x0, 1, auth.uid()), ('planta_grande', x0 + 12, 1, auth.uid()), ('alfombra', x0 + 4, 5, auth.uid()),
    ('mesa', x0 + 9, 6, auth.uid()), ('sofa', x0 + 9, 8, auth.uid()), ('planta', x0, 8, auth.uid()), ('lampara', x0 + 12, 8, auth.uid());
  update public.office_config set
    data = jsonb_set(data, '{offices}', (
      select jsonb_agg(case when o->>'slot' = s then o || jsonb_build_object('bare', true) else o end order by ord)
      from jsonb_array_elements(data->'offices') with ordinality t(o, ord))),
    updated_at = now(), updated_by = auth.uid()
  where id = 1;
end $$;

-- Decorar MI oficina gratis (cualquier artículo activo de la tienda)
create or replace function public.office_place_own(p_item text, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.office_decor;
begin
  if not public.office_is_member() then raise exception 'no autorizado'; end if;
  if not public.office_in_my_office(p_x, p_y) then raise exception 'solo puedes decorar gratis dentro de tu oficina'; end if;
  if not exists(select 1 from public.office_catalog where item = p_item and active) then raise exception 'artículo no disponible'; end if;
  insert into public.office_decor(item, x, y, placed_by) values (p_item, p_x, p_y, auth.uid()) returning * into d;
  return jsonb_build_object('ok', true, 'decor', to_jsonb(d));
end $$;

-- Admin: usuarios autorizados
create or replace function public.office_accounts_list() returns setof public.office_accounts
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.office_is_admin() then raise exception 'no autorizado'; end if;
  return query select * from public.office_accounts order by created_at;
end $$;
create or replace function public.office_account_upsert(p_username text, p_name text, p_slot text, p_cargo text, p_admin boolean, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(leading '@' from trim(coalesce(p_username, ''))));
begin
  if not public.office_is_admin() then raise exception 'no autorizado'; end if;
  if u !~ '^[a-z0-9._-]{2,40}$' then raise exception 'usuario inválido (letras, números, punto, guion)'; end if;
  insert into public.office_accounts(username, display_name, slot, cargo, is_admin, active)
  values (u, coalesce(nullif(trim(p_name), ''), u), nullif(p_slot, ''), coalesce(nullif(trim(p_cargo), ''), 'Equipo Ruedda'), coalesce(p_admin, false), coalesce(p_active, true))
  on conflict (username) do update set display_name = excluded.display_name, slot = excluded.slot, cargo = excluded.cargo, is_admin = excluded.is_admin, active = excluded.active;
end $$;
create or replace function public.office_account_delete(p_username text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.office_is_admin() then raise exception 'no autorizado'; end if;
  select user_id into uid from public.office_accounts where username = p_username;
  if uid = auth.uid() then raise exception 'no puedes quitarte a ti mismo'; end if;
  delete from public.office_accounts where username = p_username;
  if uid is not null then delete from public.office_members where user_id = uid; end if;
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
alter table public.office_board_notes enable row level security;
alter table public.office_accounts  enable row level security;   -- sin políticas: solo service role y RPCs

do $$ declare t text; begin
  foreach t in array array['office_members','office_config','office_catalog','office_decor','office_notes','office_positions','office_strokes','office_events','office_chat','office_accounts','office_board_notes'] loop
    execute format('revoke all on public.%I from anon', t);
    if t = 'office_accounts' then execute 'revoke all on public.office_accounts from authenticated'; end if;
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
  using (public.office_is_admin() or (public.office_is_member() and (placed_by = auth.uid() or public.office_in_my_office(x, y))))
  with check (public.office_is_admin() or (public.office_is_member() and (placed_by = auth.uid() or public.office_in_my_office(x, y)) and not public.office_in_other_office(x, y)));
create policy office_decor_del on public.office_decor for delete to authenticated
  using (public.office_is_admin() or (public.office_is_member() and (placed_by = auth.uid() or public.office_in_my_office(x, y))));

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

drop policy if exists office_bnotes_sel on public.office_board_notes;
drop policy if exists office_bnotes_all on public.office_board_notes;
create policy office_bnotes_sel on public.office_board_notes for select to authenticated using (public.office_is_member());
create policy office_bnotes_all on public.office_board_notes for all to authenticated using (public.office_is_member()) with check (public.office_is_member());

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
                           'office_find_users(text)','office_upsert_member(uuid,text,text,text,boolean)',
                           'office_in_my_office(integer,integer)','office_in_other_office(integer,integer)','office_update_my_office(text,text,boolean)','office_place_own(text,integer,integer)',
                           'office_accounts_list()','office_lottery()','office_tip(integer)','office_set_my_desk(integer,integer)','office_unpack_base()','office_account_upsert(text,text,text,text,boolean,boolean)','office_account_delete(text)'] loop
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
