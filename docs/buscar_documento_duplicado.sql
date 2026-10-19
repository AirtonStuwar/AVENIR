-- Aviso de N° de documento duplicado entre Solicitudes, Caja Chica, A Rendir y Reembolso.
-- Pegar completo en Supabase > SQL Editor y ejecutar. Es de solo lectura (no modifica datos).
-- (norm_doc ya está aplicada; este script solo reemplaza la función de búsqueda, que quedó con un error de tipos.)

drop function if exists public.buscar_documento_duplicado(text, text, integer);

create or replace function public.buscar_documento_duplicado(p_numero text, p_modulo text default null, p_excluir_id bigint default null)
returns table(modulo text, registro_id bigint, codigo text, proveedor text, monto numeric, moneda text, estado text)
language plpgsql security definer set search_path = public
as $$
declare n text := public.norm_doc(p_numero);
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if n is null or length(n) < 3 then return; end if;

  return query
  select 'Solicitud'::text, s.id::bigint, s.codigo::text, s.razon_social::text, null::numeric, s.moneda::text, e.nombre::text
  from solicitud s join estado_soli e on e.id = s.estado_id
  where public.norm_doc(s.numero_factura) = n
    and e.nombre not in ('Rechazado','Cancelado')
    and not (p_modulo = 'solicitud' and p_excluir_id = s.id)
  union all
  select 'Caja Chica', d.id::bigint, c.codigo::text, d.proveedor::text, d.monto::numeric, 'PEN', c.estado::text
  from caja_chica_detalle d join caja_chica c on c.id = d.caja_chica_id
  where public.norm_doc(d.numero_documento) = n
    and c.estado not in ('Rechazado','Cancelado')
    and not (p_modulo = 'caja_chica' and p_excluir_id = d.id)
  union all
  select 'A Rendir', d.id::bigint, a.codigo::text, d.proveedor::text, d.importe::numeric, a.moneda::text, a.estado::text
  from solicitud_arendir_detalle d join solicitud_arendir a on a.id = d.solicitud_arendir_id
  where public.norm_doc(d.numero_documento) = n
    and a.estado not in ('Rechazado','Cancelado')
    and not (p_modulo = 'arendir' and p_excluir_id = d.id)
  union all
  select 'Reembolso', d.id::bigint, r.codigo::text, d.proveedor::text, d.importe::numeric, r.moneda::text, r.estado::text
  from solicitud_reembolso_detalle d join solicitud_reembolso r on r.id = d.solicitud_reembolso_id
  where public.norm_doc(d.numero_documento) = n
    and r.estado not in ('Rechazado','Cancelado')
    and not (p_modulo = 'reembolso' and p_excluir_id = d.id)
  limit 10;
end $$;

revoke all on function public.buscar_documento_duplicado(text, text, bigint) from public, anon;
grant execute on function public.buscar_documento_duplicado(text, text, bigint) to authenticated;
