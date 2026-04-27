import { supabase } from '../../../api/supabase'
import type { Solicitud, SolicitudInsert, SolicitudUpdate, SolicitudFiltros, SolicitudPaginado, SolicitudDetalleInsert, SolicitudDetalle, SolicitudArchivo } from '../types/solicitud'
import { ROLES } from '../types/solicitud'

const TABLE = 'solicitud'

// ── Estado ID cache ───────────────────────────────────────────────
let estadoCache: Record<string, number> = {}
let estadoCacheLoaded = false

async function resolveEstadoIds(nombres: string[]): Promise<number[]> {
  if (!estadoCacheLoaded) {
    const { data } = await supabase.from('estado_soli').select('id, nombre')
    estadoCache = {}
    for (const row of (data ?? []) as { id: number; nombre: string }[]) {
      if (row.nombre) estadoCache[row.nombre] = row.id
    }
    estadoCacheLoaded = true
  }
  return nombres.map(n => estadoCache[n]).filter((id): id is number => id !== undefined)
}

function getRoleEstadoTipos(role: number): string[] {
  const map: Record<number, string[]> = {
    [ROLES.EVALUADOR]:    ['En Revision'],
    [ROLES.APROBADOR]:    ['Evaluado', 'Aprobado', 'Rechazado'],
    [ROLES.VISUALIZADOR]: ['Aprobado'],
  }
  return map[role] ?? []
}

async function enrichSolicitudes(solicitudes: Solicitud[]): Promise<Solicitud[]> {
  const userIds = [...new Set(solicitudes.map(s => s.usuario_creador).filter(Boolean))] as string[]
  if (userIds.length === 0) return solicitudes

  const [areaRes, userRes] = await Promise.all([
    supabase
      .from('area_usuario')
      .select('usuario_id, area:area_id(nombre)')
      .in('usuario_id', userIds)
      .eq('estado', 1),
    // vista_creadores: CREATE OR REPLACE VIEW public.vista_creadores AS
    //   SELECT id, email FROM auth.users;
    // GRANT SELECT ON public.vista_creadores TO anon, authenticated;
    supabase
      .from('vista_creadores')
      .select('id, email')
      .in('id', userIds),
  ])

  const areaMap: Record<string, string> = {}
  for (const row of (areaRes.data ?? []) as any[]) {
    if (row.usuario_id && row.area?.nombre) {
      areaMap[row.usuario_id] = row.area.nombre
    }
  }

  const emailMap: Record<string, string> = {}
  for (const row of (userRes.data ?? []) as any[]) {
    if (row.id && row.email) emailMap[row.id] = row.email
  }

  return solicitudes.map(s => ({
    ...s,
    area_nombre:   s.usuario_creador ? (areaMap[s.usuario_creador]  ?? null) : null,
    creador_email: s.usuario_creador ? (emailMap[s.usuario_creador] ?? null) : null,
  }))
}

export async function getSolicitudes(filtros: SolicitudFiltros = {}): Promise<SolicitudPaginado> {
  const { search, proyecto_id, estado_id, page = 1, pageSize = 10, role, userId } = filtros
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query: any = supabase
    .from(TABLE)
    .select('*, proyecto:proyecto_id(id,nombre), solicitud_tipo:tipo_id(id,nombre), estado_soli:estado_id(id,nombre,tipo)', { count: 'exact' })
    .order('fecha_creacion', { ascending: false })
    .range(from, to)

  // ── Filtro por rol ──────────────────────────────────────────────
  if (role === ROLES.USUARIO && userId) {
    query = query.eq('usuario_creador', userId)
  } else if (role && role !== ROLES.ADMIN) {
    const tipos = getRoleEstadoTipos(role)
    if (tipos.length > 0) {
      const ids = await resolveEstadoIds(tipos)
      query = ids.length > 0 ? query.in('estado_id', ids) : query.eq('id', -1)
    }
  }

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
  const enriched   = await enrichSolicitudes((data ?? []) as Solicitud[])

  return { data: enriched, total, page, pageSize, totalPages }
}

