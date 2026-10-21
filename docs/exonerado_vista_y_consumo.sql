-- Operación exonerada (solicitud.monto_exonerado): la columna ya fue creada (migración solicitud_monto_exonerado).
-- Este script hace que la vista de Power BI/Finanzas y el cálculo de consumo de presupuesto sumen la operación exonerada
-- al total de los pagos a proveedores. No modifica datos: solo reemplaza la vista y la función (CREATE OR REPLACE).
-- Pegar completo en Supabase > SQL Editor y ejecutar. Las facturas antiguas tienen monto_exonerado = 0, así que no cambian.

-- 1) Función de consumo de presupuesto: agrega un tramo que suma lo exonerado una sola vez por solicitud
CREATE OR REPLACE FUNCTION public.get_consumo_proyectos(pids bigint[])
 RETURNS TABLE(scope text, ref_id bigint, moneda text, total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sol AS (
    SELECT s.id, s.proyecto_id::bigint AS proyecto_id, s.proyecto_partida_id::bigint AS partida_id,
           COALESCE(s.moneda,'PEN') AS mon,
           CASE WHEN st.nombre IN ('Recibo por Honorarios','Liberalidad','Otros') OR s.aplica_igv = false THEN 1 ELSE 1.18 END AS factor,
           CASE WHEN st.nombre IN ('Recibo por Honorarios','Liberalidad','Otros') THEN 0 ELSE COALESCE(s.monto_exonerado, 0) END AS exon
    FROM solicitud s
    JOIN estado_soli e ON e.id = s.estado_id AND e.nombre IN ('Aprobado','Observado')
    LEFT JOIN solicitud_tipo st ON st.id = s.tipo_id
    WHERE s.proyecto_id = ANY(pids)
  ),
  unioned AS (
    SELECT sol.proyecto_id, sol.partida_id, sol.mon,
           SUM(COALESCE(d.valor_total, d.cantidad * d.valor_unitario) * sol.factor) AS total
    FROM sol JOIN solicitud_detalle d ON d.solicitud_id = sol.id
    GROUP BY 1,2,3
    UNION ALL
    SELECT sol.proyecto_id, sol.partida_id, sol.mon, SUM(sol.exon) AS total
    FROM sol WHERE sol.exon <> 0
    GROUP BY 1,2,3
    UNION ALL
    SELECT proyecto_id::bigint, proyecto_partida_id::bigint, COALESCE(moneda,'PEN'),
           SUM(CASE WHEN estado = 'Aprobado' THEN importe ELSE total_reembolso END)
    FROM solicitud_arendir
    WHERE estado IN ('Aprobado','Pagado','En Revision','Cerrado','Observado') AND proyecto_id = ANY(pids)
    GROUP BY 1,2,3
    UNION ALL
    SELECT proyecto_id::bigint, proyecto_partida_id::bigint, COALESCE(moneda,'PEN'), SUM(total_reembolso)
    FROM solicitud_reembolso
    WHERE estado IN ('Autorizado','Observado') AND proyecto_id = ANY(pids)
    GROUP BY 1,2,3
    UNION ALL
    SELECT proyecto_id::bigint, NULL::bigint, 'PEN', SUM(total_gastos)
    FROM caja_chica
    WHERE estado = 'Autorizado' AND proyecto_id = ANY(pids)
    GROUP BY 1
    UNION ALL
    SELECT proyecto_id::bigint, proyecto_partida_id::bigint, COALESCE(moneda,'PEN'), SUM(monto)
    FROM devolucion_cliente
    WHERE estado IN ('Autorizado','Observado') AND proyecto_id = ANY(pids)
    GROUP BY 1,2,3
  )
  SELECT 'proyecto'::text, proyecto_id, mon, SUM(total) FROM unioned WHERE proyecto_id IS NOT NULL GROUP BY 2,3
  UNION ALL
  SELECT 'partida'::text, partida_id, mon, SUM(total) FROM unioned WHERE partida_id IS NOT NULL GROUP BY 2,3;
$function$;

-- 2) Vista consolidada (Power BI y Finanzas): solo cambian monto_pen y monto_usd de las solicitudes (suman lo exonerado)
CREATE OR REPLACE VIEW public.vista_gasto_consolidado AS
 SELECT ('solicitud-'::text || (s.id)::text) AS ref_id,
        CASE
            WHEN (st.nombre = 'Recibo por Honorarios'::text) THEN 'RxH'::text
            WHEN (st.nombre = 'Liberalidad'::text) THEN 'Liberalidad'::text
            ELSE 'OC'::text
        END AS tipo,
    s.codigo,
    es.nombre AS estado,
    p.nombre AS empresa,
    pp.nombre AS centro_costo,
    ( SELECT a.nombre
           FROM (area_usuario au
             JOIN area a ON ((a.id = au.area_id)))
          WHERE ((au.usuario_id = s.usuario_creador) AND (au.estado = 1))
         LIMIT 1) AS area,
    s.razon_social AS beneficiario,
    s.fecha_creacion,
    s.fecha_aprobacion,
    COALESCE(s.moneda, 'PEN'::text) AS moneda,
        CASE
            WHEN (COALESCE(s.moneda, 'PEN'::text) = 'PEN'::text) THEN (( SELECT COALESCE(sum(COALESCE(d.valor_total, (d.cantidad * d.valor_unitario))), (0)::numeric) AS "coalesce"
               FROM solicitud_detalle d
              WHERE (d.solicitud_id = s.id)) *
            CASE
                WHEN ((st.nombre = ANY (ARRAY['Recibo por Honorarios'::text, 'Liberalidad'::text])) OR (s.aplica_igv = false)) THEN (1)::numeric
                ELSE 1.18
            END) + (CASE WHEN (st.nombre = ANY (ARRAY['Recibo por Honorarios'::text, 'Liberalidad'::text, 'Otros'::text])) THEN (0)::numeric ELSE COALESCE(s.monto_exonerado, (0)::numeric) END)
            ELSE (0)::numeric
        END AS monto_pen,
        CASE
            WHEN (COALESCE(s.moneda, 'PEN'::text) = 'USD'::text) THEN (( SELECT COALESCE(sum(COALESCE(d.valor_total, (d.cantidad * d.valor_unitario))), (0)::numeric) AS "coalesce"
               FROM solicitud_detalle d
              WHERE (d.solicitud_id = s.id)) *
            CASE
                WHEN ((st.nombre = ANY (ARRAY['Recibo por Honorarios'::text, 'Liberalidad'::text])) OR (s.aplica_igv = false)) THEN (1)::numeric
                ELSE 1.18
            END) + (CASE WHEN (st.nombre = ANY (ARRAY['Recibo por Honorarios'::text, 'Liberalidad'::text, 'Otros'::text])) THEN (0)::numeric ELSE COALESCE(s.monto_exonerado, (0)::numeric) END)
            ELSE (0)::numeric
        END AS monto_usd,
    s.monto_detraccion AS detraccion,
        CASE
            WHEN (COALESCE(s.moneda, 'PEN'::text) = 'PEN'::text) THEN s.monto_retencion
            ELSE (0)::numeric
        END AS retencion_pen,
        CASE
            WHEN (COALESCE(s.moneda, 'PEN'::text) = 'USD'::text) THEN s.monto_retencion
            ELSE (0)::numeric
        END AS retencion_usd,
    pc.nombre_cuenta_contable AS cuenta_contable,
    pc.partida_presupuestal,
    s.fecha_pago
   FROM (((((solicitud s
     LEFT JOIN estado_soli es ON ((es.id = s.estado_id)))
     LEFT JOIN solicitud_tipo st ON ((st.id = s.tipo_id)))
     LEFT JOIN proyecto p ON ((p.id = s.proyecto_id)))
     LEFT JOIN proyecto_partida pp ON ((pp.id = s.proyecto_partida_id)))
     LEFT JOIN plan_contable_brash pc ON ((pc.id = s.plan_contable_id)))
