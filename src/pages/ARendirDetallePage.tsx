import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { pdf } from '@react-pdf/renderer'
import {
  ChevronLeft, Loader2, FileText, CheckCircle2, XCircle,
  RotateCcw, Download, ExternalLink,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import {
  getARendirById,
  enviarARendir,
  autorizarARendir,
  rechazarARendir,
  devolverARendir,
  getArchivoUrl,
  uploadFirmaARendir,
} from '../features/arendir/services/arendirService'
import type { SolicitudARendir, ARendirDetalle } from '../features/arendir/types/arendir'
import { ARendirPDF } from '../features/arendir/components/ARendirPDF'
import FirmaModal from '../features/solicitud/components/FirmaModal'
import logoUrl from '../assets/avenir-logo.png'

// ── Helpers ───────────────────────────────────────────────────
function fmtMoney(val: number | null) {
  if (val == null) return '—'
  return `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
}

function EstadoBadge({ estado }: { estado: SolicitudARendir['estado'] }) {
  const map: Record<string, string> = {
    'Pendiente':   'bg-yellow-100 text-yellow-800',
    'En Revision': 'bg-blue-100 text-blue-800',
    'Autorizado':  'bg-green-100 text-green-800',
    'Rechazado':   'bg-red-100 text-red-800',
    'Devuelto':    'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  )
}

// ── Modal comentario ──────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────
export default function ARendirDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole, usuarioProfile } = useAuthStore()

  const [solicitud,   setSolicitud]   = useState<SolicitudARendir | null>(null)
  const [detalles,    setDetalles]    = useState<ARendirDetalle[]>([])
  const [loading,     setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modales
  const [firmaOpen,    setFirmaOpen]    = useState(false)
  const [rechazarOpen, setRechazarOpen] = useState(false)
  const [devolverOpen, setDevolverOpen] = useState(false)

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

  // ── Helpers de acciones ───────────────────────────────────────
  async function handleEnviar() {
    if (!solicitud) return
    setActionLoading(true)
    try {
      await enviarARendir(solicitud.id)
      toast.success('Enviada a revisión')
      setSolicitud(prev => prev ? { ...prev, estado: 'En Revision' } : prev)
    } catch {
      toast.error('Error al enviar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAutorizar(blob: Blob) {
    if (!solicitud || !user?.id) return
    setActionLoading(true)
    try {
      const firmaPath = await uploadFirmaARendir(blob, solicitud.id, 'firma_aprobador')

      // Enrich sol para PDF
      let firmaAprobadorSrc: string | null = null
      try { firmaAprobadorSrc = await getArchivoUrl(firmaPath) } catch { /* noop */ }

      let firmaUsuarioSrc: string | null = null
      // Buscar firma del usuario en storage si existe
      try {
        const { data } = await import('../api/supabase').then(m =>
          m.supabase.storage.from('arendir-documentos').list(`${solicitud.id}/firma_usuario`)
        )
        if (data && data.length > 0) {
          firmaUsuarioSrc = await getArchivoUrl(`${solicitud.id}/firma_usuario/${data[0].name}`)
        }
      } catch { /* noop */ }

      await autorizarARendir(solicitud.id, user.id)

      const enriched: SolicitudARendir = {
        ...solicitud,
        aprobador_nombre: usuarioProfile?.nombre_completo ?? null,
      }

      const pdfBlob = await pdf(
        <ARendirPDF
          solicitud={enriched}
          detalles={detalles}
          logoSrc={logoUrl}
          firmaUsuarioSrc={firmaUsuarioSrc}
          firmaAprobadorSrc={firmaAprobadorSrc}
        />
      ).toBlob()

      const url = URL.createObjectURL(pdfBlob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${solicitud.codigo ?? `AR-${solicitud.id}`}_autorizado.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Solicitud autorizada')
      setSolicitud(prev => prev ? { ...prev, estado: 'Autorizado' } : prev)
      setFirmaOpen(false)
    } catch {
      toast.error('Error al autorizar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRechazar(comentario: string) {
    if (!solicitud) return
    setActionLoading(true)
    try {
      await rechazarARendir(solicitud.id, comentario)
      toast.success('Solicitud rechazada')
      setSolicitud(prev => prev ? { ...prev, estado: 'Rechazado', comentario } : prev)
      setRechazarOpen(false)
    } catch {
      toast.error('Error al rechazar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDevolver(comentario: string) {
    if (!solicitud) return
    setActionLoading(true)
    try {
      await devolverARendir(solicitud.id, comentario)
      toast.success('Solicitud devuelta')
      setSolicitud(prev => prev ? { ...prev, estado: 'Devuelto', comentario } : prev)
      setDevolverOpen(false)
    } catch {
      toast.error('Error al devolver')
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

  // ── Role-based actions ────────────────────────────────────────
  const isUsuario   = userRole === ROLES.USUARIO
  const isAdmin     = userRole === ROLES.ADMIN
  const isAprobador = userRole === ROLES.APROBADOR

  const isOwner = solicitud?.beneficiario_id === user?.id

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Cargando...
      </div>
    )
  }

  if (!solicitud) {
    return (
      <div className="p-6 text-center text-gray-500">Solicitud no encontrada.</div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/arendir')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{solicitud.codigo ?? `#${solicitud.id}`}</h1>
              <EstadoBadge estado={solicitud.estado} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">A Rendir de Gastos</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Descargar PDF (siempre visible si no es Pendiente) */}
          {solicitud.estado !== 'Pendiente' && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} /> PDF
            </button>
          )}

          {/* USUARIO / ADMIN en Pendiente o Devuelto */}
          {(isUsuario || isAdmin) && isOwner && ['Pendiente', 'Devuelto'].includes(solicitud.estado) && (
            <button
              onClick={handleEnviar}
              disabled={actionLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              Enviar a revisión
            </button>
          )}

          {/* APROBADOR / ADMIN en En Revision */}
          {(isAprobador || isAdmin) && solicitud.estado === 'En Revision' && (
            <>
              <button
                onClick={() => setFirmaOpen(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={13} /> Autorizar
              </button>
              <button
                onClick={() => setDevolverOpen(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                <RotateCcw size={13} /> Devolver
              </button>
              <button
                onClick={() => setRechazarOpen(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <XCircle size={13} /> Rechazar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Comentario si fue rechazado/devuelto */}
      {solicitud.comentario && ['Rechazado', 'Devuelto'].includes(solicitud.estado) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-red-700 uppercase mb-1">
            {solicitud.estado === 'Rechazado' ? 'Motivo de rechazo' : 'Motivo de devolución'}
          </p>
          <p className="text-sm text-red-800">{solicitud.comentario}</p>
        </div>
      )}

      {/* Datos generales */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Datos generales</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Beneficiario', value: solicitud.beneficiario_nombre },
            { label: 'DNI',          value: solicitud.beneficiario_dni },
            { label: 'Cargo',        value: solicitud.beneficiario_cargo },
            { label: 'Proyecto',     value: solicitud.proyecto?.nombre },
            { label: 'Importe adelanto', value: fmtMoney(solicitud.importe) },
            { label: 'Total reembolso',  value: fmtMoney(solicitud.total_reembolso) },
            { label: 'Fecha rendición',  value: fmtDate(solicitud.fecha_rendicion) },
            { label: 'Fecha creación',   value: fmtDate(solicitud.fecha_creacion) },
            { label: 'Aprobador',    value: solicitud.aprobador_nombre },
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
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Detalle de gastos</h2>
        </div>
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
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(d.importe)}</td>
                    <td className="px-4 py-3">
                      {d.archivo_path && (
                        <DetalleArchivoBtn path={d.archivo_path} />
                      )}
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
                    {fmtMoney(solicitud.total_reembolso)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      <FirmaModal
        open={firmaOpen}
        title="Firma del aprobador"
        onClose={() => setFirmaOpen(false)}
        onConfirm={handleAutorizar}
      />

      <ComentarioModal
        open={rechazarOpen}
        title="Motivo de rechazo"
        onConfirm={handleRechazar}
        onCancel={() => setRechazarOpen(false)}
        loading={actionLoading}
      />

      <ComentarioModal
        open={devolverOpen}
        title="Motivo de devolución"
        onConfirm={handleDevolver}
        onCancel={() => setDevolverOpen(false)}
        loading={actionLoading}
      />
    </div>
  )
}

// ── Sub-component: botón ver archivo detalle ──────────────────
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
