export interface Usuario {
  id:              string
  nombres:         string | null
  apellidos:       string | null
  nombre_completo: string | null
  correo:          string | null
  cargo:           string | null
  fecha_creacion:  string | null
  firma_path:      string | null
  dni:             string | null
}

export interface SolicitudFormaPago {
  id: number
  nombre: string
  estado: boolean
  fecha_creacion: string | null
}

export interface Detraccion {
  id:           number
  codigo:       string
  concepto:     string
  porcentaje:   number
  monto_minimo: number
}

export interface PlanContable {
  id: number
  tipo_gasto_costo:            string | null
  codigo_starsoft:             string | null
  cuenta_contable_2020_starsoft: number | null
  nombre_cuenta_contable:      string | null
  partida_presupuestal:        string | null
  partida_presupuesta_n1:      string | null
  partida_presupuesta_n2:      string | null
}

export const ROLES = {
  ADMIN:        1,
  EVALUADOR:    8,
  APROBADOR:    9,
  VISUALIZADOR: 10,
  USUARIO:      11,
} as const

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
  forma_pago_id: number | null
  porcentaje_contrato: number | null
  porcentaje_acumulado_contrato: number | null
  porcentaje_pendiente_contrato: number | null
  condiciones: string | null
  motivo_factura: string | null
  fecha_emision_factura: string | null
  fecha_vencimiento_factura: string | null
  fecha_pedido: string | null
  fecha_requerida: string | null
  estado_id: number | null
  fecha_creacion: string | null
  usuario_creador: string | null
  fecha_aprobacion: string | null
  usuario_aprobador: string | null
  comentario_gerencia: string | null
  numero_factura: string | null
  monto_total: number | null
  moneda: string | null
  plan_contable_id: number | null
  usuario_evaluador: string | null
  numero_rxh: string | null
  periodo_servicio: string | null
  porcentaje_retencion: number | null
  monto_retencion: number | null
  aplica_suspension: boolean | null
  detraccion_id:    number | null
  monto_detraccion: number | null
  proyecto_partida_id: number | null
  fecha_pago: string | null
  cuenta_pago_id: number | null
  usuario_pago: string | null
  detraccion_pagada: boolean
  fecha_pago_detraccion: string | null
  proyecto?: { id: number; nombre: string; ruc?: string | null; direccion?: string | null; presupuesto?: number | null } | null
  proyecto_partida?: { id: number; nombre: string; presupuesto_pen: number; presupuesto_usd: number } | null
  detraccion?: Detraccion | null
  solicitud_tipo?: { id: number; nombre: string } | null
  estado_soli?: { id: number; nombre: string; tipo: string | null } | null
  solicitud_forma_pago?: { id: number; nombre: string } | null
  plan_contable?: PlanContable | null
  detalles?: SolicitudDetalle[]
  // enriched fields (set by enrichSolicitudes)
  creador_email?:  string | null
  creador_nombre?: string | null
  creador_cargo?:  string | null
  area_nombre?:    string | null
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
  | 'numero_factura'       // se registra al completar el proceso
  | 'monto_total'          // calculado al enviar a revisión
  | 'plan_contable_id'       // lo asigna el usuario en Step 4 del wizard (o desde el detalle en Pendiente); EVALUADOR puede corregirlo
  | 'usuario_evaluador'      // se registra al marcar Evaluado
  | 'numero_rxh'             // sólo aplica a Recibo por Honorarios
  | 'periodo_servicio'       // sólo aplica a Recibo por Honorarios
  | 'porcentaje_retencion'   // lo asigna el evaluador para RxH
  | 'monto_retencion'        // calculado al marcar Evaluado en RxH
  | 'aplica_suspension'      // se guarda al finalizar Step 3 en RxH
  | 'detraccion_id'          // lo asigna el evaluador al marcar Evaluado
  | 'monto_detraccion'       // calculado al marcar Evaluado
  | 'proyecto_partida_id'    // opcional según si el proyecto tiene partidas
  | 'proyecto_partida'       // join, no se inserta
  | 'fecha_pago'             // lo marca contabilidad
  | 'cuenta_pago_id'         // lo marca contabilidad
  | 'usuario_pago'           // lo marca contabilidad
  | 'detraccion_pagada'      // lo marca contabilidad
  | 'fecha_pago_detraccion'  // lo marca contabilidad
  | 'detalles'               // se reemplaza por SolicitudDetalleInsert[]
> & {
    detalles?: SolicitudDetalleInsert[]
    numero_rxh?: string | null
    periodo_servicio?: string | null
    aplica_suspension?: boolean | null
    proyecto_partida_id?: number | null
  }

export type SolicitudUpdate = Partial<Omit<Solicitud, 'id' | 'fecha_creacion'>>

export interface SolicitudArchivo {
  id: number
  solicitud_id: number
  nombre_archivo: string | null
  archivo_path: string | null
  tipo_archivo: string | null
  fecha_creacion: string | null
}

export type SolicitudArchivoInsert = Omit<SolicitudArchivo, 'id' | 'fecha_creacion'>

export interface SolicitudFiltros {
  search?: string
  proyecto_id?: number | null
  estado_id?: number | null
  mes_aprobacion?: number | null
  pagoFilter?: 'pendiente' | 'pagado' | null
  page?: number
  pageSize?: number
  role?: number | null
  userId?: string | null
}

export interface SolicitudPaginado {
  data: Solicitud[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
