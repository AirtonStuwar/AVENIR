import { supabase } from '../../../api/supabase'
import type {
  SolicitudReembolso, SolicitudReembolsoInsert, ReembolsoDetalle,
  ReembolsoDetalleInsert, ReembolsoFiltros, ReembolsoPaginado,
} from '../types/reembolso'
import { ROLES } from '../../solicitud/types/solicitud'

const BUCKET = 'reembolso-documentos'
const SEL = '*, proyecto:proyecto_id(id,nombre), plan_contable:plan_contable_id(id,tipo_gasto_costo,codigo_starsoft,nombre_cuenta_contable,partida_presupuestal)'

// ── Enrich helper ──────────────────────────────────────────────
async function enrichReembolso(items: SolicitudReembolso[]): Promise<SolicitudReembolso[]> {
  const uids = [...new Set([
    ...items.map(i => i.beneficiario_id).filter(Boolean),
    ...items.map(i => i.usuario_aprobador).filter(Boolean),
    ...items.map(i => i.usuario_evaluador).filter(Boolean),
  ])] as string[]
  if (uids.length === 0) return items
  const { data: users } = await supabase
    .from('usuario')
    .select('id,nombre_completo,correo,dni,cargo')
    .in('id', uids)
  const map = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  return items.map(i => ({
    ...i,
    beneficiario_nombre: map[i.beneficiario_id ?? '']?.nombre_completo ?? null,
    beneficiario_email:  map[i.beneficiario_id ?? '']?.correo ?? null,
    beneficiario_dni:    map[i.beneficiario_id ?? '']?.dni ?? null,
    beneficiario_cargo:  map[i.beneficiario_id ?? '']?.cargo ?? null,
    aprobador_nombre:    map[i.usuario_aprobador ?? '']?.nombre_completo ?? null,
    evaluador_nombre:    map[i.usuario_evaluador ?? '']?.nombre_completo ?? null,
  }))
}

// ── CRUD Principal ─────────────────────────────────────────────
export async function getReembolsos(filtros: ReembolsoFiltros = {}): Promise<ReembolsoPaginado> {
  const { page = 1, pageSize = 10, role, userId, estado, proyectoId } = filtros
  let q = supabase.from('solicitud_reembolso').select(SEL, { count: 'exact' })
  if (role === ROLES.USUARIO && userId) q = q.eq('beneficiario_id', userId)
  if (role === ROLES.EVALUADOR && userId) {
    q = q.or(`estado.eq.En Revision,usuario_evaluador.eq.${userId}`)
  }
  if (role === ROLES.VISUALIZADOR) {
    if (estado) {
      q = q.eq('estado', estado)
    } else {
      q = q.in('estado', ['Evaluado', 'Autorizado'])
    }
  } else if (estado) {
    q = q.eq('estado', estado)
  }
  if (proyectoId) q = q.eq('proyecto_id', proyectoId)
  q = q.order('fecha_creacion', { ascending: false })
       .range((page - 1) * pageSize, page * pageSize - 1)
  const { data, count, error } = await q
  if (error) throw error
  const enriched = await enrichReembolso((data ?? []) as SolicitudReembolso[])
  const total = count ?? 0
  return { data: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }
}

export async function getReembolsoById(id: number): Promise<SolicitudReembolso> {
  const { data, error } = await supabase
    .from('solicitud_reembolso')
    .select(`${SEL}, detalles:solicitud_reembolso_detalle(*)`)
    .eq('id', id)
    .single()
  if (error) throw error
  const [enriched] = await enrichReembolso([data as SolicitudReembolso])
  return enriched
}

export async function createReembolso(payload: SolicitudReembolsoInsert): Promise<SolicitudReembolso> {
  const { data, error } = await supabase
    .from('solicitud_reembolso').insert(payload).select(SEL).single()
  if (error) throw error
  return data as SolicitudReembolso
}

