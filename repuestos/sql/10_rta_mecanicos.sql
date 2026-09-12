-- ============================================================================
-- RUEDDA REPUESTOS · 10_rta_mecanicos.sql
-- ----------------------------------------------------------------------------
-- RTA — Ruedda Taller Avalado. Vertical de mecanicos y Red Post-Venta,
-- construida a partir de los documentos de producto de Ruben:
--   "Vertical de Mecanicos y Red Post-Venta" y "App de tecnicos, precios y
--   automatizacion" (Septiembre 2026).
--
-- Extiende repuestos.mechanics (no la reemplaza) con las tres capas de
-- entrada (identidad, competencia, compromiso), el sistema de aval por
-- especialidad, solicitudes con precio protegido, cierre de trabajo,
-- garantia/disputa e historial de vehiculo por serial (para que Avalta y
-- FlotaIQ puedan leerlo mas adelante — mismo ecosistema, un solo historial).
--
-- Corre esto DESPUES de 08_reviews_push.sql y 09_payment_confirmations.sql.
-- Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------
do $$ begin create type repuestos.mechanic_stage as enum
  ('borrador','verificacion','verificado','avalado','maestro','suspendido');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.mechanic_kind as enum ('taller','movil');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.especialidad_estado as enum ('declarada','avalada');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.modalidad_atencion as enum ('taller','domicilio','grua');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.urgencia as enum ('hoy','esta_semana','cuando_se_pueda');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.solicitud_estado as enum
  ('abierta','presupuestada','aprobada','en_camino','en_sitio','en_proceso','cerrada','cancelada');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.presupuesto_cobro as enum ('por_trabajo','por_hora');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.trabajo_estado as enum ('en_proceso','emitido','rechazado');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.garantia_estado as enum ('activa','reclamada','vencida');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.disputa_estado as enum ('abierta','resuelta_cliente','resuelta_mecanico');
exception when duplicate_object then null; end $$;

