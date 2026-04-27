import { supabase } from '../../../api/supabase'

export interface SolicitudRow {
  id: number
  codigo: string | null
  razon_social: string | null
  proyecto_id: number | null
  estado_id: number | null
  fecha_creacion: string | null
  fecha_pedido: string | null
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

export async function getDashboardData(): Promise<DashboardData> {
  const [solRes, proyRes, detRes] = await Promise.all([
    supabase
      .from('solicitud')
      .select('id, codigo, razon_social, proyecto_id, estado_id, fecha_creacion, fecha_pedido, estado_soli:estado_id(id,nombre,tipo), proyecto:proyecto_id(id,nombre)')
      .order('fecha_creacion', { ascending: false }),
    supabase
      .from('proyecto')
      .select('id, nombre, estado, presupuesto, fecha_inicio, fecha_fin'),
    supabase
      .from('solicitud_detalle')
      .select('solicitud_id, valor_total, cantidad, valor_unitario'),
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
