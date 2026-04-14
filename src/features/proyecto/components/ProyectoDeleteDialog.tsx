import { useState } from 'react'
import { AlertTriangle, X, Trash2 } from 'lucide-react'
import type { Proyecto } from '../types/proyecto'

interface Props {
  open: boolean
  proyecto: Proyecto | null
  onClose: () => void
  onConfirm: (id: number) => Promise<boolean>
}

export default function ProyectoDeleteDialog({ open, proyecto, onClose, onConfirm }: Props) {
  const [loading, setLoading] = useState(false)

  if (!open || !proyecto) return null

  const handleConfirm = async () => {
    setLoading(true)
    const ok = await onConfirm(proyecto.id)
    setLoading(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#003D7D]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_.4s_cubic-bezier(.16,1,.3,1)_both]">
        <div className="h-1 bg-[#F65740]" />

        <div className="p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F65740]/10 mb-4">
            <AlertTriangle size={22} className="text-[#F65740]" />
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Eliminar proyecto</h3>
              <p className="text-sm text-gray-500 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 -mt-1 -mr-1">
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Proyecto a eliminar</p>
            <p className="font-semibold text-gray-900 text-sm">{proyecto.nombre}</p>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{proyecto.codigo}</p>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all">
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl bg-[#F65740] text-white text-sm font-medium
                         flex items-center justify-center gap-2 hover:bg-[#D94432] disabled:opacity-50 transition-all">
              {loading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Trash2 size={15} />}
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}