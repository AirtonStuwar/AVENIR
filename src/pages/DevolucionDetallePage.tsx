import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ChevronLeft, Loader2, CheckCircle2, XCircle, ExternalLink, RotateCcw, AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import PagoModal from '../features/solicitud/components/PagoModal'
import {
  getDevolucionById,
  autorizarDevolucion,
  rechazarDevolucion,
  marcarPagadoDevolucion,
  getArchivoDevolucionUrl,
} from '../features/devolucion/services/devolucionService'
import type { DevolucionCliente } from '../features/devolucion/types/devolucion'

function fmtMoney(val: number | null, moneda = 'PEN') {
  if (val == null) return '—'
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  return `${sym}${val.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2 })}`
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
}

function EstadoBadge({ estado }: { estado: DevolucionCliente['estado'] }) {
  const map: Record<string, string> = {
    'Pendiente':  'bg-yellow-100 text-yellow-800',
    'Autorizado': 'bg-green-100 text-green-800',
    'Rechazado':  'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  )
}

const ARCHIVO_LABELS: { field: keyof DevolucionCliente; label: string }[] = [
  { field: 'sustento_path',               label: 'Sustento' },
  { field: 'boucher_separacion_path',     label: 'Boucher de Separación' },
  { field: 'constancia_separacion_path',  label: 'Constancia de Separación' },
  { field: 'sustento_desistimiento_path', label: 'Sustento Desistimiento' },
]

export default function DevolucionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole } = useAuthStore()

  const [dev,     setDev]     = useState<DevolucionCliente | null>(null)
  const [loading, setLoading] = useState(true)

  const [pagoOpen,        setPagoOpen]        = useState(false)
  const [autorizarOpen,   setAutorizarOpen]   = useState(false)
  const [rechazarOpen,    setRechazarOpen]    = useState(false)
  const [comentario,      setComentario]      = useState('')
  const [actionLoading,   setActionLoading]   = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getDevolucionById(Number(id))
      .then(setDev)
      .catch(() => toast.error('No se pudo cargar la devolución'))
      .finally(() => setLoading(false))
  }, [id])

  const reload = async () => {
    if (!id) return
    const d = await getDevolucionById(Number(id))
    setDev(d)
  }

  async function handleAutorizar() {
    if (!dev || !user?.id) return
    setActionLoading(true)
    try {
      await autorizarDevolucion(dev.id, user.id, comentario.trim() || undefined)
      toast.success('Devolución autorizada')
      setAutorizarOpen(false); setComentario('')
      await reload()
    } catch {
      toast.error('Error al autorizar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRechazar() {
    if (!dev || !user?.id) return
    if (!comentario.trim()) { toast.error('Ingresa el motivo del rechazo'); return }
    setActionLoading(true)
    try {
      await rechazarDevolucion(dev.id, user.id, comentario.trim())
      toast.success('Devolución rechazada')
      setRechazarOpen(false); setComentario('')
      await reload()
    } catch {
      toast.error('Error al rechazar')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirmPago(cuentaId: number, fechaPago: string) {
    if (!dev?.id || !user?.id) return
    try {
      await marcarPagadoDevolucion(dev.id, cuentaId, fechaPago, user.id)
      toast.success('Devolución marcada como pagada')
      setPagoOpen(false)
      await reload()
    } catch (err) {
      console.error('Error al marcar pagado:', err)
      toast.error('Error al guardar — revisa la consola para más detalles')
    }
  }

  async function handleVerArchivo(path: string) {
    try {
      const url = await getArchivoDevolucionUrl(path)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo abrir el archivo')
    }
  }

  const isAdmin        = userRole === ROLES.ADMIN
  const isAprobador    = userRole === ROLES.APROBADOR
  const isVisualizador = userRole === ROLES.VISUALIZADOR

  const canAutorizar    = dev?.estado === 'Pendiente' && (isAprobador || isAdmin)
  const canMarcarPagado = dev?.estado === 'Autorizado' && !dev?.fecha_pago && (isVisualizador || isAdmin)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  if (!dev) {
    return <div className="p-6 text-center text-gray-500">Devolución no encontrada.</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/devolucion')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{dev.codigo ?? `#${dev.id}`}</h1>
              <EstadoBadge estado={dev.estado} />
              {dev.moneda === 'USD' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  USD $
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Devolución de Cliente</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {dev.fecha_pago && (
            <span className="flex items-center gap-1 h-9 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              Pagado {fmtDate(dev.fecha_pago)}
            </span>
          )}
          {canAutorizar && (
            <>
              <button onClick={() => { setComentario(''); setAutorizarOpen(true) }} disabled={actionLoading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 size={13} /> Autorizar
              </button>
              <button onClick={() => { setComentario(''); setRechazarOpen(true) }} disabled={actionLoading}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
                <XCircle size={13} /> Rechazar
              </button>
            </>
          )}
          {canMarcarPagado && (
            <button onClick={() => setPagoOpen(true)} disabled={actionLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              Marcar pagado
            </button>
          )}
        </div>
      </div>

      {/* Alerta rechazo */}
      {dev.estado === 'Rechazado' && dev.comentario && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700 uppercase mb-1">Devolución rechazada</p>
            <p className="text-sm text-red-800">{dev.comentario}</p>
          </div>
        </div>
      )}

      {/* Datos generales */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <RotateCcw size={15} className="text-[#003D7D]" /> Datos de la devolución
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Cliente',          value: dev.cliente_nombre },
            { label: 'DNI',              value: dev.cliente_dni },
            { label: 'Monto',            value: fmtMoney(dev.monto, dev.moneda) },
            { label: 'Moneda',           value: dev.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)' },
            { label: 'Empresa',          value: dev.proyecto?.nombre },
            { label: 'Centro de costo',  value: dev.proyecto_partida?.nombre },
            { label: 'Banco',            value: dev.banco },
            { label: dev.banco === 'BBVA' ? 'Número de cuenta' : 'Número CCI', value: dev.numero_cuenta },
            { label: 'Registrado por',   value: dev.creador_nombre },
            { label: 'Fecha registro',   value: fmtDate(dev.fecha_creacion) },
            ...(dev.aprobador_nombre ? [{ label: dev.estado === 'Rechazado' ? 'Rechazado por' : 'Autorizado por', value: dev.aprobador_nombre }] : []),
            ...(dev.fecha_aprobacion ? [{ label: 'Fecha decisión', value: fmtDate(dev.fecha_aprobacion) }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
              <p className="text-sm text-gray-900 font-medium">{value ?? '—'}</p>
            </div>
          ))}
        </div>
        {dev.estado === 'Autorizado' && dev.comentario && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Comentario del aprobador</p>
            <p className="text-sm text-gray-700">{dev.comentario}</p>
          </div>
        )}
      </div>

      {/* Documentos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Documentos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ARCHIVO_LABELS.map(({ field, label }) => {
            const path = dev[field] as string | null
            return (
              <div key={field} className={`rounded-xl border-2 p-4 flex items-center gap-3 ${
                path ? 'border-green-200 bg-green-50' : 'border-dashed border-gray-200 bg-gray-50'
              }`}>
                <span className="flex-1 text-sm font-semibold text-gray-800">{label}</span>
                {path ? (
                  <button onClick={() => handleVerArchivo(path)}
                    className="flex items-center gap-1 text-xs text-[#003D7D] font-semibold hover:underline">
                    <ExternalLink size={12} /> Ver
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 italic">No adjuntado</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal autorizar */}
      {autorizarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Autorizar devolución</h2>
            <p className="text-sm text-gray-600">
              Cliente: <span className="font-semibold">{dev.cliente_nombre}</span> ·
              Monto: <span className="font-semibold">{fmtMoney(dev.monto, dev.moneda)}</span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Comentario (opcional)</label>
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAutorizarOpen(false)} disabled={actionLoading}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleAutorizar} disabled={actionLoading}
                className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Autorizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rechazar */}
      {rechazarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Rechazar devolución</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Motivo del rechazo *</label>
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
                placeholder="Explica el motivo..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRechazarOpen(false)} disabled={actionLoading}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleRechazar} disabled={actionLoading || !comentario.trim()}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pago */}
      <PagoModal
        open={pagoOpen}
        proyectoId={dev?.proyecto_id ?? null}
        onConfirm={handleConfirmPago}
        onCancel={() => setPagoOpen(false)}
      />
    </div>
  )
}
