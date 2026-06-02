import { supabase } from '../../../api/supabase'
import type {
  SolicitudARendir, SolicitudARendirInsert, ARendirDetalle,
  ARendirDetalleInsert, ARendirFiltros, ARendirPaginado,
} from '../types/arendir'
import { ROLES } from '../../solicitud/types/solicitud'

const BUCKET = 'arendir-documentos'
const SEL = '*, proyecto:proyecto_id(id,nombre)'

// ── Enrich helper ──────────────────────────────────────────────
async function enrichARendir(items: SolicitudARendir[]): Promise<SolicitudARendir[]> {
  const uids = [...new Set([
    ...items.map(i => i.beneficiario_id).filter(Boolean),
    ...items.map(i => i.usuario_aprobador).filter(Boolean),
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
  }))
}

// ── CRUD Principal ─────────────────────────────────────────────
export async function getARendir(filtros: ARendirFiltros = {}): Promise<ARendirPaginado> {
  const { page = 1, pageSize = 10, role, userId, estado } = filtros
  let q = supabase.from('solicitud_arendir').select(SEL, { count: 'exact' })
  if (role === ROLES.USUARIO && userId) q = q.eq('beneficiario_id', userId)
  if (estado) q = q.eq('estado', estado)
  q = q.order('fecha_creacion', { ascending: false })
       .range((page - 1) * pageSize, page * pageSize - 1)
  const { data, count, error } = await q
  if (error) throw error
  const enriched = await enrichARendir((data ?? []) as SolicitudARendir[])
  const total = count ?? 0
  return { data: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 }
}

export async function getARendirById(id: number): Promise<SolicitudARendir> {
  const { data, error } = await supabase
    .from('solicitud_arendir')
    .select(`${SEL}, detalles:solicitud_arendir_detalle(*)`)
    .eq('id', id)
    .single()
  if (error) throw error
  const [enriched] = await enrichARendir([data as SolicitudARendir])
  return enriched
}

export async function createARendir(payload: SolicitudARendirInsert): Promise<SolicitudARendir> {
  const { data, error } = await supabase
    .from('solicitud_arendir').insert(payload).select(SEL).single()
  if (error) throw error
  return data as SolicitudARendir
}

export async function updateARendir(id: number, payload: Partial<SolicitudARendir>): Promise<void> {
  const { error } = await supabase.from('solicitud_arendir').update(payload).eq('id', id)
  if (error) throw error
}

// ── Estado helpers ────────────────────────────────────────────
export async function enviarARendir(id: number): Promise<void> {
  const { error } = await supabase.from('solicitud_arendir')
    .update({ estado: 'En Revision' }).eq('id', id)
  if (error) throw error
}

export async function autorizarARendir(id: number, aprobadorId: string): Promise<void> {
  const { error } = await supabase.from('solicitud_arendir')
    .update({ estado: 'Autorizado', usuario_aprobador: aprobadorId, fecha_aprobacion: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function rechazarARendir(id: number, comentario: string): Promise<void> {
  const { error } = await supabase.from('solicitud_arendir')
    .update({ estado: 'Rechazado', comentario }).eq('id', id)
  if (error) throw error
}

export async function devolverARendir(id: number, comentario: string): Promise<void> {
  const { error } = await supabase.from('solicitud_arendir')
    .update({ estado: 'Devuelto', comentario }).eq('id', id)
  if (error) throw error
}

// ── Detalle ───────────────────────────────────────────────────
export async function addDetalle(payload: ARendirDetalleInsert): Promise<ARendirDetalle> {
  const { data, error } = await supabase
    .from('solicitud_arendir_detalle').insert(payload).select().single()
  if (error) throw error
  return data as ARendirDetalle
}

export async function updateDetalle(id: number, payload: Partial<ARendirDetalle>): Promise<ARendirDetalle> {
  const { data, error } = await supabase
    .from('solicitud_arendir_detalle').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data as ARendirDetalle
}

export async function deleteDetalle(id: number, archivoPath?: string | null): Promise<void> {
  if (archivoPath) {
    await supabase.storage.from(BUCKET).remove([archivoPath])
  }
  const { error } = await supabase.from('solicitud_arendir_detalle').delete().eq('id', id)
  if (error) throw error
}

export async function recalcTotal(solicitudId: number): Promise<void> {
  const { data } = await supabase
    .from('solicitud_arendir_detalle')
    .select('importe')
    .eq('solicitud_arendir_id', solicitudId)
  const total = (data ?? []).reduce((s, r) => s + (r.importe ?? 0), 0)
  await supabase.from('solicitud_arendir').update({ total_reembolso: total }).eq('id', solicitudId)
}

// ── Storage ───────────────────────────────────────────────────
export async function uploadSustento(file: File, solicitudId: number): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${solicitudId}/sustento/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function uploadDetalleArchivo(file: File, solicitudId: number, detalleId: number): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${solicitudId}/detalle/${detalleId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getArchivoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function uploadFirmaARendir(
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
