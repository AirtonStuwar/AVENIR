import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Plus, Trash2, Pencil, Send, CheckCircle, Ban, RotateCcw,
  Upload, Loader2, AlertCircle, Wallet, Download,
} from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import {
  getCajaChicaById,
  createDetalleCajaChica, updateDetalleCajaChica, deleteDetalleCajaChica,
  enviarCajaChica, autorizarCajaChica, rechazarCajaChica, devolverCajaChica,
  getAreas,
} from '../features/caja-chica/services/cajaChicaService'
import { getUserFirmaBlob } from '../features/usuario/services/usuarioService'
import { supabase } from '../api/supabase'
import type { CajaChica, CajaChicaDetalle } from '../features/caja-chica/types/cajaChica'
import { CajaChicaPDF } from '../features/caja-chica/components/CajaChicaPDF'
import RechazoModal from '../features/solicitud/components/RechazoModal'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import logoUrl from '../assets/avenir-logo.png'

const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fmtDate = (s: string | null) => s ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(s + 'T00:00:00')) : '—'

const ESTADO_BADGE: Record<string, string> = {
  'Pendiente': 'bg-gray-100 text-gray-600',
  'En Revision': 'bg-blue-100 text-blue-700',
  'Autorizado': 'bg-emerald-100 text-emerald-700',
  'Rechazado': 'bg-red-100 text-red-700',
  'Devuelto': 'bg-amber-100 text-amber-700',
}

const TIPOS_DOC = ['FACTURA', 'RECIBO', 'BOLETA', 'PLLA-MOV', 'TICKET', 'OTRO']

const LABEL = 'block text-xs font-semibold text-[#003D7D]/50 uppercase tracking-wide mb-0.5'

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  )
}

