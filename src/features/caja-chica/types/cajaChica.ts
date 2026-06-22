export interface CajaChica {
  id: number
  codigo: string | null
  proyecto_id: number | null
  responsable_id: string | null
  periodo_desde: string
  periodo_hasta: string
  monto_asignado: number
  saldo_anterior: number
  transferencia: number
  total_gastos: number
  saldo_actual: number
  cuenta_bbva: string | null
  estado: 'Pendiente' | 'En Revision' | 'Autorizado' | 'Rechazado' | 'Devuelto'
  usuario_aprobador: string | null
  fecha_aprobacion: string | null
  comentario: string | null
  fecha_creacion: string | null
  // joins
  proyecto?: { id: number; nombre: string } | null
  // enriched
  responsable_nombre?: string | null
  responsable_email?: string | null
  aprobador_nombre?: string | null
  detalles?: CajaChicaDetalle[]
}

export interface CajaChicaDetalle {
  id: number
  caja_chica_id: number
  fecha: string
  area_id: number | null
  proveedor: string
  tipo_documento: string
  numero_documento: string | null
  detalle: string
  monto: number
  archivo_path: string | null
  fecha_creacion: string | null
  // join
  area_nombre?: string | null
}

export type CajaChicaInsert = Omit<CajaChica,
  'id' | 'codigo' | 'fecha_creacion' | 'total_gastos' | 'saldo_actual' |
  'usuario_aprobador' | 'fecha_aprobacion' | 'comentario' | 'detalles' |
  'proyecto' | 'responsable_nombre' | 'responsable_email' | 'aprobador_nombre'
>

export type CajaChicaDetalleInsert = Omit<CajaChicaDetalle, 'id' | 'fecha_creacion' | 'area_nombre'>

export interface CajaChicaFiltros {
  page?: number
  pageSize?: number
  role?: number | null
  userId?: string | null
  estado?: string | null
  proyectoId?: number | null
}

export interface CajaChicaPaginado {
  data: CajaChica[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
