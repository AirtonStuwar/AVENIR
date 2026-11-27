-- Finanzas: "Pagado realmente" por mes (dinero que salió, en la fecha en que salió).
-- Solo lectura: crea una función nueva; no modifica datos ni la función anterior get_finanzas_egresos.
--
-- Conceptos que devuelve (columna `concepto`):
--   Cuentan como pagado:  Proveedores (neto), Confirming repuesto, Detracciones (fecha de depósito),
--                         A rendir (adelanto), Reembolsos, Caja chica (gastos reembolsados), Devoluciones
--   Aparte, no suman:     Confirming sin reponer, Total de facturas (para comparar), Por pagar

create or replace function public.get_finanzas_pagos()
returns jsonb   -- un solo valor JSON: así no lo recorta el límite de 1000 filas de la API
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- ADMIN (1), APROBADOR (9) y FINANZAS (12): lee datos de todas las empresas y módulos
  if not exists (select 1 from public.usuario_rol ur where ur.usuario = auth.uid() and ur.rol in (1, 9, 12)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return (
  with cat as (
    select x.grp, regexp_replace(trim(x.nombre), '^[0-9]+\.\s*', '') as nombre
    from (
      select distinct on (t.grp) t.grp, t.nombre
      from (
        select (substring(pc.partida_presupuestal from '^P([0-9]+)[0-9]{2}$'))::int as grp,
               pc.partida_presupuesta_n1 as nombre,
               count(*) as c
        from public.plan_contable_brash pc
        where pc.partida_presupuestal is not null and pc.partida_presupuesta_n1 is not null
        group by 1, 2
      ) t
      order by t.grp, t.c desc
    ) x
  ),
  v as (
    select g.ref_id, coalesce(g.empresa, '(sin empresa)') as empresa, g.moneda, g.tipo, g.estado, g.fecha_pago,
           (substring(g.partida_presupuestal from '^P([0-9]+)[0-9]{2}$'))::int as grp,
           (case when g.moneda = 'USD' then g.monto_usd else g.monto_pen end)::numeric as bruto
    from public.vista_gasto_consolidado g
  ),
  sol as (
    select v.*, s.id as solicitud_id, s.detraccion_pagada, s.fecha_pago_detraccion,
           coalesce(s.monto_detraccion, 0)::numeric as detraccion,
           -- Detracción descontada al proveedor, en la moneda del documento
           case when s.detraccion_id is null then 0
                when v.moneda = 'PEN' then coalesce(s.monto_detraccion, 0)::numeric
                else v.bruto * d.porcentaje::numeric / 100
           end as detraccion_doc,
           coalesce(s.monto_retencion, 0)::numeric as retencion,
           coalesce(s.monto_fondo_garantia, 0)::numeric as fondo,
           exists (select 1 from public.solicitud_pago sp where sp.solicitud_id = s.id) as en_partes
    from v
    join public.solicitud s on v.ref_id = 'solicitud-' || s.id
    left join public.detraccion d on d.id = s.detraccion_id
  ),
  partes as (
    select sol.empresa, sol.moneda, sol.grp, sp.monto::numeric as importe, sp.medio_pago,
           sp.fecha_pago as fecha, sp.confirming_pagado_fecha as repuesto
    from sol
    join public.solicitud_pago sp on sp.solicitud_id = sol.solicitud_id
  ),
  mov(m_concepto, m_empresa, m_moneda, m_grp, m_fecha, m_monto) as (
    -- Solicitudes pagadas de una sola vez: neto al proveedor
    select 'Proveedores'::text, s.empresa, s.moneda, s.grp, s.fecha_pago,
           s.bruto - s.detraccion_doc - s.retencion - s.fondo
    from sol s where s.fecha_pago is not null and not s.en_partes
    union all
    -- Solicitudes pagadas en partes: cada transferencia en su fecha
    select 'Proveedores', p.empresa, p.moneda, p.grp, p.fecha, p.importe
    from partes p where p.medio_pago = 'Transferencia'
    union all
    select 'Confirming repuesto', p.empresa, p.moneda, p.grp, p.repuesto, p.importe
    from partes p where p.medio_pago = 'Confirming' and p.repuesto is not null
    union all
    select 'Confirming sin reponer', p.empresa, p.moneda, p.grp, p.fecha, p.importe
    from partes p where p.medio_pago = 'Confirming' and p.repuesto is null
    union all
    -- La detracción siempre se deposita en soles
    select 'Detracciones', s.empresa, 'PEN', s.grp, s.fecha_pago_detraccion, s.detraccion
    from sol s where s.detraccion_pagada and s.fecha_pago_detraccion is not null and s.detraccion > 0
    union all
    select 'A rendir', v.empresa, v.moneda, v.grp, v.fecha_pago, a.importe::numeric
    from v join public.solicitud_arendir a on v.ref_id = 'arendir-' || a.id
    where v.fecha_pago is not null
    union all
    select 'Reembolsos', v.empresa, v.moneda, v.grp, v.fecha_pago, v.bruto
    from v where v.tipo = 'Reembolso' and v.fecha_pago is not null
    union all
    -- Caja chica: al marcarla pagada se reembolsan sus gastos (pendiente a reembolsar)
    select 'Caja chica', v.empresa, v.moneda, v.grp, v.fecha_pago, v.bruto
    from v where v.tipo = 'Caja Chica' and v.fecha_pago is not null
    union all
    select 'Devoluciones', v.empresa, v.moneda, v.grp, v.fecha_pago, v.bruto
    from v where v.tipo = 'Devolución' and v.fecha_pago is not null
    union all
    -- Solo para comparar: total de los documentos marcados como pagados
    select 'Total de facturas', v.empresa, v.moneda, v.grp, v.fecha_pago, coalesce(a.importe::numeric, v.bruto)
    from v left join public.solicitud_arendir a on v.ref_id = 'arendir-' || a.id
    where v.fecha_pago is not null
    union all
    -- Pendiente al día de hoy (se descuenta lo que ya se haya pagado en partes)
    select 'Por pagar', v.empresa, v.moneda, v.grp, null::date,
           coalesce(a.importe::numeric, v.bruto)
             - coalesce((select sum(sp.monto) from public.solicitud_pago sp
                         where v.ref_id = 'solicitud-' || sp.solicitud_id), 0)
    from v left join public.solicitud_arendir a on v.ref_id = 'arendir-' || a.id
    where v.fecha_pago is null and v.estado in ('Aprobado', 'Autorizado')
  )
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  from (
    select to_char(m.m_fecha, 'YYYY-MM') as mes, m.m_empresa as empresa, m.m_moneda as moneda,
           coalesce(c.nombre, 'Sin plan contable') as categoria, m.m_concepto as concepto,
           count(*)::bigint as registros, sum(round(m.m_monto, 2)) as monto
    from mov m
    left join cat c on c.grp = m.m_grp
    where m.m_concepto = 'Por pagar' or m.m_fecha is not null
    group by 1, 2, 3, 4, 5
  ) r
  );
end;
$function$;

revoke all on function public.get_finanzas_pagos() from public, anon;
grant execute on function public.get_finanzas_pagos() to authenticated;
