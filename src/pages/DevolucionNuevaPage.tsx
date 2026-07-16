import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChevronLeft, Loader2, Upload, RotateCcw, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { createDevolucion, updateDevolucion, uploadArchivoDevolucion } from '../features/devolucion/services/devolucionService'
import type { TipoArchivoDevolucion } from '../features/devolucion/services/devolucionService'
import { getProyectos, getPartidasByProyecto } from '../features/proyecto/services/proyectoService'
import type { Proyecto, ProyectoPartida } from '../features/proyecto/types/proyecto'
import { BANCOS, labelNumeroCuenta, maxLengthNumeroCuenta, placeholderNumeroCuenta } from '../features/solicitud/constants/bancos'

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

interface ArchivoSlot {
  tipo: TipoArchivoDevolucion
  label: string
  obligatorio: boolean
}

const ARCHIVOS: ArchivoSlot[] = [
  { tipo: 'sustento',               label: 'Sustento',                obligatorio: true },
  { tipo: 'boucher_separacion',     label: 'Boucher de Separación',   obligatorio: false },
  { tipo: 'constancia_separacion',  label: 'Constancia de Separación', obligatorio: false },
  { tipo: 'sustento_desistimiento', label: 'Sustento Desistimiento',  obligatorio: false },
]

const PATH_FIELD: Record<TipoArchivoDevolucion, string> = {
  sustento:               'sustento_path',
  boucher_separacion:     'boucher_separacion_path',
  constancia_separacion:  'constancia_separacion_path',
  sustento_desistimiento: 'sustento_desistimiento_path',
}

