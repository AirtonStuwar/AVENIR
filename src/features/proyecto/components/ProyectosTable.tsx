import { useState } from 'react'
import {
  Search, Plus, RefreshCw, Pencil, Trash2,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  FolderOpen, Filter,
} from 'lucide-react'
import type { Proyecto } from '../types/proyecto'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(d + 'T00:00:00'))
}

function fmtMoney(n: number | null): string {
  if (n === null) return '—'
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)
}

interface Props {
  data:         Proyecto[]
  total:        number
  page:         number
  pageSize:     number
  totalPages:   number
  loading:      boolean
  onEdit:       (p: Proyecto) => void
  onDelete:     (p: Proyecto) => void
  onToggle:     (p: Proyecto) => void
  onCreate:     () => void
  onSearch:     (q: string) => void
  onFilter:     (activo: boolean | null) => void
  onPageChange: (page: number) => void
  onRefresh:    () => void
}

export default function ProyectosTable({
  data, total, page, pageSize, totalPages, loading,
  onEdit, onDelete, onToggle, onCreate,
  onSearch, onFilter, onPageChange, onRefresh,
}: Props) {
  const [searchVal,  setSearchVal]  = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [activoSel,  setActivoSel]  = useState<'all' | 'active' | 'inactive'>('all')

  const handleSearch = (val: string) => { setSearchVal(val); onSearch(val) }

  const handleFilter = (val: 'all' | 'active' | 'inactive') => {
    setActivoSel(val)
    setFilterOpen(false)
    onFilter(val === 'all' ? null : val === 'active')
  }

  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem   = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 shadow-[0_2px_12px_0_rgba(0,61,125,.07)] bg-white">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#003D7D]">
            <FolderOpen size={17} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[#003D7D] text-base leading-tight">Proyectos</h2>
            <p className="text-[11px] text-gray-400">{total} registros en total</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="h-9 rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm
                         text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2
                         focus:ring-[#003D7D]/20 focus:border-[#003D7D]/40 w-52 transition-all"
              placeholder="Buscar código o nombre…"
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`h-9 px-3 rounded-xl border text-sm flex items-center gap-1.5 transition-colors
                ${activoSel !== 'all'
                  ? 'border-[#003D7D] bg-[#003D7D] text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >
              <Filter size={13} />
              {activoSel === 'all' ? 'Estado' : activoSel === 'active' ? 'Activos' : 'Inactivos'}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-11 z-10 w-40 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
                {(['all', 'active', 'inactive'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleFilter(opt)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                      ${activoSel === opt ? 'bg-[#003D7D]/5 text-[#003D7D] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {opt === 'all' ? 'Todos' : opt === 'active' ? '✓ Activos' : '✗ Inactivos'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200
                       bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Create */}
          <button
            onClick={onCreate}
            className="h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium
                       flex items-center gap-1.5 hover:bg-[#002D5C] active:scale-[.98] transition-all shadow-sm"
          >
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
              {['Código', 'Nombre', 'Presupuesto', 'Inicio', 'Fin Est.', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && data.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <RefreshCw size={28} className="animate-spin text-[#003D7D]/30" />
                    <span className="text-sm">Cargando proyectos…</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FolderOpen size={32} className="text-gray-200" />
                    <p className="text-sm font-medium text-gray-500">No hay proyectos</p>
                    <p className="text-xs text-gray-400">Crea uno nuevo para comenzar.</p>
                  </div>
                </td>
              </tr>
            )}

            {data.map((p, i) => (
              <tr
                key={p.id}
                className={`border-b border-gray-50 transition-colors hover:bg-[#003D7D]/[0.02]
                  ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md font-semibold">
                    {p.codigo}
                  </span>
                </td>

                <td className="px-4 py-3 max-w-[220px]">
                  <p className="font-medium text-gray-900 truncate">{p.nombre}</p>
                  {p.descripcion && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{p.descripcion}</p>
                  )}
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono text-sm text-gray-700">{fmtMoney(p.presupuesto)}</span>
                </td>

                <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{fmtDate(p.fecha_inicio)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{fmtDate(p.fecha_fin_est)}</td>

                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold
                    ${p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.activo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => onToggle(p)} title={p.activo ? 'Desactivar' : 'Activar'}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                      {p.activo ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={() => onEdit(p)} title="Editar"
                      className="p-1.5 rounded-lg hover:bg-[#003D7D]/8 text-gray-400 hover:text-[#003D7D] transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(p)} title="Eliminar"
                      className="p-1.5 rounded-lg hover:bg-[#F65740]/10 text-gray-400 hover:text-[#F65740] transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
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
            Mostrando <span className="font-medium text-gray-700">{fromItem}–{toItem}</span> de{' '}
            <span className="font-medium text-gray-700">{total}</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200
                         bg-white text-gray-500 hover:bg-[#003D7D] hover:text-white hover:border-[#003D7D]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p2) => Math.abs(p2 - page) <= 2)
              .map((p2) => (
                <button key={p2} onClick={() => onPageChange(p2)}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all border
                    ${p2 === page
                      ? 'bg-[#003D7D] text-white border-[#003D7D]'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-[#003D7D]/5 hover:border-[#003D7D]/30'}`}>
                  {p2}
                </button>
              ))}
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200
                         bg-white text-gray-500 hover:bg-[#003D7D] hover:text-white hover:border-[#003D7D]
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}