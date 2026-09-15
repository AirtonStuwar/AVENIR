import { supabase } from '../../../api/supabase'
import { ROLES } from '../../solicitud/types/solicitud'
import type {
  CobranzaCliente, CobranzaClienteInsert, CobranzaFiltros, CobranzaPaginado,
} from '../types/cobranza'

const SEL = '*, proyecto:proyecto_id(id,nombre), cuenta_pago:cuenta_pago_id(id,banco,numero_cuenta,moneda)'

async function enrichCobranzas(items: CobranzaCliente[]): Promise<CobranzaCliente[]> {
  const uids = [...new Set(items.map(i => i.creador_id).filter(Boolean))] as string[]
  if (uids.length === 0) return items
  const { data: users } = await supabase
    .from('usuario')
    .select('id,nombre_completo')
    .in('id', uids)
  const map = Object.fromEntries((users ?? []).map(u => [u.id, u.nombre_completo]))
  return items.map(i => ({ ...i, creador_nombre: map[i.creador_id] ?? null }))
}

export async function getCobranzas(filtros: CobranzaFiltros = {}): Promise<CobranzaPaginado> {
  const { page = 1, pageSize = 10, role, userId, proyectoId, fechaDesde, fechaHasta } = filtros
  let q = supabase.from('cobranza_cliente').select(SEL, { count: 'exact' })
  if (role === ROLES.USUARIO && userId) q = q.eq('creador_id', userId)
  if (proyectoId) q = q.eq('proyecto_id', proyectoId)
  if (fechaDesde) q = q.gte('fecha_pago', fechaDesde)
  if (fechaHasta) q = q.lte('fecha_pago', fechaHasta)
  q = q.order('fecha_pago', { ascending: false })
       .range((page - 1) * pageSize, page * pageSize - 1)
  const { data, count, error } = await q
  if (error) throw error
  const enriched = await enrichCobranzas((data ?? []) as unknown as CobranzaCliente[])
  const total = count ?? 0
  return { data: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }
}

export async function createCobranza(payload: CobranzaClienteInsert): Promise<CobranzaCliente> {
  const { data, error } = await supabase
    .from('cobranza_cliente').insert(payload).select(SEL).single()
  if (error) throw error
  return data as unknown as CobranzaCliente
}

/** Dueño (mientras Registrado) o ADMIN: anula un registro cargado por error */
export async function anularCobranza(id: number, comentario: string): Promise<void> {
  const { error } = await supabase.from('cobranza_cliente')
    .update({ estado: 'Anulado', comentario }).eq('id', id)
  if (error) throw error
}
