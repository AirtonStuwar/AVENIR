import { useState, useRef, useEffect } from 'react'
import { Search, RefreshCw, FolderOpen, FileText, XCircle, ChevronRight } from 'lucide-react'
import type { Solicitud } from '../types/solicitud'
import { getProyectos } from '../../proyecto/services/proyectoService'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(d + 'T00:00:00'))
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_COLOR: Record<string, string> = {
  'Pendiente':               'bg-yellow-100 text-yellow-800',
  'En Revision':             'bg-blue-100 text-blue-800',
  'Evaluado':                'bg-purple-100 text-purple-800',
  'Aprobado':                'bg-green-100 text-green-800',
  'Rechazado':               'bg-red-100 text-red-800',
  'Cancelado':               'bg-gray-100 text-gray-500',
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
  mesAprobacion?: number | null
  onMesAprobacionChange?: (mes: number | null) => void
  proyectoFilter?: number | null
  onProyectoFilterChange?: (id: number | null) => void
  pagoFilter?: 'pendiente' | 'pagado' | null
  onPagoFilterChange?: (v: 'pendiente' | 'pagado' | null) => void
}

export default function SolicitudesTable({
  data, total, page, pageSize, totalPages, loading,
  onSearch, onPageChange, onRefresh, onCreate, onView, onCancel,
  selectedIds, onSelectionChange, mesAprobacion, onMesAprobacionChange,
  proyectoFilter, onProyectoFilterChange, pagoFilter, onPagoFilterChange,
}: Props) {
  const [searchVal, setSearchVal] = useState('')
  const [proyectos, setProyectos] = useState<Array<{id: number; nombre: string}>>([])
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!onProyectoFilterChange) return
    getProyectos({ page: 1, pageSize: 500 })
      .then(res => setProyectos(res.data))
      .catch(() => {})
  }, [onProyectoFilterChange])

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

  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem   = Math.min(page * pageSize, total)

  // ── Estado badge ────────────────────────────────────────────────
  const EstadoBadge = ({ nombre }: { nombre: string | null | undefined }) => {
    const label = nombre ?? '—'
    const cls   = nombre ? (ESTADO_COLOR[nombre] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-400'
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
        {label}
      </span>
    )
  }

  // ── Creador display ─────────────────────────────────────────────
  const CreadorDisplay = ({ s, compact = false }: { s: Solicitud; compact?: boolean }) => {
    const nombre = s.creador_nombre ?? s.creador_email
    if (!nombre) return <span className="text-xs text-gray-300">—</span>
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`font-medium text-gray-800 truncate ${compact ? 'text-xs' : 'text-xs'}`}
          title={nombre}>{nombre}</span>
        {s.creador_nombre && s.creador_email && (
          <span className="text-[11px] text-gray-400 truncate">{s.creador_email}</span>
        )}
      </div>
    )
  }

  // ── Pagination shared ───────────────────────────────────────────
  const Pagination = () => (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
      <p className="text-xs text-gray-500">
        Mostrando <span className="font-medium text-gray-700">{fromItem}–{toItem}</span> de{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-40">‹</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p2 => Math.abs(p2 - page) <= 2)
          .map(p2 => (
            <button key={p2} onClick={() => onPageChange(p2)}
              className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all border
                ${p2 === page ? 'bg-[#003D7D] text-white border-[#003D7D]' : 'bg-white border-gray-200 text-gray-600'}`}>
              {p2}
            </button>
          ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-40">›</button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_2px_12px_0_rgba(0,61,125,.07)]">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
        {/* Title */}
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#003D7D]">
            <FolderOpen size={17} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[#003D7D] text-base leading-tight">Solicitudes</h2>
            <p className="text-[11px] text-gray-400">{total} registros en total</p>
          </div>
        </div>

        {/* Filters + actions — wrap on mobile */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onProyectoFilterChange && (
            <select
              value={proyectoFilter ?? ''}
              onChange={e => onProyectoFilterChange(e.target.value ? Number(e.target.value) : null)}
              className="h-9 flex-1 sm:flex-none rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 min-w-0"
            >
              <option value="">Todas las empresas</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}

          {onMesAprobacionChange && (
            <select
              value={mesAprobacion ?? ''}
              onChange={e => onMesAprobacionChange(e.target.value ? Number(e.target.value) : null)}
              className="h-9 flex-1 sm:flex-none rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 min-w-0"
            >
              <option value="">Todos los meses</option>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m} {new Date().getFullYear()}</option>
              ))}
            </select>
          )}

          {onPagoFilterChange && (
            <select
              value={pagoFilter ?? ''}
              onChange={e => onPagoFilterChange(e.target.value ? e.target.value as 'pendiente' | 'pagado' : null)}
              className="h-9 flex-1 sm:flex-none rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 min-w-0"
            >
              <option value="">Pago: Todos</option>
              <option value="pendiente">Por pagar</option>
              <option value="pagado">Pagados</option>
            </select>
          )}

          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="h-9 w-full sm:w-64 rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
              placeholder="Buscar código, razón social o RUC…"
              value={searchVal}
              onChange={e => { setSearchVal(e.target.value); onSearch(e.target.value) }}
            />
          </div>

          <button onClick={onRefresh} disabled={loading}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 shrink-0">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {onCreate && (
            <button onClick={onCreate}
              className="h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-1.5 shrink-0">
              Nuevo
            </button>
          )}
        </div>
      </div>

      {/* ── Empty / Loading shared ── */}
      {(loading && data.length === 0) && (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw size={28} className="animate-spin text-[#003D7D]/30" />
          <span className="text-sm">Cargando solicitudes…</span>
        </div>
      )}
      {(!loading && data.length === 0) && (
        <div className="py-16 flex flex-col items-center gap-2">
          <FolderOpen size={32} className="text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No hay solicitudes</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          DESKTOP — Tabla (md+)
      ════════════════════════════════════════════════════════════ */}
      {data.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
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
                {['Código', 'Razón social', 'RUC', 'Empresa', 'Fecha pedido', 'Vencimiento', 'Creado por', 'Área', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => {
                const isPendiente = s.estado_soli?.nombre === 'Pendiente'
                const isChecked   = selected.has(s.id)
                return (
                  <tr
                    key={s.id}
                    onClick={() => onView?.(s)}
                    className={`border-b border-gray-50 transition-colors cursor-pointer
                      ${isChecked
                        ? 'bg-[#003D7D]/[0.06] hover:bg-[#003D7D]/[0.09]'
                        : `hover:bg-[#003D7D]/[0.04] ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}`}
                  >
                    {selectable && (
                      <td className="px-4 py-3 w-10" onClick={e => { e.stopPropagation(); toggleOne(s.id) }}>
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
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{s.proyecto?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{fmtDate(s.fecha_pedido)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {s.fecha_vencimiento_factura
                        ? <span className="font-medium text-orange-700">{fmtDate(s.fecha_vencimiento_factura)}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <CreadorDisplay s={s} />
                    </td>
                    <td className="px-4 py-3">
                      {s.area_nombre
                        ? <span className="inline-flex items-center rounded-full bg-[#003D7D]/8 px-2.5 py-0.5 text-[11px] font-semibold text-[#003D7D]">{s.area_nombre}</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <EstadoBadge nombre={s.estado_soli?.nombre} />
                        {s.estado_soli?.nombre === 'Aprobado' && (
                          s.fecha_pago
                            ? <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200">Pagado</span>
                            : <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full border border-orange-200">Por pagar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => onView?.(s)}
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
      )}

      {/* ════════════════════════════════════════════════════════════
          MOBILE — Cards (< md)
      ════════════════════════════════════════════════════════════ */}
      {data.length > 0 && (
        <div className="md:hidden divide-y divide-gray-100">
          {data.map(s => {
            const isPendiente = s.estado_soli?.nombre === 'Pendiente'
            const isChecked   = selected.has(s.id)
            return (
              <div
                key={s.id}
                onClick={() => onView?.(s)}
                className={`flex flex-col gap-3 px-4 py-4 cursor-pointer transition-colors active:bg-gray-50
                  ${isChecked ? 'bg-[#003D7D]/[0.05]' : 'hover:bg-gray-50/60'}`}
              >
                {/* Top row: checkbox + código + estado + chevron */}
                <div className="flex items-center gap-2">
                  {selectable && (
                    <div onClick={e => { e.stopPropagation(); toggleOne(s.id) }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(s.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#003D7D] cursor-pointer"
                      />
                    </div>
                  )}
                  <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md">
                    {s.codigo ?? '—'}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <EstadoBadge nombre={s.estado_soli?.nombre} />
                    <ChevronRight size={15} className="text-gray-300" />
                  </div>
                </div>

                {/* Razón social + RUC */}
                <div>
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{s.razon_social ?? '—'}</p>
                  {s.ruc && <p className="text-xs text-gray-400 mt-0.5">RUC: {s.ruc}</p>}
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Empresa</p>
                    <p className="text-xs text-gray-700 truncate">{s.proyecto?.nombre ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Fecha pedido</p>
                    <p className="text-xs text-gray-700">{fmtDate(s.fecha_pedido)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vencimiento</p>
                    {s.fecha_vencimiento_factura
                      ? <p className="text-xs font-medium text-orange-700">{fmtDate(s.fecha_vencimiento_factura)}</p>
                      : <p className="text-xs text-gray-300">—</p>
                    }
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Creado por</p>
                    <CreadorDisplay s={s} compact />
                  </div>
                  {s.area_nombre && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Área</p>
                      <span className="inline-flex items-center rounded-full bg-[#003D7D]/8 px-2 py-0.5 text-[11px] font-semibold text-[#003D7D]">
                        {s.area_nombre}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {onCancel && (
                  <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onView?.(s)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-medium text-[#003D7D] bg-[#003D7D]/8 hover:bg-[#003D7D]/15 transition-colors"
                    >
                      <FileText size={13} /> Ver detalle
                    </button>
                    <button
                      onClick={() => onCancel(s)}
                      disabled={!isPendiente}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle size={13} /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && <Pagination />}
    </div>
  )
}
