export interface Proyecto {
  id: number
  codigo: string | null
  nombre: string
  descripcion: string | null
  presupuesto: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string | null
  ruc: string | null
  direccion: string | null
  fecha_creacion: string | null
  usuario_creador: string | null
}

export type ProyectoInsert = Omit<Proyecto, 'id' | 'fecha_creacion'>
export type ProyectoUpdate = Partial<ProyectoInsert>

export interface ProyectoFiltros {
  search?: string
  estado?: string | null
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