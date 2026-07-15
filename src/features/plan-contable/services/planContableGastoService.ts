import { supabase } from '../../../api/supabase'

export interface GastoPlanContable {
  plan_contable_id: number
  tipo_gasto_costo: string | null
  codigo_starsoft: string | null
  nombre_cuenta_contable: string | null
  partida_presupuestal: string | null
  cantidad: number
  pen: number
  usd: number
}

interface SolRow {
  id: number
  moneda: string | null
  estado_soli: { nombre: string } | null
  solicitud_tipo: { nombre: string } | null
  plan_contable: {
    id: number
    tipo_gasto_costo: string | null
    codigo_starsoft: string | null
    nombre_cuenta_contable: string | null
    partida_presupuestal: string | null
  } | null
}

/**
 * Gasto acumulado por plan contable a partir de solicitudes Aprobadas.
 * OC suma con IGV 18%; RxH sin IGV (igual que el consumo de presupuesto).
 * Si `userId` se pasa, solo considera las solicitudes creadas por ese usuario.
 */
export async function getGastoPorPlanContable(userId?: string): Promise<GastoPlanContable[]> {
  let q = supabase
    .from('solicitud')
    .select('id, moneda, estado_soli:estado_id(nombre), solicitud_tipo:tipo_id(nombre), plan_contable:plan_contable_brash!solicitud_plan_contable_id_fkey(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)')
    .not('plan_contable_id', 'is', null)
  if (userId) q = q.eq('usuario_creador', userId)
  const { data, error } = await q
  if (error) throw error

  const sols = ((data ?? []) as unknown as SolRow[])
    .filter(s => s.estado_soli?.nombre === 'Aprobado' && s.plan_contable)
  if (sols.length === 0) return []

  const ids = sols.map(s => s.id)
  const { data: dets, error: detErr } = await supabase
    .from('solicitud_detalle')
    .select('solicitud_id, valor_total, cantidad, valor_unitario')
    .in('solicitud_id', ids)
  if (detErr) throw detErr

  const subtotalBySol: Record<number, number> = {}
  for (const d of (dets ?? []) as { solicitud_id: number; valor_total: number | null; cantidad: number; valor_unitario: number }[]) {
    subtotalBySol[d.solicitud_id] = (subtotalBySol[d.solicitud_id] ?? 0) + (d.valor_total ?? d.cantidad * d.valor_unitario)
  }

  const byPlan: Record<number, GastoPlanContable> = {}
  for (const s of sols) {
    const plan = s.plan_contable!
    const subtotal = subtotalBySol[s.id] ?? 0
    const isRxH = s.solicitud_tipo?.nombre === 'Recibo por Honorarios'
    const total = isRxH ? subtotal : subtotal * 1.18
    if (!byPlan[plan.id]) {
      byPlan[plan.id] = {
        plan_contable_id: plan.id,
        tipo_gasto_costo: plan.tipo_gasto_costo,
        codigo_starsoft: plan.codigo_starsoft,
        nombre_cuenta_contable: plan.nombre_cuenta_contable,
        partida_presupuestal: plan.partida_presupuestal,
        cantidad: 0,
        pen: 0,
        usd: 0,
      }
    }
    byPlan[plan.id].cantidad += 1
    if ((s.moneda ?? 'PEN') === 'USD') byPlan[plan.id].usd += total
    else byPlan[plan.id].pen += total
  }

  return Object.values(byPlan).sort((a, b) => (b.pen + b.usd) - (a.pen + a.usd))
}
