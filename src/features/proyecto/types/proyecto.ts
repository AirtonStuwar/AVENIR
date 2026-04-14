export interface Proyecto {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  presupuesto: number | null
  fecha_inicio: string | null
  fecha_fin_est: string | null
  activo: boolean | null
  creado_en: string | null
}

export type ProyectoInsert = Omit<Proyecto, 'id' | 'creado_en'>
export type ProyectoUpdate = Partial<ProyectoInsert>

export interface ProyectoFiltros {
  search?: string
  activo?: boolean | null
  page?: number
  pageSize?: number
}

export interface ProyectoPaginado {
  data: Proyecto[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}