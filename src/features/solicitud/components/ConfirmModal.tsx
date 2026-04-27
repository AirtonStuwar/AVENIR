import { X } from 'lucide-react'

interface Props {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  variant?: 'red' | 'blue'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open, title = 'Confirmar acción', message, confirmLabel = 'Confirmar', variant = 'blue', onConfirm, onCancel,
}: Props) {
  if (!open) return null

  const btnCls = variant === 'red'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-[#003D7D] hover:bg-[#002D5C]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <button onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-all ${btnCls}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
