import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Star, ThumbsUp, ThumbsDown, RefreshCw, Search, CreditCard } from 'lucide-react'
import { getProveedoresConMetricas } from '../features/proveedor/services/proveedorService'
import type { ProveedorConMetricas } from '../features/proveedor/types/proveedor'
import { useAuthStore } from '../store/authStore'
import ProveedorCuentasPanel from '../features/proveedor/components/ProveedorCuentasPanel'

function StarDisplay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-300">Sin evaluar</span>
  const full  = Math.floor(value)
  const color = value >= 4 ? 'text-teal-500' : value >= 3 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-1">
      <span className={`text-base font-bold ${color}`}>{value.toFixed(1)}</span>
      <div className="flex">
        {[1,2,3,4,5].map(n => (
          <Star key={n} size={12}
            className={n <= full ? `fill-amber-400 text-amber-400` : 'fill-transparent text-gray-200'}
          />
        ))}
      </div>
    </div>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(d))
  } catch {
    return 'Fecha inválida'
  }
}

export default function ProveedoresPage() {
  const navigate  = useNavigate()
  const userRole  = useAuthStore(s => s.userRole)
  const isAdmin   = userRole === 1
  const [data,    setData]    = useState<ProveedorConMetricas[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [cuentasProveedor, setCuentasProveedor] = useState<ProveedorConMetricas | null>(null)

  const load = async () => {
    setLoading(true)
    try { setData(await getProveedoresConMetricas()) }
    catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = data.filter(p =>
    !search ||
    p.razon_social?.toLowerCase().includes(search.toLowerCase()) ||
    p.ruc.includes(search)
  )

  // KPIs globales
  const evaluados    = data.filter(p => p.total_encuestas > 0)
  const promedioGral = evaluados.length
    ? +(evaluados.reduce((s, p) => s + (p.promedio_general ?? 0), 0) / evaluados.length).toFixed(1)
    : null
  const pctRecom     = evaluados.length
    ? Math.round(evaluados.reduce((s, p) => s + (p.pct_recomendaria ?? 0), 0) / evaluados.length)
    : null
  const alertas      = evaluados.filter(p => (p.promedio_general ?? 5) < 3).length

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#003D7D]">Proveedores</h1>
          <p className="text-sm text-gray-400">{data.length} proveedores registrados</p>
        </div>
        <button onClick={load} disabled={loading}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total proveedores', value: data.length, icon: Users, color: 'bg-blue-50 text-[#003D7D]' },
          { label: 'Promedio general', value: promedioGral ? `${promedioGral} ★` : '—', icon: Star, color: 'bg-amber-50 text-amber-600' },
          { label: '% Recomendarían', value: pctRecom !== null ? `${pctRecom}%` : '—', icon: ThumbsUp, color: 'bg-teal-50 text-teal-600' },
          { label: 'Alertas (< 3★)', value: alertas, icon: ThumbsDown, color: 'bg-red-50 text-red-500' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${k.color}`}>
              <k.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{k.label}</p>
              <p className="text-lg font-bold text-gray-800">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por RUC o razón social…"
              className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20"
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} resultados</span>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <RefreshCw size={24} className="animate-spin text-[#003D7D]/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
            <Users size={32} className="text-gray-200" />
            <p className="text-sm">No hay proveedores registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
                  {['RUC', 'Razón social', 'Solicitudes', 'Evaluaciones', 'Puntuación', '% Recomendado', 'Última solicitud'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                  {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-[#003D7D]/60 uppercase tracking-wide">Cuentas</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.ruc}
                    onClick={() => navigate(`/solicitudes?ruc=${p.ruc}`)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-[#003D7D]/[0.03]
                      ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md">{p.ruc}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-medium text-gray-900 truncate">{p.razon_social ?? '—'}</p>
                      {p.estado_sunat && (
                        <span className={`text-[10px] font-medium ${p.estado_sunat === 'ACTIVO' ? 'text-teal-500' : 'text-red-400'}`}>
                          {p.estado_sunat}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-gray-700">{p.total_solicitudes}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.total_encuestas > 0
                        ? <span className="text-sm font-semibold text-gray-700">{p.total_encuestas}</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <StarDisplay value={p.promedio_general} />
                    </td>
                    <td className="px-4 py-3">
                      {p.pct_recomendaria !== null
                        ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden max-w-[60px]">
                              <div
                                className={`h-full rounded-full ${p.pct_recomendaria >= 70 ? 'bg-teal-400' : p.pct_recomendaria >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${p.pct_recomendaria}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{p.pct_recomendaria}%</span>
                          </div>
                        )
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(p.ultima_solicitud)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); setCuentasProveedor(p) }}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#003D7D]/10 text-[#003D7D]/50 hover:text-[#003D7D] transition-colors"
                          title="Gestionar cuentas bancarias"
                        >
                          <CreditCard size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cuentasProveedor && (
        <ProveedorCuentasPanel
          ruc={cuentasProveedor.ruc}
          razonSocial={cuentasProveedor.razon_social}
          onClose={() => setCuentasProveedor(null)}
        />
      )}
    </div>
  )
}
