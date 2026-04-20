import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getSolicitudes, createSolicitud } from '../services/solicitudService'
import type { Solicitud, SolicitudInsert, SolicitudUpdate, SolicitudFiltros, SolicitudPaginado } from '../types/solicitud'

const DEFAULT_PAGE_SIZE = 10

export function useSolicitudes(filtrosIniciales: SolicitudFiltros = {}) {
  const [result, setResult] = useState<SolicitudPaginado>({
    data: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0,
  })
  const [filtros, setFiltros] = useState<SolicitudFiltros>({
    page: 1, pageSize: DEFAULT_PAGE_SIZE, ...filtrosIniciales,
  })
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (f: SolicitudFiltros) => {
    setLoading(true)
    try {
      const res = await getSolicitudes(f)
      setResult(res)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar solicitudes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(filtros) }, [filtros, fetchData])

  const refresh = () => fetchData(filtros)
  const setPage = (page: number) => setFiltros((f) => ({ ...f, page }))
  const setSearch = (search: string) => setFiltros((f) => ({ ...f, search, page: 1 }))
  const setProyectoFilter = (proyecto_id: number | null) =>
    setFiltros((f) => ({ ...f, proyecto_id: proyecto_id ?? undefined, page: 1 }))

  const create = async (payload: SolicitudInsert): Promise<Solicitud | null> => {
    try {
      const nuevo = await createSolicitud(payload)
      toast.success('Solicitud creada.')
      refresh()
      return nuevo
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear solicitud.')
      return null
    }
  }

  return { ...result, loading, filtros, setPage, setSearch, setProyectoFilter, refresh, create }
}
