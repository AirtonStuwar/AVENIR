import { useEffect, useState } from 'react'
import { X, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCuentasByProyecto } from '../services/cuentaBancariaService'
import type { CuentaBancaria } from '../services/cuentaBancariaService'

interface Props {
  open: boolean
  proyectoId: number | null
  title?: string
  description?: string
  // cheque solo llega cuando permitirCheque=true y Contabilidad eligio "Cheque de gerencia"
  // monto solo llega cuando se paso montoPendiente (Factura con Valorizacion: se puede pagar en partes)
  onConfirm: (cuentaId: number, fechaPago: string, cheque?: { numero: string } | null, monto?: number) => Promise<void>
  onCancel: () => void
  permitirCheque?: boolean   // solo Devolucion de Cliente por ahora
  montoPendiente?: number    // si viene, pide el monto de ESTE pago (por defecto todo lo pendiente) y permite pagar en partes
  simbolo?: string           // simbolo de moneda para mostrar el monto pendiente
}

export default function PagoModal({ open, proyectoId, title, description, onConfirm, onCancel, permitirCheque, montoPendiente, simbolo }: Props) {
  const [cuentas, setCuentas]     = useState<CuentaBancaria[]>([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [cuentaId, setCuentaId]   = useState<number | null>(null)
  const localToday = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const [fechaPago, setFechaPago] = useState(localToday())
  const [esCheque, setEsCheque]       = useState(false)
  const [numeroCheque, setNumeroCheque] = useState('')
  const [montoTxt, setMontoTxt]       = useState('')
  const pedirMonto = montoPendiente != null
  const fmtM = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  useEffect(() => {
    if (!open || !proyectoId) return
    setCuentaId(null)
    setFechaPago(localToday())
    setEsCheque(false)
    setNumeroCheque('')
    setMontoTxt(montoPendiente != null ? String(Math.round(montoPendiente * 100) / 100) : '')
    setLoading(true)
    getCuentasByProyecto(proyectoId)
      .then(setCuentas)
      .catch(() => toast.error('Error al cargar cuentas'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proyectoId])

  if (!open) return null

  const handleConfirm = async () => {
    if (!cuentaId) { toast.error('Selecciona una cuenta bancaria'); return }
    if (!fechaPago) { toast.error('Ingresa la fecha de pago'); return }
    if (permitirCheque && esCheque && !numeroCheque.trim()) { toast.error('Ingresa el número de cheque'); return }
    const monto = pedirMonto ? Math.round(parseFloat(montoTxt) * 100) / 100 : undefined
    if (pedirMonto) {
      if (!monto || monto <= 0) { toast.error('Ingresa el monto de este pago'); return }
      if (monto > Math.round(montoPendiente! * 100) / 100 + 0.005) { toast.error(`El monto supera lo pendiente (${simbolo ?? ''}${fmtM(montoPendiente!)})`); return }
    }
    setSaving(true)
    try {
      await onConfirm(cuentaId, fechaPago, permitirCheque && esCheque ? { numero: numeroCheque.trim() } : null, monto)
    } finally {
      setSaving(false)
    }
  }

  const generales = cuentas.filter(c => !c.proyecto_partida_id)
  const porPartida = cuentas.filter(c => c.proyecto_partida_id)

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-800">{title ?? 'Marcar como pagado'}</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            {description ?? 'Selecciona la cuenta bancaria desde la cual se realizó el pago.'}
          </p>

          {/* Medio de pago (solo Devolucion de Cliente) */}
          {permitirCheque && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Medio de pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[{ v: false, t: 'Transferencia' }, { v: true, t: 'Cheque de gerencia' }].map(o => (
                  <button key={o.t} type="button" onClick={() => setEsCheque(o.v)}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      esCheque === o.v
                        ? 'bg-[#003D7D] text-white border-[#003D7D]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#003D7D]/40'
                    }`}>
                    {o.t}
                  </button>
                ))}
              </div>
              {esCheque && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    N° de cheque <span className="text-red-500">*</span>
                  </label>
                  <input className={INPUT} value={numeroCheque} onChange={e => setNumeroCheque(e.target.value)}
                    placeholder="Ej. 00012345" />
                  <p className="text-[11px] text-gray-400 mt-1">La cuenta es la de la empresa contra la que se giró el cheque, y la fecha es la de emisión.</p>
                </div>
              )}
            </div>
          )}

          {/* Monto de este pago (solo Factura con Valorizacion) */}
          {pedirMonto && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Monto de este pago <span className="text-red-500">*</span>
              </label>
              <input type="number" step="0.01" min="0" className={INPUT} value={montoTxt} onChange={e => setMontoTxt(e.target.value)} />
              <p className="text-[11px] text-gray-400 mt-1">
                Pendiente de pago: <strong>{simbolo ?? ''}{fmtM(montoPendiente!)}</strong>. Si pagas menos, quedará como pago parcial y podrás registrar el resto con otra cuenta.
              </p>
            </div>
          )}

          {/* Fecha de pago */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              {permitirCheque && esCheque ? 'Fecha de emisión del cheque' : 'Fecha de pago'} <span className="text-red-500">*</span>
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
              <p className="text-sm text-amber-600">No hay cuentas registradas para esta empresa.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {generales.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-1">Cuentas generales</p>
                    {generales.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => setCuentaId(c.id)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                          cuentaId === c.id
                            ? 'bg-[#003D7D] text-white border-[#003D7D]'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#003D7D]/40 hover:bg-[#003D7D]/5'
                        }`}>
                        <span className="font-semibold">{c.banco}</span>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span>{c.moneda === 'USD' ? 'Dólares' : 'Soles'}</span>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span className="font-mono text-xs">{c.numero_cuenta}</span>
                        {c.concepto && <p className={`text-xs mt-0.5 ${cuentaId === c.id ? 'text-white/70' : 'text-gray-400'}`}>{c.concepto}</p>}
                      </button>
                    ))}
                  </>
                )}
                {porPartida.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide pt-2">Cuentas por centro de costo</p>
                    {porPartida.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => setCuentaId(c.id)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                          cuentaId === c.id
                            ? 'bg-[#003D7D] text-white border-[#003D7D]'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#003D7D]/40 hover:bg-[#003D7D]/5'
                        }`}>
                        <span className="font-semibold">{c.proyecto_partida?.nombre}</span>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span>{c.banco}</span>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span>{c.tipo}</span>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span className="font-mono text-xs">{c.numero_cuenta}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
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
              : <><CreditCard size={14} /> Confirmar pago</>}
          </button>
        </div>
      </div>
    </div>
  )
}
