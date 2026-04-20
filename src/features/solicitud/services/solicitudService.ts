import { supabase } from '../../../api/supabase'
import type { Solicitud, SolicitudInsert, SolicitudUpdate, SolicitudFiltros, SolicitudPaginado, SolicitudDetalleInsert, SolicitudDetalle } from '../types/solicitud'

const TABLE = 'solicitud'

export async function getSolicitudes(filtros: SolicitudFiltros = {}): Promise<SolicitudPaginado> {
  const { search, proyecto_id, estado_id, page = 1, pageSize = 10 } = filtros
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  // Select related names from proyecto, solicitud_tipo and estado_soli
  let query: any = supabase
    .from(TABLE)
    .select('*, proyecto:proyecto_id(id,nombre), solicitud_tipo:tipo_id(id,nombre), estado_soli:estado_id(id,nombre)', { count: 'exact' })
    .order('fecha_creacion', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`codigo.ilike.%${search}%,razon_social.ilike.%${search}%,ruc.ilike.%${search}%,contacto_nombre.ilike.%${search}%`)
  }
  if (proyecto_id !== undefined && proyecto_id !== null) {
    query = query.eq('proyecto_id', proyecto_id)
  }
  if (estado_id !== undefined && estado_id !== null) {
    query = query.eq('estado_id', estado_id)
  }

  const { data, error, count } = await query
  if (error) throw error

  const total      = count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return { data: (data ?? []) as Solicitud[], total, page, pageSize, totalPages }
}

export async function getSolicitudById(id: number): Promise<Solicitud> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, proyecto:proyecto_id(id,nombre), solicitud_tipo:tipo_id(id,nombre), estado_soli:estado_id(id,nombre)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error

  // fetch detalles
  if (data && data.id) {
    const { data: detalles, error: errD } = await supabase.from('solicitud_detalle').select('*').eq('solicitud_id', data.id)
    if (errD) throw errD
    ;(data as any).detalles = detalles as SolicitudDetalle[]
  }

  return data as Solicitud
}

export async function createSolicitud(payload: SolicitudInsert): Promise<Solicitud> {
  const { detalles, ...rest } = payload as any

  const { data, error } = await supabase.from(TABLE).insert(rest).select('*, proyecto:proyecto_id(id,nombre), solicitud_tipo:tipo_id(id,nombre), estado_soli:estado_id(id,nombre)').maybeSingle()
  if (error) throw error

  const created = data as Solicitud

  if (detalles && Array.isArray(detalles) && detalles.length > 0) {
    const rows = detalles.map((d: SolicitudDetalleInsert) => ({ ...d, solicitud_id: created.id }))
    const { data: detIns, error: errD } = await supabase.from('solicitud_detalle').insert(rows).select()
    if (errD) throw errD
    ;(created as any).detalles = detIns as SolicitudDetalle[]
  }

  return created
}

export async function updateSolicitud(id: number, payload: SolicitudUpdate): Promise<Solicitud> {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as Solicitud
}

export async function deleteSolicitud(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function getDetallesBySolicitud(solicitud_id: number): Promise<SolicitudDetalle[]> {
  const { data, error } = await supabase.from('solicitud_detalle').select('*').eq('solicitud_id', solicitud_id)
  if (error) throw error
  return (data ?? []) as SolicitudDetalle[]
}

export async function createDetalle(payload: SolicitudDetalleInsert): Promise<SolicitudDetalle> {
  const { data, error } = await supabase.from('solicitud_detalle').insert(payload).select().maybeSingle()
  if (error) throw error
  return data as SolicitudDetalle
}

export async function updateDetalle(id: number, payload: Partial<SolicitudDetalleInsert>): Promise<SolicitudDetalle> {
  const { data, error } = await supabase.from('solicitud_detalle').update(payload).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as SolicitudDetalle
}

export async function deleteDetalle(id: number): Promise<void> {
  const { error } = await supabase.from('solicitud_detalle').delete().eq('id', id)
  if (error) throw error
}
