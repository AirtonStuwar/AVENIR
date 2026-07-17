import { supabase } from '../../../api/supabase'
import type {
  CajaChica, CajaChicaDetalle, CajaChicaInsert, CajaChicaDetalleInsert,
  CajaChicaFiltros, CajaChicaPaginado,
} from '../types/cajaChica'

const SEL = '*, proyecto:proyecto_id(id,nombre), plan_contable:plan_contable_id(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)'

// ── Enrich ────────────────────────────────────────────────────────

async function enrichCajaChica(rows: CajaChica[]): Promise<CajaChica[]> {
  const uids = [...new Set([
    ...rows.map(r => r.responsable_id),
    ...rows.map(r => r.usuario_aprobador),
    ...rows.map(r => r.usuario_evaluador),
  ].filter(Boolean))] as string[]

  if (!uids.length) return rows

  const { data } = await supabase
    .from('usuario')
    .select('id, nombre_completo, correo')
    .in('id', uids)

  const map: Record<string, { nombre: string | null; correo: string | null }> = {}
  for (const u of (data ?? []) as { id: string; nombre_completo: string | null; correo: string | null }[]) {
    map[u.id] = { nombre: u.nombre_completo, correo: u.correo }
  }

  return rows.map(r => ({
    ...r,
    responsable_nombre: r.responsable_id ? map[r.responsable_id]?.nombre ?? null : null,
    responsable_email: r.responsable_id ? map[r.responsable_id]?.correo ?? null : null,
    aprobador_nombre: r.usuario_aprobador ? map[r.usuario_aprobador]?.nombre ?? null : null,
    evaluador_nombre: r.usuario_evaluador ? map[r.usuario_evaluador]?.nombre ?? null : null,
  }))
}

// ── CRUD ──────────────────────────────────────────────────────────

