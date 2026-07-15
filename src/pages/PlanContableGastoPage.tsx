import { useEffect, useMemo, useState } from 'react'
import { Search, X, PieChart as PieIcon, Loader2, FileText, DollarSign } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import { getGastoPorPlanContable, type GastoPlanContable } from '../features/plan-contable/services/planContableGastoService'

const fmtPEN = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUSD = (n: number) => `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function PlanContableGastoPage() {
  const { user, userRole } = useAuthStore()
  const isAdmin = userRole === ROLES.ADMIN

  const [rows,    setRows]    = useState<GastoPlanContable[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [busca,   setBusca]   = useState('')
  const [planSel, setPlanSel] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    getGastoPorPlanContable(isAdmin ? undefined : user.id)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [user?.id, isAdmin])

  const filtradas = useMemo(() => {
    let r = rows
    if (planSel) r = r.filter(x => x.plan_contable_id === planSel)
    if (busca.trim()) {
      const t = busca.trim().toLowerCase()
      r = r.filter(x =>
        (x.tipo_gasto_costo ?? '').toLowerCase().includes(t) ||
        (x.nombre_cuenta_contable ?? '').toLowerCase().includes(t) ||
        (x.codigo_starsoft ?? '').toLowerCase().includes(t) ||
        (x.partida_presupuestal ?? '').toLowerCase().includes(t)
      )
    }
    return r
  }, [rows, busca, planSel])

  const totalPEN  = filtradas.reduce((s, r) => s + r.pen, 0)
  const totalUSD  = filtradas.reduce((s, r) => s + r.usd, 0)
  const totalSols = filtradas.reduce((s, r) => s + r.cantidad, 0)
  const maxMonto  = Math.max(...rows.map(r => r.pen + r.usd), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-center text-gray-500">No se pudo cargar la información.</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-3 shadow-sm">
        <PieIcon size={20} className="text-[#003D7D]" />
        <div>
          <h1 className="text-base font-semibold text-gray-900">Gasto por Plan Contable</h1>
          <p className="text-xs text-gray-400">
            {isAdmin
              ? 'Gasto acumulado de todas las solicitudes aprobadas, agrupado por cuenta contable'
              : 'Cuánto has gastado en solicitudes aprobadas, agrupado por cuenta contable'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Buscar</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Tipo, cuenta contable, código Starsoft o partida..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plan contable</label>
              <select
                value={planSel ?? ''}
                onChange={e => setPlanSel(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all"
              >
                <option value="">Todos los planes contables</option>
                {rows.map(r => (
                  <option key={r.plan_contable_id} value={r.plan_contable_id}>
                    {[r.tipo_gasto_costo, r.nombre_cuenta_contable].filter(Boolean).join(' — ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(busca || planSel) && (
            <button
              onClick={() => { setBusca(''); setPlanSel(null) }}
              className="flex items-center gap-1.5 px-4 py-2 mt-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <X size={13} /> Limpiar
            </button>
          )}
        </div>

        {/* Totales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#003D7D] rounded-2xl px-6 py-4">
            <p className="text-xs text-white/60 uppercase tracking-wide flex items-center gap-1.5"><DollarSign size={12} /> Total S/</p>
            <p className="text-2xl font-bold text-white mt-1">{fmtPEN(totalPEN)}</p>
          </div>
          <div className="bg-teal-700 rounded-2xl px-6 py-4">
            <p className="text-xs text-white/60 uppercase tracking-wide flex items-center gap-1.5"><DollarSign size={12} /> Total $</p>
            <p className="text-2xl font-bold text-white mt-1">{fmtUSD(totalUSD)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><FileText size={12} /> Solicitudes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalSols}</p>
          </div>
        </div>

        {/* Lista */}
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <PieIcon size={36} className="text-gray-200" />
            <p className="text-sm">
              {rows.length === 0
                ? 'Aún no tienes solicitudes aprobadas con plan contable asignado.'
                : 'Sin resultados para el filtro aplicado.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map(r => {
              const total = r.pen + r.usd
              const pct = Math.round((total / maxMonto) * 100)
              return (
                <div key={r.plan_contable_id} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {r.nombre_cuenta_contable ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[r.tipo_gasto_costo, r.codigo_starsoft && `Starsoft ${r.codigo_starsoft}`, r.partida_presupuestal]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase">Solicitudes</p>
                        <p className="text-sm font-bold text-gray-800">{r.cantidad}</p>
                      </div>
                      {r.pen > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase">S/</p>
                          <p className="text-sm font-bold text-[#003D7D]">{fmtPEN(r.pen)}</p>
                        </div>
                      )}
                      {r.usd > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase">$</p>
                          <p className="text-sm font-bold text-teal-700">{fmtUSD(r.usd)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Barra relativa al plan contable con mayor gasto */}
                  <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#003D7D]" style={{ width: `${Math.max(pct, 2)}%` }} />
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