// ── Acciones de flujo ─────────────────────────────────────────────
export async function enviarARevision(id: number): Promise<Solicitud> {
  const [estadoId] = await resolveEstadoIds(['En Revision'])
  if (!estadoId) throw new Error('Estado "En Revision" no encontrado en BD')
  return updateSolicitud(id, { estado_id: estadoId })
}

export async function cancelarSolicitud(id: number): Promise<Solicitud> {
  const [estadoId] = await resolveEstadoIds(['Cancelado'])
  if (!estadoId) throw new Error('Estado "Cancelado" no encontrado en BD')
  return updateSolicitud(id, { estado_id: estadoId })
}

export async function marcarEvaluado(id: number): Promise<Solicitud> {
  const [estadoId] = await resolveEstadoIds(['Evaluado'])
  if (!estadoId) throw new Error('Estado "Evaluado" no encontrado en BD')
  return updateSolicitud(id, { estado_id: estadoId })
}

export async function devolverSolicitud(id: number, comentario: string): Promise<Solicitud> {
  const [estadoId] = await resolveEstadoIds(['Pendiente'])
  if (!estadoId) throw new Error('Estado "Pendiente" no encontrado en BD')
  return updateSolicitud(id, { estado_id: estadoId, comentario_gerencia: comentario })
}

export async function aprobarSolicitud(id: number, userId: string): Promise<Solicitud> {
  const [estadoId] = await resolveEstadoIds(['Aprobado'])
  if (!estadoId) throw new Error('Estado "Aprobado" no encontrado en BD')
  return updateSolicitud(id, {
    estado_id:         estadoId,
    fecha_aprobacion:  new Date().toISOString().slice(0, 10),
    usuario_aprobador: userId,
  })
}

export async function rechazarSolicitud(id: number, comentario: string): Promise<Solicitud> {
  const [estadoId] = await resolveEstadoIds(['Rechazado'])
  if (!estadoId) throw new Error('Estado "Rechazado" no encontrado en BD')
  return updateSolicitud(id, { estado_id: estadoId, comentario_gerencia: comentario })
}

export async function getSolicitudById(id: number): Promise<Solicitud> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, proyecto:proyecto_id(id,nombre), solicitud_tipo:tipo_id(id,nombre), estado_soli:estado_id(id,nombre,tipo)')
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

  const { data, error } = await supabase.from(TABLE).insert(rest).select('*, proyecto:proyecto_id(id,nombre), solicitud_tipo:tipo_id(id,nombre), estado_soli:estado_id(id,nombre,tipo)').maybeSingle()
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
  if (!data) throw new Error('No se pudo actualizar la solicitud (sin permisos o fila no encontrada)')
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

const BUCKET = 'solicitud-archivos'

export async function getArchivosBySolicitud(solicitud_id: number): Promise<SolicitudArchivo[]> {
  const { data, error } = await supabase
    .from('solicitud_archivo')
    .select('*')
    .eq('solicitud_id', solicitud_id)
    .order('tipo_archivo')
  if (error) throw error
  return (data ?? []) as SolicitudArchivo[]
}

export async function uploadArchivoSolicitud(
  file: File,
  solicitudId: number,
  tipoArchivo: string
): Promise<SolicitudArchivo> {
  const ext  = file.name.split('.').pop() ?? 'pdf'
  const path = `${solicitudId}/${tipoArchivo.replace(/ /g, '_')}/${Date.now()}.${ext}`

  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })
  if (storageErr) throw storageErr

  const { data, error } = await supabase
    .from('solicitud_archivo')
    .insert({ solicitud_id: solicitudId, nombre_archivo: file.name, archivo_path: path, tipo_archivo: tipoArchivo })
    .select()
    .maybeSingle()
  if (error) throw error
  return data as SolicitudArchivo
}

export async function deleteArchivoSolicitud(id: number, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
  const { error } = await supabase.from('solicitud_archivo').delete().eq('id', id)
  if (error) throw error
}

export async function getArchivoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