export async function getCajasChicas(filtros: CajaChicaFiltros = {}): Promise<CajaChicaPaginado> {
  const { page = 1, pageSize = 10, estado, proyectoId } = filtros
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase.from('caja_chica').select(SEL, { count: 'exact' })
    .order('fecha_creacion', { ascending: false })
    .range(from, to)

  if (estado) q = q.eq('estado', estado)
  if (proyectoId) q = q.eq('proyecto_id', proyectoId)

  const { data, error, count } = await q
  if (error) throw error

  const enriched = await enrichCajaChica((data ?? []) as unknown as CajaChica[])
  const total = count ?? 0
  return { data: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getCajaChicaById(id: number): Promise<CajaChica> {
  const { data, error } = await supabase
    .from('caja_chica')
    .select(`${SEL}, detalles:caja_chica_detalle(*)`)
    .eq('id', id)
    .single()
  if (error) throw error

  const row = data as unknown as CajaChica
  const [enriched] = await enrichCajaChica([row])

  // Enrich area names on detalles
  if (enriched.detalles?.length) {
    const areaIds = [...new Set(enriched.detalles.map(d => d.area_id).filter(Boolean))] as number[]
    if (areaIds.length) {
      const { data: areaData } = await supabase
        .from('area_usuario')
        .select('area_id:area_id(id, nombre)')
        .limit(100)
      const areaMap: Record<number, string> = {}
      for (const row of (areaData ?? []) as unknown as { area_id: { id: number; nombre: string } | null }[]) {
        if (row.area_id) areaMap[row.area_id.id] = row.area_id.nombre
      }
      enriched.detalles = enriched.detalles.map(d => ({
        ...d,
        area_nombre: d.area_id ? areaMap[d.area_id] ?? null : null,
      }))
    }
  }

  return enriched
}

export async function createCajaChica(payload: CajaChicaInsert): Promise<CajaChica> {
  const { data, error } = await supabase
    .from('caja_chica')
    .insert(payload)
    .select(SEL)
    .single()
  if (error) throw error
  return data as unknown as CajaChica
}

export async function updateCajaChica(id: number, payload: Partial<CajaChica>): Promise<void> {
  const { error } = await supabase.from('caja_chica').update(payload).eq('id', id)
  if (error) throw error
}

// ── Detalles ─────────────────────────────────────────────────────

export async function getDetallesByCajaChica(cajaChicaId: number): Promise<CajaChicaDetalle[]> {
  const { data, error } = await supabase
    .from('caja_chica_detalle')
    .select('*')
    .eq('caja_chica_id', cajaChicaId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return (data ?? []) as CajaChicaDetalle[]
}

export async function createDetalleCajaChica(payload: CajaChicaDetalleInsert): Promise<CajaChicaDetalle> {
  const { data, error } = await supabase
    .from('caja_chica_detalle')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as CajaChicaDetalle
}

export async function updateDetalleCajaChica(id: number, payload: Partial<CajaChicaDetalleInsert>): Promise<CajaChicaDetalle> {
  const { data, error } = await supabase
    .from('caja_chica_detalle')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CajaChicaDetalle
}

export async function deleteDetalleCajaChica(id: number): Promise<void> {
  const { error } = await supabase.from('caja_chica_detalle').delete().eq('id', id)
  if (error) throw error
}

// ── Flujo ────────────────────────────────────────────────────────

export async function enviarCajaChica(id: number): Promise<void> {
  await updateCajaChica(id, { estado: 'En Revision' } as Partial<CajaChica>)
}

export async function marcarEvaluadoCajaChica(id: number, planContableId: number, evaluadorId: string): Promise<void> {
  await updateCajaChica(id, {
    estado: 'Evaluado',
    plan_contable_id: planContableId,
    usuario_evaluador: evaluadorId,
  } as Partial<CajaChica>)
}

export async function devolverDesdeRevisionCajaChica(id: number, comentario: string): Promise<void> {
  await updateCajaChica(id, { estado: 'Devuelto', comentario } as Partial<CajaChica>)
}

export async function autorizarCajaChica(id: number, aprobadorId: string): Promise<void> {
  await updateCajaChica(id, {
    estado: 'Autorizado',
    usuario_aprobador: aprobadorId,
    fecha_aprobacion: new Date().toISOString(),
  } as Partial<CajaChica>)
}

export async function rechazarCajaChica(id: number, aprobadorId: string, comentario: string): Promise<void> {
  await updateCajaChica(id, {
    estado: 'Rechazado',
    usuario_aprobador: aprobadorId,
    fecha_aprobacion: new Date().toISOString(),
    comentario,
  } as Partial<CajaChica>)
}

export async function devolverCajaChica(id: number, comentario: string): Promise<void> {
  await updateCajaChica(id, { estado: 'Devuelto', comentario } as Partial<CajaChica>)
}

/** VISUALIZADOR/ADMIN: encontró un error antes de pagar → estado Observado */
export async function observarCajaChica(id: number, comentario: string): Promise<void> {
  await updateCajaChica(id, { estado: 'Observado', comentario } as Partial<CajaChica>)
}

/** USUARIO/ADMIN: tras corregir → regresa directo a Autorizado (sin re-aprobación) */
export async function reenviarContabilidadCajaChica(id: number): Promise<void> {
  await updateCajaChica(id, { estado: 'Autorizado' } as Partial<CajaChica>)
}

// ── Helpers ──────────────────────────────────────────────────────

export async function getSaldoAnterior(proyectoId: number): Promise<number> {
  // RPC SECURITY DEFINER: la última caja pagada del proyecto puede ser de otro
  // responsable, cuya fila queda oculta por RLS para el rol USUARIO.
  const { data, error } = await supabase.rpc('get_saldo_anterior_caja', { pid: proyectoId })
  if (error) throw error
  return Number(data ?? 0)
}

// ── Dashboard helpers ────────────────────────────────────────────
export interface CajaChicaRow {
  id: number
  total_gastos: number
  estado: string
  proyecto_id: number | null
  fecha_pago: string | null
}

export async function getCajaChicaAutorizadas(): Promise<CajaChicaRow[]> {
  const { data, error } = await supabase
    .from('caja_chica')
    .select('id, total_gastos, estado, proyecto_id, fecha_pago')
    .eq('estado', 'Autorizado')
  if (error) throw error
  return (data ?? []) as CajaChicaRow[]
}

export async function getAreas(): Promise<{ id: number; nombre: string }[]> {
  const { data } = await supabase
    .from('area')
    .select('id, nombre')
    .order('nombre')
  return (data ?? []) as { id: number; nombre: string }[]
}
