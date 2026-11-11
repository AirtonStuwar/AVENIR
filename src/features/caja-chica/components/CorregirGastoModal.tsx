import { useEffect, useState } from 'react'
import { X, FilePen } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDocumentoDuplicado } from '../../solicitud/services/documentoDuplicadoService'
import AlertaDocumentoDuplicado from '../../solicitud/components/AlertaDocumentoDuplicado'

export interface GastoACorregir {
  id: number
  proveedor: string
  tipo_documento: string
  numero_documento: string | null
  monto: number
}

interface Props {
  gasto: GastoACorregir | null
  tipos: string[]
  codigoCaja?: string | null
  onConfirm: (tipo: string, numero: string, motivo: string) => Promise<void>
  onCancel: () => void
}

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'

/** Corrige SOLO el tipo y el N° de documento de un gasto ya registrado (monto, fecha y proveedor no se tocan). */
export default function CorregirGastoModal({ gasto, tipos, codigoCaja, onConfirm, onCancel }: Props) {
  const [tipo, setTipo] = useState('FACTURA')
  const [numero, setNumero] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!gasto) return
    setTipo(gasto.tipo_documento)
    setNumero(gasto.numero_documento ?? '')
    setMotivo('')
  }, [gasto?.id])

  const duplicados = useDocumentoDuplicado(gasto ? numero : '', 'caja_chica', gasto?.id ?? null, codigoCaja, gasto?.proveedor)

  if (!gasto) return null

  const sinCambios = tipo === gasto.tipo_documento && numero.trim() === (gasto.numero_documento ?? '').trim()

  const handleConfirm = async () => {
    if (sinCambios) { toast.error('No hay cambios que guardar'); return }
    if (motivo.trim().length < 3) { toast.error('Indica el motivo de la corrección'); return }
    setSaving(true)
    try {
      await onConfirm(tipo, numero.trim(), motivo.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FilePen size={16} className="text-[#003D7D]" />
            <h2 className="text-sm font-semibold text-gray-800">Corregir documento del gasto</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5 text-xs text-gray-600">
            <p className="font-semibold text-gray-800 truncate">{gasto.proveedor}</p>
            <p>Hoy figura como <span className="font-semibold">{gasto.tipo_documento} {gasto.numero_documento || 's/n'}</span> · S/ {gasto.monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
            Solo cambia el tipo y el número del documento; el monto no se modifica. El cambio queda registrado con tu nombre, la fecha y el motivo.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de documento</label>
              <select className={INPUT} value={tipo} onChange={e => setTipo(e.target.value)}>
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">N° de documento</label>
              <input className={INPUT} value={numero} onChange={e => setNumero(e.target.value)} />
            </div>
          </div>
          <AlertaDocumentoDuplicado duplicados={duplicados} />

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Motivo <span className="text-red-500">*</span></label>
            <textarea className={INPUT} rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej. Llegó la factura del proveedor" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving || sinCambios}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#002D5C] disabled:opacity-40 transition-all">
            {saving
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
              : 'Guardar corrección'}
          </button>
        </div>
      </div>
    </div>
  )
}
