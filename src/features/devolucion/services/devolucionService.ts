import { supabase } from '../../../api/supabase'
import type {
  DevolucionCliente, DevolucionClienteInsert,
  DevolucionFiltros, DevolucionPaginado,
} from '../types/devolucion'
import { ROLES } from '../../solicitud/types/solicitud'

const BUCKET = 'devolucion-documentos'
const SEL = '*, proyecto:proyecto_id(id,nombre), proyecto_partida:proyecto_partida_id(id,nombre)'

// ── Enrich helper ──────────────────────────────────────────────
async function enrichDevoluciones(items: DevolucionCliente[]): Promise<DevolucionCliente[]> {
  const uids = [...new Set([
    ...items.map(i => i.creador_id).filter(Boolean),
    ...items.map(i => i.usuario_aprobador).filter(Boolean),
  ])] as string[]
  if (uids.length === 0) return items
  const { data: users } = await supabase
    .from('usuario')
    .select('id,nombre_completo,correo')
    .in('id', uids)
  const map = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  return items.map(i => ({
    ...i,
    creador_nombre:   map[i.creador_id ?? '']?.nombre_completo ?? null,
    creador_email:    map[i.creador_id ?? '']?.correo ?? null,
    aprobador_nombre: map[i.usuario_aprobador ?? '']?.nombre_completo ?? null,
  }))
}

// ── CRUD ───────────────────────────────────────────────────────
export async function getDevoluciones(filtros: DevolucionFiltros = {}): Promise<DevolucionPaginado> {
  const { page = 1, pageSize = 10, role, userId, estado, proyectoId } = filtros
  let q = supabase.from('devolucion_cliente').select(SEL, { count: 'exact' })
  if (role === ROLES.USUARIO && userId) q = q.eq('creador_id', userId)
  if (role === ROLES.APROBADOR) {
    if (estado) q = q.eq('estado', estado)
    else q = q.in('estado', ['Pendiente', 'Autorizado', 'Rechazado'])
  } else if (role === ROLES.VISUALIZADOR) {
    if (estado) q = q.eq('estado', estado)
    else q = q.eq('estado', 'Autorizado')
  } else if (estado) {
    q = q.eq('estado', estado)
  }
  if (proyectoId) q = q.eq('proyecto_id', proyectoId)
  q = q.order('fecha_creacion', { ascending: false })
       .range((page - 1) * pageSize, page * pageSize - 1)
  const { data, count, error } = await q
  if (error) throw error
  const enriched = await enrichDevoluciones((data ?? []) as DevolucionCliente[])
  const total = count ?? 0
  return { data: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }
}

export async function getDevolucionById(id: number): Promise<DevolucionCliente> {
  const { data, error } = await supabase
    .from('devolucion_cliente')
    .select(SEL)
    .eq('id', id)
    .single()
  if (error) throw error
  const [enriched] = await enrichDevoluciones([data as DevolucionCliente])
  return enriched
}

export async function createDevolucion(payload: DevolucionClienteInsert): Promise<DevolucionCliente> {
  const { data, error } = await supabase
    .from('devolucion_cliente').insert(payload).select(SEL).single()
  if (error) throw error
  return data as DevolucionCliente
}

export async function updateDevolucion(id: number, payload: Partial<DevolucionCliente>): Promise<void> {
  const { error } = await supabase.from('devolucion_cliente').update(payload).eq('id', id)
  if (error) throw error
}

// ── Estado helpers ─────────────────────────────────────────────

/** APROBADOR/ADMIN: autoriza la devolución */
export async function autorizarDevolucion(id: number, usuarioId: string, comentario?: string): Promise<void> {
  const { error } = await supabase.from('devolucion_cliente')
    .update({ estado: 'Autorizado', usuario_aprobador: usuarioId, fecha_aprobacion: new Date().toISOString(), ...(comentario ? { comentario } : {}) })
    .eq('id', id)
  if (error) throw error
}

/** APROBADOR/ADMIN: rechaza con comentario */
export async function rechazarDevolucion(id: number, usuarioId: string, comentario: string): Promise<void> {
  const { error } = await supabase.from('devolucion_cliente')
    .update({ estado: 'Rechazado', usuario_aprobador: usuarioId, fecha_aprobacion: new Date().toISOString(), comentario })
    .eq('id', id)
  if (error) throw error
}

/** VISUALIZADOR/ADMIN: marca como pagado */
export async function marcarPagadoDevolucion(
  id: number,
  cuentaPagoId: number,
  fechaPago: string,
  usuarioPagoId: string,
): Promise<void> {
  const { error } = await supabase.from('devolucion_cliente')
    .update({ cuenta_pago_id: cuentaPagoId, fecha_pago: fechaPago, usuario_pago: usuarioPagoId })
    .eq('id', id)
  if (error) throw error
}

// ── Storage ────────────────────────────────────────────────────
export type TipoArchivoDevolucion = 'sustento' | 'boucher_separacion' | 'constancia_separacion' | 'sustento_desistimiento'

export async function uploadArchivoDevolucion(
  file: File,
  devolucionId: number,
  tipo: TipoArchivoDevolucion,
): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${devolucionId}/${tipo}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getArchivoDevolucionUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

// ── Dashboard helpers ──────────────────────────────────────────
export interface DevolucionRow {
  id: number
  monto: number
  moneda: string
  estado: string
  proyecto_id: number | null
  fecha_pago: string | null
}

export async function getDevolucionesAutorizadas(): Promise<DevolucionRow[]> {
  const { data, error } = await supabase
    .from('devolucion_cliente')
    .select('id, monto, moneda, estado, proyecto_id, fecha_pago')
    .in('estado', ['Pendiente', 'Autorizado'])
  if (error) throw error
  return (data ?? []) as DevolucionRow[]
}
