import { useEffect, useState, useCallback } from 'react'
import { getCajasChicas } from '../services/cajaChicaService'
import type { CajaChica, CajaChicaPaginado } from '../types/cajaChica'
import { useAuthStore } from '../../../store/authStore'

export function useCajaChica() {
  const { userRole } = useAuthStore()
  const [data, setData]               = useState<CajaChica[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [loading, setLoading]         = useState(true)
  const [estadoFilter, setEstadoFilter]     = useState<string | null>(null)
  const [proyectoFilter, setProyectoFilter] = useState<number | null>(null)

  const pageSize = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: CajaChicaPaginado = await getCajasChicas({
        page, pageSize,
        estado: estadoFilter,
        proyectoId: proyectoFilter,
        role: userRole,
      })
      setData(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      // handled by caller
    } finally {
      setLoading(false)
    }
  }, [page, estadoFilter, proyectoFilter, userRole])

  useEffect(() => { load() }, [load])

  const changeEstado = (v: string | null) => { setEstadoFilter(v); setPage(1) }
  const changeProyecto = (v: number | null) => { setProyectoFilter(v); setPage(1) }

  return {
    data, total, page, pageSize, totalPages, loading,
    setPage,
    setEstadoFilter: changeEstado,
    setProyectoFilter: changeProyecto,
    refresh: load,
  }
}
