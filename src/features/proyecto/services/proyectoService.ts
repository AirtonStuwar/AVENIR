import { supabase } from '../../../api/supabase'
import type { Proyecto, ProyectoInsert, ProyectoUpdate, ProyectoFiltros, ProyectoPaginado, ProyectoPartida, ProyectoPartidaInsert, ProyectoPartidaUpdate } from '../types/proyecto'

const TABLE = 'proyecto'

export async function getProyectos(filtros: ProyectoFiltros = {}): Promise<ProyectoPaginado> {
  const { search, estado, page = 1, pageSize = 10 } = filtros
  const from = (page - 1) * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order('fecha_creacion', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%,descripcion.ilike.%${search}%,ruc.ilike.%${search}%`)
  }
  if (estado !== undefined && estado !== null) {
    query = query.eq('estado', estado)
  }

  const { data, error, count } = await query
  if (error) throw error

  const total      = count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return { data: (data ?? []) as Proyecto[], total, page, pageSize, totalPages }
}

export async function getProyectoById(id: number): Promise<Proyecto> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Proyecto
}

export async function createProyecto(payload: ProyectoInsert): Promise<Proyecto> {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().maybeSingle()
  if (error) throw error
  return data as Proyecto
}

export async function updateProyecto(id: number, payload: ProyectoUpdate): Promise<Proyecto> {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as Proyecto
}

export async function deleteProyecto(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function toggleProyectoEstado(id: number, currentEstado: string | null): Promise<Proyecto> {
  const nuevo = currentEstado === 'Activo' ? 'Inactivo' : 'Activo'
  return updateProyecto(id, { estado: nuevo })
}

// ── Partidas ───────────────────────────────────────────────────────

export async function getPartidasByProyecto(proyectoId: number): Promise<ProyectoPartida[]> {
  const { data, error } = await supabase
    .from('proyecto_partida')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .eq('estado', 'Activo')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as ProyectoPartida[]
}

export async function createPartida(payload: ProyectoPartidaInsert): Promise<ProyectoPartida> {
  const { data, error } = await supabase.from('proyecto_partida').insert(payload).select().maybeSingle()
  if (error) throw error
  return data as ProyectoPartida
}

export async function updatePartida(id: number, payload: ProyectoPartidaUpdate): Promise<ProyectoPartida> {
  const { data, error } = await supabase.from('proyecto_partida').update(payload).eq('id', id).select().maybeSingle()
  if (error) throw error
  return data as ProyectoPartida
}

export async function deletePartida(id: number): Promise<void> {
  const { error } = await supabase.from('proyecto_partida').delete().eq('id', id)
  if (error) throw error
}