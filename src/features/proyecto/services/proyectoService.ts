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

// ── Consumo de presupuesto ────────────────────────────────────────

export interface Consumo { pen: number; usd: number }

export async function getConsumoByProyectos(proyectoIds: number[]): Promise<{
  porProyecto: Record<number, Consumo>
  porPartida:  Record<number, Consumo>
}> {
  if (!proyectoIds.length) return { porProyecto: {}, porPartida: {} }

  const porProyecto: Record<number, Consumo> = {}
  const porPartida:  Record<number, Consumo> = {}

  const add = (map: Record<number, Consumo>, key: number, moneda: string, amount: number) => {
    if (!map[key]) map[key] = { pen: 0, usd: 0 }
    if (moneda === 'USD') map[key].usd += amount
    else map[key].pen += amount
  }

  // 1. Solicitudes (OC + RxH) — Aprobado + Observado (en corrección, pero ya comprometido)
  const { data: estadoData } = await supabase
    .from('estado_soli').select('id').in('nombre', ['Aprobado', 'Observado'])
  const estadoIds = (estadoData ?? []).map(e => e.id)

  if (estadoIds.length) {
    const { data: solData } = await supabase
      .from('solicitud')
      .select('id, proyecto_id, proyecto_partida_id, moneda, solicitud_tipo:tipo_id(nombre)')
      .in('estado_id', estadoIds)
      .in('proyecto_id', proyectoIds)

    const sols = (solData ?? []) as unknown as {
      id: number; proyecto_id: number; proyecto_partida_id: number | null
      moneda: string | null; solicitud_tipo: { nombre: string } | null
    }[]

    if (sols.length) {
      const solIds = sols.map(s => s.id)
      const { data: detData } = await supabase
        .from('solicitud_detalle')
        .select('solicitud_id, cantidad, valor_unitario, valor_total')
        .in('solicitud_id', solIds)

      const detMap: Record<number, number> = {}
      for (const d of (detData ?? []) as { solicitud_id: number; cantidad: number; valor_unitario: number; valor_total?: number | null }[]) {
        detMap[d.solicitud_id] = (detMap[d.solicitud_id] ?? 0) + (d.valor_total ?? d.cantidad * d.valor_unitario)
      }

      for (const s of sols) {
        const subtotal = detMap[s.id] ?? 0
        const isRxH = s.solicitud_tipo?.nombre === 'Recibo por Honorarios'
        const total = isRxH ? subtotal : subtotal * 1.18
        const mon = s.moneda ?? 'PEN'
        add(porProyecto, s.proyecto_id, mon, total)
        if (s.proyecto_partida_id) add(porPartida, s.proyecto_partida_id, mon, total)
      }
    }
  }

  // 2. A Rendir — todo lo ya aprobado por el APROBADOR (dinero comprometido/entregado)
  const { data: arData } = await supabase
    .from('solicitud_arendir')
    .select('proyecto_id, proyecto_partida_id, importe, total_reembolso, estado, moneda')
    .in('estado', ['Aprobado', 'Pagado', 'En Revision', 'Cerrado', 'Observado'])
    .in('proyecto_id', proyectoIds)

  for (const r of (arData ?? []) as { proyecto_id: number; proyecto_partida_id: number | null; importe: number; total_reembolso: number; estado: string; moneda: string | null }[]) {
    // Antes de rendir gastos (Aprobado) el monto comprometido es el adelanto; ya rendido, el total rendido
    const monto = r.estado === 'Aprobado' ? r.importe : r.total_reembolso
    add(porProyecto, r.proyecto_id, r.moneda ?? 'PEN', monto)
    if (r.proyecto_partida_id) add(porPartida, r.proyecto_partida_id, r.moneda ?? 'PEN', monto)
  }

  // 3. Reembolso — Autorizado + Observado (en corrección, pero ya comprometido)
  const { data: reData } = await supabase
    .from('solicitud_reembolso')
    .select('proyecto_id, proyecto_partida_id, total_reembolso, moneda')
    .in('estado', ['Autorizado', 'Observado'])
    .in('proyecto_id', proyectoIds)

  for (const r of (reData ?? []) as { proyecto_id: number; proyecto_partida_id: number | null; total_reembolso: number; moneda: string | null }[]) {
    add(porProyecto, r.proyecto_id, r.moneda ?? 'PEN', r.total_reembolso)
    if (r.proyecto_partida_id) add(porPartida, r.proyecto_partida_id, r.moneda ?? 'PEN', r.total_reembolso)
  }

  // 4. Caja Chica — Autorizado (fondo ya gastado/comprometido)
  const { data: ccData } = await supabase
    .from('caja_chica')
    .select('proyecto_id, total_gastos')
    .eq('estado', 'Autorizado')
    .in('proyecto_id', proyectoIds)

  for (const r of (ccData ?? []) as { proyecto_id: number; total_gastos: number }[]) {
    add(porProyecto, r.proyecto_id, 'PEN', r.total_gastos)
  }

  // 5. Devolución de Cliente — Autorizado + Observado (egreso comprometido)
  const { data: dcData } = await supabase
    .from('devolucion_cliente')
    .select('proyecto_id, proyecto_partida_id, monto, moneda')
    .in('estado', ['Autorizado', 'Observado'])
    .in('proyecto_id', proyectoIds)

  for (const r of (dcData ?? []) as { proyecto_id: number | null; proyecto_partida_id: number | null; monto: number; moneda: string | null }[]) {
    if (!r.proyecto_id) continue
    add(porProyecto, r.proyecto_id, r.moneda ?? 'PEN', r.monto)
    if (r.proyecto_partida_id) add(porPartida, r.proyecto_partida_id, r.moneda ?? 'PEN', r.monto)
  }

  return { porProyecto, porPartida }
}