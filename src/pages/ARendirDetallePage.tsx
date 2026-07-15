import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { pdf } from '@react-pdf/renderer'
import {
  ChevronLeft, Loader2, CheckCircle2, Download, ExternalLink,
  Plus, Trash2, Pencil, Upload, Send,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import PagoModal from '../features/solicitud/components/PagoModal'
import {
  getARendirById,
  aprobarARendir,
  marcarPagadoARendir,
  enviarRendicion,
  cerrarRendicion,
  getArchivoUrl,
  uploadFirmaARendir,
  addDetalle,
  updateDetalle,
  deleteDetalle,
  uploadDetalleArchivo,
} from '../features/arendir/services/arendirService'
import type { SolicitudARendir, ARendirDetalle } from '../features/arendir/types/arendir'
import { ARendirPDF } from '../features/arendir/components/ARendirPDF'
import FirmaModal from '../features/solicitud/components/FirmaModal'
import { getUserFirmaBlob } from '../features/usuario/services/usuarioService'
import logoUrl from '../assets/avenir-logo.png'

// ── Helpers ────────────────────────────────────────────────────
function fmtMoney(val: number | null, moneda = 'PEN') {
  if (val == null) return '—'
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  const loc = moneda === 'USD' ? 'en-US' : 'es-PE'
  return `${sym}${val.toLocaleString(loc, { minimumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
}

function EstadoBadge({ estado }: { estado: SolicitudARendir['estado'] }) {
  const map: Record<string, string> = {
    'Pendiente':   'bg-yellow-100 text-yellow-800',
    'Aprobado':    'bg-emerald-100 text-emerald-800',
    'Pagado':      'bg-blue-100 text-blue-800',
    'En Revision': 'bg-purple-100 text-purple-800',
    'Cerrado':     'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  )
}

// ── Modal comentario ───────────────────────────────────────────
interface ComentarioModalProps {
  open: boolean
  title: string
  onConfirm: (comentario: string) => void
  onCancel: () => void
  loading: boolean
}

function ComentarioModal({ open, title, onConfirm, onCancel, loading }: ComentarioModalProps) {
  const [comentario, setComentario] = useState('')
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <textarea
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          rows={4}
          placeholder="Escribe un comentario..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/30 resize-none"
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(comentario)}
            disabled={loading || !comentario.trim()}
            className="flex-1 h-10 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function ARendirDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole, usuarioProfile } = useAuthStore()

  const [solicitud,     setSolicitud]     = useState<SolicitudARendir | null>(null)
  const [detalles,      setDetalles]      = useState<ARendirDetalle[]>([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Detalle form
  const [detFormOpen, setDetFormOpen] = useState(false)
  const [detEditId,   setDetEditId]   = useState<number | null>(null)
  const [detFecha,    setDetFecha]    = useState('')
  const [detProv,     setDetProv]     = useState('')
  const [detTipoDoc,  setDetTipoDoc]  = useState('FACTURA')
  const [detNumDoc,   setDetNumDoc]   = useState('')
  const [detConcepto, setDetConcepto] = useState('')
  const [detImporte,  setDetImporte]  = useState('')
  const [detArchivo,  setDetArchivo]  = useState<File | null>(null)
  const [detSaving,   setDetSaving]   = useState(false)

  const TIPOS_DOC = ['FACTURA', 'RECIBO', 'BOLETA', 'PLLA-MOV', 'TICKET', 'OTRO']

  const resetDetForm = () => {
    setDetFormOpen(false); setDetEditId(null); setDetFecha(''); setDetProv('')
    setDetTipoDoc('FACTURA'); setDetNumDoc(''); setDetConcepto(''); setDetImporte(''); setDetArchivo(null)
  }
  const openDetAdd = () => { resetDetForm(); setDetFormOpen(true) }
  const openDetEdit = (d: ARendirDetalle) => {
    setDetEditId(d.id); setDetFecha(d.fecha_documento ?? ''); setDetProv(d.proveedor ?? '')
    setDetTipoDoc(d.tipo_documento ?? 'FACTURA'); setDetNumDoc(d.numero_documento ?? '')
    setDetConcepto(d.concepto ?? ''); setDetImporte(String(d.importe)); setDetArchivo(null); setDetFormOpen(true)
  }

  const handleDetSave = async () => {
    if (!solicitud || !id) return
    if (!detFecha || !detProv.trim() || !detConcepto.trim() || !detImporte) {
      toast.error('Completa fecha, proveedor, concepto e importe'); return
    }
    setDetSaving(true)
    try {
      let archivoPath: string | null = null
      if (detArchivo) {
        archivoPath = await uploadDetalleArchivo(detArchivo, solicitud.id, detEditId ?? 0)
      }
      if (detEditId) {
        await updateDetalle(detEditId, {
          fecha_documento: detFecha, proveedor: detProv.trim(), tipo_documento: detTipoDoc,
          numero_documento: detNumDoc.trim() || null, concepto: detConcepto.trim(),
          importe: parseFloat(detImporte), ...(archivoPath ? { archivo_path: archivoPath } : {}),
        })
        toast.success('Gasto actualizado')
      } else {
        const nuevo = await addDetalle({
          solicitud_arendir_id: solicitud.id, fecha_documento: detFecha,
          proveedor: detProv.trim(), tipo_documento: detTipoDoc,
          numero_documento: detNumDoc.trim() || null, concepto: detConcepto.trim(),
          importe: parseFloat(detImporte), archivo_path: archivoPath,
        })
        if (detArchivo && !archivoPath) {
          const path = await uploadDetalleArchivo(detArchivo, solicitud.id, nuevo.id)
          await updateDetalle(nuevo.id, { archivo_path: path })
        }
        toast.success('Gasto agregado')
      }
      resetDetForm()
      const sol = await getARendirById(Number(id))
      setSolicitud(sol); setDetalles(sol.detalles ?? [])
    } catch {
      toast.error('Error al guardar')
    } finally {
      setDetSaving(false)
    }
  }

  const handleDetDelete = async (det: ARendirDetalle) => {
    if (!id) return
    try {
      await deleteDetalle(det.id, det.archivo_path)
      toast.success('Gasto eliminado')
      const sol = await getARendirById(Number(id))
      setSolicitud(sol); setDetalles(sol.detalles ?? [])
    } catch { toast.error('Error al eliminar') }
  }

  // Modales
  const [pagoOpen,      setPagoOpen]      = useState(false)
  const [firmaOpen,     setFirmaOpen]     = useState(false)
  const [aprobarOpen,   setAprobarOpen]   = useState(false)
  const [aprobarComent, setAprobarComent] = useState('')
  const [aprobarLoading, setAprobarLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getARendirById(Number(id))
      .then(sol => {
        setSolicitud(sol)
        setDetalles(sol.detalles ?? [])
      })
      .catch(() => toast.error('No se pudo cargar la solicitud'))
      .finally(() => setLoading(false))
  }, [id])

  // ── Acciones ───────────────────────────────────────────────────

  async function handleAprobar() {
    if (!solicitud || !user?.id) return
    setAprobarLoading(true)
    try {
      await aprobarARendir(solicitud.id, user.id, aprobarComent.trim() || undefined)
      toast.success('Adelanto aprobado')
      setAprobarOpen(false)
      setAprobarComent('')
      const sol = await getARendirById(Number(id))
      setSolicitud(sol); setDetalles(sol.detalles ?? [])
    } catch {
      toast.error('Error al aprobar')
    } finally {
      setAprobarLoading(false)
    }
  }

  async function handleConfirmPago(cuentaId: number, fechaPago: string) {
    if (!solicitud?.id || !user?.id) return
    try {
      await marcarPagadoARendir(solicitud.id, cuentaId, fechaPago, user.id)
      toast.success('Marcado como pagado — el usuario puede ahora registrar sus gastos')
      setPagoOpen(false)
      const sol = await getARendirById(Number(id))
      setSolicitud(sol); setDetalles(sol.detalles ?? [])
    } catch (err) {
      console.error('Error al marcar pagado:', err)
      toast.error('Error al guardar — revisa la consola para más detalles')
    }
  }

  async function handleEnviarRendicion(blob: Blob) {
    if (!solicitud || !user?.id) return
    setActionLoading(true)
    try {
      const firmaPath = await uploadFirmaARendir(blob, solicitud.id, 'firma_usuario')
      let firmaUsuarioSrc: string | null = null
      try { firmaUsuarioSrc = await getArchivoUrl(firmaPath) } catch { /* noop */ }

      await enviarRendicion(solicitud.id)

      // Generar y descargar PDF
      const pdfBlob = await pdf(
        <ARendirPDF
          solicitud={{ ...solicitud, beneficiario_nombre: usuarioProfile?.nombre_completo ?? solicitud.beneficiario_nombre }}
          detalles={detalles}
          logoSrc={logoUrl}
          firmaUsuarioSrc={firmaUsuarioSrc}
          firmaAprobadorSrc={null}
        />
      ).toBlob()
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${solicitud.codigo ?? `AR-${solicitud.id}`}_rendicion.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Rendición enviada a revisión')
      setSolicitud(prev => prev ? { ...prev, estado: 'En Revision' } : prev)
      setFirmaOpen(false)
    } catch {
      toast.error('Error al enviar rendición')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleIniciarEnvioRendicion() {
    if (!solicitud) return
    // Intentar usar firma de perfil del usuario
    if (usuarioProfile?.firma_path) {
      try {
        const blob = await getUserFirmaBlob(usuarioProfile.firma_path)
        await handleEnviarRendicion(blob)
        return
      } catch { /* no hay firma en perfil, abrir modal */ }
    }
    setFirmaOpen(true)
  }

  async function handleCerrar() {
    if (!solicitud || !user?.id) return
    setActionLoading(true)
    try {
      await cerrarRendicion(solicitud.id, user.id)
      toast.success('Rendición cerrada')
      setSolicitud(prev => prev ? { ...prev, estado: 'Cerrado' } : prev)
    } catch {
      toast.error('Error al cerrar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDownloadPDF() {
    if (!solicitud) return
    const pdfBlob = await pdf(
      <ARendirPDF
        solicitud={solicitud}
        detalles={detalles}
        logoSrc={logoUrl}
        firmaUsuarioSrc={null}
        firmaAprobadorSrc={null}
      />
    ).toBlob()
    const url = URL.createObjectURL(pdfBlob)
    const a   = document.createElement('a')
    a.href    = url
    a.download = `${solicitud.codigo ?? `AR-${solicitud.id}`}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleVerSustento() {
    if (!solicitud?.documento_sustento_path) return
    try {
      const url = await getArchivoUrl(solicitud.documento_sustento_path)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo abrir el archivo')
    }
  }

  // ── Role flags ─────────────────────────────────────────────────
  const isAdmin        = userRole === ROLES.ADMIN
  const isAprobador    = userRole === ROLES.APROBADOR
  const isEvaluador    = userRole === ROLES.EVALUADOR
  const isVisualizador = userRole === ROLES.VISUALIZADOR
  const isOwner        = solicitud?.beneficiario_id === user?.id

  const canAprobar        = solicitud?.estado === 'Pendiente' && (isAprobador || isAdmin)
  const canEditDet        = (isAdmin || ((userRole === ROLES.USUARIO) && isOwner)) &&
    ['Aprobado', 'Pagado'].includes(solicitud?.estado ?? '')
  const canMarcarPagado   = solicitud?.estado === 'Aprobado' && (isVisualizador || isAdmin)
  const canEnviarRendicion = solicitud?.estado === 'Pagado' && (isAdmin || ((userRole === ROLES.USUARIO) && isOwner))
  const canCerrar         = solicitud?.estado === 'En Revision' && (isVisualizador || isEvaluador || isAdmin)

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Cargando...
      </div>
    )
  }

  if (!solicitud) {
    return <div className="p-6 text-center text-gray-500">Solicitud no encontrada.</div>
  }

  const sym = solicitud.moneda === 'USD' ? '$ ' : 'S/ '

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/arendir')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{solicitud.codigo ?? `#${solicitud.id}`}</h1>
              <EstadoBadge estado={solicitud.estado} />
              {solicitud.moneda === 'USD' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  USD $
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">A Rendir de Gastos</p>
          </div>
        </div>

        {/* Acciones por rol y estado */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* PDF — visible desde Pagado en adelante */}
          {['Pagado', 'En Revision', 'Cerrado'].includes(solicitud.estado) && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} /> PDF
            </button>
          )}

          {/* Badge pagado (fecha en que se entregó el dinero) */}
          {solicitud.fecha_pago && (
            <span className="flex items-center gap-1 h-9 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              Dinero entregado {fmtDate(solicitud.fecha_pago)}
            </span>
          )}

          {/* APROBADOR/ADMIN: Aprobar el adelanto (Pendiente) */}
          {canAprobar && (
            <button onClick={() => setAprobarOpen(true)} disabled={actionLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              <CheckCircle2 size={13} /> Aprobar adelanto
            </button>
          )}

          {/* VISUALIZADOR/ADMIN: Marcar que el dinero fue entregado (Aprobado) */}
          {canMarcarPagado && (
            <button onClick={() => setPagoOpen(true)} disabled={actionLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              Marcar dinero entregado
            </button>
          )}

          {/* USUARIO/ADMIN: Enviar rendición con firma (Pagado) */}
          {canEnviarRendicion && (
            <button
              onClick={handleIniciarEnvioRendicion}
              disabled={actionLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Enviar rendición
            </button>
          )}

          {/* VISUALIZADOR/EVALUADOR/ADMIN: Cerrar rendición (En Revision) */}
          {canCerrar && (
            <button
              onClick={handleCerrar}
              disabled={actionLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Cerrar rendición
            </button>
          )}

        </div>
      </div>

      {/* Info de estado Aprobado — aviso a contabilidad */}
      {solicitud.estado === 'Aprobado' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Adelanto aprobado</p>
          <p className="text-sm text-emerald-800">
            El adelanto fue aprobado por {solicitud.aprobador_nombre ?? 'el aprobador'}.
            {(isVisualizador || isAdmin) ? ' Cuando entregues el dinero, haz clic en "Marcar dinero entregado".' : ' Contabilidad realizará el desembolso pronto.'}
          </p>
        </div>
      )}

      {/* Info de estado Pagado — aviso al usuario */}
      {solicitud.estado === 'Pagado' && (isAdmin || ((userRole === ROLES.USUARIO) && isOwner)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Dinero recibido</p>
          <p className="text-sm text-blue-800">El adelanto fue entregado. Agrega los gastos realizados y luego haz clic en "Enviar rendición".</p>
        </div>
      )}

      {/* Datos generales */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Datos generales</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Beneficiario',     value: solicitud.beneficiario_nombre },
            { label: 'DNI',              value: solicitud.beneficiario_dni },
            { label: 'Cargo',            value: solicitud.beneficiario_cargo },
            { label: 'Empresa',          value: solicitud.proyecto?.nombre },
            { label: 'Moneda',           value: solicitud.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)' },
            { label: 'Importe adelanto', value: fmtMoney(solicitud.importe, solicitud.moneda) },
            { label: 'Total reembolso',  value: fmtMoney(solicitud.total_reembolso, solicitud.moneda) },
            { label: 'Fecha requerida',  value: fmtDate(solicitud.fecha_rendicion) },
            { label: 'Fecha solicitud',  value: fmtDate(solicitud.fecha_creacion) },
            { label: 'Banco',            value: solicitud.banco },
            { label: solicitud.banco === 'BBVA' ? 'Número de cuenta' : 'Número CCI', value: solicitud.numero_cuenta },
            ...(solicitud.estado === 'Cerrado' && solicitud.aprobador_nombre ? [{ label: 'Cerrado por', value: solicitud.aprobador_nombre }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
              <p className="text-sm text-gray-900 font-medium">{value ?? '—'}</p>
            </div>
          ))}
        </div>

        {/* Sustento */}
        {solicitud.documento_sustento_path && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Documento sustento</p>
            <button
              onClick={handleVerSustento}
              className="flex items-center gap-1.5 text-sm text-[#003D7D] font-semibold hover:underline"
            >
              <ExternalLink size={13} /> Ver sustento
            </button>
          </div>
        )}
      </div>

      {/* Tabla detalle */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Detalle de gastos <span className="text-gray-400 font-normal">({detalles.length} ítems)</span>
          </h2>
          {canEditDet && (
            <button onClick={openDetAdd}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-medium hover:bg-[#002D5C] transition-all">
              <Plus size={13} /> Agregar gasto
            </button>
          )}
        </div>

        {/* Form inline */}
        {detFormOpen && (
          <div className="px-5 py-4 bg-blue-50 border-b border-blue-200 space-y-3">
            <p className="text-xs font-semibold text-[#003D7D] uppercase">{detEditId ? 'Editar gasto' : 'Nuevo gasto'}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Fecha *</label>
                <input type="date" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                  value={detFecha} onChange={e => setDetFecha(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Proveedor *</label>
                <input className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                  value={detProv} onChange={e => setDetProv(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Tipo doc</label>
                <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                  value={detTipoDoc} onChange={e => setDetTipoDoc(e.target.value)}>
                  {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">N° Doc</label>
                <input className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                  value={detNumDoc} onChange={e => setDetNumDoc(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Concepto *</label>
                <input className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                  value={detConcepto} onChange={e => setDetConcepto(e.target.value)} placeholder="Descripción del gasto" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Importe *</label>
                <input type="number" step="0.01" min="0" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                  value={detImporte} onChange={e => setDetImporte(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Comprobante</label>
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50">
                    <Upload size={12} /> {detArchivo ? detArchivo.name : 'Subir archivo'}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setDetArchivo(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDetSave} disabled={detSaving}
                className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium disabled:opacity-50 transition-all">
                {detSaving ? 'Guardando…' : detEditId ? 'Actualizar' : 'Agregar'}
              </button>
              <button onClick={resetDetForm}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {detalles.length === 0 ? (
          <p className="px-5 py-8 text-sm text-center text-gray-400">Sin detalles registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo Doc.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">N° Doc.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Concepto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Importe</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detalles.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 text-xs">{fmtDate(d.fecha_documento)}</td>
                    <td className="px-4 py-3 text-gray-900">{d.proveedor ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.tipo_documento ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{d.numero_documento ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{d.concepto ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {sym}{d.importe.toLocaleString(solicitud.moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {d.archivo_path && <DetalleArchivoBtn path={d.archivo_path} />}
                        {canEditDet && (
                          <>
                            <button onClick={() => openDetEdit(d)} className="p-1 rounded hover:bg-[#003D7D]/10 text-gray-400 hover:text-[#003D7D]">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDetDelete(d)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#003D7D]/[0.04] border-t-2 border-[#003D7D]/20">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-gray-700 uppercase text-right">
                    Total a reembolsar:
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#003D7D]">
                    {fmtMoney(solicitud.total_reembolso, solicitud.moneda)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Plan Contable — visible cuando fue asignado */}
      {solicitud.plan_contable && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Plan Contable</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Tipo gasto/costo',    value: solicitud.plan_contable.tipo_gasto_costo },
              { label: 'Código Starsoft',      value: solicitud.plan_contable.codigo_starsoft },
              { label: 'Cuenta contable',      value: solicitud.plan_contable.nombre_cuenta_contable },
              { label: 'Partida presupuestal', value: solicitud.plan_contable.partida_presupuestal },
              { label: 'Evaluador',            value: solicitud.evaluador_nombre },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
                <p className="text-sm text-gray-900 font-medium">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal aprobar adelanto */}
      {aprobarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Aprobar adelanto</h2>
            <p className="text-sm text-gray-600">
              Monto solicitado: <span className="font-semibold">{fmtMoney(solicitud.importe, solicitud.moneda)}</span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Comentario (opcional)</label>
              <textarea
                value={aprobarComent}
                onChange={e => setAprobarComent(e.target.value)}
                rows={3}
                placeholder="Ej: Aprobado con cargo al proyecto X..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setAprobarOpen(false); setAprobarComent('') }}
                disabled={aprobarLoading}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprobar}
                disabled={aprobarLoading}
                className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {aprobarLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Aprobar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      <PagoModal
        open={pagoOpen}
        proyectoId={solicitud?.proyecto_id ?? null}
        onConfirm={handleConfirmPago}
        onCancel={() => setPagoOpen(false)}
      />

      <FirmaModal
        open={firmaOpen}
        title="Firma del beneficiario"
        onClose={() => setFirmaOpen(false)}
        onConfirm={handleEnviarRendicion}
      />
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────
function DetalleArchivoBtn({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const url = await getArchivoUrl(path)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo abrir el archivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-[#003D7D] font-semibold hover:underline disabled:opacity-50"
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
      Ver
    </button>
  )
}
