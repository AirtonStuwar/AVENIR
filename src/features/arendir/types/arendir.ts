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
  proyecto_partida_id: number | null
  importe: number
  moneda: string           // 'PEN' | 'USD'
  fecha_rendicion: string | null
  total_reembolso: number
  banco: string | null
  numero_cuenta: string | null
  numero_pago: number | null
  documento_sustento_path: string | null
  estado: 'Pendiente' | 'En Revision' | 'Evaluado' | 'Autorizado' | 'Rechazado' | 'Devuelto'
  usuario_aprobador: string | null
  fecha_aprobacion: string | null
  comentario: string | null
  fecha_creacion: string | null
  plan_contable_id: number | null
  usuario_evaluador: string | null
  fecha_pago: string | null
  cuenta_pago_id: number | null
  usuario_pago: string | null
  // joins
  proyecto?: { id: number; nombre: string } | null
  proyecto_partida?: { id: number; nombre: string } | null
  plan_contable?: {
    id: number
    tipo_gasto_costo: string | null
    codigo_starsoft: string | null
    nombre_cuenta_contable: string | null
    partida_presupuestal: string | null
  } | null
  detalles?: ARendirDetalle[]
  // enriched
  beneficiario_nombre?: string | null
  beneficiario_email?: string | null
  beneficiario_dni?: string | null
  beneficiario_cargo?: string | null
  aprobador_nombre?: string | null
  evaluador_nombre?: string | null
}

export type SolicitudARendirInsert = Omit<SolicitudARendir,
  'id' | 'codigo' | 'fecha_creacion' | 'total_reembolso' | 'numero_pago' |
  'usuario_aprobador' | 'fecha_aprobacion' | 'comentario' | 'detalles' |
  'plan_contable_id' | 'usuario_evaluador' | 'plan_contable' |
  'fecha_pago' | 'cuenta_pago_id' | 'usuario_pago' |
  'beneficiario_nombre' | 'beneficiario_email' | 'beneficiario_dni' |
  'beneficiario_cargo' | 'aprobador_nombre' | 'evaluador_nombre'
>

export interface ARendirFiltros {
  page?: number
  pageSize?: number
  role?: number | null
  userId?: string | null
  estado?: string | null
  proyectoId?: number | null
}

export interface ARendirPaginado {
  data: SolicitudARendir[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
