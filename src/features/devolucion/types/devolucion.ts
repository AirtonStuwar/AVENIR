export interface DevolucionCliente {
  id: number
  codigo: string | null
  creador_id: string | null
  proyecto_id: number | null
  proyecto_partida_id: number | null
  cliente_nombre: string
  cliente_dni: string | null
  monto: number
  moneda: 'PEN' | 'USD'
  banco: string | null
  numero_cuenta: string | null
  sustento_path: string | null
  boucher_separacion_path: string | null
  constancia_separacion_path: string | null
  sustento_desistimiento_path: string | null
  estado: 'Pendiente' | 'En Revision' | 'Evaluado' | 'Autorizado' | 'Rechazado' | 'Devuelto' | 'Observado'
  usuario_aprobador: string | null
  fecha_aprobacion: string | null
  comentario: string | null
  fecha_creacion: string
  fecha_pago: string | null
  cuenta_pago_id: number | null
  usuario_pago: string | null
  plan_contable_id: number | null
  usuario_evaluador: string | null

  // Joins
  proyecto?: { id: number; nombre: string } | null
  proyecto_partida?: { id: number; nombre: string } | null
  plan_contable?: { id: number; tipo_gasto_costo: string | null; codigo_starsoft: string | null; nombre_cuenta_contable: string | null; partida_presupuestal: string | null } | null

  // Enriquecidos
  creador_nombre?: string | null
  creador_email?: string | null
  aprobador_nombre?: string | null
  evaluador_nombre?: string | null
}

export type DevolucionClienteInsert = Omit<
  DevolucionCliente,
  | 'id' | 'codigo' | 'fecha_creacion'
  | 'usuario_aprobador' | 'fecha_aprobacion' | 'comentario'
  | 'fecha_pago' | 'cuenta_pago_id' | 'usuario_pago'
  | 'plan_contable_id' | 'usuario_evaluador'
  | 'proyecto' | 'proyecto_partida' | 'plan_contable'
  | 'creador_nombre' | 'creador_email' | 'aprobador_nombre' | 'evaluador_nombre'
>

export interface DevolucionFiltros {
  page?: number
  pageSize?: number
  role?: number | null
  userId?: string | null
  estado?: string | null
  proyectoId?: number | null
}

export interface DevolucionPaginado {
  data: DevolucionCliente[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
