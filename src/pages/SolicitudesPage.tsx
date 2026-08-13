import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Send, ThumbsUp, X, Loader2, Download, FileSpreadsheet, CreditCard, Landmark } from 'lucide-react'
import ExcelJS from 'exceljs'
import SolicitudesTable from '../features/solicitud/components/SolicitudesTable'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import BulkPagoModal from '../features/solicitud/components/BulkPagoModal'
import { useSolicitudes } from '../features/solicitud/hooks/useSolicitudes'
import {
  cancelarSolicitud,
  enviarARevision,
  aprobarSolicitud,
  marcarDetraccionPagada,
} from '../features/solicitud/services/solicitudService'
import { marcarPagado } from '../features/solicitud/services/cuentaBancariaService'
import { useAuthStore } from '../store/authStore'
import { useSolicitudFiltrosStore } from '../store/solicitudFiltrosStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import { sanitizeBBVA } from '../features/solicitud/constants/bancos'
import type { Solicitud } from '../features/solicitud/types/solicitud'

// Monto neto que corresponde girar al proveedor (descuenta detracción en OC y retención en RxH;
// Liberalidad ya viene neteada en monto_total desde que se crea).
function montoAGirar(s: Solicitud): number {
  const total = s.monto_total ?? 0
  const tipo  = s.solicitud_tipo?.nombre
  if (tipo === 'Liberalidad') return total

  if (tipo === 'Recibo por Honorarios') return total - (s.monto_retencion ?? 0)

  // OC
  if (!s.detraccion_id) return total
  const isPEN = (s.moneda ?? 'PEN') === 'PEN'
  if (isPEN) return total - (s.monto_detraccion ?? 0)
  const pct = s.detraccion?.porcentaje ?? 0
  return Math.round((total - total * pct / 100) * 100) / 100
}