export async function updateReembolso(id: number, payload: Partial<SolicitudReembolso>): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso').update(payload).eq('id', id)
  if (error) throw error
}

// ── Estado helpers ─────────────────────────────────────────────
export async function enviarReembolso(id: number): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso')
    .update({ estado: 'En Revision' }).eq('id', id)
  if (error) throw error
}

export async function marcarEvaluadoReembolso(
  id: number,
  planContableId: number,
  evaluadorId: string,
): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso')
    .update({ estado: 'Evaluado', plan_contable_id: planContableId, usuario_evaluador: evaluadorId })
    .eq('id', id)
  if (error) throw error
}

export async function devolverDesdeRevisionReembolso(id: number, comentario: string): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso')
    .update({ estado: 'Devuelto', comentario }).eq('id', id)
  if (error) throw error
}

export async function autorizarReembolso(id: number, aprobadorId: string): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso')
    .update({ estado: 'Autorizado', usuario_aprobador: aprobadorId, fecha_aprobacion: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function rechazarReembolso(id: number, comentario: string): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso')
    .update({ estado: 'Rechazado', comentario }).eq('id', id)
  if (error) throw error
}

export async function devolverReembolso(id: number, comentario: string): Promise<void> {
  const { error } = await supabase.from('solicitud_reembolso')
    .update({ estado: 'Devuelto', comentario }).eq('id', id)
  if (error) throw error
}

// ── Detalle ────────────────────────────────────────────────────
export async function addDetalleReembolso(payload: ReembolsoDetalleInsert): Promise<ReembolsoDetalle> {
  const { data, error } = await supabase
    .from('solicitud_reembolso_detalle').insert(payload).select().single()
  if (error) throw error
  return data as ReembolsoDetalle
}

export async function updateDetalleReembolso(id: number, payload: Partial<ReembolsoDetalle>): Promise<ReembolsoDetalle> {
  const { data, error } = await supabase
    .from('solicitud_reembolso_detalle').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data as ReembolsoDetalle
}

export async function deleteDetalleReembolso(id: number, archivoPath?: string | null): Promise<void> {
  if (archivoPath) {
    await supabase.storage.from(BUCKET).remove([archivoPath])
  }
  const { error } = await supabase.from('solicitud_reembolso_detalle').delete().eq('id', id)
  if (error) throw error
}

export async function recalcTotalReembolso(solicitudId: number): Promise<void> {
  const { data } = await supabase
    .from('solicitud_reembolso_detalle')
    .select('importe')
    .eq('solicitud_reembolso_id', solicitudId)
  const total = (data ?? []).reduce((s, r) => s + (r.importe ?? 0), 0)
  await supabase.from('solicitud_reembolso').update({ total_reembolso: total }).eq('id', solicitudId)
}

// ── Storage ────────────────────────────────────────────────────
export async function uploadSustentoReembolso(file: File, solicitudId: number): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${solicitudId}/sustento/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function uploadDetalleArchivoReembolso(file: File, solicitudId: number, detalleId: number): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${solicitudId}/detalle/${detalleId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getArchivoUrlReembolso(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function uploadFirmaReembolso(
  blob: Blob,
  solicitudId: number,
  tipo: 'firma_usuario' | 'firma_aprobador',
): Promise<string> {
  const path = `${solicitudId}/${tipo}/${Date.now()}.png`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (error) throw error
  return path
}

// ── Dashboard helpers ──────────────────────────────────────────
export interface ReembolsoRow {
  id: number
  moneda: string
  total_reembolso: number
  estado: string
}

export async function getReembolsoAutorizados(): Promise<ReembolsoRow[]> {
  const { data, error } = await supabase
    .from('solicitud_reembolso')
    .select('id, moneda, total_reembolso, estado')
    .in('estado', ['Evaluado', 'Autorizado'])
  if (error) throw error
  return (data ?? []) as ReembolsoRow[]
}
