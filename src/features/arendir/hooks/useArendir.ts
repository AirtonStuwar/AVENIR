import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../../../store/authStore'
import { getARendir } from '../services/arendirService'
import type { SolicitudARendir } from '../types/arendir'

export function useARendir() {
  const { userRole, user } = useAuthStore()
  const [data,       setData]       = useState<SolicitudARendir[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,    setLoading]    = useState(true)
  const pageSize = 10

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await getARendir({ page: p, pageSize, role: userRole, userId: user?.id })
      setData(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [userRole, user?.id, pageSize])

  useEffect(() => { load(page) }, [load, page])

  const refresh = useCallback(() => load(page), [load, page])

  return { data, total, page, pageSize, totalPages, loading, setPage, refresh }
}