UNION ALL
 SELECT ('arendir-'::text || (ar.id)::text) AS ref_id,
    'A Rendir'::text AS tipo,
    ar.codigo,
    ar.estado,
    p.nombre AS empresa,
    pp.nombre AS centro_costo,
    ( SELECT a.nombre
           FROM (area_usuario au
             JOIN area a ON ((a.id = au.area_id)))
          WHERE ((au.usuario_id = ar.beneficiario_id) AND (au.estado = 1))
         LIMIT 1) AS area,
    u.nombre_completo AS beneficiario,
    ar.fecha_creacion,
    ar.fecha_aprobacion,
    COALESCE(ar.moneda, 'PEN'::text) AS moneda,
        CASE
            WHEN (COALESCE(ar.moneda, 'PEN'::text) = 'PEN'::text) THEN
            CASE
                WHEN (ar.estado = 'Aprobado'::text) THEN ar.importe
                ELSE ar.total_reembolso
            END
            ELSE (0)::numeric
        END AS monto_pen,
        CASE
            WHEN (COALESCE(ar.moneda, 'PEN'::text) = 'USD'::text) THEN
            CASE
                WHEN (ar.estado = 'Aprobado'::text) THEN ar.importe
                ELSE ar.total_reembolso
            END
            ELSE (0)::numeric
        END AS monto_usd,
    NULL::numeric AS detraccion,
    (0)::numeric AS retencion_pen,
    (0)::numeric AS retencion_usd,
    pc.nombre_cuenta_contable AS cuenta_contable,
    pc.partida_presupuestal,
    ar.fecha_pago
   FROM ((((solicitud_arendir ar
     LEFT JOIN proyecto p ON ((p.id = ar.proyecto_id)))
     LEFT JOIN proyecto_partida pp ON ((pp.id = ar.proyecto_partida_id)))
     LEFT JOIN usuario u ON ((u.id = ar.beneficiario_id)))
     LEFT JOIN plan_contable_brash pc ON ((pc.id = ar.plan_contable_id)))
