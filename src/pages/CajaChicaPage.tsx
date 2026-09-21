import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, Plus, RefreshCw, X, Download, CreditCard, Search, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import ExcelJS from 'exceljs'
import toast from 'react-hot-toast'
import { supabase } from '../api/supabase'
import { useAuthStore } from '../store/authStore'
import { useCajaChica } from '../features/caja-chica/hooks/useCajaChica'
import { ROLES } from '../features/solicitud/types/solicitud'
import { sanitizeBBVA } from '../features/solicitud/constants/bancos'
import BulkPagoModal from '../features/solicitud/components/BulkPagoModal'
import { marcarPagado } from '../features/solicitud/services/cuentaBancariaService'
import { buscarGastosCajaChica } from '../features/caja-chica/services/cajaChicaService'
import type { GastoBuscado } from '../features/caja-chica/services/cajaChicaService'

const ESTADOS = ['Pendiente', 'En Revision', 'Evaluado', 'Autorizado', 'Rechazado', 'Devuelto']
const ESTADO_BADGE: Record<string, string> = {
  'Pendiente':   'bg-gray-100 text-gray-600',
  'En Revision': 'bg-blue-100 text-blue-700',
  'Evaluado':    'bg-purple-100 text-purple-700',
  'Autorizado':  'bg-emerald-100 text-emerald-700',
  'Rechazado':   'bg-red-100 text-red-700',
  'Devuelto':    'bg-amber-100 text-amber-700',
  'Observado':   'bg-amber-100 text-amber-800',
}

const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (s: string | null) => {
  if (!s) return '—'
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00'))
  } catch {
    return 'Fecha inválida'
  }
}

