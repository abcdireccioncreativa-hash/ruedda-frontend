-- ============================================================================
-- RUEDDA REPUESTOS · 11_rta_rpc.sql
-- RPCs de la vertical RTA (10_rta_mecanicos.sql). Corre esto despues.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CLIENTE: crear solicitud (con o sin cuenta)
-- ---------------------------------------------------------------------------
create or replace function repuestos.create_solicitud_rta(
  p_sintoma text, p_especialidad_id text, p_vehiculo_desc text, p_vehiculo_serial text,
  p_segmento_id text, p_modalidad repuestos.modalidad_atencion, p_urgencia repuestos.urgencia,
  p_zona text, p_guest_phone text
) returns repuestos.solicitudes_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.solicitudes_rta%rowtype;
begin
  if auth.uid() is null and (p_guest_phone is null or length(trim(p_guest_phone)) < 10) then
    raise exception 'deja un telefono de contacto';
  end if;
  insert into repuestos.solicitudes_rta
    (cliente_id, guest_phone, sintoma, especialidad_id, vehiculo_desc, vehiculo_serial,
     segmento_id, modalidad, urgencia, zona)
  values
    (auth.uid(), nullif(trim(coalesce(p_guest_phone,'')),''), p_sintoma, p_especialidad_id,
     p_vehiculo_desc, nullif(trim(coalesce(p_vehiculo_serial,'')),''),
     p_segmento_id, p_modalidad, p_urgencia, p_zona)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.create_solicitud_rta
  (text, text, text, text, text, repuestos.modalidad_atencion, repuestos.urgencia, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- MECANICO: ver solicitudes que le calzan (su especialidad avalada/declarada,
-- abiertas), mandar presupuesto
-- ---------------------------------------------------------------------------
create or replace function repuestos.list_solicitudes_for_mechanic(p_mechanic_id uuid)
returns setof repuestos.solicitudes_rta
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select s.* from repuestos.solicitudes_rta s
  where s.estado = 'abierta'
    and repuestos.is_mechanic_owner(p_mechanic_id)
    and exists (
      select 1 from repuestos.mechanic_specialties ms
      where ms.mechanic_id = p_mechanic_id and ms.especialidad_id = s.especialidad_id
    )
  order by s.created_at desc
  limit 50;
$$;
grant execute on function repuestos.list_solicitudes_for_mechanic(uuid) to authenticated;

create or replace function repuestos.submit_presupuesto_rta(
  p_solicitud_id uuid, p_mechanic_id uuid, p_mano_obra_usd numeric,
  p_repuestos_json jsonb, p_cobro repuestos.presupuesto_cobro, p_cargo_visita_usd numeric
) returns repuestos.presupuestos_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_repuestos_total numeric; v_row repuestos.presupuestos_rta%rowtype;
begin
  if not repuestos.is_mechanic_owner(p_mechanic_id) then raise exception 'no autorizado'; end if;
  select coalesce(sum((r->>'precio_usd')::numeric), 0) into v_repuestos_total
  from jsonb_array_elements(coalesce(p_repuestos_json, '[]'::jsonb)) r;

  insert into repuestos.presupuestos_rta
    (solicitud_id, mechanic_id, mano_obra_usd, repuestos_json, total_usd, cobro, cargo_visita_usd)
  values
    (p_solicitud_id, p_mechanic_id, p_mano_obra_usd, coalesce(p_repuestos_json, '[]'::jsonb),
     p_mano_obra_usd + v_repuestos_total + coalesce(p_cargo_visita_usd, 0), p_cobro, coalesce(p_cargo_visita_usd, 0))
  returning * into v_row;

  update repuestos.solicitudes_rta set estado = 'presupuestada' where id = p_solicitud_id and estado = 'abierta';

  perform repuestos.notify(
    (select cliente_id from repuestos.solicitudes_rta where id = p_solicitud_id),
    'Te llego un presupuesto', 'Un mecanico avalado ya te mando presupuesto por escrito.',
    'presupuesto_rta', v_row.id, 'solicitud_rta'
  );
  return v_row;
end $$;
grant execute on function repuestos.submit_presupuesto_rta
  (uuid, uuid, numeric, jsonb, repuestos.presupuesto_cobro, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- CLIENTE: aprobar presupuesto -> crea el trabajo (en_proceso)
-- ---------------------------------------------------------------------------
create or replace function repuestos.approve_presupuesto_rta(p_presupuesto_id uuid)
returns repuestos.trabajos_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_p repuestos.presupuestos_rta%rowtype; v_s repuestos.solicitudes_rta%rowtype; v_t repuestos.trabajos_rta%rowtype;
begin
  select * into v_p from repuestos.presupuestos_rta where id = p_presupuesto_id;
  if v_p.id is null then raise exception 'presupuesto no encontrado'; end if;
  select * into v_s from repuestos.solicitudes_rta where id = v_p.solicitud_id;
  if v_s.cliente_id is distinct from auth.uid() then raise exception 'no autorizado'; end if;

  update repuestos.presupuestos_rta set aprobado = true where id = p_presupuesto_id;
  update repuestos.solicitudes_rta set estado = 'aprobada' where id = v_s.id;

  insert into repuestos.trabajos_rta (solicitud_id, presupuesto_id, mechanic_id, modalidad)
  values (v_s.id, v_p.id, v_p.mechanic_id, v_s.modalidad)
  returning * into v_t;

  perform repuestos.notify(
    (select user_id from repuestos.mechanics where id = v_p.mechanic_id),
    'Presupuesto aprobado', 'El cliente aprobo tu presupuesto — ya puedes empezar.',
    'trabajo_rta', v_t.id, 'trabajo_rta'
  );
  return v_t;
end $$;
grant execute on function repuestos.approve_presupuesto_rta(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- MECANICO: cerrar el trabajo (formulario de cierre + checklist)
-- ---------------------------------------------------------------------------
create or replace function repuestos.close_trabajo_rta(
  p_trabajo_id uuid, p_completado text, p_motivo_incompleto text, p_km_entrega integer,
  p_checklist jsonb, p_observaciones text, p_repuestos_usados jsonb
) returns repuestos.trabajos_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_t repuestos.trabajos_rta%rowtype; r jsonb;
begin
  select * into v_t from repuestos.trabajos_rta where id = p_trabajo_id;
  if v_t.id is null or not repuestos.is_mechanic_owner(v_t.mechanic_id) then raise exception 'no autorizado'; end if;

  update repuestos.trabajos_rta set
    completado = p_completado, motivo_incompleto = p_motivo_incompleto, km_entrega = p_km_entrega,
    checklist_respuestas = coalesce(p_checklist, '{}'::jsonb), observaciones_texto = p_observaciones,
    estado = 'emitido'
  where id = p_trabajo_id
  returning * into v_t;

  for r in select * from jsonb_array_elements(coalesce(p_repuestos_usados, '[]'::jsonb)) loop
    insert into repuestos.repuestos_usados_rta (trabajo_id, descripcion, marca, origen, precio_usd)
    values (p_trabajo_id, r->>'descripcion', r->>'marca',
      coalesce((r->>'origen')::repuestos.origen_repuesto, 'nuevo'), coalesce((r->>'precio_usd')::numeric, 0));
  end loop;

  perform repuestos.notify(
    (select cliente_id from repuestos.solicitudes_rta where id = v_t.solicitud_id),
    'Tu trabajo quedo listo', 'El mecanico cerro el trabajo. Ya puedes calificarlo.',
    'trabajo_emitido', v_t.id, 'trabajo_rta'
  );
  return v_t;
end $$;
grant execute on function repuestos.close_trabajo_rta(uuid, text, text, integer, jsonb, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- AMPLIACION: el mecanico la propone, el cliente decide
-- ---------------------------------------------------------------------------
create or replace function repuestos.submit_ampliacion_rta(p_trabajo_id uuid, p_motivo text, p_foto_url text, p_monto numeric)
returns repuestos.ampliaciones_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_t repuestos.trabajos_rta%rowtype; v_row repuestos.ampliaciones_rta%rowtype;
begin
  select * into v_t from repuestos.trabajos_rta where id = p_trabajo_id;
  if v_t.id is null or not repuestos.is_mechanic_owner(v_t.mechanic_id) then raise exception 'no autorizado'; end if;
  if p_foto_url is null or trim(p_foto_url) = '' then raise exception 'la foto es obligatoria'; end if;

  insert into repuestos.ampliaciones_rta (trabajo_id, motivo, foto_url, monto_usd)
  values (p_trabajo_id, p_motivo, p_foto_url, p_monto)
  returning * into v_row;

  perform repuestos.notify(
    (select cliente_id from repuestos.solicitudes_rta where id = v_t.solicitud_id),
    'El mecanico encontro algo mas', 'Hay una ampliacion de presupuesto esperando tu aprobacion.',
    'ampliacion_rta', v_row.id, 'ampliacion_rta'
  );
  return v_row;
end $$;
grant execute on function repuestos.submit_ampliacion_rta(uuid, text, text, numeric) to authenticated;

create or replace function repuestos.resolve_ampliacion_rta(p_ampliacion_id uuid, p_aprobar boolean)
returns repuestos.ampliaciones_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_a repuestos.ampliaciones_rta%rowtype; v_t repuestos.trabajos_rta%rowtype; v_s repuestos.solicitudes_rta%rowtype;
begin
  select * into v_a from repuestos.ampliaciones_rta where id = p_ampliacion_id;
  select * into v_t from repuestos.trabajos_rta where id = v_a.trabajo_id;
  select * into v_s from repuestos.solicitudes_rta where id = v_t.solicitud_id;
  if v_s.cliente_id is distinct from auth.uid() then raise exception 'no autorizado'; end if;

  update repuestos.ampliaciones_rta set aprobada = p_aprobar, resuelta_at = now()
  where id = p_ampliacion_id returning * into v_a;
  return v_a;
end $$;
grant execute on function repuestos.resolve_ampliacion_rta(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- ADMIN / CONSEJO TECNICO: alta y aval de mecanicos
-- ---------------------------------------------------------------------------
create or replace function repuestos.admin_upsert_mechanic_rta(
  p_id uuid, p_name text, p_phone text, p_zone text, p_tipo repuestos.mechanic_kind,
  p_rif text, p_direccion text, p_zonas_cobertura text[]
) returns repuestos.mechanics
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.mechanics%rowtype;
begin
  if not repuestos.is_admin() then raise exception 'no autorizado'; end if;
  if p_id is null then
    insert into repuestos.mechanics (name, phone, zone, tipo, rif, direccion, zonas_cobertura, stage)
    values (p_name, p_phone, p_zone, p_tipo, p_rif, p_direccion, coalesce(p_zonas_cobertura, '{}'), 'verificacion')
    returning * into v_row;
  else
    update repuestos.mechanics set
      name = p_name, phone = p_phone, zone = p_zone, tipo = p_tipo, rif = p_rif,
      direccion = p_direccion, zonas_cobertura = coalesce(p_zonas_cobertura, '{}')
    where id = p_id returning * into v_row;
  end if;
  return v_row;
end $$;
grant execute on function repuestos.admin_upsert_mechanic_rta
  (uuid, text, text, text, repuestos.mechanic_kind, text, text, text[]) to authenticated;

create or replace function repuestos.admin_set_mechanic_stage(p_mechanic_id uuid, p_stage repuestos.mechanic_stage)
returns repuestos.mechanics
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.mechanics%rowtype;
begin
  if not repuestos.is_admin() then raise exception 'no autorizado'; end if;
  update repuestos.mechanics set stage = p_stage,
    verified = (p_stage in ('verificado','avalado','maestro')),
    authorized = (p_stage in ('avalado','maestro'))
  where id = p_mechanic_id returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.admin_set_mechanic_stage(uuid, repuestos.mechanic_stage) to authenticated;

create or replace function repuestos.admin_declare_specialty(p_mechanic_id uuid, p_especialidad_id text, p_equipo text)
returns repuestos.mechanic_specialties
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.mechanic_specialties%rowtype;
begin
  if not (repuestos.is_admin() or repuestos.is_mechanic_owner(p_mechanic_id)) then raise exception 'no autorizado'; end if;
  insert into repuestos.mechanic_specialties (mechanic_id, especialidad_id, equipo_declarado, estado)
  values (p_mechanic_id, p_especialidad_id, p_equipo, 'declarada')
  on conflict (mechanic_id, especialidad_id) do update set equipo_declarado = excluded.equipo_declarado
  returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.admin_declare_specialty(uuid, text, text) to authenticated;

create or replace function repuestos.admin_avalar_especialidad(
  p_mechanic_id uuid, p_especialidad_id text, p_instructor text, p_anio_sello smallint
) returns repuestos.avales
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.avales%rowtype;
begin
  if not repuestos.is_admin() then raise exception 'no autorizado'; end if;

  insert into repuestos.avales (mechanic_id, especialidad_id, instructor, vence_en, anio_sello)
  values (p_mechanic_id, p_especialidad_id, p_instructor, now() + interval '1 year', p_anio_sello)
  returning * into v_row;

  update repuestos.mechanic_specialties set estado = 'avalada'
  where mechanic_id = p_mechanic_id and especialidad_id = p_especialidad_id;

  update repuestos.mechanics set stage = 'avalado'
  where id = p_mechanic_id and stage in ('verificado','verificacion');

  return v_row;
end $$;
grant execute on function repuestos.admin_avalar_especialidad(uuid, text, text, smallint) to authenticated;

create or replace function repuestos.sign_acuerdo_rta(p_mechanic_id uuid, p_ip text)
returns repuestos.acuerdos_firmados
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.acuerdos_firmados%rowtype;
begin
  if not repuestos.is_mechanic_owner(p_mechanic_id) then raise exception 'no autorizado'; end if;
  insert into repuestos.acuerdos_firmados (mechanic_id, ip) values (p_mechanic_id, p_ip) returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.sign_acuerdo_rta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- DISPUTAS
-- ---------------------------------------------------------------------------
create or replace function repuestos.open_disputa_rta(p_trabajo_id uuid, p_evidencia text)
returns repuestos.disputas_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.disputas_rta%rowtype;
begin
  insert into repuestos.disputas_rta (trabajo_id, abierta_por, evidencia)
  values (p_trabajo_id, auth.uid(), p_evidencia) returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.open_disputa_rta(uuid, text) to authenticated;

create or replace function repuestos.resolve_disputa_rta(p_disputa_id uuid, p_estado repuestos.disputa_estado, p_decision text)
returns repuestos.disputas_rta
language plpgsql security definer
set search_path = repuestos, pg_catalog as $$
declare v_row repuestos.disputas_rta%rowtype;
begin
  if not repuestos.is_admin() then raise exception 'no autorizado'; end if;
  update repuestos.disputas_rta set estado = p_estado, decision = p_decision,
    decidido_por = auth.uid(), resuelta_at = now()
  where id = p_disputa_id returning * into v_row;
  return v_row;
end $$;
grant execute on function repuestos.resolve_disputa_rta(uuid, repuestos.disputa_estado, text) to authenticated;

-- ---------------------------------------------------------------------------
-- lectura de conveniencia para el cliente (sus propias solicitudes/trabajos)
-- ---------------------------------------------------------------------------
create or replace function repuestos.my_solicitudes_rta()
returns setof repuestos.solicitudes_rta
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select * from repuestos.solicitudes_rta where cliente_id = auth.uid() order by created_at desc limit 50;
$$;
grant execute on function repuestos.my_solicitudes_rta() to authenticated;

create or replace function repuestos.list_presupuestos_for_solicitud(p_solicitud_id uuid)
returns setof repuestos.presupuestos_rta
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select p.* from repuestos.presupuestos_rta p
  join repuestos.solicitudes_rta s on s.id = p.solicitud_id
  where p.solicitud_id = p_solicitud_id and (s.cliente_id = auth.uid() or repuestos.is_admin())
  order by p.created_at asc;
$$;
grant execute on function repuestos.list_presupuestos_for_solicitud(uuid) to authenticated;

create or replace function repuestos.my_mechanic_profile()
returns repuestos.mechanics
language sql stable security definer
set search_path = repuestos, pg_catalog as $$
  select * from repuestos.mechanics where user_id = auth.uid() limit 1;
$$;
grant execute on function repuestos.my_mechanic_profile() to authenticated;
