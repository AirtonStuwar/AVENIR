import { useEffect, useState } from 'react'
import { X, XCircle, RotateCcw } from 'lucide-react'

interface Props {
  open: boolean
  codigo: string | null
  onClose: () => void
  onConfirm: (comentario: string) => Promise<void>
  title?: string
  description?: string
  placeholder?: string
  confirmLabel?: string
  variant?: 'red' | 'amber'
}

export default function RechazoModal({
  open, codigo, onClose, onConfirm,
  title        = 'Rechazar solicitud',
  description,
  placeholder  = 'Describe el motivo…',
  confirmLabel = 'Confirmar',
  variant      = 'red',
}: Props) {
  const [comentario, setComentario] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (open) { setComentario(''); setError('') }
  }, [open])

  const handleConfirm = async () => {
    if (!comentario.trim()) { setError('El motivo es requerido'); return }
    setSaving(true)
    try { await onConfirm(comentario); onClose() }
    finally { setSaving(false) }
  }

  if (!open) return null

  const isRed   = variant === 'red'
  const hdrCls  = isRed ? 'bg-red-600'   : 'bg-amber-500'
  const ringCls = isRed ? 'focus:ring-red-200 focus:border-red-300'   : 'focus:ring-amber-200 focus:border-amber-300'
  const btnCls  = isRed ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
  const barCls  = isRed ? 'from-red-400 via-red-300'    : 'from-amber-400 via-amber-300'
  const Icon    = isRed ? XCircle : RotateCcw

  const defaultDesc = isRed
    ? `Estás rechazando la solicitud <b>${codigo ?? 'seleccionada'}</b>. Indica el motivo.`
    : `Devuelves la solicitud <b>${codigo ?? 'seleccionada'}</b> al usuario. Indica el motivo.`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className={`flex items-center justify-between px-6 py-4 ${hdrCls}`}>
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-white" />
            <h2 className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className={`h-0.5 bg-gradient-to-r ${barCls} to-transparent`} />

        <div className="px-6 py-5 space-y-4">
          <p
            className="text-sm text-gray-600"
            dangerouslySetInnerHTML={{ __html: description ?? defaultDesc }}
          />
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Motivo / comentario *
            </label>
            <textarea
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 transition-all ${
                error
                  ? 'border-red-300 bg-red-50 focus:ring-red-200'
                  : `border-gray-200 bg-gray-50 ${ringCls} focus:bg-white`
              }`}
              rows={4}
              placeholder={placeholder}
              autoFocus
              value={comentario}
              onChange={(e) => { setComentario(e.target.value); setError('') }}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className={`px-4 py-2 rounded-xl text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-all ${btnCls}`}>
            {saving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Icon size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