export default function SolicitudesPage() {
  const navigate = useNavigate()
  const { userRole, user } = useAuthStore()

  // ── Filtros persistentes (sobreviven a navegar a un detalle y volver) ──
  const {
    proyectoFilter, areaFilter, mesAprobacion, pagoFilter: pagoLocal, monedaFilter: monedaLocal, ordenVencimiento, estadoNombre,
    setProyectoFilter: setProyectoStore, setAreaFilter: setAreaStore,
    setMesAprobacion: setMesStore, setPagoFilter: setPagoStore, setMonedaFilter: setMonedaStore,
    setOrdenVencimiento: setOrdenStore, setEstadoNombre: setEstadoStore,
    clear: clearFiltrosStore,
  } = useSolicitudFiltrosStore()

  const {
    data, total, page, pageSize, totalPages, loading, setPage, setSearch,
    setProyectoFilter, setMesAprobacion, setPagoFilter, setMonedaFilter, setAreaFilter, setOrdenVencimiento, setEstadoNombre, refresh,
  } = useSolicitudes({ proyecto_id: proyectoFilter, areaId: areaFilter, mes_aprobacion: mesAprobacion, pagoFilter: pagoLocal, monedaFilter: monedaLocal, ordenVencimiento, estadoNombre })

  const isVisualizador = userRole === ROLES.VISUALIZADOR
  const isEvaluador    = userRole === ROLES.EVALUADOR

  const handleEstadoChange = (v: string | null) => {
    setEstadoStore(v)
    setEstadoNombre(v)
  }

  const handleProyectoChange = (id: number | null) => {
    setProyectoStore(id)
    setProyectoFilter(id)
  }

  const handleMesChange = (mes: number | null) => {
    setMesStore(mes)
    setMesAprobacion(mes)
  }

  const handlePagoChange = (v: 'pendiente' | 'pagado' | null) => {
    setPagoStore(v)
    setPagoFilter(v)
  }

  const handleMonedaChange = (v: 'PEN' | 'USD' | null) => {
    setMonedaStore(v)
    setMonedaFilter(v)
  }

  const handleAreaChange = (id: number | null) => {
    setAreaStore(id)
    setAreaFilter(id)
  }

  const handleOrdenVencimientoChange = (activo: boolean) => {
    setOrdenStore(activo)
    setOrdenVencimiento(activo)
  }

  const hasFiltrosActivos = !!(proyectoFilter || areaFilter || mesAprobacion || pagoLocal || monedaLocal || ordenVencimiento || estadoNombre)
  const handleClearFiltros = () => {
    clearFiltrosStore()
    setProyectoFilter(null)
    setAreaFilter(null)
    setMesAprobacion(null)
    setPagoFilter(null)
    setMonedaFilter(null)
    setOrdenVencimiento(false)
    setEstadoNombre(null)
  }

  // ── Selección ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkLoading,  setBulkLoading]  = useState(false)

  const handlePageChange = (p: number) => { setPage(p); setSelectedIds(new Set()) }

  // Conteos por estado dentro de la selección
  const pendienteCount   = data.filter(s => selectedIds.has(s.id) && s.estado_soli?.nombre === 'Pendiente').length
  const evaluadoCount    = data.filter(s => selectedIds.has(s.id) && s.estado_soli?.nombre === 'Evaluado').length

  const canBulkEnviar   = (userRole === ROLES.USUARIO || userRole === ROLES.ADMIN) && pendienteCount > 0
  const canBulkAprobar  = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && evaluadoCount > 0
  const hasAnyBulk      = canBulkEnviar || canBulkAprobar

  const handleBulkAction = async (
    estadoFiltro: string,
    actionFn: (id: number) => Promise<unknown>,
    label: string,
  ) => {
    const ids = data
      .filter(s => selectedIds.has(s.id) && s.estado_soli?.nombre === estadoFiltro)
      .map(s => s.id)
    if (ids.length === 0) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => actionFn(id)))
    const ok   = results.filter(r => r.status === 'fulfilled').length
    const fail = results.filter(r => r.status === 'rejected').length

    if (ok > 0)   toast.success(`${ok} solicitud${ok > 1 ? 'es' : ''} ${label}`)
    if (fail > 0) toast.error(`${fail} no se pudo${fail > 1 ? 'n' : ''} procesar`)

    setSelectedIds(new Set())
    setBulkLoading(false)
    refresh()
  }

  const handleBulkEnviar  = () => handleBulkAction('Pendiente', enviarARevision,                       'enviadas a revisión')
  const handleBulkAprobar = () => handleBulkAction('Evaluado',  id => aprobarSolicitud(id, user!.id), 'aprobadas')

  // ── Exportar Excel (solo VISUALIZADOR) ───────────────────────
  const handleExport = async () => {
    const selected = data.filter(s => selectedIds.has(s.id))
    if (selected.length === 0) return

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pagos')

    ws.addRow([
      'DOI tipo', 'DOI Numero', 'Tipo abono', 'Cuenta', 'Nombre del beneficiario',
      'Importe abonar', 'Tipo recibo', 'Numero documento', 'Abono Agrupado', 'Referencia',
      'Indicador de Aviso', 'Medio de aviso', 'Persona Contacto', 'Validacion', 'Moneda',
    ])

    for (const s of selected) {
      ws.addRow([
        s.ruc?.length === 11 ? 'R' : 'L',
        s.ruc ?? '',
        s.banco === 'BBVA' ? 'P' : 'I',
        s.numero_cuenta ?? '',
        sanitizeBBVA(s.razon_social),
        montoAGirar(s),
        s.solicitud_tipo?.nombre === 'Liberalidad' ? 'B' : 'F',
        s.numero_factura ?? '',
        'N',
        '',
        'E',
        s.creador_email ?? '',
        '',
        '',
        (s.moneda ?? 'PEN') === 'USD' ? 'Dólares' : 'Soles',
      ])
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `pagos_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Excel generado con ${selected.length} solicitud${selected.length > 1 ? 'es' : ''}`)
  }

  // ── Excel SPOT Detracciones ───────────────────────────────────
  const canExportDetracciones = userRole === ROLES.VISUALIZADOR || userRole === ROLES.ADMIN
  const selectedConDetraccion = data.filter(s => selectedIds.has(s.id) && s.detraccion_id !== null)

  const handleExportDetracciones = async () => {
    const solicitudesDetr = data.filter(s => selectedIds.has(s.id) && s.detraccion_id !== null)
    if (solicitudesDetr.length === 0) {
      toast.error('Ninguna solicitud seleccionada tiene detracción')
      return
    }

    const sinFecha = solicitudesDetr.filter(s => !s.fecha_emision_factura)
    if (sinFecha.length > 0) {
      toast.error(`${sinFecha.length} solicitud(es) no tienen fecha de emisión de factura: ${sinFecha.map(s => s.codigo ?? `#${s.id}`).join(', ')}`)
      return
    }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Detracciones SPOT')

    // Cabecera
    const headers = [
      'RUC DEL PROVEEDOR', 'TIPO DE DOCUMENTO', 'SERIE', 'NUMERO',
      'FECHA DE EMISION', 'IMPORTE TOTAL', 'PORCENTAJE DETRACCIÓN',
      'IMPORTE DETRACCIÓN', 'CODIGO DE SERVICIO',
      'PERIODO TRIBUTARIO', 'OBSERVACION',
    ]
    const headerRow = ws.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }
    ws.columns = [
      { width: 18 }, { width: 20 }, { width: 10 }, { width: 14 },
      { width: 16 }, { width: 16 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 20 },
    ]

    for (const s of solicitudesDetr) {
      const fechaEmision = new Date(s.fecha_emision_factura! + 'T00:00:00')
      const [serie, numero] = s.numero_factura?.includes('-')
        ? s.numero_factura.split('-')
        : ['', s.numero_factura ?? '']
      const periodoTributario = fechaEmision.toLocaleDateString('es-PE', { month: '2-digit', year: 'numeric' })
      const importeTotal = s.monto_total ?? 0

      ws.addRow([
        s.ruc ?? '',
        '01',
        serie,
        numero,
        fechaEmision.toLocaleDateString('es-PE'),
        importeTotal,
        s.detraccion?.porcentaje ?? '',
        Math.round(s.monto_detraccion ?? 0),
        s.detraccion?.codigo ?? '',
        periodoTributario,
        '',
      ])
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `detracciones_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Excel SPOT generado con ${solicitudesDetr.length} registro(s)`)
  }

  // ── Marcar pagado / detracción pagada (masivo) ─────────────────
  const canMarcarPago = userRole === ROLES.VISUALIZADOR || userRole === ROLES.ADMIN
  const selectedPorPagar = data.filter(s =>
    selectedIds.has(s.id) && s.estado_soli?.nombre === 'Aprobado' && !s.fecha_pago)
  const selectedDetraccionPendiente = data.filter(s =>
    selectedIds.has(s.id) && !!s.detraccion_id && !s.detraccion_pagada)

  const [bulkPagoOpen, setBulkPagoOpen] = useState(false)
  const [bulkDetOpen,  setBulkDetOpen]  = useState(false)

  const handleBulkPagoConfirm = async (cuentaId: number, fechaPago: string) => {
    if (!user?.id) return
    const results = await Promise.allSettled(
      selectedPorPagar.map(s => marcarPagado('solicitud', s.id, cuentaId, fechaPago, user.id))
    )
    const ok   = results.filter(r => r.status === 'fulfilled').length
    const fail = results.filter(r => r.status === 'rejected').length
    if (ok > 0)   toast.success(`${ok} solicitud${ok > 1 ? 'es' : ''} marcada${ok > 1 ? 's' : ''} como pagada${ok > 1 ? 's' : ''}`)
    if (fail > 0) toast.error(`${fail} no se pudo${fail > 1 ? 'n' : ''} marcar`)
    setBulkPagoOpen(false)
    setSelectedIds(new Set())
    refresh()
  }

  const handleBulkDetraccionConfirm = async (cuentaId: number, fechaPago: string) => {
    const results = await Promise.allSettled(
      selectedDetraccionPendiente.map(s => marcarDetraccionPagada(s.id, fechaPago, cuentaId))
    )
    const ok   = results.filter(r => r.status === 'fulfilled').length
    const fail = results.filter(r => r.status === 'rejected').length
    if (ok > 0)   toast.success(`${ok} detracción${ok > 1 ? 'es' : ''} marcada${ok > 1 ? 's' : ''} como pagada${ok > 1 ? 's' : ''}`)
    if (fail > 0) toast.error(`${fail} no se pudo${fail > 1 ? 'n' : ''} marcar`)
    setBulkDetOpen(false)
    setSelectedIds(new Set())
    refresh()
  }

  // ── Cancelar individual ───────────────────────────────────────
  const canCancelFromList = userRole === ROLES.ADMIN || userRole === ROLES.USUARIO

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMsg,  setConfirmMsg]  = useState('')
  const [pendingSol,  setPendingSol]  = useState<Solicitud | null>(null)

  const handleCancel = (s: Solicitud) => {
    setConfirmMsg(`¿Cancelar la solicitud ${s.codigo ?? `#${s.id}`}? Esta acción no se puede deshacer.`)
    setPendingSol(s)
    setConfirmOpen(true)
  }

  const confirmCancel = async () => {
    if (!pendingSol) return
    setConfirmOpen(false)
    try {
      await cancelarSolicitud(pendingSol.id)
      toast.success('Solicitud cancelada')
      refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cancelar la solicitud')
    }
  }

  return (
    <div className="p-6 space-y-3">

      {/* ── Barra de acciones masivas ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#003D7D]/20 bg-[#003D7D]/[0.04] px-5 py-3">
          <span className="text-sm font-semibold text-[#003D7D]">
            {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
          </span>

          <div className="h-4 w-px bg-[#003D7D]/20" />

          {!hasAnyBulk && (
            <span className="text-xs text-gray-400">
              Las solicitudes seleccionadas no tienen acciones disponibles para tu rol.
            </span>
          )}

          {canBulkEnviar && (
            <button
              onClick={handleBulkEnviar}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar a revisión ({pendienteCount})
            </button>
          )}

          {canBulkAprobar && (
            <button
              onClick={handleBulkAprobar}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
              Aprobar ({evaluadoCount})
            </button>
          )}

          {isVisualizador && (
            <button
              onClick={handleExport}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <Download size={12} /> Descargar Excel ({selectedIds.size})
            </button>
          )}

          {canExportDetracciones && selectedConDetraccion.length > 0 && (
            <button
              onClick={handleExportDetracciones}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet size={12} /> Excel Detracciones ({selectedConDetraccion.length})
            </button>
          )}

          {canMarcarPago && selectedPorPagar.length > 0 && (
            <button
              onClick={() => setBulkPagoOpen(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CreditCard size={12} /> Marcar pagado ({selectedPorPagar.length})
            </button>
          )}

          {canMarcarPago && selectedDetraccionPendiente.length > 0 && (
            <button
              onClick={() => setBulkDetOpen(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Landmark size={12} /> Marcar detracción pagada ({selectedDetraccionPendiente.length})
            </button>
          )}

          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkLoading}
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            <X size={13} /> Deseleccionar todo
          </button>
        </div>
      )}

      {/* ── Tabla ── */}
      <SolicitudesTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        onSearch={setSearch}
        onPageChange={handlePageChange}
        onRefresh={refresh}
        onCreate={!isVisualizador ? () => navigate('/solicitudes/nueva') : undefined}
        onView={(s) => navigate(`/solicitudes/${s.id}`)}
        onCancel={canCancelFromList ? handleCancel : undefined}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        proyectoFilter={proyectoFilter}
        onProyectoFilterChange={handleProyectoChange}
        mesAprobacion={isVisualizador ? mesAprobacion : undefined}
        onMesAprobacionChange={isVisualizador ? handleMesChange : undefined}
        pagoFilter={isVisualizador ? pagoLocal : undefined}
        onPagoFilterChange={isVisualizador ? handlePagoChange : undefined}
        monedaFilter={isVisualizador ? monedaLocal : undefined}
        onMonedaFilterChange={isVisualizador ? handleMonedaChange : undefined}
        showMontoPago={canMarcarPago}
        areaFilter={areaFilter}
        onAreaFilterChange={handleAreaChange}
        estadoFilter={isEvaluador ? estadoNombre : undefined}
        onEstadoFilterChange={isEvaluador ? handleEstadoChange : undefined}
        ordenVencimiento={ordenVencimiento}
        onOrdenVencimientoChange={handleOrdenVencimientoChange}
        hasFiltrosActivos={hasFiltrosActivos}
        onClearFilters={handleClearFiltros}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Cancelar solicitud"
        message={confirmMsg}
        confirmLabel="Cancelar solicitud"
        variant="red"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmOpen(false)}
      />

      <BulkPagoModal
        open={bulkPagoOpen}
        title="Marcar pagado (masivo)"
        cantidad={selectedPorPagar.length}
        onConfirm={handleBulkPagoConfirm}
        onCancel={() => setBulkPagoOpen(false)}
      />

      <BulkPagoModal
        open={bulkDetOpen}
        title="Marcar detracción pagada (masivo)"
        description={`Se registrará el pago de la detracción (SUNAT) de las ${selectedDetraccionPendiente.length} solicitudes seleccionadas.`}
        cantidad={selectedDetraccionPendiente.length}
        onConfirm={handleBulkDetraccionConfirm}
        onCancel={() => setBulkDetOpen(false)}
      />
    </div>
  )
}
