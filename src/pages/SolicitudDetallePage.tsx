import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Plus, Trash2, AlertCircle, CheckCircle, Ban } from 'lucide-react'
import { supabase } from '../api/supabase'
import { getSolicitudById, createDetalle, updateDetalle, deleteDetalle, updateSolicitud } from '../features/solicitud/services/solicitudService'
import SolicitudDetalleModal from '../features/solicitud/components/SolicitudDetalleModal'
import RechazoModal from '../features/solicitud/components/RechazoModal'
import { useAuthStore } from '../store/authStore'
import type { Solicitud, SolicitudDetalle } from '../features/solicitud/types/solicitud'

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
  Pendiente:  'bg-yellow-100 text-yellow-800',
  Proceso:    'bg-blue-100 text-blue-800',
  Final:      'bg-green-100 text-green-800',
  Rechazado:  'bg-red-100 text-red-800',
  Cancelado:  'bg-gray-100 text-gray-600',
}

export default function SolicitudDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole } = useAuthStore()

  const isGerencia = userRole === 1

  const [solicitud,  setSolicitud]  = useState<Solicitud | null>(null)
  const [loadingSol, setLoadingSol] = useState(true)
  const [detalles,   setDetalles]   = useState<SolicitudDetalle[]>([])

  const [estadoIds,    setEstadoIds]    = useState<{ proceso: number | null; rechazado: number | null }>({ proceso: null, rechazado: null })
  const [rechazoOpen,  setRechazoOpen]  = useState(false)

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingDet,   setEditingDet]   = useState<SolicitudDetalle | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoadingSol(true)
      try {
        const sol = await getSolicitudById(Number(id))
        setSolicitud(sol)
        setDetalles(sol.detalles ?? [])
      } catch {
        toast.error('No se pudo cargar la solicitud')
      } finally {
        setLoadingSol(false)
      }
    })()
  }, [id])

  useEffect(() => {
    supabase
      .from('estado_soli')
      .select('id, tipo')
      .in('tipo', ['Proceso', 'Rechazado'])
      .then(({ data: rows }) => {
        if (!rows) return
        setEstadoIds({
          proceso:   rows.find((r: any) => r.tipo === 'Proceso')?.id   ?? null,
          rechazado: rows.find((r: any) => r.tipo === 'Rechazado')?.id ?? null,
        })
      })
  }, [])

  const isPendiente = solicitud?.estado_soli?.tipo === 'Pendiente'
  const tipoLabel   = solicitud?.estado_soli?.tipo ?? ''
  const estadoColor = ESTADO_COLOR[tipoLabel] ?? 'bg-gray-100 text-gray-600'

  const openAdd  = () => { setEditingDet(null); setModalOpen(true) }
  const openEdit = (d: SolicitudDetalle) => { setEditingDet(d); setModalOpen(true) }

  const handleModalSubmit = async (data: { cantidad: number; descripcion: string; valor_unitario: number }) => {
    if (!solicitud) return
    if (editingDet) {
      const updated = await updateDetalle(editingDet.id, data)
      setDetalles((ds) => ds.map((x) => (x.id === editingDet.id ? updated : x)))
      toast.success('Detalle actualizado')
    } else {
      const nuevo = await createDetalle({ solicitud_id: solicitud.id, ...data })
      setDetalles((ds) => [...ds, nuevo])
      toast.success('Detalle agregado')
    }
  }

  const handleDetDelete = async (detId: number) => {
    if (!confirm('¿Eliminar este detalle?')) return
    try {
      await deleteDetalle(detId)
      setDetalles((ds) => ds.filter((x) => x.id !== detId))
      toast.success('Detalle eliminado')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al eliminar')
    }
  }

  const total = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)

  const handleAprobar = async () => {
    if (!solicitud) return
    if (!estadoIds.proceso) { toast.error('Estado "Proceso" no encontrado'); return }
    if (!confirm(`¿Aprobar la solicitud ${solicitud.codigo ?? `#${solicitud.id}`}?`)) return
    try {
      await updateSolicitud(solicitud.id, {
        estado_id:         estadoIds.proceso,
        fecha_aprobacion:  new Date().toISOString().slice(0, 10),
        usuario_aprobador: user?.id ?? null,
      })
      setSolicitud((prev) => prev ? { ...prev, estado_id: estadoIds.proceso!, estado_soli: { id: estadoIds.proceso!, nombre: 'En Proceso', tipo: 'Proceso' } } : prev)
      toast.success('Solicitud aprobada')
    } catch {
      toast.error('No se pudo aprobar la solicitud')
    }
  }

  const confirmRechazo = async (comentario: string) => {
    if (!solicitud) return
    if (!estadoIds.rechazado) { toast.error('Estado "Rechazado" no encontrado'); return }
    await updateSolicitud(solicitud.id, {
      estado_id:           estadoIds.rechazado,
      comentario_gerencia: comentario,
    })
    setSolicitud((prev) => prev ? { ...prev, estado_id: estadoIds.rechazado!, estado_soli: { id: estadoIds.rechazado!, nombre: 'Rechazado', tipo: 'Rechazado' } } : prev)
    toast.success('Solicitud rechazada')
  }

  // ── LOADING ────────────────────────────────────────────────────
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

  // ── RENDER ─────────────────────────────────────────────────────
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
          {isGerencia && isPendiente && (
            <>
              <button
                onClick={handleAprobar}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
              >
                <CheckCircle size={14} /> Aprobar
              </button>
              <button
                onClick={() => setRechazoOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                <Ban size={14} /> Rechazar
              </button>
            </>
          )}
          {!isPendiente && (
            <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <AlertCircle size={13} /> Solo se puede editar en estado Pendiente
            </span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ── INFO GENERAL ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Información general</h2>
          </div>
          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <InfoField label="Código"       value={solicitud.codigo} />
            <InfoField label="Tipo"         value={solicitud.solicitud_tipo?.nombre} />
            <InfoField label="Proyecto"     value={solicitud.proyecto?.nombre} />
            <InfoField label="Prioridad"    value={solicitud.prioridad} />
            <InfoField label="Fecha pedido" value={fmtDate(solicitud.fecha_pedido)} />
            <InfoField label="Fecha requerida" value={fmtDate(solicitud.fecha_requerida)} />
            <InfoField label="Forma de pago" value={solicitud.forma_pago} />
          </div>

          <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-gray-50 pt-4">
            {/* Cliente */}
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
            {/* Financiero */}
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
              <p className={LABEL}>Comentario gerencia</p>
              <p className="text-sm text-gray-700">{solicitud.comentario_gerencia}</p>
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
              {total > 0 && <span className="text-sm font-bold text-[#003D7D]">{fmtMoney(total)}</span>}
              {isPendiente && (
                <button onClick={openAdd}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-medium hover:bg-[#002D5C] transition-all">
                  <Plus size={13} /> Agregar
                </button>
              )}
            </div>
          </div>

          {detalles.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">
              {isPendiente
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
                    {isPendiente && <th className="px-5 py-3" />}
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
                      {isPendiente && (
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
                    <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-gray-600">Total general:</td>
                    <td className="px-5 py-3 text-right text-base font-bold text-[#003D7D]">{fmtMoney(total)}</td>
                    {isPendiente && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal agregar / editar detalle */}
      <SolicitudDetalleModal
        open={modalOpen}
        detalle={editingDet}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />

      <RechazoModal
        open={rechazoOpen}
        codigo={solicitud.codigo ?? null}
        onClose={() => setRechazoOpen(false)}
        onConfirm={confirmRechazo}
      />
    </div>
  )
}
