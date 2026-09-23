import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { X, Loader2, CheckCircle } from 'lucide-react'
import { BANCOS } from '../../solicitud/constants/bancos'
import { getCuentasByProyecto } from '../../solicitud/services/cuentaBancariaService'
import type { CuentaBancaria } from '../../solicitud/services/cuentaBancariaService'
import { createCobranza } from '../services/cobranzaService'
import type { Proyecto } from '../../proyecto/types/proyecto'

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

const METODOS_PAGO = ['Transferencia', 'Depósito', 'Efectivo'] as const

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  proyectos: Proyecto[]
  userId: string
  onClose: () => void
  onCreated: () => void
}

export default function CobranzaModal({ proyectos, userId, onClose, onCreated }: Props) {
  const [proyectoId, setProyectoId] = useState('')
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [loadingCuentas, setLoadingCuentas] = useState(false)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteEdad, setClienteEdad] = useState('')
  const [clienteProfesion, setClienteProfesion] = useState('')
  const [clienteDni, setClienteDni] = useState('')
  const [clienteCorreo, setClienteCorreo] = useState('')
  const [bancoCliente, setBancoCliente] = useState('')
  const [metodoPago, setMetodoPago] = useState<typeof METODOS_PAGO[number]>('Transferencia')
  const [cuentaPagoId, setCuentaPagoId] = useState('')
  const [importe, setImporte] = useState('')
  const [fechaPago, setFechaPago] = useState(localToday())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCuentaPagoId('')
    if (!proyectoId) { setCuentas([]); return }
    setLoadingCuentas(true)
    getCuentasByProyecto(Number(proyectoId))
      .then(setCuentas)
      .catch(() => toast.error('No se pudieron cargar las cuentas bancarias'))
      .finally(() => setLoadingCuentas(false))
  }, [proyectoId])

  const handleGuardar = async () => {
    if (!proyectoId) { toast.error('Selecciona la empresa'); return }
    if (!clienteNombre.trim()) { toast.error('Ingresa el nombre del cliente'); return }
    if (!cuentaPagoId) { toast.error('Selecciona la cuenta bancaria receptora'); return }
    if (!importe || parseFloat(importe) <= 0) { toast.error('Ingresa el importe'); return }
    if (!fechaPago) { toast.error('Ingresa la fecha de pago'); return }

    setSaving(true)
    try {
      await createCobranza({
        creador_id: userId,
        proyecto_id: Number(proyectoId),
        cliente_nombre: clienteNombre.trim(),
        cliente_edad: clienteEdad ? Number(clienteEdad) : null,
        cliente_profesion: clienteProfesion.trim() || null,
        cliente_dni: clienteDni.trim() || null,
        cliente_correo: clienteCorreo.trim() || null,
        banco_cliente: bancoCliente || null,
        metodo_pago: metodoPago,
        cuenta_pago_id: Number(cuentaPagoId),
        importe: parseFloat(importe),
        fecha_pago: fechaPago,
      })
      toast.success('Cobranza registrada')
      onCreated()
      onClose()
    } catch {
      toast.error('Error al registrar la cobranza')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-900">Registrar Cobranza</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-[#003D7D] uppercase tracking-wide mb-3">Datos del cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={LABEL}>Nombre completo *</label>
                <input className={INPUT} value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} placeholder="Nombre y apellidos del cliente" />
              </div>
              <div>
                <label className={LABEL}>DNI</label>
                <input className={INPUT} value={clienteDni} maxLength={8}
                  onChange={e => setClienteDni(e.target.value.replace(/\D/g, ''))} placeholder="8 dígitos" />
              </div>
              <div>
                <label className={LABEL}>Edad</label>
                <input type="number" min="0" className={INPUT} value={clienteEdad}
                  onChange={e => setClienteEdad(e.target.value)} placeholder="Edad" />
              </div>
              <div>
                <label className={LABEL}>Profesión</label>
                <input className={INPUT} value={clienteProfesion} onChange={e => setClienteProfesion(e.target.value)} placeholder="Profesión u ocupación" />
              </div>
              <div>
                <label className={LABEL}>Correo</label>
                <input type="email" className={INPUT} value={clienteCorreo} onChange={e => setClienteCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#003D7D] uppercase tracking-wide mb-3">Datos del pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Empresa *</label>
                <select className={INPUT} value={proyectoId} onChange={e => setProyectoId(e.target.value)}>
                  <option value="">Selecciona empresa</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Cuenta bancaria receptora *</label>
                <select className={INPUT} value={cuentaPagoId} disabled={!proyectoId || loadingCuentas}
                  onChange={e => setCuentaPagoId(e.target.value)}>
                  <option value="">{loadingCuentas ? 'Cargando...' : 'Selecciona cuenta'}</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>{c.banco} — {c.numero_cuenta} ({c.moneda})</option>
                  ))}
                </select>
                {proyectoId && !loadingCuentas && cuentas.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">Esta empresa no tiene cuentas bancarias activas configuradas.</p>
                )}
              </div>
              <div>
                <label className={LABEL}>Banco del cliente</label>
                <select className={INPUT} value={bancoCliente} onChange={e => setBancoCliente(e.target.value)}>
                  <option value="">— Seleccionar banco —</option>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Método de pago *</label>
                <select className={INPUT} value={metodoPago} onChange={e => setMetodoPago(e.target.value as typeof metodoPago)}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Importe *</label>
                <input type="number" step="0.01" min="0" className={INPUT} value={importe}
                  onChange={e => setImporte(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className={LABEL}>Fecha de pago *</label>
                <input type="date" className={INPUT} value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            className="flex items-center gap-2 h-10 px-6 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