export default function CajaChicaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userRole } = useAuthStore()

  const [cc, setCc] = useState<CajaChica | null>(null)
  const [detalles, setDetalles] = useState<CajaChicaDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [areas, setAreas] = useState<{ id: number; nombre: string }[]>([])

  // Form state for add/edit
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fecha, setFecha] = useState('')
  const [areaId, setAreaId] = useState<number | null>(null)
  const [proveedor, setProveedor] = useState('')
  const [tipoDoc, setTipoDoc] = useState('FACTURA')
  const [numDoc, setNumDoc] = useState('')
  const [detalle, setDetalle] = useState('')
  const [monto, setMonto] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [savingDet, setSavingDet] = useState(false)

  // Modals
  const [rechazoOpen, setRechazoOpen] = useState(false)
  const [devolucionOpen, setDevolucionOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getCajaChicaById(Number(id))
      setCc(data)
      setDetalles(data.detalles ?? [])
    } catch {
      toast.error('Error al cargar la caja chica')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])
  useEffect(() => { getAreas().then(setAreas).catch(() => {}) }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
  if (!cc) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <p>No encontrado</p>
    </div>
  )

  const isPendiente = cc.estado === 'Pendiente'
  const isDevuelto = cc.estado === 'Devuelto'
  const isEnRevision = cc.estado === 'En Revision'
  const isOwner = cc.responsable_id === user?.id
  const canEdit = (isPendiente || isDevuelto) && (isOwner || userRole === ROLES.ADMIN)
  const canEnviar = canEdit && detalles.length > 0
  const canAprobar = (userRole === ROLES.APROBADOR || userRole === ROLES.ADMIN) && isEnRevision
  const canShowPDF = !isPendiente && detalles.length > 0

  const totalGastos = detalles.reduce((s, d) => s + d.monto, 0)
  const pctUsado = cc.monto_asignado > 0 ? (totalGastos / cc.monto_asignado) * 100 : 0
  const barColor = pctUsado > 100 ? 'bg-red-500' : pctUsado > 80 ? 'bg-amber-500' : 'bg-emerald-500'

  const handleDownloadPDF = async () => {
    if (!cc) return
    try {
      let logoSrc: string | null = null
      try {
        const res = await fetch(logoUrl)
        const blob = await res.blob()
        logoSrc = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { /* logo optional */ }

      let firmaUsuarioSrc: string | null = null
      let firmaAprobadorSrc: string | null = null
      if (cc.responsable_id) {
        try { const b = await getUserFirmaBlob(cc.responsable_id); if (b) firmaUsuarioSrc = URL.createObjectURL(b) } catch {}
      }
      if (cc.usuario_aprobador) {
        try { const b = await getUserFirmaBlob(cc.usuario_aprobador); if (b) firmaAprobadorSrc = URL.createObjectURL(b) } catch {}
      }

      const pdfBlob = await pdf(
        <CajaChicaPDF cajaChica={cc} detalles={detalles}
          logoSrc={logoSrc} firmaUsuarioSrc={firmaUsuarioSrc} firmaAprobadorSrc={firmaAprobadorSrc} />
      ).toBlob()
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${cc.codigo ?? `CC-${cc.id}`}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      if (firmaUsuarioSrc) URL.revokeObjectURL(firmaUsuarioSrc)
      if (firmaAprobadorSrc) URL.revokeObjectURL(firmaAprobadorSrc)
    } catch {
      toast.error('Error al generar el PDF')
    }
  }

  // Form handlers
  const resetForm = () => {
    setFormOpen(false); setEditId(null); setFecha(''); setAreaId(null)
    setProveedor(''); setTipoDoc('FACTURA'); setNumDoc(''); setDetalle(''); setMonto(''); setArchivo(null)
  }

  const openAdd = () => { resetForm(); setFormOpen(true) }
  const openEdit = (d: CajaChicaDetalle) => {
    setEditId(d.id); setFecha(d.fecha); setAreaId(d.area_id); setProveedor(d.proveedor)
    setTipoDoc(d.tipo_documento); setNumDoc(d.numero_documento ?? ''); setDetalle(d.detalle)
    setMonto(String(d.monto)); setArchivo(null); setFormOpen(true)
  }

  const handleSaveDet = async () => {
    if (!fecha || !proveedor.trim() || !detalle.trim() || !monto) {
      toast.error('Completa fecha, proveedor, detalle y monto'); return
    }
    setSavingDet(true)
    try {
      let archivoPath: string | null = null
      if (archivo) {
        const ext = archivo.name.split('.').pop()
        const path = `${cc.id}/detalle/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('caja-chica-documentos').upload(path, archivo)
        if (error) throw error
        archivoPath = path
      }

      const payload = {
        caja_chica_id: cc.id,
        fecha,
        area_id: areaId,
        proveedor: proveedor.trim(),
        tipo_documento: tipoDoc,
        numero_documento: numDoc.trim() || null,
        detalle: detalle.trim(),
        monto: parseFloat(monto),
        archivo_path: archivoPath,
      }

      if (editId) {
        await updateDetalleCajaChica(editId, payload)
        toast.success('Gasto actualizado')
      } else {
        await createDetalleCajaChica(payload)
        toast.success('Gasto agregado')
      }
      resetForm()
      await loadData()
    } catch {
      toast.error('Error al guardar el gasto')
    } finally {
      setSavingDet(false)
    }
  }

  const handleDeleteDet = async (detId: number) => {
    try {
      await deleteDetalleCajaChica(detId)
      toast.success('Gasto eliminado')
      await loadData()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // Flow actions
  const handleEnviar = () => {
    setPendingAction({
      title: 'Enviar a revisión',
      message: '¿Enviar esta caja chica para aprobación?',
      onConfirm: async () => {
        setActioning(true)
        try { await enviarCajaChica(cc.id); toast.success('Enviada a revisión'); await loadData() }
        catch { toast.error('Error') }
        finally { setActioning(false); setPendingAction(null) }
      },
    })
  }

  const handleAutorizar = () => {
    setPendingAction({
      title: 'Autorizar caja chica',
      message: `¿Autorizar esta rendición por ${fmt(totalGastos)}? Se repondrá el fondo.`,
      onConfirm: async () => {
        setActioning(true)
        try { await autorizarCajaChica(cc.id, user!.id); toast.success('Autorizada'); await loadData() }
        catch { toast.error('Error') }
        finally { setActioning(false); setPendingAction(null) }
      },
    })
  }

  const handleRechazar = async (comentario: string) => {
    setActioning(true)
    try { await rechazarCajaChica(cc.id, user!.id, comentario); toast.success('Rechazada'); await loadData() }
    catch { toast.error('Error') }
    finally { setActioning(false); setRechazoOpen(false) }
  }

  const handleDevolver = async (comentario: string) => {
    setActioning(true)
    try { await devolverCajaChica(cc.id, comentario); toast.success('Devuelta'); await loadData() }
    catch { toast.error('Error') }
    finally { setActioning(false); setDevolucionOpen(false) }
  }

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/caja-chica')} className="p-2 rounded-xl hover:bg-white text-gray-500">
              <ArrowLeft size={18} />
            </button>
            <span className="font-semibold text-gray-800">{cc.codigo}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_BADGE[cc.estado]}`}>
              {cc.estado}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canShowPDF && (
              <button onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Download size={13} /> PDF
              </button>
            )}
            {canEnviar && (
              <button onClick={handleEnviar} disabled={actioning}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium hover:bg-[#002D5C] disabled:opacity-50 transition-all">
                <Send size={14} /> Enviar a revisión
              </button>
            )}
            {canAprobar && (
              <>
                <button onClick={handleAutorizar} disabled={actioning}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
                  <CheckCircle size={14} /> Autorizar
                </button>
                <button onClick={() => setDevolucionOpen(true)} disabled={actioning}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50 transition-all">
                  <RotateCcw size={14} /> Devolver
                </button>
                <button onClick={() => setRechazoOpen(true)} disabled={actioning}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all">
                  <Ban size={14} /> Rechazar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Alert if devuelto/rechazado */}
        {cc.comentario && (cc.estado === 'Rechazado' || cc.estado === 'Devuelto') && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border ${cc.estado === 'Rechazado' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">{cc.estado === 'Rechazado' ? 'Motivo del rechazo' : 'Motivo de devolución'}</p>
              <p className="text-sm">{cc.comentario}</p>
            </div>
          </div>
        )}

        {/* Info general */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Wallet size={15} className="text-[#003D7D]" />
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Información general</h2>
          </div>
          <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <InfoField label="Código" value={cc.codigo} />
            <InfoField label="Empresa" value={cc.proyecto?.nombre} />
            <InfoField label="Responsable" value={cc.responsable_nombre} />
            <InfoField label="Período" value={`${fmtDate(cc.periodo_desde)} — ${fmtDate(cc.periodo_hasta)}`} />
            <InfoField label="Cuenta BBVA" value={cc.cuenta_bbva} />
            {cc.aprobador_nombre && <InfoField label="Aprobado por" value={cc.aprobador_nombre} />}
          </div>

          {/* Financial summary */}
          <div className="px-6 pb-5 border-t border-gray-50 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Saldo anterior</p>
                <p className="text-sm font-semibold text-gray-700">{fmt(cc.saldo_anterior)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Transferencia</p>
                <p className="text-sm font-bold text-[#003D7D]">{fmt(cc.transferencia)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Monto asignado</p>
                <p className="text-sm font-bold text-emerald-700">{fmt(cc.monto_asignado)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Pendiente a reembolsar</p>
                <p className="text-sm font-bold text-amber-700">{fmt(totalGastos)}</p>
              </div>
            </div>
            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Saldo actual: {fmt(cc.monto_asignado - totalGastos)}</span>
                <span className={`text-xs font-bold ${pctUsado > 100 ? 'text-red-600' : pctUsado > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {pctUsado.toFixed(0)}% usado
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pctUsado, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
              Detalle de gastos <span className="text-gray-400 font-normal normal-case">({detalles.length} ítems)</span>
            </h2>
            {canEdit && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-medium hover:bg-[#002D5C] transition-all">
                <Plus size={13} /> Agregar gasto
              </button>
            )}
          </div>

          {/* Add/Edit form */}
          {formOpen && (
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-200 space-y-3">
              <p className="text-xs font-semibold text-[#003D7D] uppercase">{editId ? 'Editar gasto' : 'Nuevo gasto'}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Fecha *</label>
                  <input type="date" className={INPUT} value={fecha} onChange={e => setFecha(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Área</label>
                  <select className={INPUT} value={areaId ?? ''} onChange={e => setAreaId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Proveedor *</label>
                  <input className={INPUT} value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Tipo doc</label>
                  <select className={INPUT} value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                    {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">N° Doc</label>
                  <input className={INPUT} value={numDoc} onChange={e => setNumDoc(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Detalle *</label>
                  <input className={INPUT} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Descripción del gasto" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Monto S/ *</label>
                  <input type="number" step="0.01" min="0" className={INPUT}
                    value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Comprobante</label>
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50">
                    <Upload size={12} /> {archivo ? archivo.name : 'Subir archivo'}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveDet} disabled={savingDet}
                  className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium disabled:opacity-50 transition-all">
                  {savingDet ? 'Guardando…' : editId ? 'Actualizar' : 'Agregar'}
                </button>
                <button onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Fecha', 'Cód. Costos', 'Proveedor / Usuario', 'Tipo Doc', 'N° Doc', 'Detalle', 'S/.', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detalles.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400 text-sm">Sin gastos registrados</td></tr>
                )}
                {detalles.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{fmtDate(d.fecha)}</td>
                    <td className="px-3 py-2">
                      {d.area_nombre
                        ? <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{d.area_nombre}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-800 max-w-[140px] truncate">{d.proveedor}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{d.tipo_documento}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{d.numero_documento ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{d.detalle}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">{d.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      {canEdit && (
                        <div className="flex items-center gap-0.5 justify-end">
                          <button onClick={() => openEdit(d)} className="p-1 rounded hover:bg-[#003D7D]/10 text-gray-400 hover:text-[#003D7D]">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDeleteDet(d.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {detalles.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-right text-sm font-semibold text-gray-600">Total gastos:</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-[#003D7D] text-base">{fmt(totalGastos)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RechazoModal open={rechazoOpen} title="Rechazar caja chica"
        codigo={cc.codigo} onClose={() => setRechazoOpen(false)} onConfirm={handleRechazar} variant="red" />
      <RechazoModal open={devolucionOpen} title="Devolver caja chica"
        codigo={cc.codigo} onClose={() => setDevolucionOpen(false)} onConfirm={handleDevolver} variant="amber" />
      <ConfirmModal
        open={!!pendingAction} title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        onConfirm={pendingAction?.onConfirm ?? (async () => {})}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
