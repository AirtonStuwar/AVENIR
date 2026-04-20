import { useState } from 'react'
import { Search, RefreshCw, FolderOpen } from 'lucide-react'
import type { Solicitud } from '../types/solicitud'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(d + 'T00:00:00'))
}

interface Props {
  data: Solicitud[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  loading: boolean
  onView?: (s: Solicitud) => void
  onCreate?: () => void
  onSearch: (q: string) => void
  onPageChange: (page: number) => void
  onRefresh: () => void
}

export default function SolicitudesTable({ data, total, page, pageSize, totalPages, loading, onSearch, onPageChange, onRefresh, onCreate }: Props) {
  const [searchVal, setSearchVal] = useState('')

  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem   = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_2px_12px_0_rgba(0,61,125,.07)]">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#003D7D]">
            <FolderOpen size={17} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[#003D7D] text-base leading-tight">Solicitudes</h2>
            <p className="text-[11px] text-gray-400">{total} registros en total</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="h-9 rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm"
              placeholder="Buscar código, razón social o RUC…"
              value={searchVal}
              onChange={(e) => { setSearchVal(e.target.value); onSearch(e.target.value) }}
            />
          </div>

          <button onClick={onRefresh} disabled={loading}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button onClick={onCreate} className="h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-1.5">
            Nuevo
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
              {['Código', 'Razón social', 'RUC', 'Proyecto', 'Fecha pedido', 'Prioridad', 'Estado'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center"><div className="flex flex-col items-center gap-3 text-gray-400"><RefreshCw size={28} className="animate-spin text-[#003D7D]/30" /><span className="text-sm">Cargando solicitudes…</span></div></td></tr>
            )}

            {!loading && data.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center"><div className="flex flex-col items-center gap-2"><FolderOpen size={32} className="text-gray-200" /><p className="text-sm font-medium text-gray-500">No hay solicitudes</p></div></td></tr>
            )}

            {data.map((s, i) => (
              <tr key={s.id} className={`border-b border-gray-50 transition-colors hover:bg-[#003D7D]/[0.02] ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                <td className="px-4 py-3"><span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md">{s.codigo ?? '—'}</span></td>
                <td className="px-4 py-3 max-w-[220px]"><p className="font-medium text-gray-900 truncate">{s.razon_social ?? '—'}</p></td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 text-sm">{s.ruc ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{s.proyecto?.nombre ?? s.proyecto_id ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{fmtDate(s.fecha_pedido)}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700">{s.prioridad ?? 'Media'}</span></td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{s.estado_soli?.nombre ?? s.estado_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-500">Mostrando <span className="font-medium text-gray-700">{fromItem}–{toItem}</span> de <span className="font-medium text-gray-700">{total}</span></p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p2) => Math.abs(p2 - page) <= 2).map((p2) => (
              <button key={p2} onClick={() => onPageChange(p2)} className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all border ${p2 === page ? 'bg-[#003D7D] text-white border-[#003D7D]' : 'bg-white border-gray-200 text-gray-600'}`}>{p2}</button>
            ))}
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">›</button>
          </div>
        </div>
      )}
    </div>
  )
}