export default function CajaChicaPage() {
  const navigate = useNavigate()
  const { user, userRole } = useAuthStore()
  const {
    data, total, page, pageSize, totalPages, loading,
    setPage, setEstadoFilter, setProyectoFilter, refresh,
  } = useCajaChica()

  const [proyectos, setProyectos] = useState<{ id: number; nombre: string }[]>([])
  const [filtroProy, setFiltroProy] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [bulkPagoOpen, setBulkPagoOpen] = useState(false)

  // ── Búsqueda de gastos por proveedor / N° de factura (entre todas las cajas chicas) ──
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<GastoBuscado[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const q = busqueda.trim()
    if (!q) { setResultadosBusqueda(null); return }
    setBuscando(true)
    const timer = setTimeout(() => {
      buscarGastosCajaChica(q)
        .then(setResultadosBusqueda)
        .catch(() => toast.error('Error al buscar gastos'))
        .finally(() => setBuscando(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    supabase.from('proyecto').select('id, nombre').order('nombre')
      .then(({ data }) => setProyectos((data ?? []) as { id: number; nombre: string }[]))
  }, [])

  const canCreate = userRole === ROLES.ADMIN || userRole === ROLES.USUARIO
  const isVisualizador = userRole === ROLES.VISUALIZADOR || userRole === ROLES.ADMIN
  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem = Math.min(page * pageSize, total)

  const handleEstado = (v: string | null) => { setFiltroEstado(v); setEstadoFilter(v) }
  const handleProy = (v: number | null) => { setFiltroProy(v); setProyectoFilter(v) }
  const limpiar = () => { handleEstado(null); handleProy(null) }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === data.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(data.map(d => d.id)))
  }

  const selectedPorPagar = data.filter(cc => selectedIds.has(cc.id) && cc.estado === 'Autorizado' && !cc.fecha_pago)

  async function handleBulkPagoConfirm(cuentaId: number, fechaPago: string) {
    if (!user?.id) return
    const results = await Promise.allSettled(
      selectedPorPagar.map(cc => marcarPagado('caja_chica', cc.id, cuentaId, fechaPago, user.id))
    )
    const ok   = results.filter(r => r.status === 'fulfilled').length
    const fail = results.filter(r => r.status === 'rejected').length
    if (ok > 0)   toast.success(`${ok} caja${ok > 1 ? 's' : ''} chica${ok > 1 ? 's' : ''} marcada${ok > 1 ? 's' : ''} como pagada${ok > 1 ? 's' : ''}`)
    if (fail > 0) toast.error(`${fail} no se pudo${fail > 1 ? 'n' : ''} marcar`)
    setBulkPagoOpen(false)
    setSelectedIds(new Set())
    refresh()
  }

  async function handleExport() {
    const selected = data.filter(cc => selectedIds.has(cc.id))
    if (selected.length === 0) return
    setExporting(true)

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pagos Caja Chica')

    ws.addRow([
      'DOI tipo', 'DOI Numero', 'Tipo abono', 'Cuenta', 'Nombre del beneficiario',
      'Importe abonar', 'Tipo recibo', 'Numero documento', 'Abono Agrupado', 'Referencia',
      'Indicador de Aviso', 'Medio de aviso', 'Persona Contacto', 'Validacion', 'Moneda',
    ])

    selected.forEach((cc, idx) => {
      ws.addRow([
        'L',
        cc.responsable_dni ?? '',
        cc.banco === 'BBVA' ? 'P' : 'I',
        cc.cuenta_bbva ?? '',
        sanitizeBBVA(cc.responsable_nombre),
        cc.total_gastos ?? 0,
        'B',
        String(idx + 1).padStart(3, '0'),
        'N',
        cc.codigo ?? '',
        'E',
        cc.responsable_email ?? '',
        '',
        '',
        'Soles',
      ])
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `cajachica_pagos_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Excel generado con ${selected.length} registro${selected.length > 1 ? 's' : ''}`)
    setExporting(false)
  }

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
                <option value="">Empresa</option>
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
              {isVisualizador && selectedPorPagar.length > 0 && (
                <button onClick={() => setBulkPagoOpen(true)}
                  className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-sm">
                  <CreditCard size={14} /> Marcar pagado ({selectedPorPagar.length})
                </button>
              )}
              {isVisualizador && selectedIds.size > 0 && (
                <button onClick={handleExport} disabled={exporting}
                  className="h-9 px-4 rounded-xl bg-green-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm">
                  <Download size={14} /> {exporting ? 'Generando…' : `Excel BBVA (${selectedIds.size})`}
                </button>
              )}
              {canCreate && (
                <button onClick={() => navigate('/caja-chica/nueva')}
                  className="h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-1.5 hover:bg-[#002D5C] transition-all shadow-sm">
                  <Plus size={15} /> Nueva
                </button>
              )}
            </div>
          </div>

          {/* Buscador de gastos por proveedor / N° de factura */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative max-w-md">
              {buscando
                ? <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar gasto por proveedor o N° de factura (entre todas las cajas chicas)..."
                className="w-full h-9 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {resultadosBusqueda !== null ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Detalle</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Caja Chica</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resultadosBusqueda.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">Sin resultados para "{busqueda}"</td></tr>
                  ) : resultadosBusqueda.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/caja-chica/${g.caja_chica.id}`)}>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(g.fecha)}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{g.proveedor}</td>
                      <td className="px-4 py-3 text-gray-600">{g.numero_documento ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate">{g.detalle}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(g.monto)}</td>
                      <td className="px-4 py-3 text-[#003D7D] font-medium">{g.caja_chica.codigo}</td>
                      <td className="px-4 py-3 text-gray-600">{g.caja_chica.proyecto?.nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[g.caja_chica.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {g.caja_chica.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
                  {isVisualizador && (
                    <th className="px-4 py-3 text-left">
                      <input type="checkbox" checked={data.length > 0 && selectedIds.size === data.length}
                        onChange={toggleAll} onClick={e => e.stopPropagation()} />
                    </th>
                  )}
                  {['Código', 'Empresa', 'Responsable', 'Período', 'Asignado', 'Gastado', 'Saldo', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 && (
                  <tr><td colSpan={isVisualizador ? 9 : 8} className="py-16 text-center text-gray-400">
                    <RefreshCw size={28} className="animate-spin text-[#003D7D]/30 mx-auto mb-2" />
                    Cargando…
                  </td></tr>
                )}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={isVisualizador ? 9 : 8} className="py-16 text-center text-gray-400">
                    <Wallet size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm">No hay registros de caja chica.</p>
                  </td></tr>
                )}
                {data.map((cc, i) => (
                  <tr key={cc.id}
                    onClick={() => navigate(`/caja-chica/${cc.id}`)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-[#003D7D]/[0.02] transition-colors ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                    {isVisualizador && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(cc.id)} onChange={() => toggleSelect(cc.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md font-semibold">{cc.codigo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium max-w-[160px] truncate">
                      {cc.proyecto?.nombre ?? '—'}
                      {cc.proyecto_partida && <span className="block text-[11px] text-gray-400 font-normal">{cc.proyecto_partida.nombre}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{cc.responsable_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(cc.periodo_desde)} — {fmtDate(cc.periodo_hasta)}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{fmt(cc.monto_asignado)}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{fmt(cc.total_gastos)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#003D7D]">{fmt(cc.saldo_actual)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_BADGE[cc.estado] ?? ''}`}>
                          {cc.estado}
                        </span>
                        {cc.estado === 'Autorizado' && (
                          cc.fecha_pago
                            ? <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200">Pagado</span>
                            : <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full border border-orange-200">Por pagar</span>
                        )}
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
          </>
          )}
        </div>
      </div>

      <BulkPagoModal
        open={bulkPagoOpen}
        title="Marcar pagado (masivo)"
        cantidad={selectedPorPagar.length}
        onConfirm={handleBulkPagoConfirm}
        onCancel={() => setBulkPagoOpen(false)}
      />
    </div>
  )
}
