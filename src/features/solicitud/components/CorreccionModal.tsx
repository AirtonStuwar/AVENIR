import { useEffect, useState } from 'react'
import { X, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CategoriaCorreccion } from '../services/correccionService'

const CATEGORIAS: CategoriaCorreccion[] = ['Cuenta bancaria incorrecta', 'Nombre mal escrito', 'Archivo equivocado', 'Otro']

interface CampoOption {
  campo: string
  label: string
  valorActual: string | null
}

interface Props {
  open: boolean
  campos: CampoOption[]
  onConfirm: (campo: string, valorAnterior: string | null, valorNuevo: string, categoria: CategoriaCorreccion, motivo: string) => Promise<void>
  onCancel: () => void
}

export default function CorreccionModal({ open, campos, onConfirm, onCancel }: Props) {
  const [campoSel, setCampoSel] = useState(campos[0]?.campo ?? '')
  const [valorNuevo, setValorNuevo] = useState('')
  const [categoria, setCategoria] = useState<CategoriaCorreccion>('Cuenta bancaria incorrecta')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const primero = campos[0]
    setCampoSel(primero?.campo ?? '')
    setValorNuevo(primero?.valorActual ?? '')
    setCategoria('Cuenta bancaria incorrecta')
    setMotivo('')
  }, [open])

  if (!open) return null

  const campoActual = campos.find(c => c.campo === campoSel)

  const handleCampoChange = (campo: string) => {
    setCampoSel(campo)
    setValorNuevo(campos.find(c => c.campo === campo)?.valorActual ?? '')
  }

  const handleConfirm = async () => {
    if (!valorNuevo.trim()) { toast.error('Ingresa el valor nuevo'); return }
    setSaving(true)
    try {
      await onConfirm(campoSel, campoActual?.valorActual ?? null, valorNuevo.trim(), categoria, motivo.trim())
    } finally {
      setSaving(false)
    }
  }

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-800">Corregir dato (Administrador)</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
            Esta corrección se aplica de inmediato y queda registrada con tu usuario, fecha y motivo — visible en el historial de correcciones.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Campo a corregir</label>
            <select className={INPUT} value={campoSel} onChange={e => handleCampoChange(e.target.value)}>
              {campos.map(c => <option key={c.campo} value={c.campo}>{c.label}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Valor actual: {campoActual?.valorActual || '—'}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Valor nuevo <span className="text-red-500">*</span></label>
            <input type="text" className={INPUT} value={valorNuevo} onChange={e => setValorNuevo(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Categoría <span className="text-red-500">*</span></label>
            <select className={INPUT} value={categoria} onChange={e => setCategoria(e.target.value as CategoriaCorreccion)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Motivo adicional (opcional)</label>
            <textarea className={INPUT} rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Detalle adicional, si hace falta…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-amber-700 disabled:opacity-40 transition-all">
            {saving
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
              : 'Guardar corrección'}
          </button>
        </div>
      </div>
    </div>
  )
}
