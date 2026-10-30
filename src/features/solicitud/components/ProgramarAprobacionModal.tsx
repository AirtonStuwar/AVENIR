import { useEffect, useState } from 'react'
import { X, CalendarClock } from 'lucide-react'
import { mesSiguienteISO, etiquetaMes } from '../utils/programacion'

interface Props {
  open: boolean
  codigo: string | null
  /** Mes ya programado (YYYY-MM-DD), si la solicitud ya estaba programada */
  actual?: string | null
  motivoActual?: string | null
  onClose: () => void
  /** `mes` llega como YYYY-MM-01 */
  onConfirm: (mes: string, motivo: string) => Promise<void>
}

export default function ProgramarAprobacionModal({ open, codigo, actual, motivoActual, onClose, onConfirm }: Props) {
  const minMes = mesSiguienteISO()
  const [mes, setMes] = useState(minMes)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMes(actual ? actual.slice(0, 7) : minMes)
    setMotivo(motivoActual ?? '')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const handleConfirm = async () => {
    if (!mes || mes < minMes) { setError(`Elige ${etiquetaMes(minMes + '-01')} o un mes posterior`); return }
    setSaving(true)
    try { await onConfirm(`${mes}-01`, motivo); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#003D7D]">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-white" />
            <h2 className="text-base font-semibold text-white">{actual ? 'Reprogramar aprobación' : 'Programar aprobación'}</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            La solicitud <b>{codigo ?? 'seleccionada'}</b> seguirá <b>Evaluada</b>, pero se irá al final de tu lista y volverá sola a tu cola de aprobación cuando llegue el mes que elijas. No se rechaza ni se cancela.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Aprobar desde el mes *
            </label>
            <input type="month" min={minMes} value={mes}
              onChange={(e) => { setMes(e.target.value); setError('') }}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                error ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-gray-200 bg-gray-50 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white'
              }`} />
            {error
              ? <p className="mt-1 text-xs text-red-500">{error}</p>
              : mes && <p className="mt-1 text-xs text-gray-400">Volverá a tu cola el 1 de {etiquetaMes(mes + '-01')}.</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Motivo (opcional)
            </label>
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Se paga cuando se dé el desembolso"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all" />
            <p className="mt-1 text-xs text-gray-400">Lo verán quienes abran la solicitud y queda en la Bitácora.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-50 transition-all">
            {saving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <CalendarClock size={14} />}
            {actual ? 'Reprogramar' : 'Programar'}
          </button>
        </div>
      </div>
    </div>
  )
}
