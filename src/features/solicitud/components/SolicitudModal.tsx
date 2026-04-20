import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getProyectos } from '../../proyecto/services/proyectoService'
import { supabase } from '../../../api/supabase'
import type { Proyecto } from '../../proyecto/types/proyecto'
import type { SolicitudInsert } from '../types/solicitud'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (payload: SolicitudInsert) => Promise<void>
}

export default function SolicitudModal({ open, onClose, onCreate }: Props) {
  const [loading, setLoading] = useState(false)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])

  const [razon_social, setRazonSocial] = useState('')
  const [ruc, setRuc] = useState('')
  const [proyecto_id, setProyectoId] = useState<number | null>(null)
  const [tipo_id, setTipoId] = useState<number | null>(null)
  const [direccion, setDireccion] = useState('')
  const [contacto_nombre, setContactoNombre] = useState('')
  const [contacto_telefono, setContactoTelefono] = useState('')
  const [contacto_correo, setContactoCorreo] = useState('')
  const [banco, setBanco] = useState('')
  const [numero_cuenta, setNumeroCuenta] = useState('')
  const [cuenta_detracciones, setCuentaDetracciones] = useState('')
  const [forma_pago, setFormaPago] = useState('')
  const [porcentaje_contrato, setPorcentajeContrato] = useState<number | null>(null)
  const [porcentaje_acumulado_contrato, setPorcentajeAcumuladoContrato] = useState<number | null>(null)
  const [porcentaje_pendiente_contrato, setPorcentajePendienteContrato] = useState<number | null>(null)
  const [condiciones, setCondiciones] = useState('')
  const [solicitante, setSolicitante] = useState('')
  const [fecha_pedido, setFechaPedido] = useState('')
  const [fecha_requerida, setFechaRequerida] = useState('')
  const [prioridad, setPrioridad] = useState('Media')
  const [estado_id, setEstadoId] = useState<number | null>(null)
  const [comentario_gerencia, setComentarioGerencia] = useState('')
  const [tipos, setTipos] = useState<Array<{id:number;nombre:string}>>([])
  const [estados, setEstados] = useState<Array<{id:number;nombre:string}>>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const clearErrors = () => setErrors({})

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const res = await getProyectos({ page: 1, pageSize: 500 })
        setProyectos(res.data)
        const { data: tiposData } = await supabase.from('solicitud_tipo').select('id,nombre').order('nombre')
        const { data: estadosData } = await supabase.from('estado_soli').select('id,nombre').order('orden')
        setTipos(tiposData ?? [])
        setEstados(estadosData ?? [])
      } catch (err) {
        console.error(err)
      }
    })()
  }, [open])

  const resetForm = () => {
    setRazonSocial('')
    setRuc('')
    setProyectoId(null)
    setTipoId(null)
    setDireccion('')
    setContactoNombre('')
    setContactoTelefono('')
    setContactoCorreo('')
    setBanco('')
    setNumeroCuenta('')
    setCuentaDetracciones('')
    setFormaPago('')
    setPorcentajeContrato(null)
    setPorcentajeAcumuladoContrato(null)
    setPorcentajePendienteContrato(null)
    setCondiciones('')
    setSolicitante('')
    setFechaPedido('')
    setFechaRequerida('')
    setPrioridad('Media')
    setEstadoId(null)
    setComentarioGerencia('')
  }

  const submit = async () => {
    // Validar campos obligatorios (inline). Sólo `banco`, `numero_cuenta` y `cuenta_detracciones` pueden quedar vacíos.
    const e: Record<string, string> = {}
    if (!tipo_id && tipo_id !== 0) e.tipo_id = 'Tipo es obligatorio'
    if (!proyecto_id && proyecto_id !== 0) e.proyecto_id = 'Proyecto es obligatorio'
    if (!razon_social?.trim()) e.razon_social = 'Razón social es obligatoria'
    if (!direccion?.trim()) e.direccion = 'Dirección es obligatoria'
    if (!ruc?.trim()) e.ruc = 'RUC es obligatorio'
    if (!contacto_nombre?.trim()) e.contacto_nombre = 'Nombre de contacto es obligatorio'
    if (!contacto_telefono?.trim()) e.contacto_telefono = 'Teléfono de contacto es obligatorio'
    if (!contacto_correo?.trim()) e.contacto_correo = 'Correo de contacto es obligatorio'
    if (!forma_pago?.trim()) e.forma_pago = 'Forma de pago es obligatoria'
    if (porcentaje_contrato === null || porcentaje_contrato === undefined) e.porcentaje_contrato = 'Porcentaje contrato es obligatorio'
    if (porcentaje_acumulado_contrato === null || porcentaje_acumulado_contrato === undefined) e.porcentaje_acumulado_contrato = 'Porcentaje acumulado es obligatorio'
    if (porcentaje_pendiente_contrato === null || porcentaje_pendiente_contrato === undefined) e.porcentaje_pendiente_contrato = 'Porcentaje pendiente es obligatorio'
    if (!condiciones?.trim()) e.condiciones = 'Condiciones es obligatorio'
    if (!solicitante?.trim()) e.solicitante = 'Solicitante es obligatorio'
    if (!fecha_pedido?.trim()) e.fecha_pedido = 'Fecha pedido es obligatorio'
    if (!fecha_requerida?.trim()) e.fecha_requerida = 'Fecha requerida es obligatoria'
    if (!prioridad?.trim()) e.prioridad = 'Prioridad es obligatoria'
    if (!estado_id && estado_id !== 0) e.estado_id = 'Estado es obligatorio'
    if (!comentario_gerencia?.trim()) e.comentario_gerencia = 'Comentario gerencia es obligatorio'

    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }

    setLoading(true)
    try {
      const payload: SolicitudInsert = {
        tipo_id: tipo_id ?? null,
        codigo: null,
        proyecto_id: proyecto_id ?? null,
        razon_social: razon_social || null,
        direccion: direccion || null,
        ruc: ruc || null,
        contacto_nombre: contacto_nombre || null,
        contacto_telefono: contacto_telefono || null,
        contacto_correo: contacto_correo || null,
        banco: banco || null,
        numero_cuenta: numero_cuenta || null,
        cuenta_detracciones: cuenta_detracciones || null,
        forma_pago: forma_pago || null,
        porcentaje_contrato: porcentaje_contrato ?? null,
        porcentaje_acumulado_contrato: porcentaje_acumulado_contrato ?? null,
        porcentaje_pendiente_contrato: porcentaje_pendiente_contrato ?? null,
        condiciones: condiciones || null,
        fecha_pedido: fecha_pedido || null,
        solicitante: solicitante || null,
        fecha_requerida: fecha_requerida || null,
        prioridad: prioridad || 'Media',
        estado_id: estado_id ?? null,
        comentario_gerencia: comentario_gerencia || null,
      }
      await onCreate(payload)
      resetForm()
      onClose()
      toast.success('Solicitud creada exitosamente')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al crear solicitud')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gradient-to-r from-[#003D7D] to-[#0056a3] px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Nueva Solicitud</h3>
              <p className="mt-1 text-sm text-blue-100">Complete todos los campos obligatorios para crear la solicitud</p>
            </div>
            <button 
              className="text-white/80 transition-colors hover:text-white"
              onClick={onClose}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Formulario */}
        <div className="px-6 py-6">
          {/* Sección: Información del cliente */}
          <div className="mb-8">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-[#003D7D]">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Información del Cliente
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Razón social <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Nombre o razón social"
                  value={razon_social}
                  onChange={(e) => { setRazonSocial(e.target.value); clearErrors() }}
                />
                {errors.razon_social && <p className="mt-1 text-sm text-red-600">{errors.razon_social}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  RUC <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="20XXXXXXXXX"
                  value={ruc}
                  onChange={(e) => { setRuc(e.target.value); clearErrors() }}
                />
                {errors.ruc && <p className="mt-1 text-sm text-red-600">{errors.ruc}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Dirección <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Dirección completa"
                  value={direccion}
                  onChange={(e) => { setDireccion(e.target.value); clearErrors() }}
                />
                {errors.direccion && <p className="mt-1 text-sm text-red-600">{errors.direccion}</p>}
              </div>
            </div>
          </div>

          {/* Sección: Contacto */}
          <div className="mb-8">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-[#003D7D]">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Información de Contacto
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Nombre del contacto"
                  value={contacto_nombre}
                  onChange={(e) => { setContactoNombre(e.target.value); clearErrors() }}
                />
                {errors.contacto_nombre && <p className="mt-1 text-sm text-red-600">{errors.contacto_nombre}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="9XXXXXXXX"
                  value={contacto_telefono}
                  onChange={(e) => { setContactoTelefono(e.target.value); clearErrors() }}
                />
                {errors.contacto_telefono && <p className="mt-1 text-sm text-red-600">{errors.contacto_telefono}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Correo <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="correo@empresa.com"
                  type="email"
                  value={contacto_correo}
                  onChange={(e) => { setContactoCorreo(e.target.value); clearErrors() }}
                />
                {errors.contacto_correo && <p className="mt-1 text-sm text-red-600">{errors.contacto_correo}</p>}
              </div>
            </div>
          </div>

          {/* Sección: Datos bancarios */}
          <div className="mb-8">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-[#003D7D]">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Datos Bancarios
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Banco</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Nombre del banco"
                  value={banco}
                  onChange={(e) => { setBanco(e.target.value); clearErrors() }}
                />
                {errors.banco && <p className="mt-1 text-sm text-red-600">{errors.banco}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Número de cuenta</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Número de cuenta"
                  value={numero_cuenta}
                  onChange={(e) => { setNumeroCuenta(e.target.value); clearErrors() }}
                />
                {errors.numero_cuenta && <p className="mt-1 text-sm text-red-600">{errors.numero_cuenta}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Cuenta detracciones</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Cuenta para detracciones"
                  value={cuenta_detracciones}
                  onChange={(e) => { setCuentaDetracciones(e.target.value); clearErrors() }}
                />
                {errors.cuenta_detracciones && <p className="mt-1 text-sm text-red-600">{errors.cuenta_detracciones}</p>}
              </div>
            </div>
          </div>

          {/* Sección: Proyecto y tipos */}
          <div className="mb-8">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-[#003D7D]">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Configuración del Proyecto
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  value={tipo_id ?? ''}
                  onChange={(e) => { setTipoId(e.target.value ? Number(e.target.value) : null); clearErrors() }}
                >
                  <option value="">Seleccionar tipo</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
                {errors.tipo_id && <p className="mt-1 text-sm text-red-600">{errors.tipo_id}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Proyecto <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  value={proyecto_id ?? ''}
                  onChange={(e) => { setProyectoId(e.target.value ? Number(e.target.value) : null); clearErrors() }}
                >
                  <option value="">Seleccionar proyecto</option>
                  {proyectos.map((p) => <option key={p.id} value={p.id}>{p.codigo ?? ''} — {p.nombre}</option>)}
                </select>
                {errors.proyecto_id && <p className="mt-1 text-sm text-red-600">{errors.proyecto_id}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Forma de pago <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Ej: Transferencia, Efectivo"
                  value={forma_pago}
                  onChange={(e) => { setFormaPago(e.target.value); clearErrors() }}
                />
                {errors.forma_pago && <p className="mt-1 text-sm text-red-600">{errors.forma_pago}</p>}
              </div>
            </div>
          </div>

          {/* Sección: Porcentajes */}
          <div className="mb-8">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-[#003D7D]">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m-6 4h6m-6 4h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
              Porcentajes
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  % Contrato <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Porcentaje del contrato"
                  value={porcentaje_contrato ?? ''}
                  onChange={(e) => { setPorcentajeContrato(e.target.value ? Number(e.target.value) : null); clearErrors() }}
                />
                {errors.porcentaje_contrato && <p className="mt-1 text-sm text-red-600">{errors.porcentaje_contrato}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  % Acumulado <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Porcentaje acumulado"
                  value={porcentaje_acumulado_contrato ?? ''}
                  onChange={(e) => { setPorcentajeAcumuladoContrato(e.target.value ? Number(e.target.value) : null); clearErrors() }}
                />
                {errors.porcentaje_acumulado_contrato && <p className="mt-1 text-sm text-red-600">{errors.porcentaje_acumulado_contrato}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  % Pendiente <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Porcentaje pendiente"
                  value={porcentaje_pendiente_contrato ?? ''}
                  onChange={(e) => { setPorcentajePendienteContrato(e.target.value ? Number(e.target.value) : null); clearErrors() }}
                />
                {errors.porcentaje_pendiente_contrato && <p className="mt-1 text-sm text-red-600">{errors.porcentaje_pendiente_contrato}</p>}
              </div>
            </div>
          </div>

          {/* Sección: Fechas y prioridad */}
          <div className="mb-8">
            <h4 className="mb-3 flex items-center text-sm font-semibold text-[#003D7D]">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Fechas y Prioridad
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Solicitante <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Nombre del solicitante"
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Fecha pedido <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  value={fecha_pedido}
                  onChange={(e) => setFechaPedido(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Fecha requerida <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  value={fecha_requerida}
                  onChange={(e) => setFechaRequerida(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Prioridad <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                >
                  <option value="Alta" className="text-red-600">🔴 Alta</option>
                  <option value="Media" className="text-yellow-600">🟡 Media</option>
                  <option value="Baja" className="text-green-600">🟢 Baja</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sección: Estado y comentarios */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Estado <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  value={estado_id ?? ''}
                  onChange={(e) => setEstadoId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Seleccionar estado</option>
                  {estados.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Condiciones <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                  placeholder="Condiciones del contrato"
                  value={condiciones}
                  onChange={(e) => setCondiciones(e.target.value)}
                />
              </div>
            </div>
            {/* <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Comentario gerencia <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#003D7D] focus:outline-none focus:ring-1 focus:ring-[#003D7D]"
                rows={3}
                placeholder="Comentarios u observaciones de gerencia"
                value={comentario_gerencia}
                onChange={(e) => setComentarioGerencia(e.target.value)}
              />
            </div> */}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-xl">
          <button
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D] focus:ring-offset-2 disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="rounded-lg bg-[#003D7D] px-5 py-2 text-sm font-medium text-white transition-all hover:bg-[#002a5a] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#003D7D] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={submit}
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Guardando...
              </div>
            ) : (
              'Crear Solicitud'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}