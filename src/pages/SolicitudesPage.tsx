import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Send, CheckCircle, ThumbsUp, X, Loader2 } from 'lucide-react'
import SolicitudesTable from '../features/solicitud/components/SolicitudesTable'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import { useSolicitudes } from '../features/solicitud/hooks/useSolicitudes'
import {
  cancelarSolicitud,
  enviarARevision,
  marcarEvaluado,
  aprobarSolicitud,
} from '../features/solicitud/services/solicitudService'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import type { Solicitud } from '../features/solicitud/types/solicitud'

export default function SolicitudesPage() {
  const navigate = useNavigate()
  const { userRole, user } = useAuthStore()
  const { data, total, page, pageSize, totalPages, loading, setPage, setSearch, refresh } = useSolicitudes()

  // ── Selección ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkLoading,  setBulkLoading]  = useState(false)

  const handlePageChange = (p: number) => { setPage(p); setSelectedIds(new Set()) }

  // Conteos por estado dentro de la selección
  const pendienteCount   = data.filter(s => selectedIds.has(s.id) && s.estado_soli?.nombre === 'Pendiente').length
  const enRevisionCount  = data.filter(s => selectedIds.has(s.id) && s.estado_soli?.nombre === 'En Revision').length
  const evaluadoCount    = data.filter(s => selectedIds.has(s.id) && s.estado_soli?.nombre === 'Evaluado').length

  const canBulkEnviar   = (userRole === ROLES.USUARIO || userRole === ROLES.ADMIN) && pendienteCount > 0
  const canBulkEvaluar  = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && enRevisionCount > 0
  const canBulkAprobar  = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && evaluadoCount > 0
  const hasAnyBulk      = canBulkEnviar || canBulkEvaluar || canBulkAprobar

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

  const handleBulkEnviar  = () => handleBulkAction('Pendiente',   enviarARevision, 'enviadas a revisión')
  const handleBulkEvaluar = () => handleBulkAction('En Revision', marcarEvaluado,  'marcadas como Evaluadas')
  const handleBulkAprobar = () => handleBulkAction('Evaluado',    id => aprobarSolicitud(id, user!.id), 'aprobadas')

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

          {canBulkEvaluar && (
            <button
              onClick={handleBulkEvaluar}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Marcar evaluado ({enRevisionCount})
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
        onCreate={() => navigate('/solicitudes/nueva')}
        onView={(s) => navigate(`/solicitudes/${s.id}`)}
        onCancel={canCancelFromList ? handleCancel : undefined}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
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
    </div>
  )
}
