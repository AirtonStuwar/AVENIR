import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import type { SolicitudDetalle } from '../types/solicitud'

interface Props {
  open: boolean
  detalle?: SolicitudDetalle | null  // null = nuevo, value = editar
  onClose: () => void
  onSubmit: (data: { cantidad: number; descripcion: string; valor_unitario: number }) => Promise<void>
}

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

export default function SolicitudDetalleModal({ open, detalle, onClose, onSubmit }: Props) {
  const [cantidad,       setCantidad]      = useState(1)
  const [descripcion,    setDescripcion]   = useState('')
  const [valor_unitario, setValorUnitario] = useState(0)
  const [saving,         setSaving]        = useState(false)
  const [errors,         setErrors]        = useState<Record<string, string>>({})

  const isEdit = Boolean(detalle)

  useEffect(() => {
    if (!open) return
    if (detalle) {
      setCantidad(detalle.cantidad)
      setDescripcion(detalle.descripcion)
      setValorUnitario(detalle.valor_unitario)
    } else {
      setCantidad(1)
      setDescripcion('')
      setValorUnitario(0)
    }
    setErrors({})
  }, [open, detalle])

  const handleSubmit = async () => {
    const e: Record<string, string> = {}
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (cantidad <= 0)       e.cantidad    = 'Debe ser mayor a 0'
    if (valor_unitario < 0)  e.valor       = 'No puede ser negativo'
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSaving(true)
    try {
      await onSubmit({ cantidad, descripcion, valor_unitario })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const total = cantidad * valor_unitario

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#003D7D]">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Editar detalle' : 'Agregar detalle'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#F65740] via-[#F65740]/60 to-transparent" />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LABEL}>Descripción *</label>
            <input
              className={INPUT + (errors.descripcion ? ' border-red-300 bg-red-50' : '')}
              placeholder="Ej: Laptop HP, Servicio de instalación…"
              value={descripcion}
              autoFocus
              onChange={(e) => { setDescripcion(e.target.value); setErrors((x) => ({ ...x, descripcion: '' })) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {errors.descripcion && <p className="mt-1 text-xs text-red-500">{errors.descripcion}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Cantidad *</label>
              <input
                className={INPUT + (errors.cantidad ? ' border-red-300 bg-red-50' : '')}
                type="number" min="0.01" step="0.01"
                value={cantidad}
                onChange={(e) => { setCantidad(Number(e.target.value)); setErrors((x) => ({ ...x, cantidad: '' })) }}
              />
              {errors.cantidad && <p className="mt-1 text-xs text-red-500">{errors.cantidad}</p>}
            </div>
            <div>
              <label className={LABEL}>Valor unitario (S/) *</label>
              <input
                className={INPUT + (errors.valor ? ' border-red-300 bg-red-50' : '')}
                type="number" min="0" step="0.01"
                value={valor_unitario}
                onChange={(e) => { setValorUnitario(Number(e.target.value)); setErrors((x) => ({ ...x, valor: '' })) }}
              />
              {errors.valor && <p className="mt-1 text-xs text-red-500">{errors.valor}</p>}
            </div>
          </div>

          {/* Preview total */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-base font-bold text-[#003D7D]">
              S/ {total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all"
          >
            {saving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Save size={14} />}
            {isEdit ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
