import { useEffect, useMemo, useState } from 'react'
import { X, CreditCard, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAllCuentasBancarias } from '../services/cuentaBancariaService'
import type { CuentaBancaria } from '../services/cuentaBancariaService'

interface Props {
  open: boolean
  title: string
  description?: string
  cantidad: number
  onConfirm: (cuentaId: number, fechaPago: string) => Promise<void>
  onCancel: () => void
}

/**
 * Igual que PagoModal pero para acción masiva: la selección puede incluir solicitudes
 * de distintas empresas, así que lista TODAS las cuentas activas (getAllCuentasBancarias)
 * en vez de las de un solo proyecto.
 */
export default function BulkPagoModal({ open, title, description, cantidad, onConfirm, onCancel }: Props) {
  const [cuentas, setCuentas]   = useState<CuentaBancaria[]>([])
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [cuentaId, setCuentaId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const localToday = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const [fechaPago, setFechaPago] = useState(localToday())

  useEffect(() => {
    if (!open) return
    setCuentaId(null)
    setBusqueda('')
    setFechaPago(localToday())
    setLoading(true)
    getAllCuentasBancarias()
      .then(setCuentas)
      .catch(() => toast.error('Error al cargar cuentas'))
      .finally(() => setLoading(false))
  }, [open])

  const cuentasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return cuentas
    return cuentas.filter(c =>
      (c.proyecto?.nombre ?? '').toLowerCase().includes(q) ||
      c.banco.toLowerCase().includes(q) ||
      c.numero_cuenta.toLowerCase().includes(q) ||
      (c.concepto ?? '').toLowerCase().includes(q))
  }, [cuentas, busqueda])

  if (!open) return null

  const handleConfirm = async () => {
    if (!cuentaId) { toast.error('Selecciona una cuenta bancaria'); return }
    if (!fechaPago) { toast.error('Ingresa la fecha de pago'); return }
    setSaving(true)
    try {
      await onConfirm(cuentaId, fechaPago)
    } finally {
      setSaving(false)
    }
  }

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            {description ?? `Se aplicará el mismo pago a las ${cantidad} solicitudes seleccionadas.`}
          </p>

          {/* Fecha de pago */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Fecha de pago <span className="text-red-500">*</span>
            </label>
            <input type="date" className={INPUT} value={fechaPago}
              onChange={e => setFechaPago(e.target.value)} />
          </div>

          {/* Cuenta bancaria */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Cuenta bancaria <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <p className="text-sm text-gray-400">Cargando cuentas…</p>
            ) : cuentas.length === 0 ? (
              <p className="text-sm text-amber-600">No hay cuentas registradas.</p>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    className="w-full h-8 rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
                    placeholder="Buscar empresa, banco o cuenta…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {cuentasFiltradas.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => setCuentaId(c.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                        cuentaId === c.id
                          ? 'bg-[#003D7D] text-white border-[#003D7D]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#003D7D]/40 hover:bg-[#003D7D]/5'
                      }`}>
                      <span className="font-semibold">{c.proyecto?.nombre}</span>
                      <span className="mx-1.5 opacity-60">·</span>
                      <span>{c.banco}</span>
                      <span className="mx-1.5 opacity-60">·</span>
                      <span>{c.moneda === 'USD' ? 'Dólares' : 'Soles'}</span>
                      <p className={`text-xs mt-0.5 font-mono ${cuentaId === c.id ? 'text-white/70' : 'text-gray-400'}`}>
                        {c.numero_cuenta}{c.proyecto_partida?.nombre ? ` · ${c.proyecto_partida.nombre}` : ''}
                      </p>
                    </button>
                  ))}
                  {cuentasFiltradas.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">Sin resultados.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving || !cuentaId}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-40 transition-all">
            {saving
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
              : <><CreditCard size={14} /> Confirmar ({cantidad})</>}
          </button>
        </div>
      </div>
    </div>
  )
}
