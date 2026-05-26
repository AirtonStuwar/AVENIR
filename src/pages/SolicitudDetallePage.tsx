import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Plus, Trash2, AlertCircle, CheckCircle, Ban, Send, RotateCcw, ThumbsUp, Copy, FileDown } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import {
  getSolicitudById, createDetalle, updateDetalle, deleteDetalle,
  enviarARevision, cancelarSolicitud, marcarEvaluado, devolverSolicitud, aprobarSolicitud, rechazarSolicitud,
  getArchivosBySolicitud, getArchivoUrl,
  updateSolicitud, duplicarSolicitud, uploadFirma, getUsuarioById,
} from '../features/solicitud/services/solicitudService'
import SolicitudDetalleModal from '../features/solicitud/components/SolicitudDetalleModal'
import SolicitudArchivos from '../features/solicitud/components/SolicitudArchivos'
import SolicitudModal from '../features/solicitud/components/SolicitudModal'
import RechazoModal from '../features/solicitud/components/RechazoModal'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import FirmaModal from '../features/solicitud/components/FirmaModal'
import { OrdenCompraPDF } from '../features/solicitud/components/OrdenCompraPDF'
import EncuestaProveedorForm from '../features/proveedor/components/EncuestaProveedorForm'
import { getEncuestaBySolicitud } from '../features/proveedor/services/proveedorService'
import type { Encuesta } from '../features/proveedor/types/proveedor'
import { useAuthStore } from '../store/authStore'
import type { Solicitud, SolicitudDetalle, SolicitudArchivo, SolicitudUpdate } from '../features/solicitud/types/solicitud'
import { ROLES } from '../features/solicitud/types/solicitud'
import logoUrl from '../assets/avenir-logo.png'

// ── PDF helper ────────────────────────────────────────────────────
async function fetchAsBase64(url: string): Promise<string> {
  const res  = await fetch(url)
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

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
  Pendiente:               'bg-yellow-100 text-yellow-800',
  'En Revision':           'bg-blue-100 text-blue-800',
  Evaluado:                'bg-purple-100 text-purple-800',
  Aprobado:                'bg-green-100 text-green-800',
  Rechazado:               'bg-red-100 text-red-800',
  Cancelado:               'bg-gray-100 text-gray-600',
}

