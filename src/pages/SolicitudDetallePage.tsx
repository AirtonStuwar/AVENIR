import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Plus, Trash2, AlertCircle, CheckCircle, Ban, Send, RotateCcw, ThumbsUp, Copy, FileDown, Search } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import {
  getSolicitudById, createDetalle, updateDetalle, deleteDetalle,
  enviarARevision, cancelarSolicitud, marcarEvaluado, devolverSolicitud, aprobarSolicitud, rechazarSolicitud,
  observarSolicitud, reenviarAContabilidad,
  getArchivosBySolicitud, getArchivoUrl,
  updateSolicitud, duplicarSolicitud, uploadFirma, getUsuarioById, marcarDetraccionPagada,
  getPlanContable,
} from '../features/solicitud/services/solicitudService'
import SolicitudDetalleModal from '../features/solicitud/components/SolicitudDetalleModal'
import SolicitudArchivos from '../features/solicitud/components/SolicitudArchivos'
import SolicitudModal from '../features/solicitud/components/SolicitudModal'
import RechazoModal from '../features/solicitud/components/RechazoModal'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import EvaluarModal from '../features/solicitud/components/EvaluarModal'
import PagoModal from '../features/solicitud/components/PagoModal'
import { marcarPagado } from '../features/solicitud/services/cuentaBancariaService'
import { getTipoCambioUSD } from '../features/solicitud/services/rucService'
import FirmaModal from '../features/solicitud/components/FirmaModal'
import { OrdenCompraPDF } from '../features/solicitud/components/OrdenCompraPDF'
import EncuestaProveedorForm from '../features/proveedor/components/EncuestaProveedorForm'
import { getEncuestaBySolicitud } from '../features/proveedor/services/proveedorService'
import type { Encuesta } from '../features/proveedor/types/proveedor'
import { useAuthStore } from '../store/authStore'
import { getConsumoByProyectos } from '../features/proyecto/services/proyectoService'
import type { Consumo } from '../features/proyecto/services/proyectoService'
import { getUserFirmaBlob, getUserFirmaUrl } from '../features/usuario/services/usuarioService'
import type { Solicitud, SolicitudDetalle, SolicitudArchivo, SolicitudUpdate, PlanContable } from '../features/solicitud/types/solicitud'
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
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(d.includes('T') ? d : d + 'T00:00:00'))
}

function fmtMoney(n: number, moneda: 'PEN' | 'USD' = 'PEN') {
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  return sym + n.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })
}

const ESTADO_COLOR: Record<string, string> = {
  Pendiente:               'bg-yellow-100 text-yellow-800',
  'En Revision':           'bg-blue-100 text-blue-800',
  Evaluado:                'bg-purple-100 text-purple-800',
  Aprobado:                'bg-green-100 text-green-800',
  Rechazado:               'bg-red-100 text-red-800',
  Cancelado:               'bg-gray-100 text-gray-600',
  Observado:               'bg-amber-100 text-amber-800',
}

// Tipos de acción para el modal de confirmación
type ActionKey = 'cancelar' | { deleteDetId: number }

interface ConfirmCfg {
  title: string
  message: string
  confirmLabel: string
  variant: 'red' | 'blue'
}

