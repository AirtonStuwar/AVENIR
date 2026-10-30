-- Programar la aprobacion de una solicitud Evaluada para un mes posterior (2026-10)
-- El aprobador no quiere aprobarla este mes: la solicitud NO cambia de estado (sigue Evaluada),
-- solo guarda "aprobar desde el mes X". Pegar completo en el SQL Editor de Supabase.

-- 1) Columnas
alter table public.solicitud
  add column if not exists aprobar_desde date,
  add column if not exists programacion_motivo text,
  add column if not exists programacion_usuario uuid,
  add column if not exists programacion_fecha timestamptz;

alter table public.solicitud drop constraint if exists solicitud_aprobar_desde_mes_chk;
alter table public.solicitud add constraint solicitud_aprobar_desde_mes_chk
  check (aprobar_desde is null or extract(day from aprobar_desde) = 1);

-- 2) Reglas: solo APROBADOR/ADMIN programa; solo una solicitud Evaluada; el mes debe ser posterior al actual;
--    la programacion se limpia sola si la solicitud cambia de estado (aprobada, rechazada, devuelta...).
create or replace function public.fn_programacion_validar()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_evaluado int;
begin
  if NEW.estado_id is distinct from OLD.estado_id then
    NEW.aprobar_desde := null; NEW.programacion_motivo := null; NEW.programacion_usuario := null; NEW.programacion_fecha := null;
    return NEW;
  end if;
  if NEW.aprobar_desde is distinct from OLD.aprobar_desde then
    if auth.uid() is not null and not exists (select 1 from usuario_rol where usuario = auth.uid() and rol in (1,9)) then
      raise exception 'Solo el aprobador puede programar la aprobación' using errcode = '42501';
    end if;
    if NEW.aprobar_desde is not null then
      select id into v_evaluado from estado_soli where nombre = 'Evaluado';
      if NEW.estado_id is distinct from v_evaluado then
        raise exception 'Solo se puede programar una solicitud Evaluada';
      end if;
      if NEW.aprobar_desde <= (now() at time zone 'America/Lima')::date then
        raise exception 'El mes programado debe ser posterior al mes actual';
      end if;
      NEW.programacion_usuario := auth.uid();
      NEW.programacion_fecha := now();
    else
      NEW.programacion_motivo := null; NEW.programacion_usuario := null; NEW.programacion_fecha := null;
    end if;
  end if;
  return NEW;
end $function$;

drop trigger if exists trg_solicitud_programacion_validar on public.solicitud;
create trigger trg_solicitud_programacion_validar
  before update on public.solicitud for each row execute function public.fn_programacion_validar();

-- 3) Bitacora: queda quien programo, para que mes y por que (o que se quito la programacion)
create or replace function public.fn_bitacora_programacion()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
begin
  if NEW.estado_id is not distinct from OLD.estado_id and NEW.aprobar_desde is distinct from OLD.aprobar_desde then
    if NEW.aprobar_desde is not null then
      insert into bitacora_evento (modulo, registro_id, tipo, usuario_id, fecha, comentario, detalle)
      values ('solicitud', NEW.id, 'programacion', auth.uid(), now(),
              left(nullif(trim(coalesce(NEW.programacion_motivo, '')), ''), 500),
              'Aprobación programada para ' || meses[extract(month from NEW.aprobar_desde)::int] || ' ' || extract(year from NEW.aprobar_desde)::int);
    elsif coalesce(current_setting('app.programacion_auto', true), '') <> 'on' then
      insert into bitacora_evento (modulo, registro_id, tipo, usuario_id, fecha, detalle)
      values ('solicitud', NEW.id, 'programacion', auth.uid(), now(),
              'Programación quitada (estaba para ' || meses[extract(month from OLD.aprobar_desde)::int] || ' ' || extract(year from OLD.aprobar_desde)::int || ')');
    end if;
  end if;
  return NEW;
exception when others then
  return NEW;
end $function$;

drop trigger if exists trg_solicitud_programacion_bitacora on public.solicitud;
create trigger trg_solicitud_programacion_bitacora
  after update of aprobar_desde, estado_id on public.solicitud for each row execute function public.fn_bitacora_programacion();

-- 4) Cuando llega el mes, la solicitud vuelve sola a la cola normal del aprobador y se le avisa en la campanita.
--    Se ejecuta una vez al dia (paso 5); no es llamable desde la app.
create or replace function public.procesar_programacion_aprobacion()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare r record; n int := 0; v_evaluado int; v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  select id into v_evaluado from estado_soli where nombre = 'Evaluado';
  perform set_config('app.programacion_auto', 'on', true);
  for r in select id from solicitud where aprobar_desde is not null and aprobar_desde <= v_hoy and estado_id = v_evaluado loop
    update solicitud set aprobar_desde = null, programacion_motivo = null, programacion_usuario = null, programacion_fecha = null where id = r.id;
    insert into bitacora_evento (modulo, registro_id, tipo, usuario_id, fecha, detalle)
    values ('solicitud', r.id, 'programacion', null, now(), 'Llegó el mes programado: vuelve a la cola de aprobación');
    n := n + 1;
  end loop;
  perform set_config('app.programacion_auto', 'off', true);
  if n > 0 then
    insert into notificacion (usuario_id, titulo, mensaje, ruta, modulo)
    select distinct ur.usuario, 'Programadas para este mes',
           case when n = 1 then '1 solicitud que se programó para este mes ya está en tu cola de aprobación.'
                else n || ' solicitudes que se programaron para este mes ya están en tu cola de aprobación.' end,
           '/solicitudes', 'Solicitud'
    from usuario_rol ur where ur.rol = 9;
  end if;
  return n;
end $function$;

revoke all on function public.procesar_programacion_aprobacion() from public, anon, authenticated;
revoke all on function public.fn_programacion_validar() from public, anon, authenticated;
revoke all on function public.fn_bitacora_programacion() from public, anon, authenticated;

-- 5) Tarea diaria: 08:00 hora de Lima (13:00 UTC)
create extension if not exists pg_cron;
select cron.schedule('programadas-aprobacion', '0 13 * * *', $$select public.procesar_programacion_aprobacion()$$);
