import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, Plus, RefreshCw, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { supabase } from '../api/supabase'
import { useAuthStore } from '../store/authStore'
import { useCajaChica } from '../features/caja-chica/hooks/useCajaChica'
import { ROLES } from '../features/solicitud/types/solicitud'

const ESTADOS = ['Pendiente', 'En Revision', 'Autorizado', 'Rechazado', 'Devuelto']
const ESTADO_BADGE: Record<string, string> = {
  'Pendiente':   'bg-gray-100 text-gray-600',
  'En Revision': 'bg-blue-100 text-blue-700',
  'Autorizado':  'bg-emerald-100 text-emerald-700',
  'Rechazado':   'bg-red-100 text-red-700',
  'Devuelto':    'bg-amber-100 text-amber-700',
}

const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fmtDate = (s: string | null) => s ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00')) : '—'

export default function CajaChicaPage() {
  const navigate = useNavigate()
  const { userRole } = useAuthStore()
  const {
    data, total, page, pageSize, totalPages, loading,
    setPage, setEstadoFilter, setProyectoFilter, refresh,
  } = useCajaChica()

  const [proyectos, setProyectos] = useState<{ id: number; nombre: string }[]>([])
  const [filtroProy, setFiltroProy] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('proyecto').select('id, nombre').order('nombre')
      .then(({ data }) => setProyectos((data ?? []) as { id: number; nombre: string }[]))
  }, [])

  const canCreate = userRole === ROLES.ADMIN || userRole === ROLES.USUARIO
  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem = Math.min(page * pageSize, total)

  const handleEstado = (v: string | null) => { setFiltroEstado(v); setEstadoFilter(v) }
  const handleProy = (v: number | null) => { setFiltroProy(v); setProyectoFilter(v) }
  const limpiar = () => { handleEstado(null); handleProy(null) }

  return (
    <div className="min-h-screen flex justify-center">
      <div className="space-y-4 max-w-6xl w-full px-4 py-6">

        {/* Toolbar */}
        <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#003D7D]">
                <Wallet size={17} className="text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-[#003D7D] text-base leading-tight">Caja Chica</h2>
                <p className="text-[11px] text-gray-400">{total} registros</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm"
                value={filtroEstado ?? ''}
                onChange={e => handleEstado(e.target.value || null)}
              >
                <option value="">Estado</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select
                className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm"
                value={filtroProy ?? ''}
                onChange={e => handleProy(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Proyecto</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              {(filtroEstado || filtroProy) && (
                <button onClick={limpiar} className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                  <X size={13} /> Limpiar
                </button>
              )}
              <button onClick={refresh} disabled={loading}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              {canCreate && (
                <button onClick={() => navigate('/caja-chica/nueva')}
                  className="h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-1.5 hover:bg-[#002D5C] transition-all shadow-sm">
                  <Plus size={15} /> Nueva
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
                  {['Código', 'Proyecto', 'Responsable', 'Período', 'Asignado', 'Gastado', 'Saldo', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 && (
                  <tr><td colSpan={8} className="py-16 text-center text-gray-400">
                    <RefreshCw size={28} className="animate-spin text-[#003D7D]/30 mx-auto mb-2" />
                    Cargando…
                  </td></tr>
                )}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={8} className="py-16 text-center text-gray-400">
                    <Wallet size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm">No hay registros de caja chica.</p>
                  </td></tr>
                )}
                {data.map((cc, i) => (
                  <tr key={cc.id}
                    onClick={() => navigate(`/caja-chica/${cc.id}`)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-[#003D7D]/[0.02] transition-colors ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md font-semibold">{cc.codigo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium max-w-[160px] truncate">{cc.proyecto?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{cc.responsable_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(cc.periodo_desde)} — {fmtDate(cc.periodo_hasta)}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{fmt(cc.monto_asignado)}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{fmt(cc.total_gastos)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#003D7D]">{fmt(cc.saldo_actual)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_BADGE[cc.estado] ?? ''}`}>
                        {cc.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{fromItem}–{toItem}</span> de <span className="font-medium text-gray-700">{total}</span>
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(page - 1)} disabled={page <= 1}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-[#003D7D] hover:text-white disabled:opacity-40 transition-all">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium border transition-all ${
                      p === page ? 'bg-[#003D7D] text-white border-[#003D7D]' : 'bg-white border-gray-200 text-gray-600 hover:bg-[#003D7D]/5'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-[#003D7D] hover:text-white disabled:opacity-40 transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
