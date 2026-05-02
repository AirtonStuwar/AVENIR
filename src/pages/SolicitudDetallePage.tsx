import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Plus, Trash2, AlertCircle, CheckCircle, Ban, Send, RotateCcw, ThumbsUp } from 'lucide-react'
import {
  getSolicitudById, createDetalle, updateDetalle, deleteDetalle,
  enviarARevision, cancelarSolicitud, marcarEvaluado, devolverSolicitud, aprobarSolicitud, rechazarSolicitud,
} from '../features/solicitud/services/solicitudService'
import SolicitudDetalleModal from '../features/solicitud/components/SolicitudDetalleModal'
import SolicitudArchivos from '../features/solicitud/components/SolicitudArchivos'
import RechazoModal from '../features/solicitud/components/RechazoModal'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import { useAuthStore } from '../store/authStore'
import type { Solicitud, SolicitudDetalle } from '../features/solicitud/types/solicitud'
import { ROLES } from '../features/solicitud/types/solicitud'

const LABEL = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5'
const VALUE = 'text-sm text-gray-900'

function InfoField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className={VALUE}>{value ?? '—'}</p>
    </div>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(d + 'T00:00:00'))
}

function fmtMoney(n: number) {
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2 })
}

const ESTADO_COLOR: Record<string, string> = {
  Pendiente:     'bg-yellow-100 text-yellow-800',
  'En Revision': 'bg-blue-100 text-blue-800',
  Evaluado:      'bg-purple-100 text-purple-800',
  Aprobado:      'bg-green-100 text-green-800',
  Rechazado:     'bg-red-100 text-red-800',
  Cancelado:     'bg-gray-100 text-gray-600',
}

// Tipos de acción para el modal de confirmación
type ActionKey = 'enviar' | 'cancelar' | 'evaluar' | 'aprobar' | { deleteDetId: number }

interface ConfirmCfg {
  title: string
  message: string
  confirmLabel: string
  variant: 'red' | 'blue'
}

