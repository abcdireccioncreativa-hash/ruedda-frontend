-- ============================================================================
-- RUEDDA REPUESTOS · 13_alta_gama.sql
-- ----------------------------------------------------------------------------
-- La Red RTA (10_rta_mecanicos.sql) traia 4 segmentos de vehiculo (A-D) y 9
-- especialidades pensadas para el parque automotor masivo de Venezuela. Un
-- carro aleman o exotico (BMW, Mercedes-Benz, Audi, Porsche, Land Rover,
-- Volvo, Jaguar, Mini, Lexus) no encaja ahi: necesita escaner de marca
-- (ISTA/INPA en BMW, Xentry/DAS en Mercedes, ODIS en Audi/VW, PIWIS en
-- Porsche), repuestos que casi nadie tiene en Venezuela y un mecanico que
-- de verdad se especializo en esa marca — no basta con "sabe de motor".
--
-- Por eso esto se separa en dos catalogos, igual de cerrados que los que ya
-- existen (nada de texto libre):
--   1. Un segmento nuevo 'E' (alta gama / alemanes / exoticos).
--   2. Una tabla de marcas de alta gama, y una columna en mechanics para que
--      declare cuales atiende — es una etiqueta de MARCA, ortogonal a las
--      especialidades tecnicas (un mecanico alta-gama sigue siendo de motor,
--      frenos, electrico, etc., pero certificado en esas marcas puntuales).
-- ============================================================================

insert into repuestos.segmentos (id, nombre, ejemplos) values
  ('E','Alta gama, alemanes y exoticos','BMW, Mercedes-Benz, Audi, Porsche, Land Rover, Volvo, Jaguar')
on conflict (id) do nothing;

insert into repuestos.especialidades (id, nombre, sort) values
  ('alta_gama','Alta gama / alemanes / exoticos',10)
on conflict (id) do nothing;

create table if not exists repuestos.marcas_alta_gama (
  id     text primary key,   -- 'bmw','mercedes_benz','audi','porsche','land_rover','volvo','jaguar','mini','lexus','volkswagen'
  nombre text not null,
  sort   smallint not null default 0
);
insert into repuestos.marcas_alta_gama (id, nombre, sort) values
  ('bmw','BMW',1), ('mercedes_benz','Mercedes-Benz',2), ('audi','Audi',3), ('porsche','Porsche',4),
  ('land_rover','Land Rover / Range Rover',5), ('volvo','Volvo',6), ('jaguar','Jaguar',7),
  ('mini','Mini',8), ('lexus','Lexus',9), ('volkswagen','Volkswagen',10)
on conflict (id) do nothing;

alter table repuestos.marcas_alta_gama enable row level security;
create policy "catalogo publico: marcas_alta_gama" on repuestos.marcas_alta_gama for select using (true);

alter table repuestos.mechanics
  add column if not exists marcas_atendidas text[] not null default '{}';

alter table repuestos.solicitudes_rta
  add column if not exists marca_alta_gama text references repuestos.marcas_alta_gama(id);

grant select on repuestos.marcas_alta_gama to anon, authenticated;

-- declarar/quitar marcas atendidas: mismo dueno del perfil o admin, nunca un
-- update directo de otra columna (por eso es RPC y no un update libre).
create or replace function repuestos.set_mechanic_brands(p_mechanic_id uuid, p_marcas text[])
returns repuestos.mechanics
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.mechanics%rowtype;
begin
  if not (repuestos.is_mechanic_owner(p_mechanic_id) or repuestos.is_admin()) then raise exception 'no autorizado'; end if;
  update repuestos.mechanics set marcas_atendidas = coalesce(p_marcas, '{}')
  where id = p_mechanic_id returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.set_mechanic_brands(uuid, text[]) to authenticated;

-- create_solicitud_rta gana un parametro (marca, solo aplica si segmento='E').
-- Se dropea la version de 09 porque cambia la lista de argumentos.
drop function if exists repuestos.create_solicitud_rta(text, text, text, text, text, repuestos.modalidad_atencion, repuestos.urgencia, text, text);

create or replace function repuestos.create_solicitud_rta(
  p_sintoma text, p_especialidad_id text, p_vehiculo_desc text, p_vehiculo_serial text,
  p_segmento_id text, p_modalidad repuestos.modalidad_atencion, p_urgencia repuestos.urgencia,
  p_zona text, p_guest_phone text, p_marca_alta_gama text default null
) returns repuestos.solicitudes_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.solicitudes_rta%rowtype;
begin
  if auth.uid() is null and (p_guest_phone is null or length(trim(p_guest_phone)) < 10) then
    raise exception 'deja un telefono de contacto';
  end if;
  if p_segmento_id = 'E' and (p_marca_alta_gama is null or trim(p_marca_alta_gama) = '') then
    raise exception 'para alta gama hay que indicar la marca';
  end if;
  insert into repuestos.solicitudes_rta
    (cliente_id, guest_phone, sintoma, especialidad_id, vehiculo_desc, vehiculo_serial,
     segmento_id, modalidad, urgencia, zona, marca_alta_gama)
  values
    (auth.uid(), nullif(trim(coalesce(p_guest_phone,'')),''), p_sintoma, p_especialidad_id,
     p_vehiculo_desc, nullif(trim(coalesce(p_vehiculo_serial,'')),''),
     p_segmento_id, p_modalidad, p_urgencia, p_zona, p_marca_alta_gama)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.create_solicitud_rta
  (text, text, text, text, text, repuestos.modalidad_atencion, repuestos.urgencia, text, text, text)
  to anon, authenticated;

-- solicitudes de segmento E: solo las ve un mecanico avalado en 'alta_gama'
-- que ademas declaro atender esa marca puntual — mas estricto que el resto
-- a proposito (un BMW no lo agarra cualquiera que diga "se de motor").
create or replace function repuestos.list_solicitudes_alta_gama(p_mechanic_id uuid)
returns setof repuestos.solicitudes_rta
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select s.* from repuestos.solicitudes_rta s
  join repuestos.mechanics m on m.id = p_mechanic_id
  where s.estado = 'abierta' and s.segmento_id = 'E'
    and repuestos.is_mechanic_owner(p_mechanic_id)
    and exists (
      select 1 from repuestos.mechanic_specialties ms
      where ms.mechanic_id = p_mechanic_id and ms.especialidad_id = 'alta_gama'
    )
    and (
      s.marca_alta_gama is null
      or s.marca_alta_gama = any (m.marcas_atendidas)
    )
  order by s.created_at desc limit 50;
$$;
grant execute on function repuestos.list_solicitudes_alta_gama(uuid) to authenticated;
