import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../../../store/authStore'
import { getDevoluciones } from '../services/devolucionService'
import type { DevolucionCliente } from '../types/devolucion'

export function useDevolucion() {
  const { userRole, user } = useAuthStore()
  const [data,           setData]          = useState<DevolucionCliente[]>([])
  const [total,          setTotal]         = useState(0)
  const [page,           setPageState]     = useState(1)
  const [totalPages,     setTotalPages]    = useState(1)
  const [loading,        setLoading]       = useState(true)
  const [estadoFilter,   setEstadoFilter]  = useState<string | null>(null)
  const [proyectoFilter, setProyectoFilter] = useState<number | null>(null)
  const pageSize = 10

  const load = useCallback(async (p: number, estado: string | null, proyectoId: number | null) => {
    setLoading(true)
    try {
      const res = await getDevoluciones({ page: p, pageSize, role: userRole, userId: user?.id, estado, proyectoId })
      setData(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [userRole, user?.id, pageSize])

  useEffect(() => { load(page, estadoFilter, proyectoFilter) }, [load, page, estadoFilter, proyectoFilter])

  const setPage = (p: number) => setPageState(p)
  const handleSetEstadoFilter   = (v: string | null) => { setEstadoFilter(v);   setPageState(1) }
  const handleSetProyectoFilter = (v: number | null) => { setProyectoFilter(v); setPageState(1) }
  const refresh = useCallback(() => load(page, estadoFilter, proyectoFilter), [load, page, estadoFilter, proyectoFilter])

  return {
    data, total, page, pageSize, totalPages, loading,
    estadoFilter, proyectoFilter,
    setPage,
    setEstadoFilter: handleSetEstadoFilter,
    setProyectoFilter: handleSetProyectoFilter,
    refresh,
  }
}
