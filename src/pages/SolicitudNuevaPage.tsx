import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle, Plus, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../api/supabase'
import { getProyectos } from '../features/proyecto/services/proyectoService'
import {
  createSolicitud,
  createDetalle,
  updateDetalle,
  deleteDetalle,
  getDetallesBySolicitud,
} from '../features/solicitud/services/solicitudService'
import SolicitudDetalleModal from '../features/solicitud/components/SolicitudDetalleModal'
import { useAuthStore } from '../store/authStore'
import type { Proyecto } from '../features/proyecto/types/proyecto'
import type { SolicitudDetalle } from '../features/solicitud/types/solicitud'

const INPUT =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const INPUT_ERR =
  'w-full rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-4 w-1 rounded-full bg-[#003D7D]" />
      <h3 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">{children}</h3>
    </div>
  )
}

export default function SolicitudNuevaPage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)

  // ─── Step: 'form' → fill data | 'detalles' → add line items ───
  const [step,          setStep]          = useState<'form' | 'detalles'>('form')
  const [solicitudId,   setSolicitudId]   = useState<number | null>(null)
  const [savingForm,    setSavingForm]    = useState(false)
  const [errors,        setErrors]        = useState<Record<string, string>>({})

  // Catalogs
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [tipos,     setTipos]     = useState<{ id: number; nombre: string }[]>([])

  // Form fields
  const [tipo_id,                      setTipoId]                      = useState<number | null>(null)
  const [proyecto_id,                  setProyectoId]                  = useState<number | null>(null)
  const [razon_social,                 setRazonSocial]                 = useState('')
  const [ruc,                          setRuc]                         = useState('')
  const [direccion,                    setDireccion]                   = useState('')
  const [contacto_nombre,              setContactoNombre]              = useState('')
  const [contacto_telefono,            setContactoTelefono]            = useState('')
  const [contacto_correo,              setContactoCorreo]              = useState('')
  const [banco,                        setBanco]                       = useState('')
  const [numero_cuenta,                setNumeroCuenta]                = useState('')
  const [cuenta_detracciones,          setCuentaDetracciones]          = useState('')
  const [forma_pago,                   setFormaPago]                   = useState('')
  const [porcentaje_contrato,          setPorcentajeContrato]          = useState<number | null>(100)
  const [porcentaje_acumulado_contrato,setPorcentajeAcumulado]         = useState<number | null>(0)
  const [porcentaje_pendiente_contrato,setPorcentajePendiente]         = useState<number | null>(100)
  const [condiciones,                  setCondiciones]                 = useState(
    'Se penalizará el retraso o incumplimiento de algún acuerdo en la fecha de entrega acordada'
  )
  const [fecha_pedido,   setFechaPedido]   = useState('')
  const [fecha_requerida,setFechaRequerida]= useState('')
  const [prioridad,      setPrioridad]     = useState('Media')

  // Detalles state
  const [detalles,   setDetalles]   = useState<SolicitudDetalle[]>([])
  const [loadingDet, setLoadingDet] = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editingDet, setEditingDet] = useState<SolicitudDetalle | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [pRes, tRes] = await Promise.all([
          getProyectos({ page: 1, pageSize: 500 }),
          supabase.from('solicitud_tipo').select('id,nombre').order('nombre'),
        ])
        setProyectos(pRes.data)
        setTipos(tRes.data ?? [])
      } catch {
        toast.error('Error al cargar catálogos')
      }
    })()
  }, [])

  // ── FORM SUBMIT ────────────────────────────────────────────────
  const handleGuardar = async () => {
    const e: Record<string, string> = {}
    if (!tipo_id)                e.tipo_id        = 'Obligatorio'
    if (!proyecto_id)            e.proyecto_id    = 'Obligatorio'
    if (!razon_social.trim())    e.razon_social   = 'Obligatorio'
    if (!ruc.trim())             e.ruc            = 'Obligatorio'
    if (!direccion.trim())       e.direccion      = 'Obligatorio'
    if (!contacto_nombre.trim()) e.contacto_nombre= 'Obligatorio'
    if (!contacto_telefono.trim())e.contacto_telefono='Obligatorio'
    if (!contacto_correo.trim()) e.contacto_correo= 'Obligatorio'
    if (!forma_pago.trim())      e.forma_pago     = 'Obligatorio'
    if (!fecha_pedido)           e.fecha_pedido   = 'Obligatorio'
    if (!fecha_requerida)        e.fecha_requerida= 'Obligatorio'
    if (porcentaje_contrato === null)   e.porcentaje_contrato = 'Obligatorio'
    if (porcentaje_acumulado_contrato === null) e.porcentaje_acumulado = 'Obligatorio'
    if (porcentaje_pendiente_contrato === null) e.porcentaje_pendiente = 'Obligatorio'

    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSavingForm(true)
    try {
      const nueva = await createSolicitud({
        tipo_id, proyecto_id,
        razon_social, ruc, direccion,
        contacto_nombre, contacto_telefono, contacto_correo,
        banco: banco || null,
        numero_cuenta: numero_cuenta || null,
        cuenta_detracciones: cuenta_detracciones || null,
        forma_pago,
        porcentaje_contrato,
        porcentaje_acumulado_contrato,
        porcentaje_pendiente_contrato,
        condiciones: condiciones || null,
        fecha_pedido, fecha_requerida, prioridad,
        usuario_creador: user?.id ?? null,
      })
      setSolicitudId(nueva.id)
      setStep('detalles')
      toast.success('Solicitud creada — ahora agrega los detalles')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al crear la solicitud')
    } finally {
      setSavingForm(false)
    }
  }

  // ── DETALLES ───────────────────────────────────────────────────
  const fetchDetalles = async (id: number) => {
    setLoadingDet(true)
    try { setDetalles(await getDetallesBySolicitud(id)) }
    catch { toast.error('Error al cargar detalles') }
    finally { setLoadingDet(false) }
  }

  useEffect(() => {
    if (step === 'detalles' && solicitudId) fetchDetalles(solicitudId)
  }, [step, solicitudId])

  const openAdd  = () => { setEditingDet(null); setModalOpen(true) }
  const openEdit = (d: SolicitudDetalle) => { setEditingDet(d); setModalOpen(true) }

  const handleModalSubmit = async (data: { cantidad: number; descripcion: string; valor_unitario: number }) => {
    if (!solicitudId) return
    if (editingDet) {
      const updated = await updateDetalle(editingDet.id, data)
      setDetalles((ds) => ds.map((x) => (x.id === editingDet.id ? updated : x)))
      toast.success('Detalle actualizado')
    } else {
      const nuevo = await createDetalle({ solicitud_id: solicitudId, ...data })
      setDetalles((ds) => [...ds, nuevo])
      toast.success('Detalle agregado')
    }
  }

  const handleDetDelete = async (id: number) => {
    if (!confirm('¿Eliminar este detalle?')) return
    try {
      await deleteDetalle(id)
      setDetalles((ds) => ds.filter((x) => x.id !== id))
      toast.success('Detalle eliminado')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al eliminar')
    }
  }

  const totalGeneral = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)

  const inp = (err?: string) => (err ? INPUT_ERR : INPUT)

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => navigate('/solicitudes')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#003D7D] transition-colors">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <h1 className="text-base font-semibold text-gray-900">Nueva solicitud</h1>

        {/* Steps */}
        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
            step === 'form' ? 'bg-[#003D7D] text-white' : 'bg-green-100 text-green-700'}`}>
            {step === 'detalles' ? <CheckCircle size={12} /> : '1'} Datos generales
          </span>
          <div className="w-6 h-px bg-gray-300" />
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
            step === 'detalles' ? 'bg-[#003D7D] text-white' : 'bg-gray-100 text-gray-400'}`}>
            2 Detalles
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── STEP 1: FORM ── */}
        {step === 'form' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 space-y-8">

              {/* Cliente */}
              <div>
                <SectionTitle>Información del cliente</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Razón social *</label>
                    <input className={inp(errors.razon_social)} placeholder="Nombre o razón social"
                      value={razon_social} onChange={(e) => { setRazonSocial(e.target.value); setErrors((x) => ({ ...x, razon_social: '' })) }} />
                    {errors.razon_social && <p className="mt-1 text-xs text-red-500">{errors.razon_social}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>RUC *</label>
                    <input className={inp(errors.ruc)} placeholder="20XXXXXXXXX"
                      value={ruc} onChange={(e) => { setRuc(e.target.value); setErrors((x) => ({ ...x, ruc: '' })) }} />
                    {errors.ruc && <p className="mt-1 text-xs text-red-500">{errors.ruc}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Dirección *</label>
                    <input className={inp(errors.direccion)} placeholder="Dirección completa"
                      value={direccion} onChange={(e) => { setDireccion(e.target.value); setErrors((x) => ({ ...x, direccion: '' })) }} />
                    {errors.direccion && <p className="mt-1 text-xs text-red-500">{errors.direccion}</p>}
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div>
                <SectionTitle>Contacto</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Nombre *</label>
                    <input className={inp(errors.contacto_nombre)} placeholder="Nombre del contacto"
                      value={contacto_nombre} onChange={(e) => { setContactoNombre(e.target.value); setErrors((x) => ({ ...x, contacto_nombre: '' })) }} />
                    {errors.contacto_nombre && <p className="mt-1 text-xs text-red-500">{errors.contacto_nombre}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Teléfono *</label>
                    <input className={inp(errors.contacto_telefono)} placeholder="9XXXXXXXX"
                      value={contacto_telefono} onChange={(e) => { setContactoTelefono(e.target.value); setErrors((x) => ({ ...x, contacto_telefono: '' })) }} />
                    {errors.contacto_telefono && <p className="mt-1 text-xs text-red-500">{errors.contacto_telefono}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Correo *</label>
                    <input className={inp(errors.contacto_correo)} type="email" placeholder="correo@empresa.com"
                      value={contacto_correo} onChange={(e) => { setContactoCorreo(e.target.value); setErrors((x) => ({ ...x, contacto_correo: '' })) }} />
                    {errors.contacto_correo && <p className="mt-1 text-xs text-red-500">{errors.contacto_correo}</p>}
                  </div>
                </div>
              </div>

              {/* Datos bancarios */}
              <div>
                <SectionTitle>Datos bancarios</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Banco</label>
                    <input className={INPUT} placeholder="Nombre del banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Número de cuenta</label>
                    <input className={INPUT} placeholder="Número de cuenta" value={numero_cuenta} onChange={(e) => setNumeroCuenta(e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Cuenta detracciones</label>
                    <input className={INPUT} placeholder="Cuenta para detracciones" value={cuenta_detracciones} onChange={(e) => setCuentaDetracciones(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Proyecto */}
              <div>
                <SectionTitle>Proyecto y tipo</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Tipo *</label>
                    <select className={inp(errors.tipo_id)} value={tipo_id ?? ''}
                      onChange={(e) => { setTipoId(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, tipo_id: '' })) }}>
                      <option value="">Seleccionar tipo</option>
                      {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    {errors.tipo_id && <p className="mt-1 text-xs text-red-500">{errors.tipo_id}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Proyecto *</label>
                    <select className={inp(errors.proyecto_id)} value={proyecto_id ?? ''}
                      onChange={(e) => { setProyectoId(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, proyecto_id: '' })) }}>
                      <option value="">Seleccionar proyecto</option>
                      {proyectos.map((p) => <option key={p.id} value={p.id}>{p.codigo ?? ''} — {p.nombre}</option>)}
                    </select>
                    {errors.proyecto_id && <p className="mt-1 text-xs text-red-500">{errors.proyecto_id}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Forma de pago *</label>
                    <input className={inp(errors.forma_pago)} placeholder="Ej: Transferencia, Efectivo"
                      value={forma_pago} onChange={(e) => { setFormaPago(e.target.value); setErrors((x) => ({ ...x, forma_pago: '' })) }} />
                    {errors.forma_pago && <p className="mt-1 text-xs text-red-500">{errors.forma_pago}</p>}
                  </div>
                </div>
              </div>

              {/* Porcentajes */}
              <div>
                <SectionTitle>Porcentajes del contrato</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>% Contrato *</label>
                    <input className={inp(errors.porcentaje_contrato)} type="number" step="0.01" placeholder="100"
                      value={porcentaje_contrato ?? ''} onChange={(e) => { setPorcentajeContrato(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, porcentaje_contrato: '' })) }} />
                    {errors.porcentaje_contrato && <p className="mt-1 text-xs text-red-500">{errors.porcentaje_contrato}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>% Acumulado *</label>
                    <input className={inp(errors.porcentaje_acumulado)} type="number" step="0.01" placeholder="0"
                      value={porcentaje_acumulado_contrato ?? ''} onChange={(e) => { setPorcentajeAcumulado(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, porcentaje_acumulado: '' })) }} />
                    {errors.porcentaje_acumulado && <p className="mt-1 text-xs text-red-500">{errors.porcentaje_acumulado}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>% Pendiente *</label>
                    <input className={inp(errors.porcentaje_pendiente)} type="number" step="0.01" placeholder="100"
                      value={porcentaje_pendiente_contrato ?? ''} onChange={(e) => { setPorcentajePendiente(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, porcentaje_pendiente: '' })) }} />
                    {errors.porcentaje_pendiente && <p className="mt-1 text-xs text-red-500">{errors.porcentaje_pendiente}</p>}
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div>
                <SectionTitle>Fechas y prioridad</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Fecha pedido *</label>
                    <input className={inp(errors.fecha_pedido)} type="date" value={fecha_pedido}
                      onChange={(e) => { setFechaPedido(e.target.value); setErrors((x) => ({ ...x, fecha_pedido: '' })) }} />
                    {errors.fecha_pedido && <p className="mt-1 text-xs text-red-500">{errors.fecha_pedido}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Fecha requerida *</label>
                    <input className={inp(errors.fecha_requerida)} type="date" value={fecha_requerida}
                      onChange={(e) => { setFechaRequerida(e.target.value); setErrors((x) => ({ ...x, fecha_requerida: '' })) }} />
                    {errors.fecha_requerida && <p className="mt-1 text-xs text-red-500">{errors.fecha_requerida}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Prioridad</label>
                    <select className={INPUT} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Condiciones */}
              <div>
                <SectionTitle>Condiciones y observaciones</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={LABEL}>Condiciones</label>
                    <textarea className={INPUT + ' resize-none'} rows={2} value={condiciones}
                      onChange={(e) => setCondiciones(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => navigate('/solicitudes')}
                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={savingForm}
                className="px-5 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all">
                {savingForm
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando...</>
                  : 'Guardar y continuar →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: DETALLES ── */}
        {step === 'detalles' && (
          <>
            {/* Banner éxito */}
            <div className="flex items-center gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-2xl">
              <CheckCircle size={20} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Solicitud #{solicitudId} creada correctamente</p>
                <p className="text-xs text-green-600">Ahora agrega los productos o servicios solicitados.</p>
              </div>
            </div>

            {/* Tabla de detalles */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
                  Detalles <span className="ml-1 text-gray-400 font-normal normal-case">
                    ({detalles.length} {detalles.length === 1 ? 'ítem' : 'ítems'})
                  </span>
                </h2>
                <div className="flex items-center gap-3">
                  {totalGeneral > 0 && (
                    <span className="text-sm font-bold text-[#003D7D]">
                      S/ {totalGeneral.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {loadingDet
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent" />
                    : <button onClick={openAdd}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-medium hover:bg-[#002D5C] transition-all">
                        <Plus size={13} /> Agregar
                      </button>
                  }
                </div>
              </div>

              {detalles.length === 0 && !loadingDet ? (
                <div className="py-14 text-center text-sm text-gray-400">
                  <button onClick={openAdd} className="text-[#003D7D] hover:underline">
                    + Agregar el primer detalle
                  </button>
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
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {detalles.map((d, i) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3 text-gray-900">{d.descripcion}</td>
                          <td className="px-5 py-3 text-right text-gray-700">{d.cantidad}</td>
                          <td className="px-5 py-3 text-right text-gray-700">S/ {d.valor_unitario.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-3 text-right font-semibold text-[#003D7D]">
                            S/ {(d.valor_total ?? d.cantidad * d.valor_unitario).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEdit(d)} className="text-blue-500 hover:text-blue-700 transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => handleDetDelete(d.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-gray-600">Total general:</td>
                        <td className="px-5 py-3 text-right text-base font-bold text-[#003D7D]">
                          S/ {totalGeneral.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button onClick={() => navigate('/solicitudes')}
                  className="px-6 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] transition-all">
                  <CheckCircle size={15} /> Finalizar
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal agregar / editar detalle */}
      <SolicitudDetalleModal
        open={modalOpen}
        detalle={editingDet}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}
