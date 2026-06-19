import { useEffect, useState } from 'react'
import { Building2, RefreshCw, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { getConsumoByAreas } from '../features/area/services/areaConsumoService'
import type { AreaConsumo } from '../features/area/services/areaConsumoService'

const fmt = (n: number) => n === 0 ? '—' : `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
const fmtUSD = (n: number) => n === 0 ? '—' : `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const MODULOS = [
  { key: 'oc', label: 'OC', color: 'bg-blue-500' },
  { key: 'rxh', label: 'RxH', color: 'bg-green-500' },
  { key: 'arendir', label: 'A Rendir', color: 'bg-amber-500' },
  { key: 'reembolso', label: 'Reembolso', color: 'bg-pink-500' },
] as const

export default function AreasConsumoPage() {
  const [areas, setAreas] = useState<AreaConsumo[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getConsumoByAreas()
      .then(setAreas)
      .catch(() => toast.error('Error al cargar datos de áreas'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const grandTotalPen = areas.reduce((s, a) => s + a.total_pen, 0)
  const grandTotalUsd = areas.reduce((s, a) => s + a.total_usd, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-3 shadow-sm">
        <Building2 size={20} className="text-[#003D7D]" />
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">Gasto por Área</h1>
          <p className="text-xs text-gray-400">Consolidado de OC, RxH, A Rendir y Reembolso aprobados/autorizados</p>
        </div>
        <button onClick={load} disabled={loading}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Totals bar */}
        {areas.length > 0 && (
          <div className="bg-[#003D7D] rounded-2xl px-6 py-4 flex flex-wrap gap-8">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">Total áreas</p>
              <p className="text-xl font-bold text-white">{areas.length}</p>
            </div>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">Total gasto S/.</p>
              <p className="text-xl font-bold text-white">{fmt(grandTotalPen)}</p>
            </div>
            {grandTotalUsd > 0 && (
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide">Total gasto $</p>
                <p className="text-xl font-bold text-white">{fmtUSD(grandTotalUsd)}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <RefreshCw size={28} className="animate-spin text-[#003D7D]/30" />
            <p className="text-sm">Cargando datos de áreas…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && areas.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <TrendingUp size={36} className="text-gray-200" />
            <p className="text-sm">No hay datos de gasto por área.</p>
          </div>
        )}

        {/* Area cards */}
        {!loading && areas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {areas.map(a => {
              const maxPen = Math.max(...areas.map(x => x.total_pen), 1)
              const pctBar = (a.total_pen / maxPen) * 100
              return (
                <div key={a.area_id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Area header */}
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#003D7D]/10 flex items-center justify-center">
                        <Building2 size={15} className="text-[#003D7D]" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800">{a.area_nombre}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#003D7D]">{fmt(a.total_pen)}</p>
                      {a.total_usd > 0 && <p className="text-xs text-gray-500">{fmtUSD(a.total_usd)}</p>}
                    </div>
                  </div>

                  {/* Progress bar (relative to highest area) */}
                  <div className="px-5 pt-3">
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#003D7D] rounded-full transition-all" style={{ width: `${pctBar}%` }} />
                    </div>
                  </div>

                  {/* Module breakdown */}
                  <div className="px-5 py-3 grid grid-cols-4 gap-2">
                    {MODULOS.map(m => {
                      const pen = a[`${m.key}_pen` as keyof AreaConsumo] as number
                      const usd = a[`${m.key}_usd` as keyof AreaConsumo] as number
                      return (
                        <div key={m.key} className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${m.color}`} />
                            <span className="text-[10px] text-gray-500 font-medium">{m.label}</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800">
                            {pen > 0 ? `S/ ${pen.toLocaleString('es-PE', { maximumFractionDigits: 0 })}` : '—'}
                          </p>
                          {usd > 0 && (
                            <p className="text-[10px] text-gray-400">
                              $ {usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
