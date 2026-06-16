import { useEffect, useState } from 'react'
import { FileDown, Filter, X, BarChart2, TrendingUp, Receipt, RefreshCw, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../api/supabase'
import { getReporteData, exportarReporteExcel } from '../features/reportes/services/reportesService'
import type { ReporteRow, ReporteFiltros } from '../features/reportes/services/reportesService'

const TIPO_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'OC':        { label: 'OC',        color: 'bg-blue-100 text-blue-700',   icon: <FileText   size={11} /> },
  'RxH':       { label: 'RxH',       color: 'bg-green-100 text-green-700', icon: <FileText   size={11} /> },
  'A Rendir':  { label: 'A Rendir',  color: 'bg-amber-100 text-amber-700', icon: <Receipt    size={11} /> },
  'Reembolso': { label: 'Reembolso', color: 'bg-pink-100 text-pink-700',   icon: <RefreshCw  size={11} /> },
}

const fmt = (n: number) => n === 0 ? '—' : `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fmtUSD = (n: number) => n === 0 ? '—' : `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = (s: string | null) => s ? new Intl.DateTimeFormat('es-PE').format(new Date(s)) : '—'

// Default: current month
const today = new Date()
const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
const todayStr     = today.toISOString().slice(0, 10)

export default function ReportesPage() {
  const [rows,          setRows]          = useState<ReporteRow[]>([])
  const [loading,       setLoading]       = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [proyectos,     setProyectos]     = useState<{ id: number; nombre: string }[]>([])

  const [fechaDesde,    setFechaDesde]    = useState(firstOfMonth)
  const [fechaHasta,    setFechaHasta]    = useState(todayStr)
  const [proyectoId,    setProyectoId]    = useState<number | null>(null)

  // Load projects
  useEffect(() => {
    supabase.from('proyecto').select('id, nombre').order('nombre')
      .then(({ data }) => setProyectos((data ?? []) as { id: number; nombre: string }[]))
  }, [])

  const handleBuscar = async () => {
    if (!fechaDesde || !fechaHasta) { toast.error('Ingresa el rango de fechas'); return }
    setLoading(true)
    try {
      const filtros: ReporteFiltros = { fechaDesde, fechaHasta, proyectoId }
      const data = await getReporteData(filtros)
      setRows(data)
      if (data.length === 0) toast('Sin registros para el período seleccionado.', { icon: 'ℹ️' })
    } catch {
      toast.error('Error al obtener datos del reporte')
    } finally {
      setLoading(false)
    }
  }

  const handleExportar = async () => {
    if (rows.length === 0) { toast.error('Busca primero los datos antes de exportar'); return }
    setExporting(true)
    try {
      const proyecto = proyectos.find(p => p.id === proyectoId)?.nombre ?? ''
      await exportarReporteExcel(rows, { fechaDesde, fechaHasta, proyectoId }, proyecto)
      toast.success('Excel generado correctamente')
    } catch {
      toast.error('Error al generar el Excel')
    } finally {
      setExporting(false)
    }
  }

  const limpiar = () => {
    setFechaDesde(firstOfMonth)
    setFechaHasta(todayStr)
    setProyectoId(null)
    setRows([])
  }

  // Stats
  const byTipo = (tipo: string) => rows.filter(r => r.tipo === tipo)
  const sumPEN = (rs: ReporteRow[]) => rs.reduce((s, r) => s + r.girar_pen, 0)
  const sumUSD = (rs: ReporteRow[]) => rs.reduce((s, r) => s + r.girar_usd, 0)

  const INPUT = 'rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
  const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-3 shadow-sm">
        <BarChart2 size={20} className="text-[#003D7D]" />
        <div>
          <h1 className="text-base font-semibold text-gray-900">Reportes</h1>
          <p className="text-xs text-gray-400">Exporta solicitudes aprobadas, A Rendir y Reembolsos autorizados</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={14} className="text-[#003D7D]" />
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>Fecha desde *</label>
              <input type="date" className={INPUT + ' w-full'} value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Fecha hasta *</label>
              <input type="date" className={INPUT + ' w-full'} value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Proyecto (opcional)</label>
              <select className={INPUT + ' w-full'} value={proyectoId ?? ''}
                onChange={e => setProyectoId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Todos los proyectos</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleBuscar} disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all">
              {loading
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Buscando…</>
                : <><Filter size={14} /> Buscar</>}
            </button>
            {(proyectoId || rows.length > 0) && (
              <button onClick={limpiar}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                <X size={13} /> Limpiar
              </button>
            )}
            {rows.length > 0 && (
              <button onClick={handleExportar} disabled={exporting}
                className="ml-auto px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-all">
                {exporting
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generando…</>
                  : <><FileDown size={14} /> Exportar Excel ({rows.length})</>}
              </button>
            )}
          </div>
        </div>

        {/* KPI summary */}
        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(['OC', 'RxH', 'A Rendir', 'Reembolso'] as const).map(tipo => {
                const rs = byTipo(tipo)
                const badge = TIPO_BADGE[tipo]
                return (
                  <div key={tipo} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.icon} {badge.label}
                      </span>
                      <span className="ml-auto text-lg font-bold text-gray-800">{rs.length}</span>
                    </div>
                    <p className="text-xs text-gray-500">Girar S/. <span className="font-semibold text-gray-800">{fmt(sumPEN(rs))}</span></p>
                    {sumUSD(rs) > 0 && <p className="text-xs text-gray-500">Girar $ <span className="font-semibold text-gray-800">{fmtUSD(sumUSD(rs))}</span></p>}
                  </div>
                )
              })}
            </div>

            {/* Totals bar */}
            <div className="bg-[#003D7D] rounded-2xl px-6 py-4 flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide">Total registros</p>
                <p className="text-xl font-bold text-white">{rows.length}</p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide">Girar S/. total</p>
                <p className="text-xl font-bold text-white">{fmt(rows.reduce((s, r) => s + r.girar_pen, 0))}</p>
              </div>
              {rows.some(r => r.girar_usd > 0) && (
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Girar $ total</p>
                  <p className="text-xl font-bold text-white">{fmtUSD(rows.reduce((s, r) => s + r.girar_usd, 0))}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide">Detracción S/.</p>
                <p className="text-xl font-bold text-white">{fmt(rows.reduce((s, r) => s + r.detraccion, 0))}</p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide">Retención S/.</p>
                <p className="text-xl font-bold text-white">{fmt(rows.reduce((s, r) => s + r.retencion, 0))}</p>
              </div>
            </div>

            {/* Preview table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Vista previa — {rows.length} registros</h2>
                <button onClick={handleExportar} disabled={exporting}
                  className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors">
                  <FileDown size={13} /> Exportar Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['#','Módulo','Código','Beneficiario','Documento','Fecha','Proyecto','Concepto','Total S/.','Total $','Detrac.','Reten.','Girar S/.','Girar $','Banco'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => {
                      const badge = TIPO_BADGE[row.tipo]
                      return (
                        <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${badge.color}`}>
                              {badge.icon} {row.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-600">{row.codigo ?? '—'}</td>
                          <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">{row.beneficiario ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.documento ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(row.fecha)}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{row.proyecto ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">{row.concepto ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">{row.total_pen > 0 ? fmt(row.total_pen) : '—'}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">{row.total_usd > 0 ? fmtUSD(row.total_usd) : '—'}</td>
                          <td className="px-3 py-2 text-right text-amber-700">{row.detraccion > 0 ? fmt(row.detraccion) : '—'}</td>
                          <td className="px-3 py-2 text-right text-orange-700">{row.retencion > 0 ? fmt(row.retencion) : '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-[#003D7D]">{row.girar_pen > 0 ? fmt(row.girar_pen) : '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-[#003D7D]">{row.girar_usd > 0 ? fmtUSD(row.girar_usd) : '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{row.banco ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <TrendingUp size={36} className="text-gray-200" />
            <p className="text-sm">Selecciona el período y haz clic en <strong>Buscar</strong> para generar el reporte.</p>
          </div>
        )}
      </div>
    </div>
  )
}
