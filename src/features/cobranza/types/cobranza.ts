export interface CobranzaCliente {
  id: number
  codigo: string | null
  creador_id: string
  proyecto_id: number
  cliente_nombre: string
  cliente_edad: number | null
  cliente_profesion: string | null
  cliente_dni: string | null
  cliente_correo: string | null
  banco_cliente: string | null
  metodo_pago: 'Transferencia' | 'Depósito' | 'Efectivo'
  cuenta_pago_id: number
  importe: number
  fecha_pago: string
  estado: 'Registrado' | 'Anulado'
  comentario: string | null
  fecha_creacion: string
  // joins
  proyecto?: { id: number; nombre: string } | null
  cuenta_pago?: { id: number; banco: string; numero_cuenta: string; moneda: string } | null
  // enriquecido
  creador_nombre?: string | null
}

export type CobranzaClienteInsert = Omit<CobranzaCliente,
  'id' | 'codigo' | 'fecha_creacion' | 'estado' | 'comentario' | 'proyecto' | 'cuenta_pago' | 'creador_nombre'
>

export interface CobranzaFiltros {
  page?: number
  pageSize?: number
  role?: number | null
  userId?: string | null
  proyectoId?: number | null
  fechaDesde?: string | null
  fechaHasta?: string | null
}

export interface CobranzaPaginado {
  data: CobranzaCliente[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