export default function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole } = useAuthStore()

  const [solicitud,      setSolicitud]      = useState<Solicitud | null>(null)
  const [loadingSol,     setLoadingSol]     = useState(true)
  const [detalles,       setDetalles]       = useState<SolicitudDetalle[]>([])
  const [actioning,      setActioning]      = useState(false)

  // Modales
  const [rechazoOpen,    setRechazoOpen]    = useState(false)
  const [devolucionOpen, setDevolucionOpen] = useState(false)
  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingDet,     setEditingDet]     = useState<SolicitudDetalle | null>(null)

  // Confirm modal — guarda la CLAVE de la acción, no la función
  const [pendingAction,  setPendingAction]  = useState<ActionKey | null>(null)
  const [confirmCfg,     setConfirmCfg]     = useState<ConfirmCfg>({ title: '', message: '', confirmLabel: 'Confirmar', variant: 'blue' })

  // ── Data loading ──────────────────────────────────────────────
  const reload = async (currentId: string) => {
    const sol = await getSolicitudById(Number(currentId))
    setSolicitud(sol)
    setDetalles(sol.detalles ?? [])
  }

  useEffect(() => {
    if (!id) return
    setLoadingSol(true)
    getSolicitudById(Number(id))
      .then(sol => { setSolicitud(sol); setDetalles(sol.detalles ?? []) })
      .catch(() => toast.error('No se pudo cargar la solicitud'))
      .finally(() => setLoadingSol(false))
  }, [id])

  // ── Derived state ──────────────────────────────────────────────
  const nombre         = solicitud?.estado_soli?.nombre ?? ''
  const isPendiente    = nombre === 'Pendiente'
  const isEnRevision   = nombre === 'En Revision'
  const isEvaluado     = nombre === 'Evaluado'
  const isOwnSolicitud = solicitud?.usuario_creador === user?.id

  const canEdit    = (userRole === ROLES.USUARIO && isPendiente && isOwnSolicitud) || userRole === ROLES.ADMIN
  const canEnviar  = ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && isPendiente
  const canCancelar = ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && isPendiente
  const canEvaluar  = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canDevolver = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canAprobar  = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEvaluado
  const canRechazar = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEvaluado

  const estadoColor = ESTADO_COLOR[nombre] ?? 'bg-gray-100 text-gray-600'

  // ── Abrir confirm ─────────────────────────────────────────────
  const openConfirm = (action: ActionKey, cfg: ConfirmCfg) => {
    setConfirmCfg(cfg)
    setPendingAction(action)
  }

  // ── Ejecutar acción confirmada ────────────────────────────────
  const handleConfirmOk = async () => {
    const action = pendingAction
    const solId  = solicitud?.id
    if (!action || !solId || !id) { setPendingAction(null); return }

    setPendingAction(null)
    setActioning(true)
    try {
      if (action === 'enviar') {
        await enviarARevision(solId)
        toast.success('Enviada a revisión')
      } else if (action === 'cancelar') {
        await cancelarSolicitud(solId)
        toast.success('Solicitud cancelada')
      } else if (action === 'evaluar') {
        await marcarEvaluado(solId)
        toast.success('Marcada como Evaluada')
      } else if (action === 'aprobar') {
        if (!user) return
        await aprobarSolicitud(solId, user.id)
        toast.success('Solicitud aprobada')
      } else if (typeof action === 'object' && 'deleteDetId' in action) {
        await deleteDetalle(action.deleteDetId)
        setDetalles(ds => ds.filter(x => x.id !== action.deleteDetId))
        toast.success('Detalle eliminado')
      }
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al ejecutar la acción')
    } finally {
      setActioning(false)
    }
  }

  // ── Handlers de botones ───────────────────────────────────────
  const handleEnviar = () => {
    if (!solicitud) return
    openConfirm('enviar', {
      title: 'Enviar a revisión',
      message: `¿Enviar la solicitud ${solicitud.codigo ?? `#${solicitud.id}`} a revisión? Ya no podrá editarla.`,
      confirmLabel: 'Enviar',
      variant: 'blue',
    })
  }

  const handleCancelar = () => {
    if (!solicitud) return
    openConfirm('cancelar', {
      title: 'Cancelar solicitud',
      message: `¿Cancelar la solicitud ${solicitud.codigo ?? `#${solicitud.id}`}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, cancelar',
      variant: 'red',
    })
  }

  const handleEvaluar = () => {
    if (!solicitud) return
    openConfirm('evaluar', {
      title: 'Marcar como Evaluada',
      message: `¿Marcar como Evaluada la solicitud ${solicitud.codigo ?? `#${solicitud.id}`}?`,
      confirmLabel: 'Marcar evaluado',
      variant: 'blue',
    })
  }

  const handleAprobar = () => {
    if (!solicitud) return
    openConfirm('aprobar', {
      title: 'Aprobar solicitud',
      message: `¿Aprobar la solicitud ${solicitud.codigo ?? `#${solicitud.id}`}?`,
      confirmLabel: 'Aprobar',
      variant: 'blue',
    })
  }

  const handleDevolver = async (comentario: string) => {
    if (!solicitud || !id) return
    try {
      await devolverSolicitud(solicitud.id, comentario)
      toast.success('Solicitud devuelta al usuario')
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al devolver')
      throw err
    }
  }

  const handleRechazar = async (comentario: string) => {
    if (!solicitud || !id) return
    try {
      await rechazarSolicitud(solicitud.id, comentario)
      toast.success('Solicitud rechazada')
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar')
      throw err
    }
  }

  // ── Detalle handlers ─────────────────────────────────────────
  const openAdd  = () => { setEditingDet(null); setModalOpen(true) }
  const openEdit = (d: SolicitudDetalle) => { setEditingDet(d); setModalOpen(true) }

  const handleModalSubmit = async (data: { cantidad: number; descripcion: string; valor_unitario: number }) => {
    if (!solicitud) return
    if (editingDet) {
      const updated = await updateDetalle(editingDet.id, data)
      setDetalles(ds => ds.map(x => x.id === editingDet.id ? updated : x))
      toast.success('Detalle actualizado')
    } else {
      const nuevo = await createDetalle({ solicitud_id: solicitud.id, ...data })
      setDetalles(ds => [...ds, nuevo])
      toast.success('Detalle agregado')
    }
  }

  const handleDetDelete = (detId: number) => {
    openConfirm({ deleteDetId: detId }, {
      title: 'Eliminar detalle',
      message: '¿Eliminar este detalle? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'red',
    })
  }

  const subtotal    = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
  const igv         = subtotal * 0.18
  const totalConIgv = subtotal + igv

  // ── Loading / not found ───────────────────────────────────────
  if (loadingSol) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#003D7D] border-t-transparent" />
      </div>
    )
  }

  if (!solicitud) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-500">
        <AlertCircle size={32} className="text-gray-300" />
        <p>Solicitud no encontrada.</p>
        <button onClick={() => navigate('/solicitudes')} className="text-sm text-[#003D7D] hover:underline">Volver al listado</button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate('/solicitudes')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#003D7D] transition-colors">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-sm font-semibold text-gray-800">{solicitud.codigo ?? `Solicitud #${solicitud.id}`}</span>
        <span className={`ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoColor}`}>
          {solicitud.estado_soli?.nombre ?? '—'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {canEnviar && (
            <button onClick={handleEnviar} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
              <Send size={13} /> Enviar a revisión
            </button>
          )}
          {canCancelar && (
            <button onClick={handleCancelar} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <Ban size={13} /> Cancelar
            </button>
          )}
          {canEvaluar && (
            <button onClick={handleEvaluar} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              <CheckCircle size={13} /> Marcar evaluado
            </button>
          )}
          {canDevolver && (
            <button onClick={() => setDevolucionOpen(true)} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
              <RotateCcw size={13} /> Devolver
            </button>
          )}
          {canAprobar && (
            <button onClick={handleAprobar} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              <ThumbsUp size={13} /> Aprobar
            </button>
          )}
          {canRechazar && (
            <button onClick={() => setRechazoOpen(true)} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
              <Ban size={13} /> Rechazar
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ── INFO GENERAL ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Información general</h2>
          </div>
          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <InfoField label="Código"          value={solicitud.codigo} />
            <InfoField label="Tipo"            value={solicitud.solicitud_tipo?.nombre} />
            <InfoField label="Proyecto"        value={solicitud.proyecto?.nombre} />
            <InfoField label="Fecha pedido"    value={fmtDate(solicitud.fecha_pedido)} />
            <InfoField label="Fecha requerida" value={fmtDate(solicitud.fecha_requerida)} />
            <InfoField label="Forma de pago"   value={solicitud.forma_pago} />
          </div>

          <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-gray-50 pt-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Razón social" value={solicitud.razon_social} />
                <InfoField label="RUC"          value={solicitud.ruc} />
                <InfoField label="Dirección"    value={solicitud.direccion} />
                <InfoField label="Contacto"     value={solicitud.contacto_nombre} />
                <InfoField label="Teléfono"     value={solicitud.contacto_telefono} />
                <InfoField label="Correo"       value={solicitud.contacto_correo} />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Financiero</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Banco"         value={solicitud.banco} />
                <InfoField label="N° cuenta"     value={solicitud.numero_cuenta} />
                <InfoField label="Detracciones"  value={solicitud.cuenta_detracciones} />
                <InfoField label="% Contrato"    value={solicitud.porcentaje_contrato != null ? `${solicitud.porcentaje_contrato}%` : null} />
                <InfoField label="% Acumulado"   value={solicitud.porcentaje_acumulado_contrato != null ? `${solicitud.porcentaje_acumulado_contrato}%` : null} />
                <InfoField label="% Pendiente"   value={solicitud.porcentaje_pendiente_contrato != null ? `${solicitud.porcentaje_pendiente_contrato}%` : null} />
              </div>
            </div>
          </div>

          {solicitud.condiciones && (
            <div className="px-6 pb-5 border-t border-gray-50 pt-4">
              <p className={LABEL}>Condiciones</p>
              <p className="text-sm text-gray-700">{solicitud.condiciones}</p>
            </div>
          )}
          {solicitud.comentario_gerencia && (
            <div className="px-6 pb-5 border-t border-gray-50 pt-4">
              <p className={LABEL}>Comentario</p>
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">{solicitud.comentario_gerencia}</p>
            </div>
          )}
        </div>

        {/* ── DETALLES ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
              Detalles <span className="ml-1 text-gray-400 font-normal normal-case">({detalles.length} ítems)</span>
            </h2>
            <div className="flex items-center gap-3">
              {subtotal > 0 && <span className="text-sm font-bold text-[#003D7D]">{fmtMoney(totalConIgv)}</span>}
              {canEdit && (
                <button onClick={openAdd}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-medium hover:bg-[#002D5C] transition-all">
                  <Plus size={13} /> Agregar
                </button>
              )}
            </div>
          </div>

          {detalles.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">
              {canEdit
                ? <button onClick={openAdd} className="text-[#003D7D] hover:underline">+ Agregar el primer detalle</button>
                : 'Esta solicitud no tiene detalles registrados.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Descripción</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Cant.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor unit.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                    {canEdit && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {detalles.map((d, i) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 text-gray-900">{d.descripcion}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{d.cantidad}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{fmtMoney(d.valor_unitario)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#003D7D]">
                        {fmtMoney(d.valor_total ?? d.cantidad * d.valor_unitario)}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(d)} className="text-blue-500 hover:text-blue-700 transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => handleDetDelete(d.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-100">
                  <tr>
                    <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">Subtotal</td>
                    <td className="px-5 py-2 text-right text-sm text-gray-600">{fmtMoney(subtotal)}</td>
                    {canEdit && <td />}
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">IGV (18%)</td>
                    <td className="px-5 py-2 text-right text-sm text-gray-600">{fmtMoney(igv)}</td>
                    {canEdit && <td />}
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-gray-600">Total general:</td>
                    <td className="px-5 py-3 text-right text-base font-bold text-[#003D7D]">{fmtMoney(totalConIgv)}</td>
                    {canEdit && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── DOCUMENTOS ── */}
        <SolicitudArchivos solicitudId={solicitud.id} editable={canEdit} />

      </div>

      <SolicitudDetalleModal
        open={modalOpen}
        detalle={editingDet}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <ConfirmModal
        open={pendingAction !== null}
        title={confirmCfg.title}
        message={confirmCfg.message}
        confirmLabel={confirmCfg.confirmLabel}
        variant={confirmCfg.variant}
        onConfirm={handleConfirmOk}
        onCancel={() => setPendingAction(null)}
      />

      <RechazoModal
        open={devolucionOpen}
        codigo={solicitud.codigo ?? null}
        onClose={() => setDevolucionOpen(false)}
        onConfirm={handleDevolver}
        title="Devolver solicitud"
        confirmLabel="Devolver"
        variant="amber"
      />

      <RechazoModal
        open={rechazoOpen}
        codigo={solicitud.codigo ?? null}
        onClose={() => setRechazoOpen(false)}
        onConfirm={handleRechazar}
      />
    </div>
  )
}
