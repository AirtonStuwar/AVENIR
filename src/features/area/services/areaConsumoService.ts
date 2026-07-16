import { supabase } from '../../../api/supabase'

export interface AreaConsumo {
  area_id: number
  area_nombre: string
  oc_pen: number
  oc_usd: number
  rxh_pen: number
  rxh_usd: number
  arendir_pen: number
  arendir_usd: number
  reembolso_pen: number
  reembolso_usd: number
  cajachica_pen: number
  devolucion_pen: number
  devolucion_usd: number
  total_pen: number
  total_usd: number
}

export async function getConsumoByAreas(): Promise<AreaConsumo[]> {
  // 1. Get all active user-area mappings
  const { data: areaData } = await supabase
    .from('area_usuario')
    .select('usuario_id, area_id(id, nombre)')
    .eq('estado', 1)

  const userAreaMap: Record<string, { id: number; nombre: string }> = {}
  for (const row of (areaData ?? []) as unknown as { usuario_id: string; area_id: { id: number; nombre: string } | null }[]) {
    if (row.area_id) userAreaMap[row.usuario_id] = row.area_id
  }

  const areas = new Map<number, AreaConsumo>()
  const getArea = (areaId: number, nombre: string): AreaConsumo => {
    if (!areas.has(areaId)) {
      areas.set(areaId, {
        area_id: areaId, area_nombre: nombre,
        oc_pen: 0, oc_usd: 0, rxh_pen: 0, rxh_usd: 0,
        arendir_pen: 0, arendir_usd: 0, reembolso_pen: 0, reembolso_usd: 0,
        cajachica_pen: 0, devolucion_pen: 0, devolucion_usd: 0,
        total_pen: 0, total_usd: 0,
      })
    }
    return areas.get(areaId)!
  }

  // 2. Solicitudes (OC + RxH) — Aprobado + Observado (en corrección, pero ya comprometido)
  const { data: estadoData } = await supabase
    .from('estado_soli').select('id').in('nombre', ['Aprobado', 'Observado'])
  const estadoIds = (estadoData ?? []).map(e => e.id)

  if (estadoIds.length) {
    const { data: solData } = await supabase
      .from('solicitud')
      .select('id, usuario_creador, moneda, solicitud_tipo:tipo_id(nombre)')
      .in('estado_id', estadoIds)

    const sols = (solData ?? []) as unknown as {
      id: number; usuario_creador: string | null; moneda: string | null
      solicitud_tipo: { nombre: string } | null
    }[]

    if (sols.length) {
      const solIds = sols.map(s => s.id)
      const { data: detData } = await supabase
        .from('solicitud_detalle')
        .select('solicitud_id, cantidad, valor_unitario, valor_total')
        .in('solicitud_id', solIds)

      const detMap: Record<number, number> = {}
      for (const d of (detData ?? []) as { solicitud_id: number; cantidad: number; valor_unitario: number; valor_total?: number | null }[]) {
        detMap[d.solicitud_id] = (detMap[d.solicitud_id] ?? 0) + (d.valor_total ?? d.cantidad * d.valor_unitario)
      }

      for (const s of sols) {
        if (!s.usuario_creador) continue
        const ua = userAreaMap[s.usuario_creador]
        if (!ua) continue
        const a = getArea(ua.id, ua.nombre)
        const subtotal = detMap[s.id] ?? 0
        const isRxH = s.solicitud_tipo?.nombre === 'Recibo por Honorarios'
        const total = isRxH ? subtotal : subtotal * 1.18
        const isPEN = (s.moneda ?? 'PEN') === 'PEN'
        if (isRxH) {
          if (isPEN) a.rxh_pen += total; else a.rxh_usd += total
        } else {
          if (isPEN) a.oc_pen += total; else a.oc_usd += total
        }
      }
    }
  }

  // 3. A Rendir — todo lo ya aprobado por el APROBADOR (dinero comprometido/entregado)
  const { data: arData } = await supabase
    .from('solicitud_arendir')
    .select('beneficiario_id, importe, total_reembolso, estado, moneda')
    .in('estado', ['Aprobado', 'Pagado', 'En Revision', 'Cerrado', 'Observado'])

  for (const r of (arData ?? []) as { beneficiario_id: string | null; importe: number; total_reembolso: number; estado: string; moneda: string | null }[]) {
    if (!r.beneficiario_id) continue
    const ua = userAreaMap[r.beneficiario_id]
    if (!ua) continue
    const a = getArea(ua.id, ua.nombre)
    const monto = r.estado === 'Aprobado' ? r.importe : r.total_reembolso
    if ((r.moneda ?? 'PEN') === 'USD') a.arendir_usd += monto
    else a.arendir_pen += monto
  }

  // 4. Reembolso — Autorizado + Observado (en corrección, pero ya comprometido)
  const { data: reData } = await supabase
    .from('solicitud_reembolso')
    .select('beneficiario_id, total_reembolso, moneda')
    .in('estado', ['Autorizado', 'Observado'])

  for (const r of (reData ?? []) as { beneficiario_id: string | null; total_reembolso: number; moneda: string | null }[]) {
    if (!r.beneficiario_id) continue
    const ua = userAreaMap[r.beneficiario_id]
    if (!ua) continue
    const a = getArea(ua.id, ua.nombre)
    if ((r.moneda ?? 'PEN') === 'USD') a.reembolso_usd += r.total_reembolso
    else a.reembolso_pen += r.total_reembolso
  }

  // 5. Caja Chica autorizada (fondo ya gastado/comprometido)
  const { data: ccData } = await supabase
    .from('caja_chica')
    .select('responsable_id, total_gastos')
    .eq('estado', 'Autorizado')

  for (const r of (ccData ?? []) as { responsable_id: string | null; total_gastos: number }[]) {
    if (!r.responsable_id) continue
    const ua = userAreaMap[r.responsable_id]
    if (!ua) continue
    const a = getArea(ua.id, ua.nombre)
    a.cajachica_pen += r.total_gastos
  }

  // 6. Devolución de Cliente — Autorizado + Observado (egreso comprometido)
  const { data: dcData } = await supabase
    .from('devolucion_cliente')
    .select('creador_id, monto, moneda')
    .in('estado', ['Autorizado', 'Observado'])

  for (const r of (dcData ?? []) as { creador_id: string | null; monto: number; moneda: string | null }[]) {
    if (!r.creador_id) continue
    const ua = userAreaMap[r.creador_id]
    if (!ua) continue
    const a = getArea(ua.id, ua.nombre)
    if ((r.moneda ?? 'PEN') === 'USD') a.devolucion_usd += r.monto
    else a.devolucion_pen += r.monto
  }

  // Calculate totals
  for (const a of areas.values()) {
    a.total_pen = a.oc_pen + a.rxh_pen + a.arendir_pen + a.reembolso_pen + a.cajachica_pen + a.devolucion_pen
    a.total_usd = a.oc_usd + a.rxh_usd + a.arendir_usd + a.reembolso_usd + a.devolucion_usd
  }

  return [...areas.values()].sort((a, b) => (b.total_pen + b.total_usd) - (a.total_pen + a.total_usd))
}
