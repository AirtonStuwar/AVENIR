-- A Rendir: subir/reemplazar el documento sustento general cuando la solicitud ya esta EVALUADA (2026-11)
-- Antes el dueño solo podia hacerlo en Pendiente/Aprobado/Pagado/Observado. En Evaluado la policy UPDATE de
-- solicitud_arendir no deja al dueño tocar la cabecera, y no se abre esa policy (dejaria editar todo):
-- se usa una funcion que SOLO toca documento_sustento_path. Pegar completo en el SQL Editor de Supabase.

create or replace function public.registrar_sustento_arendir(p_id bigint, p_path text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado text;
  v_dueno uuid;
begin
  if auth.uid() is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_path is null or btrim(p_path) = '' then
    raise exception 'Ruta del documento vacia';
  end if;

  select estado, beneficiario_id into v_estado, v_dueno
  from public.solicitud_arendir where id = p_id;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  -- Solo el dueño o un ADMIN (rol 1)
  if v_dueno is distinct from auth.uid()
     and not exists (select 1 from public.usuario_rol ur where ur.usuario = auth.uid() and ur.rol = 1) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_estado <> 'Evaluado' then
    raise exception 'Solo se puede usar con la solicitud en estado Evaluado (esta en %)', v_estado;
  end if;

  update public.solicitud_arendir set documento_sustento_path = p_path where id = p_id;
end;
$function$;

revoke all on function public.registrar_sustento_arendir(bigint, text) from public, anon;
grant execute on function public.registrar_sustento_arendir(bigint, text) to authenticated;
