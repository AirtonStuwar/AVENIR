export interface Solicitud {
  id: number
  codigo: string | null
  tipo_id: number | null
  proyecto_id: number | null
  razon_social: string | null
  direccion: string | null
  ruc: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  contacto_correo: string | null
  banco: string | null
  numero_cuenta: string | null
  cuenta_detracciones: string | null
  forma_pago: string | null
  porcentaje_contrato: number | null
  porcentaje_acumulado_contrato: number | null
  porcentaje_pendiente_contrato: number | null
  condiciones: string | null
  fecha_pedido: string | null
  fecha_requerida: string | null
  prioridad: string | null
  estado_id: number | null
  fecha_creacion: string | null
  usuario_creador: string | null
  fecha_aprobacion: string | null
  usuario_aprobador: string | null
  comentario_gerencia: string | null
  proyecto?: { id: number; nombre: string } | null
  solicitud_tipo?: { id: number; nombre: string } | null
  estado_soli?: { id: number; nombre: string; tipo: string | null } | null
  detalles?: SolicitudDetalle[]
}

export interface SolicitudDetalle {
  id: number
  solicitud_id: number
  cantidad: number
  descripcion: string
  valor_unitario: number
  valor_total?: number
  fecha_creacion?: string | null
  usuario_creador?: string | null
  observaciones?: string | null
}

export type SolicitudDetalleInsert = Omit<SolicitudDetalle, 'id' | 'valor_total' | 'fecha_creacion'>

export type SolicitudInsert = Omit<
  Solicitud,
  | 'id'
  | 'fecha_creacion'
  | 'codigo'               // auto-generado por trigger
  | 'estado_id'            // default 1 en BD
  | 'comentario_gerencia'  // lo llena gerencia al aprobar
  | 'fecha_aprobacion'     // se completa al aprobar
  | 'usuario_aprobador'    // se completa al aprobar
> & { detalles?: SolicitudDetalleInsert[] }

export type SolicitudUpdate = Partial<Omit<Solicitud, 'id' | 'fecha_creacion'>>

export interface SolicitudFiltros {
  search?: string
  proyecto_id?: number | null
  estado_id?: number | null
  page?: number
  pageSize?: number
}

export interface SolicitudPaginado {
  data: Solicitud[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
