export interface ARendirDetalle {
  id: number
  solicitud_arendir_id: number
  fecha_documento: string | null
  proveedor: string | null
  tipo_documento: string | null
  numero_documento: string | null
  concepto: string | null
  importe: number
  archivo_path: string | null
  fecha_creacion: string | null
}

export type ARendirDetalleInsert = Omit<ARendirDetalle, 'id' | 'fecha_creacion'>

export interface SolicitudARendir {
  id: number
  codigo: string | null
  beneficiario_id: string | null
  proyecto_id: number | null
  importe: number
  fecha_rendicion: string | null
  total_reembolso: number
  documento_sustento_path: string | null
  estado: 'Pendiente' | 'En Revision' | 'Autorizado' | 'Rechazado' | 'Devuelto'
  usuario_aprobador: string | null
  fecha_aprobacion: string | null
  comentario: string | null
  fecha_creacion: string | null
  // joins
  proyecto?: { id: number; nombre: string } | null
  detalles?: ARendirDetalle[]
  // enriched
  beneficiario_nombre?: string | null
  beneficiario_email?: string | null
  beneficiario_dni?: string | null
  beneficiario_cargo?: string | null
  aprobador_nombre?: string | null
}

export type SolicitudARendirInsert = Omit<SolicitudARendir,
  'id' | 'codigo' | 'fecha_creacion' | 'total_reembolso' |
  'usuario_aprobador' | 'fecha_aprobacion' | 'comentario' | 'detalles' |
  'beneficiario_nombre' | 'beneficiario_email' | 'beneficiario_dni' |
  'beneficiario_cargo' | 'aprobador_nombre'
>

export interface ARendirFiltros {
  page?: number
  pageSize?: number
  role?: number | null
  userId?: string | null
  estado?: string | null
}

export interface ARendirPaginado {
  data: SolicitudARendir[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