do $$ begin create type repuestos.origen_repuesto as enum ('nuevo','remanufacturado','usado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. CATALOGOS FIJOS
-- ---------------------------------------------------------------------------
create table if not exists repuestos.especialidades (
  id     text primary key,           -- 'motor','caja_transmision','tren_delantero','frenos',
                                      -- 'electrico','diagnostico_inyeccion','aire_acondicionado',
                                      -- 'diesel_liviano','servicio_rapido'
  nombre text not null,
  sort   smallint not null default 0
);
insert into repuestos.especialidades (id, nombre, sort) values
  ('motor','Motor',1), ('caja_transmision','Caja y transmision',2),
  ('tren_delantero','Tren delantero',3), ('frenos','Frenos',4),
  ('electrico','Electrico y electronico',5), ('diagnostico_inyeccion','Diagnostico e inyeccion',6),
  ('aire_acondicionado','Aire acondicionado',7), ('diesel_liviano','Diesel liviano',8),
  ('servicio_rapido','Servicio rapido y mantenimiento preventivo',9)
on conflict (id) do nothing;

create table if not exists repuestos.segmentos (
  id       text primary key,  -- 'A','B','C','D'
  nombre   text not null,
  ejemplos text
);
insert into repuestos.segmentos (id, nombre, ejemplos) values
  ('A','Sedan pequeno y compacto','Aveo, Rio, Accent'),
  ('B','Sedan mediano y SUV liviana','Corolla, Sentra, Tucson'),
  ('C','Camioneta y SUV grande','Hilux, Grand Vitara, Fortuner'),
  ('D','Diesel liviano y comercial','NHR, camionetas 350/4JB1')
on conflict (id) do nothing;

create table if not exists repuestos.servicios_rta (
  id          text primary key,          -- clave del servicio, ej 'cambio_aceite_filtro'
  nombre      text not null,
  categoria   text not null default 'presupuesto' check (categoria in ('fijo','desde','presupuesto')),
  modalidad   text not null default 'ambos' check (modalidad in ('taller','domicilio','ambos')),
  especialidad_id text references repuestos.especialidades(id),
  checklist   jsonb not null default '[]'::jsonb,
  activo      boolean not null default true,
  sort        smallint not null default 0
);

create table if not exists repuestos.zonas (
  id     text primary key,
  nombre text not null,
  activa boolean not null default true
);

create table if not exists repuestos.precios_referencia (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  text not null references repuestos.servicios_rta(id) on delete cascade,
  segmento_id  text not null references repuestos.segmentos(id),
  modalidad    repuestos.modalidad_atencion not null default 'taller',
  valor_usd    numeric(12,2) not null default 0,
  origen       text not null default 'estimado' check (origen in ('estimado','medido')),
  n_trabajos   integer not null default 0,
  actualizado_at timestamptz not null default now(),
  constraint uq_precio_ref unique (servicio_id, segmento_id, modalidad)
);

-- ---------------------------------------------------------------------------
-- 3. MECANICO: capas de entrada (extiende repuestos.mechanics existente)
-- ---------------------------------------------------------------------------
alter table repuestos.mechanics
  add column if not exists user_id           uuid references auth.users(id) on delete set null,
  add column if not exists tipo              repuestos.mechanic_kind not null default 'taller',
  add column if not exists cedula_verificada  boolean not null default false,
  add column if not exists rif               text,
  add column if not exists direccion         text,
  add column if not exists zonas_cobertura   text[] not null default '{}',
  add column if not exists fotos             text[] not null default '{}',
  add column if not exists stage             repuestos.mechanic_stage not null default 'borrador',
  add column if not exists year_sello        smallint;

create index if not exists idx_mechanics_user on repuestos.mechanics(user_id);
create index if not exists idx_mechanics_stage on repuestos.mechanics(stage);

create table if not exists repuestos.mechanic_references (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references repuestos.mechanics(id) on delete cascade,
  nombre      text not null,
  telefono    text not null,
  resultado   text,               -- lo que respondio al llamado (texto libre, lo llena el equipo Ruedda)
  llamado_por uuid references auth.users(id) on delete set null,
  llamado_en  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists repuestos.mechanic_specialties (
  mechanic_id     uuid not null references repuestos.mechanics(id) on delete cascade,
  especialidad_id text not null references repuestos.especialidades(id),
  equipo_declarado text,
  estado          repuestos.especialidad_estado not null default 'declarada',
  created_at      timestamptz not null default now(),
  primary key (mechanic_id, especialidad_id)
);

create table if not exists repuestos.avales (
  id              uuid primary key default gen_random_uuid(),
  mechanic_id     uuid not null references repuestos.mechanics(id) on delete cascade,
  especialidad_id text not null references repuestos.especialidades(id),
  instructor      text not null,           -- nombre de quien firma (consejo tecnico, no un booleano)
  firmado_en      timestamptz not null default now(),
  vence_en        timestamptz not null,
  anio_sello      smallint not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_avales_mecanico on repuestos.avales(mechanic_id);

create table if not exists repuestos.acuerdos_firmados (
  id          uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references repuestos.mechanics(id) on delete cascade,
  version     text not null default '1.0',
  ip          text,
  firmado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. SOLICITUD -> PRESUPUESTO -> TRABAJO
-- ---------------------------------------------------------------------------
create table if not exists repuestos.solicitudes_rta (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid references auth.users(id) on delete set null,
  guest_phone   text,
  sintoma       text not null,       -- catalogo cerrado del front: mantenimiento, no_arranca, ruido_raro,
                                      -- frenos, se_calienta, ac, luz_tablero, electrico, golpe, no_se_que_es
  especialidad_id text references repuestos.especialidades(id),  -- 'no_se_que_es' -> diagnostico_inyeccion
  vehiculo_desc text not null,       -- "Toyota Hilux 2014" (texto libre: no hay garage formal en repuestos aun)
  vehiculo_serial text,              -- VIN si el cliente lo tiene a mano (opcional en v1)
  segmento_id   text references repuestos.segmentos(id),
  modalidad     repuestos.modalidad_atencion not null default 'taller',
  urgencia      repuestos.urgencia not null default 'cuando_se_pueda',
  zona          text,
  estado        repuestos.solicitud_estado not null default 'abierta',
  created_at    timestamptz not null default now()
);
create index if not exists idx_solrta_estado on repuestos.solicitudes_rta(estado);
create index if not exists idx_solrta_cliente on repuestos.solicitudes_rta(cliente_id);

create table if not exists repuestos.presupuestos_rta (
  id            uuid primary key default gen_random_uuid(),
  solicitud_id  uuid not null references repuestos.solicitudes_rta(id) on delete cascade,
  mechanic_id   uuid not null references repuestos.mechanics(id) on delete cascade,
  mano_obra_usd numeric(12,2) not null check (mano_obra_usd >= 0),
  repuestos_json jsonb not null default '[]'::jsonb,  -- [{desc, marca, origen, precio_usd}]
  total_usd     numeric(12,2) not null check (total_usd >= 0),
  cobro         repuestos.presupuesto_cobro not null default 'por_trabajo',
  cargo_visita_usd numeric(12,2) not null default 0,
  aprobado      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_presrta_solicitud on repuestos.presupuestos_rta(solicitud_id);

create table if not exists repuestos.trabajos_rta (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references repuestos.solicitudes_rta(id) on delete cascade,
  presupuesto_id  uuid not null references repuestos.presupuestos_rta(id) on delete cascade,
  mechanic_id     uuid not null references repuestos.mechanics(id) on delete cascade,
  modalidad       repuestos.modalidad_atencion not null,
  estado          repuestos.trabajo_estado not null default 'en_proceso',
  completado      text check (completado in ('si','parcial','no')),
  motivo_incompleto text,
  km_entrega      integer,
  checklist_respuestas jsonb not null default '{}'::jsonb,
  observaciones_texto  text,
  observaciones_audio_url text,
  transcripcion   text,
  monto_final_usd numeric(12,2),
  created_at      timestamptz not null default now(),
  emitido_at      timestamptz
);
create index if not exists idx_trabajosrta_mecanico on repuestos.trabajos_rta(mechanic_id);

create table if not exists repuestos.ampliaciones_rta (
  id            uuid primary key default gen_random_uuid(),
  trabajo_id    uuid not null references repuestos.trabajos_rta(id) on delete cascade,
  motivo        text not null,
  foto_url      text not null,
  monto_usd     numeric(12,2) not null check (monto_usd >= 0),
  aprobada      boolean,
  created_at    timestamptz not null default now(),
  resuelta_at   timestamptz
);

create table if not exists repuestos.repuestos_usados_rta (
  id          uuid primary key default gen_random_uuid(),
  trabajo_id  uuid not null references repuestos.trabajos_rta(id) on delete cascade,
  descripcion text not null,
  marca       text,
  origen      repuestos.origen_repuesto not null default 'nuevo',
  precio_usd  numeric(12,2) not null default 0
);

create table if not exists repuestos.recomendados_rta (
  id           uuid primary key default gen_random_uuid(),
  trabajo_id   uuid not null references repuestos.trabajos_rta(id) on delete cascade,
  vehiculo_serial text,
  que          text not null,
  urgencia_semanas smallint,
  urgencia_km      integer,
  estado       text not null default 'pendiente' check (estado in ('pendiente','atendido','descartado')),
  created_at   timestamptz not null default now()
);

create table if not exists repuestos.derivaciones_rta (
  id                  uuid primary key default gen_random_uuid(),
  trabajo_origen_id   uuid not null references repuestos.trabajos_rta(id) on delete cascade,
  que_encontro         text not null,
  foto_url             text not null,
  solicitud_generada_id uuid references repuestos.solicitudes_rta(id) on delete set null,
  created_at           timestamptz not null default now()
);

create table if not exists repuestos.garantias_rta (
  id           uuid primary key default gen_random_uuid(),
  trabajo_id   uuid not null unique references repuestos.trabajos_rta(id) on delete cascade,
  vence_fecha  timestamptz not null,
  vence_km     integer,
  estado       repuestos.garantia_estado not null default 'activa',
  reclamo_texto text,
  reclamado_at timestamptz
);

create table if not exists repuestos.disputas_rta (
  id           uuid primary key default gen_random_uuid(),
  trabajo_id   uuid not null references repuestos.trabajos_rta(id) on delete cascade,
  abierta_por  uuid references auth.users(id) on delete set null,
  evidencia    text,
  estado       repuestos.disputa_estado not null default 'abierta',
  decision     text,
  decidido_por uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  resuelta_at  timestamptz
);

-- append-only a proposito (para Avalta/FlotaIQ mas adelante): nunca se
-- edita ni se borra una fila de historial, solo se inserta.
create table if not exists repuestos.historial_vehiculo (
  id          uuid primary key default gen_random_uuid(),
  serial      text not null,
  fecha       timestamptz not null default now(),
  tipo_evento text not null,   -- 'trabajo_rta','recomendado','garantia_reclamada', etc.
  descripcion text not null,
  quien_lo_ejecuto text,
  fuente      text not null default 'ruedda_repuestos',
  trabajo_id  uuid references repuestos.trabajos_rta(id) on delete set null
);
create index if not exists idx_historial_serial on repuestos.historial_vehiculo(serial, fecha desc);

create table if not exists repuestos.informes_rta (
  id            uuid primary key default gen_random_uuid(),
  trabajo_id    uuid not null unique references repuestos.trabajos_rta(id) on delete cascade,
  json_generado jsonb,
  pdf_url       text,
  codigo_publico text unique,
  aprobado_por  uuid references auth.users(id) on delete set null,
  enviado_en    timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. TRIGGERS DE NEGOCIO
-- ---------------------------------------------------------------------------
-- tope del 10%: una ampliacion no puede empujar el monto final mas alla del
-- 10% del presupuesto aprobado sin que ELLA MISMA este aprobada.
create or replace function repuestos.tg_check_ampliacion_tope()
returns trigger language plpgsql
set search_path = repuestos, pg_catalog as $$
declare v_presupuesto numeric; v_aprobado_extra numeric;
begin
  select p.total_usd into v_presupuesto
  from repuestos.trabajos_rta t join repuestos.presupuestos_rta p on p.id = t.presupuesto_id
  where t.id = new.trabajo_id;

  select coalesce(sum(monto_usd), 0) into v_aprobado_extra
  from repuestos.ampliaciones_rta where trabajo_id = new.trabajo_id and aprobada = true and id <> new.id;

  if new.aprobada = true and (v_aprobado_extra + new.monto_usd) > (v_presupuesto * 0.10) then
    raise exception 'la ampliacion aprobada supera el tope del 10%% del presupuesto';
  end if;
  return new;
end $$;

drop trigger if exists trg_ampliacion_tope on repuestos.ampliaciones_rta;
create trigger trg_ampliacion_tope before insert or update of aprobada on repuestos.ampliaciones_rta
for each row execute function repuestos.tg_check_ampliacion_tope();

-- al emitir un trabajo: garantia automatica (3 meses / 5000km) + historial
create or replace function repuestos.tg_trabajo_emitido()
returns trigger language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_sol repuestos.solicitudes_rta%rowtype;
begin
  if new.estado = 'emitido' and (old.estado is distinct from 'emitido') then
    new.emitido_at := now();

    insert into repuestos.garantias_rta (trabajo_id, vence_fecha, vence_km)
    values (new.id, now() + interval '3 months', coalesce(new.km_entrega, 0) + 5000)
    on conflict (trabajo_id) do nothing;

    select * into v_sol from repuestos.solicitudes_rta where id = new.solicitud_id;
    if v_sol.vehiculo_serial is not null and v_sol.vehiculo_serial <> '' then
      insert into repuestos.historial_vehiculo (serial, tipo_evento, descripcion, fuente, trabajo_id)
      values (v_sol.vehiculo_serial, 'trabajo_rta',
        'Trabajo cerrado por taller avalado — ' || coalesce(new.observaciones_texto, 'sin observaciones'),
        'ruedda_repuestos', new.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_trabajo_emitido on repuestos.trabajos_rta;
create trigger trg_trabajo_emitido before update of estado on repuestos.trabajos_rta
for each row execute function repuestos.tg_trabajo_emitido();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table repuestos.mechanic_references   enable row level security;
alter table repuestos.mechanic_specialties  enable row level security;
alter table repuestos.avales                enable row level security;
alter table repuestos.acuerdos_firmados     enable row level security;
alter table repuestos.solicitudes_rta       enable row level security;
alter table repuestos.presupuestos_rta      enable row level security;
alter table repuestos.trabajos_rta          enable row level security;
alter table repuestos.ampliaciones_rta      enable row level security;
alter table repuestos.repuestos_usados_rta  enable row level security;
alter table repuestos.recomendados_rta      enable row level security;
alter table repuestos.derivaciones_rta      enable row level security;
alter table repuestos.garantias_rta         enable row level security;
alter table repuestos.disputas_rta          enable row level security;
alter table repuestos.historial_vehiculo    enable row level security;
alter table repuestos.informes_rta          enable row level security;
alter table repuestos.precios_referencia    enable row level security;

-- catalogos fijos (especialidades, segmentos, servicios, zonas): de solo
-- lectura publica, pero CON RLS encendido y una policy explicita — dejarlos
-- sin RLS los deja completamente abiertos a cualquier grant futuro sin
-- ningun control, que es exactamente lo que el linter de Supabase avisa.
alter table repuestos.especialidades enable row level security;
alter table repuestos.segmentos      enable row level security;
alter table repuestos.servicios_rta  enable row level security;
alter table repuestos.zonas          enable row level security;

create policy "catalogo publico: especialidades" on repuestos.especialidades for select using (true);
create policy "catalogo publico: segmentos"      on repuestos.segmentos      for select using (true);
create policy "catalogo publico: servicios_rta"  on repuestos.servicios_rta  for select using (true);
create policy "catalogo publico: zonas"          on repuestos.zonas          for select using (true);

grant select on repuestos.especialidades, repuestos.segmentos, repuestos.servicios_rta,
  repuestos.zonas, repuestos.precios_referencia, repuestos.mechanic_specialties, repuestos.avales
  to anon, authenticated;

create or replace function repuestos.is_mechanic_owner(p_mechanic_id uuid)
returns boolean language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select exists (select 1 from repuestos.mechanics m where m.id = p_mechanic_id and m.user_id = auth.uid());
$$;
grant execute on function repuestos.is_mechanic_owner(uuid) to anon, authenticated;

create policy "el mecanico ve sus propias referencias/admin" on repuestos.mechanic_references
  for select using (repuestos.is_mechanic_owner(mechanic_id) or repuestos.is_admin());

create policy "cliente ve su solicitud, mecanico asignado, admin" on repuestos.solicitudes_rta
  for select using (
    cliente_id = auth.uid() or repuestos.is_admin()
    or exists (select 1 from repuestos.presupuestos_rta p where p.solicitud_id = id and repuestos.is_mechanic_owner(p.mechanic_id))
    or (cliente_id is null) -- solicitud de invitado: visible para mecanicos activos (filtrado ya en el RPC de listado)
  );

create policy "presupuesto visible para el cliente de la solicitud y el mecanico" on repuestos.presupuestos_rta
  for select using (
    repuestos.is_mechanic_owner(mechanic_id) or repuestos.is_admin()
    or exists (select 1 from repuestos.solicitudes_rta s where s.id = solicitud_id and s.cliente_id = auth.uid())
  );

create policy "trabajo visible para el mecanico dueno, el cliente y admin" on repuestos.trabajos_rta
  for select using (
    repuestos.is_mechanic_owner(mechanic_id) or repuestos.is_admin()
    or exists (select 1 from repuestos.solicitudes_rta s where s.id = solicitud_id and s.cliente_id = auth.uid())
  );

create policy "historial visible para todos (autenticados) — es el punto" on repuestos.historial_vehiculo
  for select using (auth.role() = 'authenticated' or repuestos.is_admin());

-- el resto (mechanic_specialties insert, avales, acuerdos, presupuestos,
-- ampliaciones, cierre de trabajo, garantias, disputas) se escribe SIEMPRE
-- por RPC (ver 11_rta_rpc.sql) — nunca insert/update directo del cliente.
revoke insert, update, delete on
  repuestos.mechanic_references, repuestos.mechanic_specialties, repuestos.avales,
  repuestos.acuerdos_firmados, repuestos.solicitudes_rta, repuestos.presupuestos_rta,
  repuestos.trabajos_rta, repuestos.ampliaciones_rta, repuestos.repuestos_usados_rta,
  repuestos.recomendados_rta, repuestos.derivaciones_rta, repuestos.garantias_rta,
  repuestos.disputas_rta, repuestos.historial_vehiculo, repuestos.informes_rta,
  repuestos.precios_referencia
from anon, authenticated;
