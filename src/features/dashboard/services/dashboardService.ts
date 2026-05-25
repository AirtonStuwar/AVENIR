import { supabase } from '../../../api/supabase'

const SOL_SELECT = 'id, codigo, razon_social, proyecto_id, estado_id, fecha_creacion, fecha_pedido, monto_total, estado_soli:estado_id(id,nombre,tipo), proyecto:proyecto_id(id,nombre)'

export interface SolicitudRow {
  id: number
  codigo: string | null
  razon_social: string | null
  proyecto_id: number | null
  estado_id: number | null
  fecha_creacion: string | null
  fecha_pedido: string | null
  monto_total: number | null
  estado_soli: { id: number; nombre: string; tipo: string | null } | null
  proyecto: { id: number; nombre: string } | null
}

export interface ProyectoRow {
  id: number
  nombre: string
  estado: string | null
  presupuesto: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

export interface DetalleRow {
  solicitud_id: number
  valor_total: number | null
  cantidad: number
  valor_unitario: number
}

export interface DashboardData {
  solicitudes: SolicitudRow[]
  proyectos: ProyectoRow[]
  detalles: DetalleRow[]
}

// ── Admin ────────────────────────────────────────────────────────
export async function getDashboardData(): Promise<DashboardData> {
  const [solRes, proyRes, detRes] = await Promise.all([
    supabase.from('solicitud').select(SOL_SELECT).order('fecha_creacion', { ascending: false }),
    supabase.from('proyecto').select('id, nombre, estado, presupuesto, fecha_inicio, fecha_fin'),
    supabase.from('solicitud_detalle').select('solicitud_id, valor_total, cantidad, valor_unitario'),
  ])
  if (solRes.error) throw solRes.error
  if (proyRes.error) throw proyRes.error
  if (detRes.error) throw detRes.error
  return {
    solicitudes: (solRes.data ?? []) as unknown as SolicitudRow[],
    proyectos:   (proyRes.data ?? []) as ProyectoRow[],
    detalles:    (detRes.data ?? []) as DetalleRow[],
  }
}

// ── Aprobador ────────────────────────────────────────────────────
export interface AprobadorData {
  enCola: SolicitudRow[]       // estado = Evaluado
  aprobadas: SolicitudRow[]    // estado = Aprobado / Facturación Pendiente / Completado
  rechazadas: SolicitudRow[]   // estado = Rechazado
  proyectos: ProyectoRow[]
  detalles: DetalleRow[]
}

export async function getAprobadorData(): Promise<AprobadorData> {
  const [solRes, proyRes, detRes] = await Promise.all([
    supabase
      .from('solicitud')
      .select(SOL_SELECT)
      .in('estado_soli.nombre', ['Evaluado', 'Aprobado', 'Facturación Pendiente', 'Completado', 'Rechazado'])
      .order('fecha_creacion', { ascending: false }),
    supabase.from('proyecto').select('id, nombre, estado, presupuesto'),
    supabase.from('solicitud_detalle').select('solicitud_id, valor_total, cantidad, valor_unitario'),
  ])
  if (solRes.error) throw solRes.error
  if (proyRes.error) throw proyRes.error
  if (detRes.error) throw detRes.error

  const all = (solRes.data ?? []) as unknown as SolicitudRow[]
  return {
    enCola:    all.filter(s => s.estado_soli?.nombre === 'Evaluado'),
    aprobadas: all.filter(s => ['Aprobado', 'Facturación Pendiente', 'Completado'].includes(s.estado_soli?.nombre ?? '')),
    rechazadas: all.filter(s => s.estado_soli?.nombre === 'Rechazado'),
    proyectos: (proyRes.data ?? []) as ProyectoRow[],
    detalles:  (detRes.data ?? []) as DetalleRow[],
  }
}

// ── Evaluador ────────────────────────────────────────────────────
export interface EvaluadorData {
  enRevision: SolicitudRow[]  // estado = En Revision
  evaluadas: SolicitudRow[]   // estado = Evaluado
  devueltas: SolicitudRow[]   // estado = Pendiente (devueltas)
}

export async function getEvaluadorData(): Promise<EvaluadorData> {
  const { data, error } = await supabase
    .from('solicitud')
    .select(SOL_SELECT)
    .order('fecha_creacion', { ascending: true })

  if (error) throw error
  const all = (data ?? []) as unknown as SolicitudRow[]
  return {
    enRevision: all.filter(s => s.estado_soli?.nombre === 'En Revision'),
    evaluadas:  all.filter(s => s.estado_soli?.nombre === 'Evaluado'),
    devueltas:  all.filter(s => s.estado_soli?.nombre === 'Pendiente'),
  }
}

// ── Visualizador ─────────────────────────────────────────────────
export interface VisualizadorData {
  facturacionPendiente: SolicitudRow[]
  completadas: SolicitudRow[]
  detalles: DetalleRow[]
}

export async function getVisualizadorData(): Promise<VisualizadorData> {
  const [solRes, detRes] = await Promise.all([
    supabase
      .from('solicitud')
      .select(SOL_SELECT)
      .order('fecha_creacion', { ascending: false }),
    supabase.from('solicitud_detalle').select('solicitud_id, valor_total, cantidad, valor_unitario'),
  ])
  if (solRes.error) throw solRes.error
  if (detRes.error) throw detRes.error

  const all = (solRes.data ?? []) as unknown as SolicitudRow[]
  return {
    facturacionPendiente: all.filter(s => s.estado_soli?.nombre === 'Facturación Pendiente'),
    completadas:          all.filter(s => s.estado_soli?.nombre === 'Completado'),
    detalles:             (detRes.data ?? []) as DetalleRow[],
  }
}

// ── Proveedor métricas ───────────────────────────────────────────
export interface ProveedorMetrica {
  ruc: string
  razon_social: string | null
  promedio_general: number | null
  pct_recomendaria: number | null
  total_encuestas: number
}

export interface ProveedorMetricasData {
  totalProveedores: number
  promedioGeneral: number | null
  pctRecomendaria: number | null
  alertas: number
  topProveedores: ProveedorMetrica[]
}

export async function getProveedorMetricas(): Promise<ProveedorMetricasData> {
  const [provRes, encRes] = await Promise.all([
    supabase.from('proveedor').select('ruc, razon_social'),
    supabase.from('encuesta_proveedor').select('proveedor_ruc, calidad, tiempo, precio, comunicacion, recomendaria'),
  ])
  if (provRes.error) throw provRes.error
  if (encRes.error) throw encRes.error

  const proveedores = (provRes.data ?? []) as { ruc: string; razon_social: string | null }[]
  const encuestas   = (encRes.data ?? []) as {
    proveedor_ruc: string | null
    calidad: number; tiempo: number; precio: number; comunicacion: number
    recomendaria: boolean
  }[]

  // Group by ruc
  const byRuc: Record<string, typeof encuestas> = {}
  for (const e of encuestas) {
    if (!e.proveedor_ruc) continue
    byRuc[e.proveedor_ruc] = byRuc[e.proveedor_ruc] ?? []
    byRuc[e.proveedor_ruc].push(e)
  }

  const avg = (nums: number[]) => nums.reduce((s, v) => s + v, 0) / nums.length

  const metricas: ProveedorMetrica[] = proveedores.map(p => {
    const encs = byRuc[p.ruc] ?? []
    if (encs.length === 0) {
      return { ruc: p.ruc, razon_social: p.razon_social, promedio_general: null, pct_recomendaria: null, total_encuestas: 0 }
    }
    const promedio_general = +((
      avg(encs.map(e => e.calidad)) +
      avg(encs.map(e => e.tiempo)) +
      avg(encs.map(e => e.precio)) +
      avg(encs.map(e => e.comunicacion))
    ) / 4).toFixed(1)
    const pct_recomendaria = Math.round((encs.filter(e => e.recomendaria).length / encs.length) * 100)
    return { ruc: p.ruc, razon_social: p.razon_social, promedio_general, pct_recomendaria, total_encuestas: encs.length }
  })

  const evaluados = metricas.filter(m => m.total_encuestas > 0)
  const promedioGeneral  = evaluados.length
    ? +(evaluados.reduce((s, m) => s + (m.promedio_general ?? 0), 0) / evaluados.length).toFixed(1)
    : null
  const pctRecomendaria  = evaluados.length
    ? Math.round(evaluados.reduce((s, m) => s + (m.pct_recomendaria ?? 0), 0) / evaluados.length)
    : null
  const alertas = evaluados.filter(m => (m.promedio_general ?? 5) < 3).length

  const topProveedores = [...evaluados]
    .sort((a, b) => (b.promedio_general ?? 0) - (a.promedio_general ?? 0))
    .slice(0, 5)

  return { totalProveedores: proveedores.length, promedioGeneral, pctRecomendaria, alertas, topProveedores }
}

// ── Usuario ──────────────────────────────────────────────────────
export interface UsuarioData {
  solicitudes: SolicitudRow[]
  detalles: DetalleRow[]
}

export async function getUsuarioData(userId: string): Promise<UsuarioData> {
  const [solRes, detRes] = await Promise.all([
    supabase
      .from('solicitud')
      .select(SOL_SELECT)
      .eq('usuario_creador', userId)
      .order('fecha_creacion', { ascending: false }),
    supabase
      .from('solicitud_detalle')
      .select('solicitud_id, valor_total, cantidad, valor_unitario'),
  ])
  if (solRes.error) throw solRes.error
  if (detRes.error) throw detRes.error

  const sols = (solRes.data ?? []) as unknown as SolicitudRow[]
  const solIds = new Set(sols.map(s => s.id))
  return {
    solicitudes: sols,
    detalles: ((detRes.data ?? []) as DetalleRow[]).filter(d => solIds.has(d.solicitud_id)),
  }
}