export default function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole, usuarioProfile } = useAuthStore()

  const [solicitud,        setSolicitud]        = useState<Solicitud | null>(null)
  const [loadingSol,       setLoadingSol]       = useState(true)
  const [detalles,         setDetalles]         = useState<SolicitudDetalle[]>([])
  const [actioning,        setActioning]        = useState(false)

  // Archivos de la solicitud
  const [archivosSubidos,  setArchivosSubidos]  = useState<SolicitudArchivo[]>([])

  // Encuesta
  const [encuesta,         setEncuesta]         = useState<Encuesta | null>(null)

  // Consumo presupuesto (ADMIN + APROBADOR)
  const canVerConsumo = userRole === ROLES.ADMIN || userRole === ROLES.APROBADOR
  const [consumoData, setConsumoData] = useState<{ consumo: Consumo; presupuesto: { pen: number; usd: number }; label: string } | null>(null)
  const [tipoCambio, setTipoCambio] = useState<number | null>(null)

  // Datos de factura
  const [numeroFactura,        setNumeroFactura]        = useState('')
  const [motivoFactura,        setMotivoFactura]        = useState('')
  const [fechaEmisionFactura,  setFechaEmisionFactura]  = useState('')
  const [fechaVencimientoFactura, setFechaVencimientoFactura] = useState('')
  const [savingFactura,        setSavingFactura]        = useState(false)

  // Plan contable (editable en Pendiente)
  const [planContableEditOpciones, setPlanContableEditOpciones] = useState<PlanContable[]>([])
  const [planContableEditSel,      setPlanContableEditSel]      = useState<PlanContable | null>(null)
  const [planContableEditSearch,   setPlanContableEditSearch]   = useState('')
  const [planContableEditDropOpen, setPlanContableEditDropOpen] = useState(false)
  const [savingPlanContable,       setSavingPlanContable]       = useState(false)

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

  // Evaluar modal
  const [evaluarOpen,        setEvaluarOpen]        = useState(false)
  const [pagoOpen,           setPagoOpen]           = useState(false)
  const [detPagoOpen,        setDetPagoOpen]        = useState(false)
  const [detFechaPago,       setDetFechaPago]       = useState('')
  const [savingDetPago,      setSavingDetPago]      = useState(false)

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

  // Sync datos de factura desde solicitud
  useEffect(() => {
    setNumeroFactura(solicitud?.numero_factura ?? '')
    setMotivoFactura(solicitud?.motivo_factura ?? '')
    setFechaEmisionFactura(solicitud?.fecha_emision_factura ?? '')
    setFechaVencimientoFactura(solicitud?.fecha_vencimiento_factura ?? '')
  }, [solicitud?.numero_factura, solicitud?.motivo_factura, solicitud?.fecha_emision_factura, solicitud?.fecha_vencimiento_factura])

  // Consumo de presupuesto (partida o proyecto)
  useEffect(() => {
    if (!canVerConsumo || !solicitud?.proyecto_id) return
    getConsumoByProyectos([solicitud.proyecto_id])
      .then(c => {
        if (solicitud.proyecto_partida_id && solicitud.proyecto_partida) {
          setConsumoData({
            consumo: c.porPartida[solicitud.proyecto_partida_id] ?? { pen: 0, usd: 0 },
            presupuesto: { pen: solicitud.proyecto_partida.presupuesto_pen, usd: solicitud.proyecto_partida.presupuesto_usd },
            label: solicitud.proyecto_partida.nombre,
          })
        } else {
          const proy = solicitud.proyecto
          setConsumoData({
            consumo: c.porProyecto[solicitud.proyecto_id!] ?? { pen: 0, usd: 0 },
            presupuesto: { pen: proy?.presupuesto ?? 0, usd: 0 },
            label: proy?.nombre ?? 'Empresa',
          })
        }
      })
      .catch(() => {})
  }, [canVerConsumo, solicitud?.proyecto_id, solicitud?.proyecto_partida_id])

  // Tipo de cambio — solo para OC en USD (para umbral de contrato)
  useEffect(() => {
    const isOCSol = solicitud?.solicitud_tipo?.nombre !== 'Recibo por Honorarios'
    if (!solicitud || !isOCSol || solicitud.moneda !== 'USD') return
    getTipoCambioUSD().then(setTipoCambio).catch(() => {})
  }, [solicitud?.id, solicitud?.moneda, solicitud?.solicitud_tipo?.nombre])

  // Plan contable — cargar opciones cuando el usuario puede editar
  useEffect(() => {
    const isOwner = solicitud?.usuario_creador === user?.id
    const editable = solicitud?.estado_soli?.nombre === 'Pendiente'
      && ((userRole === ROLES.USUARIO && isOwner) || userRole === ROLES.ADMIN)
    if (!editable) return
    getPlanContable().then(setPlanContableEditOpciones).catch(() => {})
  }, [solicitud?.id, solicitud?.estado_soli?.nombre, userRole, solicitud?.usuario_creador, user?.id])

  // Sincronizar selección actual desde solicitud
  useEffect(() => {
    if (solicitud?.plan_contable) {
      setPlanContableEditSel(solicitud.plan_contable)
      setPlanContableEditSearch(solicitud.plan_contable.tipo_gasto_costo ?? '')
    } else {
      setPlanContableEditSel(null)
      setPlanContableEditSearch('')
    }
  }, [solicitud?.plan_contable_id])

  // ── Derived state ──────────────────────────────────────────────
  const nombre         = solicitud?.estado_soli?.nombre ?? ''
  const isPendiente    = nombre === 'Pendiente'
  const isEnRevision   = nombre === 'En Revision'
  const isEvaluado     = nombre === 'Evaluado'
  const isAprobado     = nombre === 'Aprobado'
  const isCancelado    = nombre === 'Cancelado'
  const isRechazado    = nombre === 'Rechazado'
  const isObservado    = nombre === 'Observado'
  const isOwnSolicitud = solicitud?.usuario_creador === user?.id

  const isRxH        = solicitud?.solicitud_tipo?.nombre === 'Recibo por Honorarios'
  // Observado (devuelto por contabilidad): editable como Pendiente, pero SIN abrir el modal
  // de cabecera — así banco y número de cuenta quedan bloqueados durante la corrección.
  const canEdit      = (isPendiente || isObservado) && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)
  const canDuplicar  = userRole === ROLES.USUARIO && isOwnSolicitud && (isAprobado || isCancelado || isRechazado)
  const canShowPDF   = !isRechazado && !isCancelado
  // Contrato requerido si total con IGV en soles >= S/ 3,500
  const _solMoneda   = (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN'
  const _tc          = _solMoneda === 'USD' ? (tipoCambio ?? 1) : 1
  const DOCS_OBLIGATORIOS     = isRxH
    ? ['Sustento', 'Recibo Honorario']
    : (() => {
        // subtotal se calcula abajo, pero aquí usamos detalles directamente
        const sub = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
        const totalIgvSoles = sub * 1.18 * _tc
        return totalIgvSoles >= 3500
          ? ['Contrato', 'Cotizacion', 'Sustento']
          : ['Cotizacion', 'Sustento']
      })()
  const tieneDocsObligatorios = DOCS_OBLIGATORIOS.every(doc =>
    archivosSubidos.some(a => a.tipo_archivo === doc)
  )
  const tienePlanContable = !!solicitud?.plan_contable_id
  const canEnviar    = ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && isPendiente && tieneDocsObligatorios && tienePlanContable
  const canReenviarConta = isObservado && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)
  const canCancelar  = ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && isPendiente
  const canEvaluar   = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canDevolver  = (userRole === ROLES.EVALUADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canAprobar   = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEvaluado
  const canRechazar  = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEvaluado
  const canEncuestar    = isAprobado && !isRxH && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)
  const canMarcarPagado        = isAprobado && !solicitud?.fecha_pago && userRole === ROLES.VISUALIZADOR
  const canMarcarDetraccionPag = isAprobado && !!solicitud?.detraccion_id && !solicitud?.detraccion_pagada
                                 && (userRole === ROLES.VISUALIZADOR || userRole === ROLES.ADMIN)
  const canEditFactura  = !isRxH && (canEdit || isAprobado) && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN)
  const showFacturaCard = !isRxH && (canEdit || !!solicitud?.numero_factura || !!solicitud?.motivo_factura || !!solicitud?.fecha_emision_factura || archivosSubidos.some(a => a.tipo_archivo === 'Factura XML' || a.tipo_archivo === 'Factura PDF'))

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
  const handleFirmaConfirm = async (blob: Blob, actionOverride?: 'enviar' | 'aprobar') => {
    if (!solicitud || !id) return
    const action = actionOverride ?? firmaAction
    const tipo   = action === 'enviar' ? 'Firma_Usuario' : 'Firma_Aprobador'
    await uploadFirma(blob, solicitud.id, tipo)
    setFirmaOpen(false)
    setActioning(true)
    try {
      if (action === 'enviar') {
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

  // ── Ejecutar acción usando firma pre-guardada o abrir FirmaModal ──
  const executeWithFirma = async (action: 'enviar' | 'aprobar') => {
    if (!solicitud) return
    const firmaPath = usuarioProfile?.firma_path
    if (firmaPath) {
      try {
        toast.loading('Usando tu firma guardada…', { id: 'firma-auto' })
        const blob = await getUserFirmaBlob(firmaPath)
        toast.dismiss('firma-auto')
        await handleFirmaConfirm(blob, action)
      } catch {
        toast.dismiss('firma-auto')
        // Fallback: abrir FirmaModal manualmente
        setFirmaAction(action)
        setFirmaOpen(true)
      }
    } else {
      setFirmaAction(action)
      setFirmaOpen(true)
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

      // Firma usuario: usa la del registro de solicitud; si no existe, cae al perfil del usuario actual
      const firmaUPromise: Promise<string | null> = firmaU?.archivo_path
        ? getArchivoUrl(firmaU.archivo_path).then(fetchAsBase64)
        : usuarioProfile?.firma_path
          ? getUserFirmaUrl(usuarioProfile.firma_path).then(fetchAsBase64)
          : Promise.resolve(null)

      const [logoB64, firmaUB64, firmaAB64, aprobador] = await Promise.all([
        fetchAsBase64(logoUrl),
        firmaUPromise,
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
  const handleSavePlanContable = async () => {
    if (!planContableEditSel || !solicitud || !id) return
    setSavingPlanContable(true)
    try {
      await updateSolicitud(solicitud.id, { plan_contable_id: planContableEditSel.id })
      await reload(id)
      toast.success('Plan contable guardado')
    } catch {
      toast.error('Error al guardar plan contable')
    } finally {
      setSavingPlanContable(false)
    }
  }

  const handleEnviar = () => {
    if (!solicitud) return
    executeWithFirma('enviar')
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
    setEvaluarOpen(true)
  }

  const handleConfirmEvaluar = async (planContableId: number, porcentajeRetencion?: number, detraccionId?: number, montoDetraccion?: number) => {
    if (!solicitud?.id || !id) return
    const isRxHSol = solicitud.solicitud_tipo?.nombre === 'Recibo por Honorarios'
    const subtotalSol = (solicitud.detalles ?? detalles).reduce(
      (s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0
    )
    const montoRetencion = isRxHSol && porcentajeRetencion !== undefined
      ? subtotalSol * porcentajeRetencion / 100
      : undefined
    await marcarEvaluado(solicitud.id, planContableId, user?.id ?? null, porcentajeRetencion, montoRetencion, detraccionId, montoDetraccion)
    toast.success('Marcada como Evaluada')
    setEvaluarOpen(false)
    await reload(id)
  }


  const handleConfirmPago = async (cuentaId: number, fechaPago: string) => {
    if (!solicitud?.id || !user?.id) return
    await marcarPagado('solicitud', solicitud.id, cuentaId, fechaPago, user.id)
    toast.success('Solicitud marcada como pagada')
    setPagoOpen(false)
    await reload(id!)
  }

  const handleConfirmDetraccionPago = async () => {
    if (!solicitud?.id || !detFechaPago) return
    setSavingDetPago(true)
    try {
      await marcarDetraccionPagada(solicitud.id, detFechaPago)
      toast.success('Detracción marcada como pagada')
      setDetPagoOpen(false)
      setDetFechaPago('')
      await reload(id!)
    } catch {
      toast.error('Error al marcar la detracción como pagada')
    } finally {
      setSavingDetPago(false)
    }
  }

  const handleAprobar = () => {
    if (!solicitud) return
    executeWithFirma('aprobar')
  }

  const handleDevolver = async (comentario: string) => {
    if (!solicitud || !id) return
    try {
      // Desde Aprobado (contabilidad) → Observado; desde En Revision (evaluador) → Pendiente
      if (isAprobado) {
        await observarSolicitud(solicitud.id, comentario)
        toast.success('Observado — el usuario puede corregir y reenviar')
      } else {
        await devolverSolicitud(solicitud.id, comentario)
        toast.success('Solicitud devuelta al usuario')
      }
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al devolver')
      throw err
    }
  }

  const handleReenviarContabilidad = async () => {
    if (!solicitud || !id) return
    setActioning(true)
    try {
      await reenviarAContabilidad(solicitud.id)
      toast.success('Reenviado a contabilidad')
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al reenviar')
    } finally {
      setActioning(false)
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

  // ── Datos de factura ─────────────────────────────────────────────
  const handleGuardarFactura = async () => {
    if (!solicitud || !id) return
    setSavingFactura(true)
    try {
      await updateSolicitud(solicitud.id, {
        numero_factura:           numeroFactura.trim() || null,
        motivo_factura:           motivoFactura.trim() || null,
        fecha_emision_factura:    fechaEmisionFactura || null,
        fecha_vencimiento_factura: fechaVencimientoFactura || null,
      })
      toast.success('Datos de factura guardados')
      await reload(id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSavingFactura(false)
    }
  }

  const facturaHasChanges =
    numeroFactura !== (solicitud?.numero_factura ?? '') ||
    motivoFactura !== (solicitud?.motivo_factura ?? '') ||
    fechaEmisionFactura !== (solicitud?.fecha_emision_factura ?? '') ||
    fechaVencimientoFactura !== (solicitud?.fecha_vencimiento_factura ?? '')

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

  const subtotal       = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
  const retencionPct   = solicitud?.porcentaje_retencion ?? 0
  const retencion      = isRxH ? (solicitud?.monto_retencion ?? subtotal * retencionPct / 100) : 0
  const igv            = isRxH ? 0 : subtotal * 0.18
  const totalConIgv    = isRxH ? subtotal - retencion : subtotal + igv

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
          {canMarcarPagado && (
            <>
              <button onClick={() => setPagoOpen(true)} disabled={actioning}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                Marcar pagado
              </button>
              <button onClick={() => setDevolucionOpen(true)} disabled={actioning}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                Devolver
              </button>
            </>
          )}
          {solicitud?.fecha_pago && (
            <span className="flex items-center gap-1 h-8 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              Pagado {fmtDate(solicitud.fecha_pago)}
            </span>
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
          {isPendiente && ((userRole === ROLES.USUARIO && isOwnSolicitud) || userRole === ROLES.ADMIN) && tieneDocsObligatorios && !tienePlanContable && (
            <span className="flex items-center gap-1 h-8 px-3 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
              Agrega el plan contable para enviar a revisión
            </span>
          )}
          {canEnviar && (
            <button onClick={handleEnviar} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
              <Send size={13} /> Enviar a revisión
            </button>
          )}
          {canReenviarConta && (
            <button onClick={handleReenviarContabilidad} disabled={actioning}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
              <Send size={13} /> Reenviar a contabilidad
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

        {/* Alerta de observación — contabilidad encontró un error */}
        {isObservado && solicitud.comentario_gerencia && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Observado por contabilidad</p>
            <p className="text-sm text-amber-800">{solicitud.comentario_gerencia}</p>
            {canReenviarConta && (
              <p className="text-xs text-amber-600 mt-1">Corrige lo indicado (documentos, factura, detalles) y haz clic en "Reenviar a contabilidad" — no pasa de nuevo por aprobación. Los datos bancarios no se pueden modificar.</p>
            )}
          </div>
        )}

        {/* ── INFO GENERAL ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Información general</h2>
            {canEdit && isPendiente && (
              <button onClick={() => setEditInfoOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                <Pencil size={13} /> Editar
              </button>
            )}
            {isObservado && canEdit && (
              <span className="text-xs text-amber-600 italic">Datos bancarios bloqueados — corrige documentos y detalles</span>
            )}
          </div>
          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <InfoField label="Código"          value={solicitud.codigo} />
            <InfoField label="Tipo"            value={solicitud.solicitud_tipo?.nombre} />
            <InfoField label="Empresa"         value={solicitud.proyecto?.nombre} />
            <InfoField label="Fecha pedido"    value={fmtDate(solicitud.fecha_pedido)} />
            <InfoField label="Fecha requerida" value={fmtDate(solicitud.fecha_requerida)} />
            <InfoField label="Forma de pago"   value={solicitud.solicitud_forma_pago?.nombre ?? solicitud.forma_pago} />
            <InfoField label="Moneda"          value={solicitud.moneda === 'USD' ? '$ Dólares (USD)' : 'S/ Soles (PEN)'} />
            {isRxH && <InfoField label="N° Recibo (RxH)" value={solicitud.numero_rxh} />}
            {isRxH && <InfoField label="Período de servicio" value={solicitud.periodo_servicio ? new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(new Date(solicitud.periodo_servicio + 'T00:00:00')) : null} />}
            {isRxH && <InfoField label="Fecha de emisión"     value={fmtDate(solicitud.fecha_emision_factura)} />}
            {isRxH && <InfoField label="Fecha de vencimiento" value={fmtDate(solicitud.fecha_vencimiento_factura)} />}
            {isRxH && solicitud.aplica_suspension !== null && (
              <InfoField
                label="Suspensión retención"
                value={solicitud.aplica_suspension ? 'Sí tiene — constancia adjunta' : 'No tiene'}
              />
            )}
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

        {/* ── PRESUPUESTO (ADMIN + APROBADOR) ── */}
        {canVerConsumo && consumoData && (consumoData.presupuesto.pen > 0 || consumoData.presupuesto.usd > 0 || consumoData.consumo.pen > 0 || consumoData.consumo.usd > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <CheckCircle size={15} className="text-[#003D7D]" />
              <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
                Presupuesto — {consumoData.label}
              </h2>
              {solicitud.proyecto_partida && (
                <span className="ml-auto text-xs text-gray-400">{solicitud.proyecto?.nombre}</span>
              )}
            </div>
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(consumoData.presupuesto.pen > 0 || consumoData.consumo.pen > 0) && (() => {
                const pres = consumoData.presupuesto.pen
                const cons = consumoData.consumo.pen
                const pct = pres > 0 ? (cons / pres) * 100 : 0
                const color = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                const txtColor = pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Soles (PEN)</span>
                      {pres > 0 && <span className={`text-xs font-bold ${txtColor}`}>{pct.toFixed(0)}%</span>}
                    </div>
                    {pres > 0 && (
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>Consumido: S/ {cons.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                      {pres > 0 && <span>Presup: S/ {pres.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>}
                    </div>
                    {pres > 0 && (
                      <p className={`mt-1 text-xs font-medium ${pct > 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {pct > 100
                          ? `Excedido por S/ ${(cons - pres).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                          : `Saldo: S/ ${(pres - cons).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                      </p>
                    )}
                  </div>
                )
              })()}
              {(consumoData.presupuesto.usd > 0 || consumoData.consumo.usd > 0) && (() => {
                const pres = consumoData.presupuesto.usd
                const cons = consumoData.consumo.usd
                const pct = pres > 0 ? (cons / pres) * 100 : 0
                const color = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                const txtColor = pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Dólares (USD)</span>
                      {pres > 0 && <span className={`text-xs font-bold ${txtColor}`}>{pct.toFixed(0)}%</span>}
                    </div>
                    {pres > 0 && (
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>Consumido: $ {cons.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      {pres > 0 && <span>Presup: $ {pres.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                    </div>
                    {pres > 0 && (
                      <p className={`mt-1 text-xs font-medium ${pct > 100 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {pct > 100
                          ? `Excedido por $ ${(cons - pres).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `Saldo: $ ${(pres - cons).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── DETALLES ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
              Bien o Servicio <span className="ml-1 text-gray-400 font-normal normal-case">({detalles.length} ítems)</span>
            </h2>
            <div className="flex items-center gap-3">
              {subtotal > 0 && <span className="text-sm font-bold text-[#003D7D]">{fmtMoney(totalConIgv, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}</span>}
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
                ? <button onClick={openAdd} className="text-[#003D7D] hover:underline">+ Agregar el primer bien o servicio</button>
                : 'Esta solicitud no tiene bienes o servicios registrados.'}
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
                      <td className="px-5 py-3 text-right text-gray-700">{fmtMoney(d.valor_unitario, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#003D7D]">
                        {fmtMoney(d.valor_total ?? d.cantidad * d.valor_unitario, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}
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
                    <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">Monto bruto</td>
                    <td className="px-5 py-2 text-right text-sm text-gray-600">{fmtMoney(subtotal, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}</td>
                    {canEdit && <td />}
                  </tr>
                  {isRxH ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">
                        Retención IR {retencionPct > 0 ? `(${retencionPct}%)` : solicitud?.porcentaje_retencion !== null ? '(Exonerado)' : '(pendiente evaluación)'}
                      </td>
                      <td className="px-5 py-2 text-right text-sm text-gray-600">
                        {solicitud?.porcentaje_retencion !== null ? `- ${fmtMoney(retencion, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}` : '—'}
                      </td>
                      {canEdit && <td />}
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">IGV (18%)</td>
                      <td className="px-5 py-2 text-right text-sm text-gray-600">{fmtMoney(igv, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}</td>
                      {canEdit && <td />}
                    </tr>
                  )}
                  <tr className="border-t border-gray-200">
                    <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-gray-600">
                      {isRxH ? 'Monto neto a pagar:' : 'Total general:'}
                    </td>
                    <td className="px-5 py-3 text-right text-base font-bold text-[#003D7D]">{fmtMoney(totalConIgv, (solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN')}</td>
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
          canDownloadAll={userRole === ROLES.VISUALIZADOR || userRole === ROLES.EVALUADOR}
          zipName={
            ([solicitud.razon_social, solicitud.numero_factura ?? solicitud.numero_rxh]
              .filter(Boolean).join('_') || solicitud.codigo || `solicitud-${solicitud.id}`)
              .replace(/[/\\:*?"<>|]/g, '-')
          }
          onChange={setArchivosSubidos}
          tiposVisibles={isRxH
            ? ['Sustento', 'Recibo Honorario', ...(solicitud.aplica_suspension ? ['Suspension'] : [])]
            : undefined}
          tiposOpcionales={isRxH
            ? (solicitud.aplica_suspension ? ['Suspension'] : [])
            : DOCS_OBLIGATORIOS.includes('Contrato') ? [] : ['Contrato']}
        />
        {isPendiente && !tieneDocsObligatorios && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle size={15} className="shrink-0" />
            {isRxH
              ? 'Para enviar a revisión debes adjuntar el Sustento y el PDF del Recibo por Honorarios.'
              : DOCS_OBLIGATORIOS.includes('Contrato')
                ? 'Para enviar a revisión debes adjuntar: Contrato, Cotización y Sustento (monto supera S/ 3,500).'
                : 'Para enviar a revisión debes adjuntar: Cotización y Sustento.'}
          </div>
        )}

        {/* ── DATOS DE FACTURA ── */}
        {showFacturaCard && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <CheckCircle size={15} className="text-[#003D7D]" />
              <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Datos de la factura</h2>
              {solicitud.numero_factura && (
                <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full">Registrado</span>
              )}
            </div>
            <div className="px-6 py-5 space-y-4">
              {canEditFactura ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>N° de Factura</label>
                      <input
                        type="text"
                        value={numeroFactura}
                        onChange={e => setNumeroFactura(e.target.value)}
                        placeholder="Ej: F001-00123"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Motivo de la factura</label>
                      <input
                        type="text"
                        value={motivoFactura}
                        onChange={e => setMotivoFactura(e.target.value)}
                        placeholder="Ej: Compra de materiales"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Fecha de emisión</label>
                      <input
                        type="date"
                        value={fechaEmisionFactura}
                        onChange={e => setFechaEmisionFactura(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Fecha de vencimiento</label>
                      <input
                        type="date"
                        value={fechaVencimientoFactura}
                        onChange={e => setFechaVencimientoFactura(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleGuardarFactura}
                      disabled={savingFactura || !facturaHasChanges}
                      className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-40 transition-colors"
                    >
                      {savingFactura
                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        : 'Guardar'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="N° de Factura"        value={solicitud.numero_factura} />
                  <InfoField label="Motivo de la factura" value={solicitud.motivo_factura} />
                  <InfoField label="Fecha de emisión"     value={fmtDate(solicitud.fecha_emision_factura)} />
                  <InfoField label="Fecha de vencimiento" value={fmtDate(solicitud.fecha_vencimiento_factura)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PLAN CONTABLE ── */}
        {(canEdit || !!solicitud.plan_contable_id) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 rounded-t-2xl flex items-center gap-2">
              <CheckCircle size={15} className={solicitud.plan_contable_id ? 'text-[#003D7D]' : 'text-gray-300'} />
              <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Plan contable</h2>
              {solicitud.plan_contable && (
                <span className="ml-auto text-xs font-semibold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full">
                  {solicitud.plan_contable.tipo_gasto_costo}
                </span>
              )}
              {!solicitud.plan_contable_id && canEdit && (
                <span className="ml-auto text-xs text-amber-600 font-semibold">Requerido para enviar a revisión</span>
              )}
            </div>

            {canEdit ? (
              <div className="px-6 py-5 relative">
                <label className={LABEL}>Tipo de gasto / costo</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={planContableEditSearch}
                    onChange={e => { setPlanContableEditSearch(e.target.value); setPlanContableEditSel(null); setPlanContableEditDropOpen(true) }}
                    onFocus={() => setPlanContableEditDropOpen(true)}
                    onBlur={() => setTimeout(() => setPlanContableEditDropOpen(false), 150)}
                    placeholder="Buscar tipo de gasto…"
                    className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50
                      focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all"
                  />
                  {planContableEditDropOpen && (() => {
                    const q = planContableEditSearch.trim().toLowerCase()
                    const filt = planContableEditOpciones.filter(o =>
                      !q
                      || (o.tipo_gasto_costo        ?? '').toLowerCase().includes(q)
                      || (o.nombre_cuenta_contable   ?? '').toLowerCase().includes(q)
                      || (o.codigo_starsoft          ?? '').toLowerCase().includes(q)
                      || (o.partida_presupuestal     ?? '').toLowerCase().includes(q)
                      || (o.partida_presupuesta_n1   ?? '').toLowerCase().includes(q)
                      || (o.partida_presupuesta_n2   ?? '').toLowerCase().includes(q)
                    )
                    if (filt.length > 0) return (
                      <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
                        {filt.map(op => (
                          <li key={op.id}
                            onMouseDown={() => { setPlanContableEditSel(op); setPlanContableEditSearch(op.tipo_gasto_costo ?? ''); setPlanContableEditDropOpen(false) }}
                            className="px-4 py-2.5 cursor-pointer hover:bg-[#003D7D]/5 transition-colors">
                            <p className="text-sm font-medium text-gray-800">{op.tipo_gasto_costo}</p>
                            {(op.codigo_starsoft || op.nombre_cuenta_contable || op.partida_presupuesta_n1) && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {[op.codigo_starsoft, op.nombre_cuenta_contable, op.partida_presupuesta_n1].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )
                    if (q) return (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
                        <p className="text-sm text-gray-400 italic">Sin resultados para "{q}"</p>
                      </div>
                    )
                    return null
                  })()}
                </div>
                {planContableEditSel && (
                  <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-green-800">{planContableEditSel.tipo_gasto_costo}</p>
                      {planContableEditSel.codigo_starsoft && <p className="text-xs text-green-600">{planContableEditSel.codigo_starsoft}</p>}
                    </div>
                  </div>
                )}
                {planContableEditSel && planContableEditSel.id !== solicitud.plan_contable_id && (
                  <button
                    onClick={handleSavePlanContable}
                    disabled={savingPlanContable}
                    className="mt-3 px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all"
                  >
                    {savingPlanContable
                      ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
                      : 'Guardar plan contable'}
                  </button>
                )}
              </div>
            ) : solicitud.plan_contable && (
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <p className={LABEL}>Tipo de gasto / costo</p>
                  <p className="text-sm font-semibold text-gray-900">{solicitud.plan_contable.tipo_gasto_costo ?? '—'}</p>
                </div>
                {solicitud.plan_contable.nombre_cuenta_contable && (
                  <div>
                    <p className={LABEL}>Nombre cuenta contable</p>
                    <p className="text-sm text-gray-700">{solicitud.plan_contable.nombre_cuenta_contable}</p>
                  </div>
                )}
                {solicitud.plan_contable.codigo_starsoft && (
                  <div>
                    <p className={LABEL}>Código Starsoft</p>
                    <p className="text-sm text-gray-700 font-mono">{solicitud.plan_contable.codigo_starsoft}</p>
                  </div>
                )}
                {solicitud.plan_contable.cuenta_contable_2020_starsoft && (
                  <div>
                    <p className={LABEL}>Cuenta contable 2020</p>
                    <p className="text-sm text-gray-700 font-mono">{solicitud.plan_contable.cuenta_contable_2020_starsoft}</p>
                  </div>
                )}
                {solicitud.plan_contable.partida_presupuestal && (
                  <div>
                    <p className={LABEL}>Partida presupuestal</p>
                    <p className="text-sm text-gray-700">{solicitud.plan_contable.partida_presupuestal}</p>
                  </div>
                )}
                {solicitud.plan_contable.partida_presupuesta_n1 && (
                  <div>
                    <p className={LABEL}>Partida N1</p>
                    <p className="text-sm text-gray-700">{solicitud.plan_contable.partida_presupuesta_n1}</p>
                  </div>
                )}
                {solicitud.plan_contable.partida_presupuesta_n2 && (
                  <div>
                    <p className={LABEL}>Partida N2</p>
                    <p className="text-sm text-gray-700">{solicitud.plan_contable.partida_presupuesta_n2}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── DETRACCIÓN ── */}
        {!isRxH && solicitud.detraccion && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
              <CheckCircle size={15} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Detracción</h2>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                {solicitud.detraccion.codigo} — {solicitud.detraccion.porcentaje}%
              </span>
              <span className="ml-auto flex items-center gap-2">
                {solicitud.detraccion_pagada ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    <CheckCircle size={11} /> Det. Pagada {solicitud.fecha_pago_detraccion
                      ? new Intl.DateTimeFormat('es-PE', { month: '2-digit', year: 'numeric' }).format(new Date(solicitud.fecha_pago_detraccion + 'T00:00:00'))
                      : ''}
                  </span>
                ) : isAprobado && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    Por pagar al Banco de la Nación
                  </span>
                )}
                {canMarcarDetraccionPag && (
                  <button
                    onClick={() => { setDetFechaPago(''); setDetPagoOpen(true) }}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                  >
                    Marcar detracción pagada
                  </button>
                )}
              </span>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className={LABEL}>Código</p>
                <p className="text-sm font-semibold text-gray-900">{solicitud.detraccion.codigo}</p>
              </div>
              <div className="col-span-2">
                <p className={LABEL}>Concepto</p>
                <p className="text-sm text-gray-700">{solicitud.detraccion.concepto}</p>
              </div>
              <div>
                <p className={LABEL}>Porcentaje</p>
                <p className="text-sm font-semibold text-gray-900">{solicitud.detraccion.porcentaje}%</p>
              </div>
              <div>
                <p className={LABEL}>Monto mínimo</p>
                <p className="text-sm text-gray-700">S/ {solicitud.detraccion.monto_minimo.toLocaleString('es-PE')}</p>
              </div>
              <div>
                <p className={LABEL}>Monto detracción</p>
                <p className="text-sm font-bold text-amber-700">
                  S/ {Math.round(solicitud.monto_detraccion ?? 0).toLocaleString('es-PE')}
                </p>
              </div>
              <div>
                <p className={LABEL}>Total solicitud</p>
                <p className="text-sm font-bold text-gray-900">
                  {fmtMoney(totalConIgv, (solicitud.moneda as 'PEN' | 'USD') ?? 'PEN')}
                </p>
              </div>
            </div>

            {/* Mini-modal marcar detracción pagada */}
            {detPagoOpen && (
              <div className="border-t border-amber-100 bg-amber-50 px-6 py-4 flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Fecha de pago al Banco de la Nación *
                  </label>
                  <input
                    type="date"
                    value={detFechaPago}
                    onChange={e => setDetFechaPago(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDetPagoOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDetraccionPago}
                    disabled={!detFechaPago || savingDetPago}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {savingDetPago ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                    Confirmar
                  </button>
                </div>
              </div>
            )}
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
        moneda={(solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN'}
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

      <PagoModal
        open={pagoOpen}
        proyectoId={solicitud?.proyecto_id ?? null}
        onConfirm={handleConfirmPago}
        onCancel={() => setPagoOpen(false)}
      />

      <EvaluarModal
        open={evaluarOpen}
        codigoSolicitud={solicitud?.codigo ?? `#${solicitud?.id}`}
        isRxH={isRxH}
        isOC={!isRxH}
        totalSolicitud={totalConIgv}
        moneda={(solicitud?.moneda as 'PEN' | 'USD') ?? 'PEN'}
        planContableActual={solicitud?.plan_contable ?? null}
        onConfirm={handleConfirmEvaluar}
        onCancel={() => setEvaluarOpen(false)}
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