UNION ALL
 SELECT ('reembolso-'::text || (r.id)::text) AS ref_id,
    'Reembolso'::text AS tipo,
    r.codigo,
    r.estado,
    p.nombre AS empresa,
    pp.nombre AS centro_costo,
    ( SELECT a.nombre
           FROM (area_usuario au
             JOIN area a ON ((a.id = au.area_id)))
          WHERE ((au.usuario_id = r.beneficiario_id) AND (au.estado = 1))
         LIMIT 1) AS area,
    u.nombre_completo AS beneficiario,
    r.fecha_creacion,
    r.fecha_aprobacion,
    COALESCE(r.moneda, 'PEN'::text) AS moneda,
        CASE
            WHEN (COALESCE(r.moneda, 'PEN'::text) = 'PEN'::text) THEN r.total_reembolso
            ELSE (0)::numeric
        END AS monto_pen,
        CASE
            WHEN (COALESCE(r.moneda, 'PEN'::text) = 'USD'::text) THEN r.total_reembolso
            ELSE (0)::numeric
        END AS monto_usd,
    NULL::numeric AS detraccion,
    (0)::numeric AS retencion_pen,
    (0)::numeric AS retencion_usd,
    pc.nombre_cuenta_contable AS cuenta_contable,
    pc.partida_presupuestal,
    r.fecha_pago
   FROM ((((solicitud_reembolso r
     LEFT JOIN proyecto p ON ((p.id = r.proyecto_id)))
     LEFT JOIN proyecto_partida pp ON ((pp.id = r.proyecto_partida_id)))
     LEFT JOIN usuario u ON ((u.id = r.beneficiario_id)))
     LEFT JOIN plan_contable_brash pc ON ((pc.id = r.plan_contable_id)))
UNION ALL
 SELECT ('cajachica-'::text || (cc.id)::text) AS ref_id,
    'Caja Chica'::text AS tipo,
    cc.codigo,
    cc.estado,
    p.nombre AS empresa,
    NULL::text AS centro_costo,
    ( SELECT a.nombre
           FROM (area_usuario au
             JOIN area a ON ((a.id = au.area_id)))
          WHERE ((au.usuario_id = cc.responsable_id) AND (au.estado = 1))
         LIMIT 1) AS area,
    u.nombre_completo AS beneficiario,
    cc.fecha_creacion,
    cc.fecha_aprobacion,
    'PEN'::text AS moneda,
    cc.total_gastos AS monto_pen,
    (0)::numeric AS monto_usd,
    NULL::numeric AS detraccion,
    (0)::numeric AS retencion_pen,
    (0)::numeric AS retencion_usd,
    pc.nombre_cuenta_contable AS cuenta_contable,
    pc.partida_presupuestal,
    cc.fecha_pago
   FROM (((caja_chica cc
     LEFT JOIN proyecto p ON ((p.id = cc.proyecto_id)))
     LEFT JOIN usuario u ON ((u.id = cc.responsable_id)))
     LEFT JOIN plan_contable_brash pc ON ((pc.id = cc.plan_contable_id)))
UNION ALL
 SELECT ('devolucion-'::text || (dc.id)::text) AS ref_id,
    'Devolución'::text AS tipo,
    dc.codigo,
    dc.estado,
    p.nombre AS empresa,
    pp.nombre AS centro_costo,
    ( SELECT a.nombre
           FROM (area_usuario au
             JOIN area a ON ((a.id = au.area_id)))
          WHERE ((au.usuario_id = dc.creador_id) AND (au.estado = 1))
         LIMIT 1) AS area,
    dc.cliente_nombre AS beneficiario,
    dc.fecha_creacion,
    dc.fecha_aprobacion,
    COALESCE(dc.moneda, 'PEN'::text) AS moneda,
        CASE
            WHEN (COALESCE(dc.moneda, 'PEN'::text) = 'PEN'::text) THEN dc.monto
            ELSE (0)::numeric
        END AS monto_pen,
        CASE
            WHEN (COALESCE(dc.moneda, 'PEN'::text) = 'USD'::text) THEN dc.monto
            ELSE (0)::numeric
        END AS monto_usd,
    NULL::numeric AS detraccion,
    (0)::numeric AS retencion_pen,
    (0)::numeric AS retencion_usd,
    pc.nombre_cuenta_contable AS cuenta_contable,
    pc.partida_presupuestal,
    dc.fecha_pago
   FROM (((devolucion_cliente dc
     LEFT JOIN proyecto p ON ((p.id = dc.proyecto_id)))
     LEFT JOIN proyecto_partida pp ON ((pp.id = dc.proyecto_partida_id)))
     LEFT JOIN plan_contable_brash pc ON ((pc.id = dc.plan_contable_id)));
