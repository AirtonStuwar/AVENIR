import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getProyectos, createProyecto, updateProyecto, deleteProyecto, toggleProyectoActivo } from '../services/proyectoService'
import type { Proyecto, ProyectoInsert, ProyectoUpdate, ProyectoFiltros, ProyectoPaginado } from '../types/proyecto'

const DEFAULT_PAGE_SIZE = 10

export function useProyectos(filtrosIniciales: ProyectoFiltros = {}) {
  const [result, setResult] = useState<ProyectoPaginado>({
    data: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0,
  })
  const [filtros, setFiltros] = useState<ProyectoFiltros>({
    page: 1, pageSize: DEFAULT_PAGE_SIZE, ...filtrosIniciales,
  })
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (f: ProyectoFiltros) => {
    setLoading(true)
    try {
      const res = await getProyectos(f)
      setResult(res)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar proyectos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(filtros) }, [filtros, fetchData])

  const refresh = () => fetchData(filtros)
  const setPage = (page: number) => setFiltros((f) => ({ ...f, page }))
  const setSearch = (search: string) => setFiltros((f) => ({ ...f, search, page: 1 }))
  const setActivoFilter = (activo: boolean | null) =>
    setFiltros((f) => ({ ...f, activo: activo ?? undefined, page: 1 }))

  const create = async (payload: ProyectoInsert): Promise<Proyecto | null> => {
    try {
      const nuevo = await createProyecto(payload)
      toast.success('Proyecto creado.')
      refresh()
      return nuevo
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear proyecto.')
      return null
    }
  }

  const update = async (id: number, payload: ProyectoUpdate): Promise<Proyecto | null> => {
    try {
      const actualizado = await updateProyecto(id, payload)
      toast.success('Proyecto actualizado.')
      refresh()
      return actualizado
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar.')
      return null
    }
  }

  const remove = async (id: number): Promise<boolean> => {
    try {
      await deleteProyecto(id)
      toast.success('Proyecto eliminado.')
      refresh()
      return true
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar.')
      return false
    }
  }

  const toggleActivo = async (proyecto: Proyecto): Promise<void> => {
    try {
      await toggleProyectoActivo(proyecto.id, !proyecto.activo)
      toast.success(`Proyecto ${!proyecto.activo ? 'activado' : 'desactivado'}.`)
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado.')
    }
  }

  return { ...result, loading, filtros, setPage, setSearch, setActivoFilter, refresh, create, update, remove, toggleActivo }
}