export default function DevolucionNuevaPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [partidas,  setPartidas]  = useState<ProyectoPartida[]>([])

  const [proyectoId, setProyectoId] = useState<number | null>(null)
  const [partidaId,  setPartidaId]  = useState<number | null>(null)
  const [moneda,     setMoneda]     = useState<'PEN' | 'USD'>('PEN')
  const [nombre,     setNombre]     = useState('')
  const [dni,        setDni]        = useState('')
  const [monto,      setMonto]      = useState('')
  const [banco,      setBanco]      = useState('')
  const [cuenta,     setCuenta]     = useState('')
  const [archivos,   setArchivos]   = useState<Partial<Record<TipoArchivoDevolucion, File>>>({})
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    getProyectos({ page: 1, pageSize: 100 }).then(r => setProyectos(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!proyectoId) { setPartidas([]); setPartidaId(null); return }
    getPartidasByProyecto(proyectoId).then(p => { setPartidas(p); setPartidaId(null) }).catch(() => setPartidas([]))
  }, [proyectoId])

  const handleFile = (tipo: TipoArchivoDevolucion, f: File | null) => {
    setArchivos(prev => {
      const next = { ...prev }
      if (f) next[tipo] = f
      else delete next[tipo]
      return next
    })
  }

  const handleGuardar = async () => {
    if (!user?.id) return
    if (!nombre.trim()) { toast.error('Ingresa el nombre del cliente'); return }
    if (!dni.trim()) { toast.error('Ingresa el DNI del cliente'); return }
    if (!monto || parseFloat(monto) <= 0) { toast.error('Ingresa el monto a devolver'); return }
    if (!banco) { toast.error('Selecciona el banco'); return }
    if (!cuenta.trim()) { toast.error(`Ingresa el ${labelNumeroCuenta(banco).toLowerCase()}`); return }
    if (partidas.length > 0 && !partidaId) { toast.error('Selecciona el centro de costo'); return }
    if (!archivos.sustento) { toast.error('Adjunta el archivo Sustento'); return }

    setSaving(true)
    try {
      const dev = await createDevolucion({
        creador_id: user.id,
        proyecto_id: proyectoId,
        proyecto_partida_id: partidaId,
        cliente_nombre: nombre.trim(),
        cliente_dni: dni.trim(),
        monto: parseFloat(monto),
        moneda,
        banco,
        numero_cuenta: cuenta.trim(),
        sustento_path: null,
        boucher_separacion_path: null,
        constancia_separacion_path: null,
        sustento_desistimiento_path: null,
        estado: 'Pendiente',
      })

      const paths: Record<string, string> = {}
      for (const [tipo, file] of Object.entries(archivos)) {
        if (!file) continue
        const path = await uploadArchivoDevolucion(file, dev.id, tipo as TipoArchivoDevolucion)
        paths[PATH_FIELD[tipo as TipoArchivoDevolucion]] = path
      }
      if (Object.keys(paths).length > 0) await updateDevolucion(dev.id, paths)

      toast.success(`Devolución ${dev.codigo ?? ''} registrada`)
      navigate(`/devolucion/${dev.id}`)
    } catch {
      toast.error('Error al registrar la devolución')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/devolucion')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-2.5">
          <RotateCcw size={20} className="text-[#003D7D]" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nueva Devolución de Cliente</h1>
            <p className="text-sm text-gray-500">Registra la devolución de dinero a un cliente</p>
          </div>
        </div>
      </div>

      {/* Datos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Datos de la devolución</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Empresa</label>
            <select className={INPUT} value={proyectoId ?? ''} onChange={e => setProyectoId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Selecciona empresa</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {partidas.length > 0 && (
            <div>
              <label className={LABEL}>Centro de costo *</label>
              <select className={INPUT} value={partidaId ?? ''} onChange={e => setPartidaId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Selecciona centro de costo</option>
                {partidas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={LABEL}>Moneda *</label>
            <select className={INPUT} value={moneda} onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}>
              <option value="PEN">Soles (S/)</option>
              <option value="USD">Dólares ($)</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Monto a devolver *</label>
            <input type="number" step="0.01" min="0" className={INPUT} value={monto}
              onChange={e => setMonto(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className={LABEL}>Nombre del cliente *</label>
            <input className={INPUT} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo del cliente" />
          </div>
          <div>
            <label className={LABEL}>DNI del cliente *</label>
            <input className={INPUT} value={dni} maxLength={8}
              onChange={e => setDni(e.target.value.replace(/\D/g, ''))} placeholder="8 dígitos" />
          </div>
          <div>
            <label className={LABEL}>Banco *</label>
            <select className={INPUT} value={banco} onChange={e => { setBanco(e.target.value); setCuenta('') }}>
              <option value="">Selecciona banco</option>
              {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>{banco ? labelNumeroCuenta(banco) : 'Número de cuenta'} *</label>
            <input className={INPUT} value={cuenta} disabled={!banco}
              maxLength={banco ? maxLengthNumeroCuenta(banco) : 20}
              onChange={e => setCuenta(e.target.value.replace(/\D/g, ''))}
              placeholder={banco ? placeholderNumeroCuenta(banco) : 'Selecciona banco primero'} />
          </div>
        </div>
      </div>

      {/* Archivos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Documentos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ARCHIVOS.map(({ tipo, label, obligatorio }) => {
            const file = archivos[tipo]
            return (
              <div key={tipo} className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-all ${
                file ? 'border-green-200 bg-green-50' : 'border-dashed border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  {file
                    ? <CheckCircle size={15} className="text-green-600 shrink-0" />
                    : <Upload size={15} className="text-gray-400 shrink-0" />}
                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                  {obligatorio
                    ? <span className="ml-auto text-xs font-medium text-red-400">*</span>
                    : <span className="ml-auto text-xs text-gray-400 italic">Opcional</span>}
                </div>
                {file ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-gray-600 truncate" title={file.name}>{file.name}</span>
                    <button onClick={() => handleFile(tipo, null)} className="text-xs text-red-400 hover:underline">Quitar</button>
                  </div>
                ) : (
                  <label className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-[#003D7D] hover:bg-white rounded-lg border border-gray-200 transition-all cursor-pointer">
                    <Upload size={12} /> Subir archivo
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => { handleFile(tipo, e.target.files?.[0] ?? null); e.target.value = '' }} />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Guardar */}
      <div className="flex justify-end">
        <button onClick={handleGuardar} disabled={saving}
          className="flex items-center gap-2 h-11 px-6 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
          Registrar devolución
        </button>
      </div>
    </div>
  )
}
