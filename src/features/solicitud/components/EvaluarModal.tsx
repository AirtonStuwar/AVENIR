import { useEffect, useRef, useState } from 'react'
import { X, Search, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPlanContable } from '../services/solicitudService'
import type { PlanContable } from '../types/solicitud'

interface Props {
  open: boolean
  codigoSolicitud: string
  onConfirm: (planContableId: number) => Promise<void>
  onCancel: () => void
}

export default function EvaluarModal({ open, codigoSolicitud, onConfirm, onCancel }: Props) {
  const [opciones,   setOpciones]   = useState<PlanContable[]>([])
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<PlanContable | null>(null)
  const [dropOpen,   setDropOpen]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef    = useRef<HTMLInputElement>(null)

  // Cargar opciones al abrir
  useEffect(() => {
    if (!open) return
    setSelected(null)
    setSearch('')
    setDropOpen(false)
    setLoading(true)
    getPlanContable()
      .then(setOpciones)
      .catch(() => toast.error('Error al cargar el plan contable'))
      .finally(() => setLoading(false))
  }, [open])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!open) return null

  const q = search.trim().toLowerCase()
  const filtradas = opciones.filter(o =>
    !q
    || (o.tipo_gasto_costo      ?? '').toLowerCase().includes(q)
    || (o.nombre_cuenta_contable ?? '').toLowerCase().includes(q)
    || (o.codigo_starsoft        ?? '').toLowerCase().includes(q)
  )

  const handleSelect = (op: PlanContable) => {
    setSelected(op)
    setSearch(op.tipo_gasto_costo ?? '')
    setDropOpen(false)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await onConfirm(selected.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Marcar como Evaluada</h2>
            <p className="text-xs text-gray-400 mt-0.5">{codigoSolicitud}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={`px-6 py-5 space-y-4 ${dropOpen ? 'pb-64' : ''}`}>
          <p className="text-sm text-gray-600">
            Selecciona la partida del <span className="font-semibold text-gray-800">Plan Contable</span> que
            corresponde a esta solicitud. Este campo es obligatorio para continuar.
          </p>

          {/* Combobox buscable */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Tipo de gasto / costo <span className="text-red-500">*</span>
            </label>

            <div ref={containerRef} className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelected(null); setDropOpen(true) }}
                  onFocus={() => setDropOpen(true)}
                  placeholder={loading ? 'Cargando…' : 'Buscar tipo de gasto…'}
                  disabled={loading}
                  className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50
                    focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white
                    disabled:opacity-50 transition-all"
                />
              </div>

              {dropOpen && filtradas.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg
                  max-h-52 overflow-y-auto divide-y divide-gray-50">
                  {filtradas.map(op => (
                    <li
                      key={op.id}
                      onMouseDown={() => handleSelect(op)}
                      className="px-4 py-2.5 cursor-pointer hover:bg-[#003D7D]/5 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 leading-snug">{op.tipo_gasto_costo}</p>
                      {op.codigo_starsoft && (
                        <p className="text-xs text-gray-400 mt-0.5">{op.codigo_starsoft}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {dropOpen && !loading && filtradas.length === 0 && q && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
                  <p className="text-sm text-gray-400 italic">Sin resultados para "{q}"</p>
                </div>
              )}
            </div>

            {/* Selección confirmada */}
            {selected && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-green-800 truncate">{selected.tipo_gasto_costo}</p>
                  {selected.codigo_starsoft && (
                    <p className="text-xs text-green-600">{selected.codigo_starsoft}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium
              hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || saving}
            className="px-4 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2
              hover:bg-[#002D5C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
              : 'Marcar evaluado'}
          </button>
        </div>
      </div>
    </div>
  )
}
