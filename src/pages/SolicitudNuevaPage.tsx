import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle, Plus, Trash2, Pencil, Loader2 } from 'lucide-react'
import { supabase } from '../api/supabase'
import { getProyectos, getPartidasByProyecto, getConsumoByProyectos } from '../features/proyecto/services/proyectoService'
import type { ProyectoPartida } from '../features/proyecto/types/proyecto'
import type { Consumo } from '../features/proyecto/services/proyectoService'
import {
  createSolicitud,
  updateSolicitud,
  createDetalle,
  updateDetalle,
  deleteDetalle,
  getDetallesBySolicitud,
  getFormasPago,
} from '../features/solicitud/services/solicitudService'
import SolicitudDetalleModal from '../features/solicitud/components/SolicitudDetalleModal'
import SolicitudArchivos from '../features/solicitud/components/SolicitudArchivos'
import type { SolicitudArchivo } from '../features/solicitud/types/solicitud'
import { useAuthStore } from '../store/authStore'
import type { Proyecto } from '../features/proyecto/types/proyecto'
import type { SolicitudDetalle, SolicitudFormaPago } from '../features/solicitud/types/solicitud'
import { buscarRuc, getTipoCambioUSD } from '../features/solicitud/services/rucService'
import { BANCOS, labelNumeroCuenta, maxLengthNumeroCuenta, placeholderNumeroCuenta } from '../features/solicitud/constants/bancos'

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
  const userRole  = useAuthStore((s) => s.userRole)
  const canVerConsumo = userRole === 1 || userRole === 9

  // ─── Step ───
  const [step,          setStep]          = useState<'form' | 'detalles' | 'archivos' | 'factura'>('form')
  const [archivos,      setArchivos]      = useState<SolicitudArchivo[]>([])
  const [solicitudId,   setSolicitudId]   = useState<number | null>(null)

  // Factura step fields
  const [numeroFactura,         setNumeroFactura]         = useState('')
  const [motivoFacturaStep,     setMotivoFacturaStep]     = useState('')
  const [fechaEmisionFactura,   setFechaEmisionFactura]   = useState('')
  const [fechaVencimFactura,    setFechaVencimFactura]    = useState('')
  const [savingFactura,         setSavingFactura]         = useState(false)
  const [savingForm,    setSavingForm]    = useState(false)
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const [rucLoading,    setRucLoading]    = useState(false)
  const [rucAutoFilled, setRucAutoFilled] = useState(false)

  // Catalogs
  const [proyectos,   setProyectos]   = useState<Proyecto[]>([])
  const [tipos,       setTipos]       = useState<{ id: number; nombre: string }[]>([])
  const [formasPago,  setFormasPago]  = useState<SolicitudFormaPago[]>([])

  // Form fields
  const [tipo_id,                      setTipoId]                      = useState<number | null>(null)
  const [proyecto_id,                  setProyectoId]                  = useState<number | null>(null)
  const [proyecto_partida_id,          setProyectoPartidaId]           = useState<number | null>(null)
  const [partidas,                     setPartidas]                    = useState<ProyectoPartida[]>([])
  const [razon_social,                 setRazonSocial]                 = useState('')
  const [ruc,                          setRuc]                         = useState('')
  const [direccion,                    setDireccion]                   = useState('')
  const [contacto_nombre,              setContactoNombre]              = useState('')
  const [contacto_telefono,            setContactoTelefono]            = useState('')
  const [contacto_correo,              setContactoCorreo]              = useState('')
  const [banco,                        setBanco]                       = useState('')
  const [numero_cuenta,                setNumeroCuenta]                = useState('')
  const [cuenta_detracciones,          setCuentaDetracciones]          = useState('')
  const [forma_pago_id,                setFormaPagoId]                 = useState<number | null>(null)
  const [moneda,                       setMoneda]                       = useState<'PEN' | 'USD'>('PEN')
  const [porcentaje_contrato,          setPorcentajeContrato]           = useState<number | null>(100)
  const [porcentaje_acumulado_contrato,setPorcentajeAcumulado]         = useState<number | null>(0)
  const [porcentaje_pendiente_contrato,setPorcentajePendiente]         = useState<number | null>(100)
  const [condiciones,                  setCondiciones]                 = useState(
    'Se penalizará el retraso o incumplimiento de algún acuerdo en la fecha de entrega acordada'
  )
  const [fecha_pedido,    setFechaPedido]    = useState('')
  const [fecha_requerida, setFechaRequerida] = useState('')
  const [numero_rxh,       setNumeroRxh]       = useState('')
  const [periodo_servicio, setPeriodoServicio]  = useState('')
  const [aplica_suspension, setAplicaSuspension] = useState<boolean | null>(null)
  const [tipoCambio,        setTipoCambio]       = useState<number | null>(null)

  const tipoNombreSeleccionado = tipos.find(t => t.id === tipo_id)?.nombre ?? ''
  const isRxH = tipoNombreSeleccionado === 'Recibo por Honorarios'

  // Detalles state
  const [detalles,   setDetalles]   = useState<SolicitudDetalle[]>([])
  const [loadingDet, setLoadingDet] = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editingDet, setEditingDet] = useState<SolicitudDetalle | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [pRes, tRes, fpRes] = await Promise.all([
          getProyectos({ page: 1, pageSize: 500 }),
          supabase.from('solicitud_tipo').select('id,nombre').order('nombre'),
          getFormasPago(),
        ])
        setProyectos(pRes.data)
        const OCULTAR = ['A RENDIR', 'CAJA CHICA', 'REEMBOLSO']
        setTipos((tRes.data ?? []).filter((t: { nombre: string }) => !OCULTAR.includes(t.nombre.toUpperCase())))
        setFormasPago(fpRes)
      } catch {
        toast.error('Error al cargar catálogos')
      }
    })()
  }, [])

  // ── PARTIDAS y CONSUMO por proyecto ──────────────────────────
  const [consumoPartidas, setConsumoPartidas] = useState<Record<number, Consumo>>({})

  useEffect(() => {
    setProyectoPartidaId(null)
    setPartidas([])
    setConsumoPartidas({})
    if (!proyecto_id) return
    const promises: [Promise<ProyectoPartida[]>, Promise<{ porPartida: Record<number, Consumo> }> | Promise<null>] = [
      getPartidasByProyecto(proyecto_id),
      canVerConsumo ? getConsumoByProyectos([proyecto_id]) : Promise.resolve(null),
    ]
    Promise.all(promises)
      .then(([parts, c]) => {
        setPartidas(parts as ProyectoPartida[])
        if (c) setConsumoPartidas((c as { porPartida: Record<number, Consumo> }).porPartida)
      })
      .catch(() => {})
  }, [proyecto_id, canVerConsumo])

  // ── RUC AUTOCOMPLETE ──────────────────────────────────────────
  useEffect(() => {
    if (ruc.length !== 11) return
    let cancelled = false
    setRucLoading(true)
    setRucAutoFilled(false)
    buscarRuc(ruc)
      .then((data) => {
        if (cancelled) return
        setRazonSocial(data.razon_social)
        setDireccion(data.direccion)
        setRucAutoFilled(true)
        setErrors((x) => ({ ...x, razon_social: '', ruc: '', direccion: '' }))
      })
      .catch(() => {
        if (cancelled) return
        toast.error('RUC no encontrado en SUNAT')
      })
      .finally(() => { if (!cancelled) setRucLoading(false) })
    return () => { cancelled = true }
  }, [ruc])

  // ── FORM SUBMIT ────────────────────────────────────────────────
  const handleGuardar = async () => {
    const e: Record<string, string> = {}
    if (!tipo_id)                e.tipo_id        = 'Obligatorio'
    if (!proyecto_id)            e.proyecto_id    = 'Obligatorio'
    if (partidas.length > 0 && !proyecto_partida_id) e.proyecto_partida_id = 'Obligatorio'
    if (!razon_social.trim())    e.razon_social   = 'Obligatorio'
    if (!ruc.trim())             e.ruc            = 'Obligatorio'
    if (!direccion.trim())       e.direccion      = 'Obligatorio'
    if (!contacto_nombre.trim()) e.contacto_nombre= 'Obligatorio'
    if (!contacto_telefono.trim())e.contacto_telefono='Obligatorio'
    if (!contacto_correo.trim()) e.contacto_correo= 'Obligatorio'
    if (!forma_pago_id)          e.forma_pago_id  = 'Obligatorio'
    if (!fecha_pedido)           e.fecha_pedido   = 'Obligatorio'
    if (!fecha_requerida)        e.fecha_requerida= 'Obligatorio'
    if (!isRxH) {
      if (porcentaje_contrato === null) e.porcentaje_contrato = 'Obligatorio'
      if (porcentaje_acumulado_contrato === null) e.porcentaje_acumulado = 'Obligatorio'
      if (porcentaje_pendiente_contrato === null) e.porcentaje_pendiente = 'Obligatorio'
    }
    if (isRxH && !numero_rxh.trim()) e.numero_rxh        = 'Obligatorio'
    if (isRxH && !periodo_servicio)  e.periodo_servicio  = 'Obligatorio'

    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSavingForm(true)
    try {
      const payload = {
        tipo_id, proyecto_id,
        proyecto_partida_id: proyecto_partida_id ?? null,
        razon_social, ruc, direccion,
        contacto_nombre, contacto_telefono, contacto_correo,
        banco: banco || null,
        numero_cuenta: numero_cuenta || null,
        cuenta_detracciones: cuenta_detracciones || null,
        forma_pago: formasPago.find(f => f.id === forma_pago_id)?.nombre ?? null,
        forma_pago_id,
        porcentaje_contrato: isRxH ? null : porcentaje_contrato,
        porcentaje_acumulado_contrato: isRxH ? null : porcentaje_acumulado_contrato,
        porcentaje_pendiente_contrato: isRxH ? null : porcentaje_pendiente_contrato,
        condiciones: isRxH ? null : (condiciones || null),
        fecha_pedido, fecha_requerida,
        moneda,
        numero_rxh: isRxH ? (numero_rxh || null) : null,
        periodo_servicio: isRxH && periodo_servicio ? periodo_servicio + '-01' : null,
      }

      if (solicitudId) {
        // Volvió atrás desde otro paso — actualiza en lugar de crear
        await updateSolicitud(solicitudId, payload)
        toast.success('Datos actualizados')
      } else {
        const nueva = await createSolicitud({
          ...payload,
          motivo_factura: null,
          fecha_emision_factura: null,
          fecha_vencimiento_factura: null,
          usuario_creador: user?.id ?? null,
        })
        setSolicitudId(nueva.id)
        toast.success('Solicitud creada — ahora agrega los bienes o servicios')
      }
      setStep('detalles')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al guardar la solicitud')
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

  useEffect(() => {
    if (step !== 'archivos' || !isRxH || moneda !== 'USD') return
    getTipoCambioUSD().then(setTipoCambio).catch(() => setTipoCambio(null))
  }, [step, isRxH, moneda])

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

  const subtotal     = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
  const igv          = subtotal * 0.18
  const totalGeneral = subtotal + igv

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
          {([
            { key: 'form',     label: 'Datos generales' },
            { key: 'detalles', label: 'Bien o Servicio'  },
            { key: 'archivos', label: 'Documentos'      },
            ...(!isRxH ? [{ key: 'factura' as const, label: 'Factura' }] : []),
          ] as { key: 'form' | 'detalles' | 'archivos' | 'factura'; label: string }[]).map((s, i, arr) => {
            const steps = arr.map(x => x.key)
            const idx      = steps.indexOf(step)
            const sIdx     = steps.indexOf(s.key)
            const isActive = step === s.key
            const isDone   = idx > sIdx
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-5 h-px bg-gray-300" />}
                <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
                  isActive ? 'bg-[#003D7D] text-white'
                  : isDone  ? 'bg-green-100 text-green-700'
                  :           'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? <CheckCircle size={12} /> : i + 1} {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── STEP 1: FORM ── */}
        {step === 'form' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 space-y-8">

              {/* Cliente */}
              <div>
                <SectionTitle>Información del proveedor</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>Razón social *</label>
                    <input className={inp(errors.razon_social)} placeholder="Nombre o razón social"
                      value={razon_social} onChange={(e) => { setRazonSocial(e.target.value); setErrors((x) => ({ ...x, razon_social: '' })) }} />
                    {errors.razon_social && <p className="mt-1 text-xs text-red-500">{errors.razon_social}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>RUC *</label>
                    <div className="relative">
                      <input
                        className={inp(errors.ruc)}
                        placeholder="20XXXXXXXXX"
                        maxLength={11}
                        value={ruc}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          setRuc(val)
                          setErrors((x) => ({ ...x, ruc: '' }))
                          if (rucAutoFilled && val.length !== 11) setRucAutoFilled(false)
                        }}
                      />
                      {rucLoading && (
                        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#003D7D] animate-spin" />
                      )}
                      {rucAutoFilled && !rucLoading && (
                        <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                      )}
                    </div>
                    {errors.ruc && <p className="mt-1 text-xs text-red-500">{errors.ruc}</p>}
                    {rucAutoFilled && !rucLoading && (
                      <p className="mt-1 text-xs text-green-600">Datos completados desde SUNAT</p>
                    )}
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
                <SectionTitle>Contacto del Proveedor</SectionTitle>
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
                    <select className={INPUT} value={banco} onChange={(e) => { setBanco(e.target.value); setNumeroCuenta('') }}>
                      <option value="">Seleccionar banco</option>
                      {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>{labelNumeroCuenta(banco)}</label>
                    <input
                      className={INPUT}
                      placeholder={placeholderNumeroCuenta(banco)}
                      maxLength={maxLengthNumeroCuenta(banco)}
                      value={numero_cuenta}
                      onChange={(e) => setNumeroCuenta(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Cuenta detracciones (CCI)</label>
                    <input className={INPUT} placeholder="Cuenta para detracciones" value={cuenta_detracciones} onChange={(e) => setCuentaDetracciones(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Proyecto */}
              <div>
                <SectionTitle>Empresa y tipo</SectionTitle>
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
                    <label className={LABEL}>Empresa *</label>
                    <select className={inp(errors.proyecto_id)} value={proyecto_id ?? ''}
                      onChange={(e) => { setProyectoId(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, proyecto_id: '', proyecto_partida_id: '' })) }}>
                      <option value="">Seleccionar empresa</option>
                      {proyectos.map((p) => <option key={p.id} value={p.id}>{p.codigo ?? ''} — {p.nombre}</option>)}
                    </select>
                    {errors.proyecto_id && <p className="mt-1 text-xs text-red-500">{errors.proyecto_id}</p>}
                  </div>

                  {partidas.length > 0 && (
                  <div>
                    <label className={LABEL}>Centro de costo *</label>
                    <select className={inp(errors.proyecto_partida_id)} value={proyecto_partida_id ?? ''}
                      onChange={(e) => { setProyectoPartidaId(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, proyecto_partida_id: '' })) }}>
                      <option value="">Seleccionar centro de costo</option>
                      {partidas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {errors.proyecto_partida_id && <p className="mt-1 text-xs text-red-500">{errors.proyecto_partida_id}</p>}
                    {canVerConsumo && (() => {
                      if (!proyecto_partida_id) return null
                      const sel = partidas.find(p => p.id === proyecto_partida_id)
                      const c = consumoPartidas[proyecto_partida_id]
                      if (!sel || !c) return null
                      const pres = moneda === 'USD' ? sel.presupuesto_usd : sel.presupuesto_pen
                      const cons = moneda === 'USD' ? c.usd : c.pen
                      if (pres <= 0) return null
                      const pct = (cons / pres) * 100
                      const sym = moneda === 'USD' ? '$' : 'S/'
                      const saldo = pres - cons
                      if (pct <= 80) return (
                        <p className="mt-1 text-[11px] text-emerald-600">
                          Saldo disponible: {sym} {saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ({(100 - pct).toFixed(0)}%)
                        </p>
                      )
                      return (
                        <div className={`mt-1.5 flex items-start gap-1.5 px-3 py-2 rounded-lg text-xs ${pct >= 100 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          <span className="shrink-0 mt-0.5">⚠️</span>
                          <span>
                            {pct >= 100
                              ? `Presupuesto agotado — consumido ${sym} ${cons.toLocaleString('es-PE', { minimumFractionDigits: 2 })} de ${sym} ${pres.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                              : `Presupuesto al ${pct.toFixed(0)}% — saldo: ${sym} ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                  )}

                  <div>
                    <label className={LABEL}>Forma de pago *</label>
                    <select className={inp(errors.forma_pago_id)} value={forma_pago_id ?? ''}
                      onChange={(e) => { setFormaPagoId(e.target.value ? Number(e.target.value) : null); setErrors((x) => ({ ...x, forma_pago_id: '' })) }}>
                      <option value="">Seleccionar forma de pago</option>
                      {formasPago.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                    {errors.forma_pago_id && <p className="mt-1 text-xs text-red-500">{errors.forma_pago_id}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>Moneda *</label>
                    <select className={inp('')} value={moneda} onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')}>
                      <option value="PEN">S/ Soles (PEN)</option>
                      <option value="USD">$ Dólares (USD)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Campos específicos Recibo por Honorarios */}
              {isRxH && (
                <div>
                  <SectionTitle>Datos del Recibo por Honorarios</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>N° de Recibo (RxH) *</label>
                      <input className={inp(errors.numero_rxh)} placeholder="Ej: E001-00123"
                        value={numero_rxh}
                        onChange={(e) => { setNumeroRxh(e.target.value); setErrors((x) => ({ ...x, numero_rxh: '' })) }} />
                      {errors.numero_rxh && <p className="mt-1 text-xs text-red-500">{errors.numero_rxh}</p>}
                    </div>
                    <div>
                      <label className={LABEL}>Período del servicio *</label>
                      <input className={inp(errors.periodo_servicio)} type="month"
                        value={periodo_servicio}
                        onChange={(e) => { setPeriodoServicio(e.target.value); setErrors((x) => ({ ...x, periodo_servicio: '' })) }} />
                      {errors.periodo_servicio && <p className="mt-1 text-xs text-red-500">{errors.periodo_servicio}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Porcentajes (solo OC, no RxH) */}
              {!isRxH && <div>
                <SectionTitle>Porcentajes del contrato</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL}>% Contrato *</label>
                    <input className={inp(errors.porcentaje_contrato)} type="number" step="0.01" min="0" max="100" placeholder="100"
                      value={porcentaje_contrato ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                        setPorcentajeContrato(v)
                        setErrors((x) => ({ ...x, porcentaje_contrato: '' }))
                      }} />
                    {errors.porcentaje_contrato && <p className="mt-1 text-xs text-red-500">{errors.porcentaje_contrato}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>% Acumulado *</label>
                    <input className={inp(errors.porcentaje_acumulado)} type="number" step="0.01" min="0" max="100" placeholder="0"
                      value={porcentaje_acumulado_contrato ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                        setPorcentajeAcumulado(v)
                        setPorcentajePendiente(v === null ? null : (porcentaje_contrato ?? 100) - v)
                        setErrors((x) => ({ ...x, porcentaje_acumulado: '' }))
                      }} />
                    {errors.porcentaje_acumulado && <p className="mt-1 text-xs text-red-500">{errors.porcentaje_acumulado}</p>}
                  </div>
                  <div>
                    <label className={LABEL}>% Pendiente *</label>
                    <input className={inp(errors.porcentaje_pendiente)} type="number" step="0.01" min="0" max="100" placeholder="100"
                      value={porcentaje_pendiente_contrato ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                        setPorcentajePendiente(v)
                        setPorcentajeAcumulado(v === null ? null : (porcentaje_contrato ?? 100) - v)
                        setErrors((x) => ({ ...x, porcentaje_pendiente: '' }))
                      }} />
                    {errors.porcentaje_pendiente && <p className="mt-1 text-xs text-red-500">{errors.porcentaje_pendiente}</p>}
                  </div>
                </div>
              </div>}

              {/* Fechas */}
              <div>
                <SectionTitle>Fechas</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </div>

              {/* Condiciones (solo OC) */}
              {!isRxH && (
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
              )}
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
                  Bien o Servicio <span className="ml-1 text-gray-400 font-normal normal-case">
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
                    : (!isRxH || detalles.length === 0) && (
                        <button onClick={openAdd}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-medium hover:bg-[#002D5C] transition-all">
                          <Plus size={13} /> Agregar
                        </button>
                      )
                  }
                </div>
              </div>

              {detalles.length === 0 && !loadingDet ? (
                <div className="py-14 text-center text-sm text-gray-400">
                  <button onClick={openAdd} className="text-[#003D7D] hover:underline">
                    + Agregar el primer bien o servicio
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
                        <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">Subtotal</td>
                        <td className="px-5 py-2 text-right text-sm text-gray-600">
                          S/ {subtotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-5 py-2 text-right text-xs text-gray-400">IGV (18%)</td>
                        <td className="px-5 py-2 text-right text-sm text-gray-600">
                          S/ {igv.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                      <tr className="border-t border-gray-200">
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

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <button onClick={() => setStep('form')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                  ← Atrás
                </button>
                <button onClick={() => setStep('archivos')}
                  className="px-6 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] transition-all">
                  Continuar →
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 3: ARCHIVOS ── */}
        {step === 'archivos' && solicitudId && (() => {
          const sustentoObligatorio = !isRxH && (porcentaje_acumulado_contrato ?? 0) > 9

          // Umbral suspensión: S/ 1,500. Para USD se convierte usando tipo de cambio.
          const subtotal = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
          const subtotalEnSoles = moneda === 'USD' && tipoCambio ? subtotal * tipoCambio : subtotal
          const superaUmbral = isRxH && subtotalEnSoles >= 1500

          const tiposVisiblesRxH = aplica_suspension === true
            ? ['Sustento', 'Recibo Honorario', 'Suspension']
            : ['Sustento', 'Recibo Honorario']

          const docsRequeridos = isRxH
            ? tiposVisiblesRxH // Suspension es opcional, pero se incluye si aplica
            : sustentoObligatorio
              ? ['Contrato', 'Cotizacion', 'Sustento']
              : ['Contrato', 'Cotizacion']

          // Docs obligatorios reales (Suspension nunca es obligatorio)
          const docsObligatorios = isRxH
            ? ['Sustento', 'Recibo Honorario']
            : docsRequeridos

          const docsCompletos = docsObligatorios.every(tipo =>
            archivos.some(a => a.tipo_archivo === tipo)
          )
          // Para RxH que supera umbral: requiere seleccionar aplica/no aplica antes de continuar
          const puedeAvanzar = docsCompletos && (!superaUmbral || aplica_suspension !== null)

          const handleFinalizar = async () => {
            if (isRxH && solicitudId) {
              try {
                await updateSolicitud(solicitudId, {
                  aplica_suspension: superaUmbral ? (aplica_suspension ?? false) : null,
                })
              } catch { /* no bloqueante */ }
            }
            navigate(`/solicitudes/${solicitudId}`)
          }

          return (
          <>
            <div className="flex items-center gap-3 px-5 py-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <CheckCircle size={20} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Adjunta los documentos requeridos</p>
                <p className="text-xs text-blue-600">
                  {isRxH
                    ? 'Sustento y PDF del Recibo por Honorarios son obligatorios.'
                    : <>
                        Contrato y Cotización son siempre obligatorios.
                        {sustentoObligatorio
                          ? ' Sustento también es obligatorio (% acumulado > 9%).'
                          : ' Sustento y Cuadro Comparativo son opcionales.'
                        }
                      </>
                  }
                </p>
              </div>
            </div>

            {/* Suspensión de retención — solo para RxH que superan S/ 1,500 */}
            {superaUmbral && (
              <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
                  <p className="text-sm font-semibold text-amber-800">Suspensión de retenciones de 4.ª categoría</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    El monto supera S/ 1,500. ¿El proveedor cuenta con constancia de suspensión emitida por SUNAT?
                  </p>
                </div>
                <div className="px-5 py-4 flex items-center gap-3">
                  <button
                    onClick={() => setAplicaSuspension(true)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      aplica_suspension === true
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700'
                    }`}
                  >
                    Sí aplica — subiré la constancia
                  </button>
                  <button
                    onClick={() => setAplicaSuspension(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      aplica_suspension === false
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    No aplica
                  </button>
                </div>
                {aplica_suspension === null && (
                  <p className="px-5 pb-3 text-xs text-amber-600">Selecciona una opción para continuar.</p>
                )}
              </div>
            )}

            <SolicitudArchivos
              solicitudId={solicitudId}
              editable={true}
              onChange={setArchivos}
              tiposVisibles={isRxH
                ? tiposVisiblesRxH
                : ['Contrato', 'Cotizacion', 'Sustento', 'Cuadro Comparativo']}
              tiposOpcionales={isRxH
                ? (aplica_suspension === true ? ['Suspension'] : [])
                : sustentoObligatorio ? [] : ['Sustento']}
            />

            <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('detalles')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                  ← Atrás
                </button>
                <span className="text-sm text-gray-500">
                  {!docsCompletos
                    ? <span className="text-amber-600 font-medium">
                        Faltan: {docsObligatorios.filter(t => !archivos.some(a => a.tipo_archivo === t)).join(', ')}
                      </span>
                    : superaUmbral && aplica_suspension === null
                      ? <span className="text-amber-600 font-medium">Indica si aplica suspensión</span>
                      : <span className="text-green-600 font-medium flex items-center gap-1.5">
                          <CheckCircle size={14} /> Documentos obligatorios completos
                        </span>
                  }
                </span>
              </div>
              <button
                onClick={() => isRxH ? handleFinalizar() : setStep('factura')}
                disabled={!puedeAvanzar}
                className="px-6 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isRxH ? 'Finalizar →' : 'Continuar →'}
              </button>
            </div>
          </>
          )
        })()}

        {/* ── STEP 4: FACTURA ── */}
        {step === 'factura' && solicitudId && (() => {
          const facturaValida = !!numeroFactura.trim() && !!motivoFacturaStep.trim() && !!fechaEmisionFactura && !!fechaVencimFactura
          return (
          <>
            <div className="flex items-center gap-3 px-5 py-4 bg-[#003D7D]/[0.05] border border-[#003D7D]/20 rounded-2xl">
              <CheckCircle size={20} className="text-[#003D7D] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#003D7D]">Datos de la factura — obligatorio</p>
                <p className="text-xs text-[#003D7D]/70">Completa todos los campos para finalizar la solicitud. Los archivos de factura son opcionales.</p>
              </div>
            </div>

            {/* Archivos de factura */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Archivos de factura</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ambos son opcionales</p>
              </div>
              <div className="p-6">
                <SolicitudArchivos
                  solicitudId={solicitudId}
                  editable={true}
                  onChange={setArchivos}
                  tiposVisibles={['Factura XML', 'Factura PDF']}
                />
              </div>
            </div>

            {/* Datos de la factura */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Datos de la factura</h2>
                <p className="text-xs text-gray-400 mt-0.5">Todos los campos son obligatorios <span className="text-red-500">*</span></p>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={LABEL}>N° de Factura <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={numeroFactura}
                    onChange={e => setNumeroFactura(e.target.value)}
                    placeholder="Ej: F001-00123"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Motivo de la factura <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={motivoFacturaStep}
                    onChange={e => setMotivoFacturaStep(e.target.value)}
                    placeholder="Concepto o descripción de la factura"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Fecha de emisión <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={fechaEmisionFactura}
                    onChange={e => setFechaEmisionFactura(e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Fecha de vencimiento <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={fechaVencimFactura}
                    onChange={e => setFechaVencimFactura(e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <button onClick={() => setStep('archivos')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
                ← Atrás
              </button>
              {!facturaValida && (
                <p className="mx-auto text-xs text-gray-400">Completa todos los campos obligatorios para finalizar.</p>
              )}
              <button
                onClick={async () => {
                  setSavingFactura(true)
                  try {
                    await updateSolicitud(solicitudId, {
                      numero_factura:            numeroFactura.trim()      || null,
                      motivo_factura:            motivoFacturaStep.trim()  || null,
                      fecha_emision_factura:     fechaEmisionFactura       || null,
                      fecha_vencimiento_factura: fechaVencimFactura        || null,
                    })
                  } catch { /* silencioso */ }
                  finally { setSavingFactura(false) }
                  navigate('/solicitudes')
                }}
                disabled={savingFactura || !facturaValida}
                className="px-6 py-2.5 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {savingFactura
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando...</>
                  : <><CheckCircle size={15} /> Finalizar</>
                }
              </button>
            </div>
          </>
          )
        })()}
      </div>

      {/* Modal agregar / editar detalle */}
      <SolicitudDetalleModal
        open={modalOpen}
        detalle={editingDet}
        moneda={moneda}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}