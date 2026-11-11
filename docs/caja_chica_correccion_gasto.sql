-- Caja Chica: corregir el tipo y N° de documento de un gasto ya registrado, dejando historial (2026-11)
-- Caso: llega la factura de un gasto que ya estaba cargado (ej. era TICKET y pasa a FACTURA F001-4567).
-- Solo se puede cambiar tipo_documento y numero_documento (nunca monto, fecha ni proveedor), con motivo obligatorio,
-- en cualquier estado salvo Rechazado/Cancelado, por el responsable de la caja o un ADMIN.
-- Cada cambio guarda el valor anterior y el nuevo en caja_chica_gasto_cambio y deja un evento en la Bitacora.
-- Pegar completo en el SQL Editor de Supabase.

create table if not exists public.caja_chica_gasto_cambio (
  id bigint generated always as identity primary key,
  caja_chica_id integer not null references public.caja_chica(id) on delete cascade,
  detalle_id integer not null,
  proveedor text,
  tipo_anterior text,
  numero_anterior text,
  tipo_nuevo text not null,
  numero_nuevo text,
  motivo text not null,
  usuario_id uuid not null default auth.uid(),
  fecha timestamptz not null default now()
);
create index if not exists caja_chica_gasto_cambio_caja_idx on public.caja_chica_gasto_cambio(caja_chica_id);

alter table public.caja_chica_gasto_cambio enable row level security;

-- Ver: quien puede ver la caja chica (la RLS de caja_chica aplica dentro del EXISTS).
-- No hay policies de INSERT/UPDATE/DELETE: el historial solo lo escribe la funcion de abajo y no se edita ni se borra.
drop policy if exists caja_chica_gasto_cambio_select on public.caja_chica_gasto_cambio;
create policy caja_chica_gasto_cambio_select on public.caja_chica_gasto_cambio for select to authenticated
  using (exists (select 1 from public.caja_chica c where c.id = caja_chica_gasto_cambio.caja_chica_id));

revoke all on public.caja_chica_gasto_cambio from public, anon, authenticated;
grant select on public.caja_chica_gasto_cambio to authenticated;

create or replace function public.corregir_documento_gasto_caja_chica(
  p_detalle_id integer, p_tipo text, p_numero text, p_motivo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caja integer; v_estado text; v_resp uuid;
  v_prov text; v_tipo_ant text; v_num_ant text;
  v_num text; v_motivo text;
begin
  if auth.uid() is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select d.caja_chica_id, c.estado, c.responsable_id, d.proveedor, d.tipo_documento, d.numero_documento
    into v_caja, v_estado, v_resp, v_prov, v_tipo_ant, v_num_ant
  from public.caja_chica_detalle d
  join public.caja_chica c on c.id = d.caja_chica_id
  where d.id = p_detalle_id
  for update of d;

  if not found then
    raise exception 'Gasto no encontrado';
  end if;

  -- Solo el responsable de la caja o un ADMIN (rol 1)
  if v_resp is distinct from auth.uid()
     and not exists (select 1 from public.usuario_rol ur where ur.usuario = auth.uid() and ur.rol = 1) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_estado in ('Rechazado', 'Cancelado') then
    raise exception 'No se puede corregir un gasto de una caja % ', lower(v_estado);
  end if;

  if p_tipo is null or p_tipo not in ('FACTURA','INVOICE','RECIBO','RECIBO POR HONORARIOS','BOLETA','PLLA-MOV','TICKET','OTRO') then
    raise exception 'Tipo de documento no valido';
  end if;

  v_num := nullif(btrim(coalesce(p_numero, '')), '');
  v_motivo := btrim(coalesce(p_motivo, ''));
  if length(v_motivo) < 3 then
    raise exception 'Indica el motivo de la correccion';
  end if;

  if p_tipo is not distinct from v_tipo_ant and v_num is not distinct from nullif(btrim(coalesce(v_num_ant, '')), '') then
    raise exception 'No hay cambios que guardar';
  end if;

  -- Solo estas dos columnas: el monto, la fecha y el proveedor no se tocan, asi los totales no se mueven
  update public.caja_chica_detalle set tipo_documento = p_tipo, numero_documento = v_num where id = p_detalle_id;

  insert into public.caja_chica_gasto_cambio
    (caja_chica_id, detalle_id, proveedor, tipo_anterior, numero_anterior, tipo_nuevo, numero_nuevo, motivo, usuario_id)
  values (v_caja, p_detalle_id, v_prov, v_tipo_ant, v_num_ant, p_tipo, v_num, v_motivo, auth.uid());

  -- Bitacora (un fallo aqui nunca bloquea la correccion)
  begin
    insert into public.bitacora_evento (modulo, registro_id, tipo, usuario_id, fecha, detalle, comentario, origen)
    values ('caja_chica', v_caja, 'gasto_corregido', auth.uid(), now(),
      format('%s: %s %s → %s %s', coalesce(v_prov, 'Gasto'),
             coalesce(v_tipo_ant, ''), coalesce(nullif(btrim(v_num_ant), ''), 's/n'),
             p_tipo, coalesce(v_num, 's/n')),
      v_motivo, 'trigger');
  exception when others then
    null;
  end;
end;
$function$;

revoke all on function public.corregir_documento_gasto_caja_chica(integer, text, text, text) from public, anon;
grant execute on function public.corregir_documento_gasto_caja_chica(integer, text, text, text) to authenticated;
