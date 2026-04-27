import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  AlertCircle, ArrowRight, Clock, DollarSign,
  FolderOpen, TrendingUp, CheckCircle, XCircle, FileText,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getDashboardData, type DashboardData } from '../features/dashboard/services/dashboardService'
import { useSolicitudes } from '../features/solicitud/hooks/useSolicitudes'
import { ROLES } from '../features/solicitud/types/solicitud'

// ── constants ────────────────────────────────────────────────────
const ESTADO_COLOR: Record<string, string> = {
  Pendiente:     '#F59E0B',
  'En Revision': '#3B82F6',
  Evaluado:      '#8B5CF6',
  Aprobado:      '#10B981',
  Rechazado:     '#EF4444',
  Cancelado:     '#9CA3AF',
}

const ESTADO_BADGE: Record<string, string> = {
  Pendiente:     'bg-yellow-100 text-yellow-800',
  'En Revision': 'bg-blue-100 text-blue-800',
  Evaluado:      'bg-purple-100 text-purple-800',
  Aprobado:      'bg-green-100 text-green-800',
  Rechazado:     'bg-red-100 text-red-800',
  Cancelado:     'bg-gray-100 text-gray-600',
}

// ── helpers ──────────────────────────────────────────────────────
function fmtMoney(n: number) {
  if (n >= 1_000_000) return `S/ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `S/ ${(n / 1_000).toFixed(1)}K`
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 0 })
}

function fmtMoneyFull(n: number) {
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getLast6Months(): { key: string; label: string }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', ''),
    }
  })
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── main component ───────────────────────────────────────────────
export function DashboardPage() {
  const { userRole } = useAuthStore()

  if (userRole === ROLES.ADMIN || userRole === ROLES.APROBADOR) return <AdminDashboard />

  if (
    userRole === ROLES.EVALUADOR ||
    userRole === ROLES.VISUALIZADOR
  ) return <RoleDashboard />

  return (
    <div className="flex h-80 flex-col items-center justify-center gap-3 text-gray-400">
      <FolderOpen size={36} className="text-gray-200" />
      <p className="text-sm">Bienvenido al sistema AVENIR.</p>
    </div>
  )
}

// ── Role dashboard (Evaluador / Aprobador / Visualizador) ────────
function RoleDashboard() {
  const { userRole } = useAuthStore()
  const navigate     = useNavigate()
  const { data, total, loading, page, totalPages, setPage } = useSolicitudes({ pageSize: 15 })

  const cfg: Record<number, { title: string; subtitle: string; kpiLabel: string; kpiColor: string }> = {
    [ROLES.EVALUADOR]: {
      title:     'Panel Evaluador',
      subtitle:  'Solicitudes en revisión pendientes de evaluación',
      kpiLabel:  'En revisión',
      kpiColor:  'text-blue-700',
    },
    [ROLES.APROBADOR]: {
      title:     'Panel Aprobador',
      subtitle:  'Solicitudes evaluadas, aprobadas y rechazadas',
      kpiLabel:  'Solicitudes visibles',
      kpiColor:  'text-purple-700',
    },
    [ROLES.VISUALIZADOR]: {
      title:     'Panel Visualizador',
      subtitle:  'Solicitudes aprobadas',
      kpiLabel:  'Aprobadas',
      kpiColor:  'text-green-700',
    },
  }

  const c = cfg[userRole ?? 0]
  if (!c) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{c.title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{c.subtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
            Datos en tiempo real
          </div>
        </div>

        {/* KPI */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-5">
          <div className="h-14 w-14 rounded-xl bg-[#003D7D]/8 flex items-center justify-center flex-shrink-0">
            <FileText size={24} className="text-[#003D7D]" />
          </div>
          <div>
            <p className={`text-4xl font-bold tracking-tight ${c.kpiColor}`}>{loading ? '…' : total}</p>
            <p className="text-sm text-gray-500 mt-0.5">{c.kpiLabel}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Solicitudes</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#003D7D] border-t-transparent" />
            </div>
          ) : data.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-2 text-gray-400">
              <AlertCircle size={28} className="text-gray-200" />
              <p className="text-sm">Sin solicitudes disponibles</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Código', 'Proveedor', 'Proyecto', 'Fecha pedido', 'Estado', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map(s => (
                    <tr key={s.id} className="hover:bg-[#003D7D]/[0.03] cursor-pointer transition-colors"
                      onClick={() => navigate(`/solicitudes/${s.id}`)}>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md">
                          {s.codigo ?? `#${s.id}`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">{s.razon_social ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.proyecto?.nombre ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {s.fecha_pedido
                          ? new Date(s.fecha_pedido + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'medium' })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE[s.estado_soli?.tipo ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.estado_soli?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-xs font-semibold text-[#003D7D]">Revisar →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(page - 1)} disabled={page <= 1 || loading}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-40">‹</button>
                <button onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 disabled:opacity-40">›</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Admin dashboard ───────────────────────────────────────────────
function AdminDashboard() {
  const navigate = useNavigate()

  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    getDashboardData()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#003D7D] border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 text-gray-400">
        <AlertCircle size={32} className="text-red-300" />
        <p className="text-sm">No se pudo cargar el panel.</p>
      </div>
    )
  }

  // ── aggregations ─────────────────────────────────────────────
  const { solicitudes, proyectos, detalles } = data

  const porTipo = solicitudes.reduce<Record<string, number>>((acc, s) => {
    const t = s.estado_soli?.nombre ?? 'Sin estado'
    acc[t]  = (acc[t] ?? 0) + 1
    return acc
  }, {})

  const totalSolicitudes = solicitudes.length
  const pendientes       = porTipo['Pendiente'] ?? 0
  const proyActivos      = proyectos.filter(p => p.estado === 'Activo').length
  const proyInactivos    = proyectos.length - proyActivos

  const idsActivos = new Set(
    solicitudes
      .filter(s => s.estado_soli?.nombre === 'Aprobado')
      .map(s => s.id)
  )
  const montoTotal = detalles
    .filter(d => idsActivos.has(d.solicitud_id))
    .reduce((sum, d) => sum + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)

  const montoTodas = detalles.reduce((sum, d) => sum + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)

  const donutData = Object.entries(porTipo)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  const months = getLast6Months()
  const barMensual = months.map(({ key, label }) => ({
    mes:       label,
    Nuevas:    solicitudes.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === key).length,
    Aprobadas: solicitudes.filter(s => {
      if (!s.fecha_creacion) return false
      return monthKey(s.fecha_creacion) === key && s.estado_soli?.nombre === 'Aprobado'
    }).length,
  }))

  const montoByProyecto: Record<string, number> = {}
  for (const s of solicitudes) {
    const nombre = s.proyecto?.nombre ?? 'Sin proyecto'
    const monto  = detalles
      .filter(d => d.solicitud_id === s.id)
      .reduce((acc, d) => acc + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
    montoByProyecto[nombre] = (montoByProyecto[nombre] ?? 0) + monto
  }
  const barProyecto = Object.entries(montoByProyecto)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, monto]) => ({
      name:  name.length > 22 ? name.slice(0, 22) + '…' : name,
      monto,
    }))

  const proyEstados = proyectos.reduce<Record<string, number>>((acc, p) => {
    const e = p.estado ?? 'Sin estado'
    acc[e]  = (acc[e] ?? 0) + 1
    return acc
  }, {})
  const barEstadoProy = Object.entries(proyEstados).map(([estado, cantidad]) => ({ estado, cantidad }))

  const pendientesList = solicitudes.filter(s => s.estado_soli?.nombre === 'Pendiente').slice(0, 6)

  // ── render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
            Datos en tiempo real
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Pend. de aprobación"
            value={pendientes}
            sub={`de ${totalSolicitudes} solicitudes`}
            icon={<Clock size={18} />}
            color="amber"
            alert={pendientes > 0}
            onClick={() => navigate('/solicitudes')}
          />
          <KpiCard
            label="Solicitudes este mes"
            value={barMensual[barMensual.length - 1]?.Nuevas ?? 0}
            sub="en el mes actual"
            icon={<TrendingUp size={18} />}
            color="blue"
          />
          <KpiCard
            label="Proyectos activos"
            value={proyActivos}
            sub={`${proyInactivos} inactivos`}
            icon={<FolderOpen size={18} />}
            color="green"
            onClick={() => navigate('/proyectos')}
          />
          <KpiCard
            label="Monto aprobado"
            value={fmtMoney(montoTotal)}
            sub={`${fmtMoney(montoTodas)} potencial total`}
            icon={<DollarSign size={18} />}
            color="indigo"
          />
        </div>

        {/* ── Charts row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <ChartCard title="Distribución por estado" subtitle="Todas las solicitudes">
            {donutData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="42%" cy="50%"
                    innerRadius={58} outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={ESTADO_COLOR[entry.name] ?? '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }}
                    formatter={(v, name) => [`${v} solicitudes`, name as string]}
                  />
                  <Legend
                    layout="vertical" align="right" verticalAlign="middle"
                    iconType="circle" iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Solicitudes por mes" subtitle="Últimos 6 meses">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barMensual} barSize={14} barGap={2}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }}
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>} />
                <Bar dataKey="Nuevas"    fill="#003D7D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Aprobadas" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Charts row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="lg:col-span-2">
            <ChartCard title="Monto por proyecto" subtitle="Top 5 — solicitudes aprobadas">
              {barProyecto.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barProyecto} layout="vertical" barSize={16} margin={{ left: 8, right: 20 }}>
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}K`}
                    />
                    <YAxis
                      type="category" dataKey="name" width={130}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }}
                      cursor={{ fill: '#F9FAFB' }}
                      formatter={(v) => [fmtMoneyFull(Number(v)), 'Monto']}
                    />
                    <Bar dataKey="monto" fill="#F65740" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ChartCard title="Estado de proyectos" subtitle={`${proyectos.length} proyectos registrados`}>
            {barEstadoProy.length === 0 ? <EmptyChart /> : (
              <div className="flex flex-col gap-3 pt-2">
                {barEstadoProy.map(({ estado, cantidad }) => {
                  const pct = Math.round((cantidad / proyectos.length) * 100)
                  const isActivo = estado === 'Activo'
                  return (
                    <div key={estado}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {isActivo
                            ? <CheckCircle size={13} className="text-green-500" />
                            : <XCircle    size={13} className="text-gray-400"  />
                          }
                          <span className="text-xs font-medium text-gray-700">{estado}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-900">{cantidad}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isActivo ? 'bg-green-500' : 'bg-gray-300'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-right text-xs text-gray-400 mt-0.5">{pct}%</p>
                    </div>
                  )
                })}

                {proyectos.some(p => p.presupuesto) && (
                  <div className="mt-2 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Presupuesto total</p>
                    <p className="text-base font-bold text-[#003D7D]">
                      {fmtMoneyFull(proyectos.reduce((s, p) => s + (p.presupuesto ?? 0), 0))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── Pendientes table ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
                Pendientes de aprobación
              </h2>
              {pendientes > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  {pendientes}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/solicitudes')}
              className="flex items-center gap-1 text-xs text-[#003D7D] hover:underline font-medium"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>

          {pendientesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2 text-gray-400">
              <CheckCircle size={28} className="text-green-300" />
              <p className="text-sm">Sin solicitudes pendientes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Código', 'Proveedor', 'Proyecto', 'Fecha pedido'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {pendientesList.map(s => (
                    <tr
                      key={s.id}
                      className="hover:bg-amber-50/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/solicitudes/${s.id}`)}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#003D7D]">
                        {s.codigo ?? `#${s.id}`}
                      </td>
                      <td className="px-5 py-3.5 text-gray-900 font-medium">
                        {s.razon_social ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {s.proyecto?.nombre ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {s.fecha_pedido
                          ? new Date(s.fecha_pedido + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'medium' })
                          : '—'
                        }
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-xs font-semibold text-[#003D7D] hover:underline">
                          Revisar →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── sub-components ───────────────────────────────────────────────

type KpiColor = 'amber' | 'blue' | 'green' | 'indigo'

const KPI_STYLES: Record<KpiColor, { icon: string; val: string; border: string }> = {
  amber:  { icon: 'bg-amber-100 text-amber-600',   val: 'text-amber-700',   border: 'border-amber-100'  },
  blue:   { icon: 'bg-blue-100 text-blue-600',     val: 'text-[#003D7D]',   border: 'border-blue-100'   },
  green:  { icon: 'bg-green-100 text-green-600',   val: 'text-green-700',   border: 'border-green-100'  },
  indigo: { icon: 'bg-indigo-100 text-indigo-600', val: 'text-indigo-700',  border: 'border-indigo-100' },
}

function KpiCard({
  label, value, sub, icon, color, alert, onClick,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: KpiColor
  alert?: boolean
  onClick?: () => void
}) {
  const s = KPI_STYLES[color]
  return (
    <div
      className={`relative bg-white rounded-2xl border ${s.border} shadow-sm p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      {alert && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
      )}
      <div className={`inline-flex items-center justify-center rounded-xl p-2.5 mb-3 ${s.icon}`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${s.val}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-700 mt-0.5 leading-snug">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartCard({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-300">
      <AlertCircle size={26} />
      <p className="text-xs">Sin datos suficientes</p>
    </div>
  )
}
