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
  aplica_igv: boolean
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

type PlanJoin = { id: number; tipo_gasto_costo: string | null; codigo_starsoft: string | null; nombre_cuenta_contable: string | null; partida_presupuestal: string | null }

function ensurePlan(byPlan: Record<number, GastoPlanContable>, plan: PlanJoin) {
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
  return byPlan[plan.id]
}

/**
 * Gasto acumulado por plan contable a partir de Solicitudes (Aprobado), Reembolso (Autorizado),
 * Caja Chica (Autorizado) y Devolución de Cliente (Autorizado). A Rendir queda fuera — no asigna
 * plan contable en ningún paso de su flujo.
 * OC suma con IGV 18%; RxH y Liberalidad sin IGV (igual que el consumo de presupuesto).
 * Si `userId` se pasa, solo considera lo creado/gestionado por ese usuario en cada módulo.
 */
export async function getGastoPorPlanContable(userId?: string): Promise<GastoPlanContable[]> {
  const byPlan: Record<number, GastoPlanContable> = {}

  // ── Solicitudes (OC / RxH / Liberalidad) ────────────────────────
  let qSol = supabase
    .from('solicitud')
    .select('id, moneda, aplica_igv, estado_soli:estado_id(nombre), solicitud_tipo:tipo_id(nombre), plan_contable:plan_contable_brash!solicitud_plan_contable_id_fkey(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)')
    .not('plan_contable_id', 'is', null)
  if (userId) qSol = qSol.eq('usuario_creador', userId)
  const { data: solData, error: solErr } = await qSol
  if (solErr) throw solErr

  const sols = ((solData ?? []) as unknown as SolRow[])
    .filter(s => s.estado_soli?.nombre === 'Aprobado' && s.plan_contable)

  if (sols.length > 0) {
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

    for (const s of sols) {
      const plan = s.plan_contable!
      const subtotal = subtotalBySol[s.id] ?? 0
      const isRxH = s.solicitud_tipo?.nombre === 'Recibo por Honorarios'
      const isLiberalidad = s.solicitud_tipo?.nombre === 'Liberalidad'
      const total = isRxH || isLiberalidad || s.aplica_igv === false ? subtotal : subtotal * 1.18
      const entry = ensurePlan(byPlan, plan)
      entry.cantidad += 1
      if ((s.moneda ?? 'PEN') === 'USD') entry.usd += total
      else entry.pen += total
    }
  }

  // ── Reembolso (Autorizado) ──────────────────────────────────────
  let qReemb = supabase
    .from('solicitud_reembolso')
    .select('moneda, total_reembolso, estado, beneficiario_id, plan_contable:plan_contable_id(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)')
    .eq('estado', 'Autorizado')
    .not('plan_contable_id', 'is', null)
  if (userId) qReemb = qReemb.eq('beneficiario_id', userId)
  const { data: reembData, error: reembErr } = await qReemb
  if (reembErr) throw reembErr
  for (const r of (reembData ?? []) as unknown as { moneda: string | null; total_reembolso: number; plan_contable: PlanJoin | null }[]) {
    if (!r.plan_contable) continue
    const entry = ensurePlan(byPlan, r.plan_contable)
    entry.cantidad += 1
    if ((r.moneda ?? 'PEN') === 'USD') entry.usd += r.total_reembolso
    else entry.pen += r.total_reembolso
  }

  // ── Caja Chica (Autorizado, siempre PEN) ────────────────────────
  let qCC = supabase
    .from('caja_chica')
    .select('total_gastos, estado, responsable_id, plan_contable:plan_contable_id(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)')
    .eq('estado', 'Autorizado')
    .not('plan_contable_id', 'is', null)
  if (userId) qCC = qCC.eq('responsable_id', userId)
  const { data: ccData, error: ccErr } = await qCC
  if (ccErr) throw ccErr
  for (const c of (ccData ?? []) as unknown as { total_gastos: number; plan_contable: PlanJoin | null }[]) {
    if (!c.plan_contable) continue
    const entry = ensurePlan(byPlan, c.plan_contable)
    entry.cantidad += 1
    entry.pen += c.total_gastos
  }

  // ── Devolución de Cliente (Autorizado) ──────────────────────────
  let qDev = supabase
    .from('devolucion_cliente')
    .select('moneda, monto, estado, creador_id, plan_contable:plan_contable_id(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)')
    .eq('estado', 'Autorizado')
    .not('plan_contable_id', 'is', null)
  if (userId) qDev = qDev.eq('creador_id', userId)
  const { data: devData, error: devErr } = await qDev
  if (devErr) throw devErr
  for (const d of (devData ?? []) as unknown as { moneda: string | null; monto: number; plan_contable: PlanJoin | null }[]) {
    if (!d.plan_contable) continue
    const entry = ensurePlan(byPlan, d.plan_contable)
    entry.cantidad += 1
    if ((d.moneda ?? 'PEN') === 'USD') entry.usd += d.monto
    else entry.pen += d.monto
  }

  return Object.values(byPlan).sort((a, b) => (b.pen + b.usd) - (a.pen + a.usd))
}
