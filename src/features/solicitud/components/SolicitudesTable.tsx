import { useState, useRef, useEffect } from 'react'
import { Search, RefreshCw, FolderOpen, FileText, XCircle } from 'lucide-react'
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
  onCancel?: (s: Solicitud) => void
  onCreate?: () => void
  onSearch: (q: string) => void
  onPageChange: (page: number) => void
  onRefresh: () => void
  selectedIds?: Set<number>
  onSelectionChange?: (ids: Set<number>) => void
}

export default function SolicitudesTable({
  data, total, page, pageSize, totalPages, loading,
  onSearch, onPageChange, onRefresh, onCreate, onView, onCancel,
  selectedIds, onSelectionChange,
}: Props) {
  const [searchVal, setSearchVal] = useState('')
  const selectAllRef = useRef<HTMLInputElement>(null)

  const selectable       = !!onSelectionChange
  const selected         = selectedIds ?? new Set<number>()
  const allPageSelected  = data.length > 0 && data.every(s => selected.has(s.id))
  const somePageSelected = data.some(s => selected.has(s.id)) && !allPageSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = somePageSelected
  }, [somePageSelected])

  const toggleAll = () => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (allPageSelected) data.forEach(s => next.delete(s.id))
    else                  data.forEach(s => next.add(s.id))
    onSelectionChange(next)
  }

  const toggleOne = (id: number) => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else              next.add(id)
    onSelectionChange(next)
  }

  const fromItem   = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem     = Math.min(page * pageSize, total)
  const colSpanAll = 9 + (selectable ? 1 : 0)

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_2px_12px_0_rgba(0,61,125,.07)]">
      {/* ── Header ── */}
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

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allPageSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 accent-[#003D7D] cursor-pointer"
                  />
                </th>
              )}
              {['Código', 'Razón social', 'RUC', 'Proyecto', 'Fecha pedido', 'Creado por', 'Área', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 && (
              <tr><td colSpan={colSpanAll} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <RefreshCw size={28} className="animate-spin text-[#003D7D]/30" />
                  <span className="text-sm">Cargando solicitudes…</span>
                </div>
              </td></tr>
            )}

            {!loading && data.length === 0 && (
              <tr><td colSpan={colSpanAll} className="py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <FolderOpen size={32} className="text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No hay solicitudes</p>
                </div>
              </td></tr>
            )}

            {data.map((s, i) => {
              const isPendiente = s.estado_soli?.nombre === 'Pendiente'
              const isChecked   = selected.has(s.id)
              return (
                <tr
                  key={s.id}
                  onClick={() => onView?.(s)}
                  className={`border-b border-gray-50 transition-colors cursor-pointer
                    ${isChecked ? 'bg-[#003D7D]/[0.06] hover:bg-[#003D7D]/[0.09]' : `hover:bg-[#003D7D]/[0.04] ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}`}
                >
                  {selectable && (
                    <td className="px-4 py-3 w-10" onClick={(e) => { e.stopPropagation(); toggleOne(s.id) }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(s.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#003D7D] cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md">{s.codigo ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="font-medium text-gray-900 truncate">{s.razon_social ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 text-sm">{s.ruc ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{s.proyecto?.nombre ?? s.proyecto_id ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{fmtDate(s.fecha_pedido)}</td>
                  <td className="px-4 py-3 max-w-[180px]">
                    {s.creador_email
                      ? <span className="text-xs text-gray-700 truncate block" title={s.creador_email}>{s.creador_email}</span>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {s.area_nombre
                      ? <span className="inline-flex items-center rounded-full bg-[#003D7D]/8 px-2.5 py-0.5 text-[11px] font-semibold text-[#003D7D]">{s.area_nombre}</span>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.estado_soli?.nombre ?? s.estado_id ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onView?.(s)}
                        title="Ver detalles"
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#003D7D] bg-[#003D7D]/8 hover:bg-[#003D7D]/15 transition-colors"
                      >
                        <FileText size={12} /> Ver
                      </button>

                      {onCancel && (
                        <button
                          onClick={() => onCancel(s)}
                          disabled={!isPendiente}
                          title={!isPendiente ? 'Solo se puede cancelar en estado Pendiente' : 'Cancelar solicitud'}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <XCircle size={12} /> Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-500">
            Mostrando <span className="font-medium text-gray-700">{fromItem}–{toItem}</span> de <span className="font-medium text-gray-700">{total}</span>
          </p>
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