// Tipos de acción para el modal de confirmación
type ActionKey = 'cancelar' | 'evaluar' | { deleteDetId: number }

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

  const [solicitud,        setSolicitud]        = useState<Solicitud | null>(null)
  const [loadingSol,       setLoadingSol]       = useState(true)
  const [detalles,         setDetalles]         = useState<SolicitudDetalle[]>([])
  const [actioning,        setActioning]        = useState(false)

  // Archivos de la solicitud
  const [archivosSubidos,  setArchivosSubidos]  = useState<SolicitudArchivo[]>([])

  // Encuesta
  const [encuesta,         setEncuesta]         = useState<Encuesta | null>(null)

  // Número de factura
  const [numeroFactura,    setNumeroFactura]    = useState('')
  const [savingFactNum,    setSavingFactNum]    = useState(false)

  // Modales
  const [rechazoOpen,    setRechazoOpen]    = useState(false)
  const [devolucionOpen, setDevolucionOpen] = useState(false)
  const [modalOpen,      setModalOpen]      = useState(false)
  const [editingDet,     setEditingDet]     = useState<SolicitudDetalle | null>(null)
  const [editInfoOpen,   setEditInfoOpen]   = useState(false)
  const [duplicando,     setDuplicando]     = useState(false)

  // Confirm modal — guarda la CLAVE de la acción, no la función
  const [pendingAction,  setPendingAction]  = useState<ActionKey | null>(null)
  const [confirmCfg,     setConfirmCfg]     = useState<ConfirmCfg>({ title: '', message: '', confirmLabel: 'Confirmar', variant: 'blue' })

  // Firma modal
  const [firmaOpen,      setFirmaOpen]      = useState(false)
  const [firmaAction,    setFirmaAction]    = useState<'enviar' | 'aprobar'>('enviar')

  // PDF
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  // ── Data loading ──────────────────────────────────────────────
  const reload = async (currentId: string) => {
    const sol = await getSolicitudById(Number(currentId))
    setSolicitud(sol)
    setDetalles(sol.detalles ?? [])
    await getEncuestaBySolicitud(Number(currentId)).then(setEncuesta).catch(() => {})
  }

  useEffect(() => {
    if (!id) return
    setLoadingSol(true)
    getSolicitudById(Number(id))
      .then(async sol => {
        setSolicitud(sol)
        setDetalles(sol.detalles ?? [])
        await getEncuestaBySolicitud(Number(id)).then(setEncuesta).catch(() => {})
      })
      .catch(() => toast.error('No se pudo cargar la solicitud'))
      .finally(() => setLoadingSol(false))
  }, [id])

  // Sync número de factura desde solicitud
  useEffect(() => {
    setNumeroFactura(solicitud?.numero_factura ?? '')
  }, [solicitud?.numero_factura])

  // ── Derived state ──────────────────────────────────────────────
  const nombre         = solicitud?.estado_soli?.nombre ?? ''
  const isPendiente    = nombre === 'Pendiente'
  const isEnRevision   = nombre === 'En Revision'
  const isEvaluado     = nombre === 'Evaluado'
  const isAprobado     = nombre === 'Aprobado'
  const isCancelado    = nombre === 'Cancelado'
  const isRechazado    = nombre === 'Rechazado'
  const isOwnSolicitud = solicitud?.usuario_creador === user?.id

  const canEdit      = isPendiente && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)
  const canDuplicar  = userRole === ROLES.USUARIO && isOwnSolicitud && (isAprobado || isCancelado || isRechazado)
  const canShowPDF   = !isPendiente && !isRechazado && !isCancelado
  const DOCS_OBLIGATORIOS = ['Contrato', 'Cotizacion', 'Sustento']
  const tieneDocsObligatorios = DOCS_OBLIGATORIOS.every(doc =>
    archivosSubidos.some(a => a.tipo_archivo === doc)
  )
  const canEnviar    = ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && isPendiente && tieneDocsObligatorios
  const canCancelar  = ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && isPendiente
  const canEvaluar   = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canDevolver  = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canAprobar   = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEvaluado
  const canRechazar  = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEvaluado
  const canEncuestar      = isAprobado && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)
  const hasFacturaDoc     = archivosSubidos.some(a => a.tipo_archivo === 'Factura XML' || a.tipo_archivo === 'Factura PDF')
  const showNumFactura    = hasFacturaDoc || !!solicitud?.numero_factura
  const canEditNumFactura = (canEdit || isAprobado) && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)

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
      if (action === 'cancelar') {
        await cancelarSolicitud(solId)
        toast.success('Solicitud cancelada')
      } else if (action === 'evaluar') {
        await marcarEvaluado(solId)
        toast.success('Marcada como Evaluada')
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

  // ── Firma confirm handler ─────────────────────────────────────
  const handleFirmaConfirm = async (blob: Blob) => {
    if (!solicitud || !id) return
    const tipo = firmaAction === 'enviar' ? 'Firma_Usuario' : 'Firma_Aprobador'
    await uploadFirma(blob, solicitud.id, tipo)
    setFirmaOpen(false)
    setActioning(true)
    try {
      if (firmaAction === 'enviar') {
        await enviarARevision(solicitud.id)
        toast.success('Enviada a revisión')
      } else {
        if (!user) return
        await aprobarSolicitud(solicitud.id, user.id)
        toast.success('Solicitud aprobada')
      }
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al ejecutar la acción')
    } finally {
      setActioning(false)
    }
  }

  // ── PDF download ──────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!solicitud) return
    setDownloadingPDF(true)
    try {
      // Fetch archivos and resolve firma URLs
      const archivos = await getArchivosBySolicitud(solicitud.id)
      const firmaU   = archivos.find(a => a.tipo_archivo === 'Firma_Usuario')
      const firmaA   = archivos.find(a => a.tipo_archivo === 'Firma_Aprobador')

      const aprobadorPromise = solicitud.usuario_aprobador
        ? getUsuarioById(solicitud.usuario_aprobador)
        : Promise.resolve(null)

      const [logoB64, firmaUB64, firmaAB64, aprobador] = await Promise.all([
        fetchAsBase64(logoUrl),
        firmaU?.archivo_path ? getArchivoUrl(firmaU.archivo_path).then(fetchAsBase64) : Promise.resolve(null),
        firmaA?.archivo_path ? getArchivoUrl(firmaA.archivo_path).then(fetchAsBase64) : Promise.resolve(null),
        aprobadorPromise,
      ])

      const blob = await pdf(
        <OrdenCompraPDF
          solicitud={solicitud}
          detalles={detalles}
          logoSrc={logoB64}
          firmaUsuarioSrc={firmaUB64}
          firmaAprobadorSrc={firmaAB64}
          aprobadorNombre={aprobador?.nombre_completo ?? null}
          aprobadorEmail={aprobador?.correo ?? null}
          aprobadorCargo={aprobador?.cargo ?? null}
        />
      ).toBlob()

      const objUrl = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href     = objUrl
      a.download = `Orden_${solicitud.codigo ?? solicitud.id}.pdf`
      a.click()
      URL.revokeObjectURL(objUrl)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el PDF')
    } finally {
      setDownloadingPDF(false)
    }
  }

  // ── Handlers de botones ───────────────────────────────────────
  const handleEnviar = () => {
    if (!solicitud) return
    setFirmaAction('enviar')
    setFirmaOpen(true)
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
    setFirmaAction('aprobar')
    setFirmaOpen(true)
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

  // ── Número de factura ────────────────────────────────────────────
  const handleGuardarNumFactura = async () => {
    if (!solicitud || !id) return
    setSavingFactNum(true)
    try {
      await updateSolicitud(solicitud.id, { numero_factura: numeroFactura.trim() || null })
      toast.success('N° de factura guardado')
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSavingFactNum(false)
    }
  }

  // ── Edit info general ────────────────────────────────────────────
  const handleUpdateInfo = async (payload: SolicitudUpdate) => {
    if (!solicitud || !id) return
    await updateSolicitud(solicitud.id, payload)
    await reload(id)
  }

  // ── Duplicar ─────────────────────────────────────────────────────
  const handleDuplicar = async () => {
    if (!solicitud || !user) return
    setDuplicando(true)
    try {
      const nueva = await duplicarSolicitud(solicitud.id, user.id)
      toast.success('Solicitud duplicada correctamente')
      navigate(`/solicitudes/${nueva.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al duplicar')
    } finally {
      setDuplicando(false)
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
          {canShowPDF && (
            <button onClick={handleDownloadPDF} disabled={downloadingPDF || actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {downloadingPDF
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                : <FileDown size={13} />}
              Descargar OC
            </button>
          )}
          {canDuplicar && (
            <button onClick={handleDuplicar} disabled={duplicando || actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {duplicando
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                : <Copy size={13} />}
              Duplicar
            </button>
          )}
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
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Información general</h2>
            {canEdit && (
              <button onClick={() => setEditInfoOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                <Pencil size={13} /> Editar
              </button>
            )}
          </div>
          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <InfoField label="Código"          value={solicitud.codigo} />
            <InfoField label="Tipo"            value={solicitud.solicitud_tipo?.nombre} />
            <InfoField label="Proyecto"        value={solicitud.proyecto?.nombre} />
            <InfoField label="Fecha pedido"    value={fmtDate(solicitud.fecha_pedido)} />
            <InfoField label="Fecha requerida" value={fmtDate(solicitud.fecha_requerida)} />
            <InfoField label="Forma de pago"   value={solicitud.solicitud_forma_pago?.nombre ?? solicitud.forma_pago} />
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

          {(solicitud.condiciones || solicitud.motivo_factura) && (
            <div className="px-6 pb-5 border-t border-gray-50 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {solicitud.condiciones && (
                <div>
                  <p className={LABEL}>Condiciones</p>
                  <p className="text-sm text-gray-700">{solicitud.condiciones}</p>
                </div>
              )}
              {solicitud.motivo_factura && (
                <div>
                  <p className={LABEL}>Motivo de la factura</p>
                  <p className="text-sm text-gray-700">{solicitud.motivo_factura}</p>
                </div>
              )}
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
        <SolicitudArchivos
          solicitudId={solicitud.id}
          editable={canEdit}
          onChange={setArchivosSubidos}
        />
        {isPendiente && !tieneDocsObligatorios && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle size={15} className="shrink-0" />
            Para enviar a revisión debes adjuntar los documentos obligatorios: Contrato, Cotización y Sustento.
          </div>
        )}

        {/* ── N° DE FACTURA ── */}
        {showNumFactura && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <CheckCircle size={15} className="text-[#003D7D]" />
              <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Número de factura</h2>
              {solicitud.numero_factura && (
                <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full">Registrado</span>
              )}
            </div>
            <div className="px-6 py-5">
              {canEditNumFactura ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1 max-w-xs">
                    <label className={LABEL}>N° de Factura</label>
                    <input
                      type="text"
                      value={numeroFactura}
                      onChange={e => setNumeroFactura(e.target.value)}
                      placeholder="Ej: F001-00123"
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]"
                    />
                  </div>
                  <button
                    onClick={handleGuardarNumFactura}
                    disabled={savingFactNum || numeroFactura.trim() === (solicitud.numero_factura ?? '')}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-40 transition-colors"
                  >
                    {savingFactNum
                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      : 'Guardar'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className={LABEL}>N° de Factura</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{solicitud.numero_factura ?? '—'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ENCUESTA PROVEEDOR ── */}
        {canEncuestar && (
          <EncuestaProveedorForm
            solicitudId={solicitud.id}
            proveedorRuc={solicitud.ruc}
            usuarioId={user!.id}
            encuesta={encuesta}
            onSaved={setEncuesta}
          />
        )}

      </div>

      <SolicitudDetalleModal
        open={modalOpen}
        detalle={editingDet}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <SolicitudModal
        open={editInfoOpen}
        onClose={() => setEditInfoOpen(false)}
        onCreate={async () => {}}
        solicitud={solicitud}
        onUpdate={handleUpdateInfo}
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

      <FirmaModal
        open={firmaOpen}
        title={firmaAction === 'enviar' ? 'Firma del solicitante' : 'Firma del aprobador'}
        onClose={() => setFirmaOpen(false)}
        onConfirm={handleFirmaConfirm}
      />
    </div>
  )
}