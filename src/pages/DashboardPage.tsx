import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  AlertCircle, ArrowRight, Clock, DollarSign,
  FolderOpen, TrendingUp, CheckCircle, XCircle,
  FileText, Send, RotateCcw, ThumbsUp, Plus,
  Hourglass, Receipt, Star, Users, ThumbsDown,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  getDashboardData, getAprobadorData, getEvaluadorData, getVisualizadorData, getUsuarioData,
  getProveedorMetricas,
  type DashboardData, type AprobadorData, type EvaluadorData,
  type VisualizadorData, type UsuarioData, type SolicitudRow,
  type ProveedorMetricasData,
} from '../features/dashboard/services/dashboardService'
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

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthKey() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysBetween(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function montoSolicitudes(sols: SolicitudRow[], detalles: { solicitud_id: number; valor_total: number | null; cantidad: number; valor_unitario: number }[]) {
  const ids = new Set(sols.map(s => s.id))
  return detalles.filter(d => ids.has(d.solicitud_id)).reduce((sum, d) => sum + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
}

// ── main component ───────────────────────────────────────────────
export function DashboardPage() {
  const { userRole } = useAuthStore()

  if (userRole === ROLES.ADMIN)        return <AdminDashboard />
  if (userRole === ROLES.APROBADOR)   return <AprobadorDashboard />
  if (userRole === ROLES.EVALUADOR)   return <EvaluadorDashboard />
  if (userRole === ROLES.VISUALIZADOR) return <VisualizadorDashboard />
  if (userRole === ROLES.USUARIO)      return <UsuarioDashboard />

  return (
    <div className="flex h-80 flex-col items-center justify-center gap-3 text-gray-400">
      <FolderOpen size={36} className="text-gray-200" />
      <p className="text-sm">Bienvenido al sistema AVENIR.</p>
    </div>
  )
}

// ── ADMIN ────────────────────────────────────────────────────────
function AdminDashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    getDashboardData().then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState />

  const { solicitudes, proyectos, detalles } = data

  const porEstado = solicitudes.reduce<Record<string, number>>((acc, s) => {
    const t = s.estado_soli?.nombre ?? 'Sin estado'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  const pendientes  = porEstado['Pendiente'] ?? 0
  const proyActivos = proyectos.filter(p => p.estado === 'Activo').length
  const montoAprobado = montoSolicitudes(
    solicitudes.filter(s => s.estado_soli?.nombre === 'Aprobado'),
    detalles,
  )
  const montoTotal = montoSolicitudes(solicitudes, detalles)

  const donutData = Object.entries(porEstado).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

  const months = getLast6Months()
  const barMensual = months.map(({ key, label }) => ({
    mes:       label,
    Nuevas:    solicitudes.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === key).length,
    Aprobadas: solicitudes.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === key && s.estado_soli?.nombre === 'Aprobado').length,
  }))

  const montoByProyecto: Record<string, number> = {}
  for (const s of solicitudes) {
    const nombre = s.proyecto?.nombre ?? 'Sin proyecto'
    const monto = detalles.filter(d => d.solicitud_id === s.id).reduce((acc, d) => acc + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
    montoByProyecto[nombre] = (montoByProyecto[nombre] ?? 0) + monto
  }
  const barProyecto = Object.entries(montoByProyecto).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, monto]) => ({
    name: name.length > 22 ? name.slice(0, 22) + '…' : name,
    monto,
  }))

  const proyEstados = proyectos.reduce<Record<string, number>>((acc, p) => {
    const e = p.estado ?? 'Sin estado'; acc[e] = (acc[e] ?? 0) + 1; return acc
  }, {})
  const barEstadoProy = Object.entries(proyEstados).map(([estado, cantidad]) => ({ estado, cantidad }))
  const pendientesList = solicitudes.filter(s => s.estado_soli?.nombre === 'Pendiente').slice(0, 6)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <DashHeader title="Panel de Administración" subtitle={new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Pend. de aprobación" value={pendientes} sub={`de ${solicitudes.length} solicitudes`} icon={<Clock size={18} />} color="amber" alert={pendientes > 0} onClick={() => navigate('/solicitudes')} />
          <KpiCard label="Solicitudes este mes" value={barMensual[barMensual.length - 1]?.Nuevas ?? 0} sub="en el mes actual" icon={<TrendingUp size={18} />} color="blue" />
          <KpiCard label="Proyectos activos" value={proyActivos} sub={`${proyectos.length - proyActivos} inactivos`} icon={<FolderOpen size={18} />} color="green" onClick={() => navigate('/proyectos')} />
          <KpiCard label="Monto aprobado" value={fmtMoney(montoAprobado)} sub={`${fmtMoney(montoTotal)} potencial`} icon={<DollarSign size={18} />} color="indigo" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Distribución por estado" subtitle="Todas las solicitudes">
            {donutData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} cx="42%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">
                    {donutData.map((e, i) => <Cell key={i} fill={ESTADO_COLOR[e.name] ?? '#94A3B8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, name) => [`${v} solicitudes`, name as string]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Solicitudes por mes" subtitle="Últimos 6 meses">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barMensual} barSize={14} barGap={2}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} cursor={{ fill: '#F9FAFB' }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>} />
                <Bar dataKey="Nuevas"    fill="#003D7D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Aprobadas" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ChartCard title="Monto por proyecto" subtitle="Top 5 — solicitudes aprobadas">
              {barProyecto.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barProyecto} layout="vertical" barSize={16} margin={{ left: 8, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}K`} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} cursor={{ fill: '#F9FAFB' }} formatter={(v) => [fmtMoneyFull(Number(v)), 'Monto']} />
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
                          {isActivo ? <CheckCircle size={13} className="text-green-500" /> : <XCircle size={13} className="text-gray-400" />}
                          <span className="text-xs font-medium text-gray-700">{estado}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-900">{cantidad}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${isActivo ? 'bg-green-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-right text-xs text-gray-400 mt-0.5">{pct}%</p>
                    </div>
                  )
                })}
                {proyectos.some(p => p.presupuesto) && (
                  <div className="mt-2 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Presupuesto total</p>
                    <p className="text-base font-bold text-[#003D7D]">{fmtMoneyFull(proyectos.reduce((s, p) => s + (p.presupuesto ?? 0), 0))}</p>
                  </div>
                )}
              </div>
            )}
          </ChartCard>
        </div>

        <SolicitudTable title="Pendientes de aprobación" rows={pendientesList} badge count={pendientes} onVerTodas={() => navigate('/solicitudes')} onView={(s) => navigate(`/solicitudes/${s.id}`)} />

        <ProveedorMetricasPanel />
      </div>
    </div>
  )
}

// ── APROBADOR ────────────────────────────────────────────────────
function AprobadorDashboard() {
  const navigate = useNavigate()
  const [data,           setData]           = useState<AprobadorData | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(false)
  const [proyectoFilter, setProyectoFilter] = useState<number | null>(null)

  useEffect(() => {
    getAprobadorData().then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState />

  const { enCola, aprobadas, rechazadas, proyectos, detalles } = data

  const applyFilter = <T extends SolicitudRow>(list: T[]) =>
    proyectoFilter ? list.filter(s => s.proyecto_id === proyectoFilter) : list

  const colaFiltrada      = applyFilter(enCola)
  const aprobadasFiltradas = applyFilter(aprobadas)
  const rechazadasFiltradas = applyFilter(rechazadas)

  const montoCola      = montoSolicitudes(colaFiltrada, detalles)
  const montoAprobado  = montoSolicitudes(aprobadasFiltradas, detalles)
  const cmk            = currentMonthKey()
  const pmk            = prevMonthKey()
  const aprobMes       = aprobadasFiltradas.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === cmk).length
  const aprobMesAnterior = aprobadasFiltradas.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === pmk).length

  const donutData = [
    { name: 'Aprobadas', value: aprobadasFiltradas.length },
    { name: 'Rechazadas', value: rechazadasFiltradas.length },
    { name: 'En cola', value: colaFiltrada.length },
  ].filter(d => d.value > 0)

  const donutColors = ['#10B981', '#EF4444', '#8B5CF6']

  const recientes = [...aprobadasFiltradas, ...rechazadasFiltradas]
    .sort((a, b) => new Date(b.fecha_creacion ?? '').getTime() - new Date(a.fecha_creacion ?? '').getTime())
    .slice(0, 6)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-end justify-between">
          <DashHeader title="Panel Gerencia" subtitle="Resumen de aprobaciones y solicitudes en cola" />
          <select
            value={proyectoFilter ?? ''}
            onChange={e => setProyectoFilter(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 shadow-sm"
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="En cola de aprobación" value={colaFiltrada.length} sub="esperando tu decisión" icon={<Hourglass size={18} />} color="amber" alert={colaFiltrada.length > 0} onClick={() => navigate('/solicitudes')} />
          <KpiCard label="Monto en cola" value={fmtMoney(montoCola)} sub="pendiente de aprobación" icon={<DollarSign size={18} />} color="indigo" />
          <KpiCard label="Aprobadas este mes" value={aprobMes} sub={`${aprobMesAnterior} el mes anterior`} icon={<ThumbsUp size={18} />} color="green" />
          <KpiCard label="Monto aprobado total" value={fmtMoney(montoAprobado)} sub={`${rechazadasFiltradas.length} rechazadas`} icon={<TrendingUp size={18} />} color="blue" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Distribución de solicitudes" subtitle="Aprobadas vs rechazadas vs en cola">
            {donutData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} cx="42%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">
                    {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, name) => [`${v} solicitudes`, name as string]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Cola de aprobación" subtitle="Solicitudes evaluadas esperando decisión">
            {colaFiltrada.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-300">
                <CheckCircle size={26} className="text-green-300" />
                <p className="text-xs">Sin solicitudes en cola</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-50 max-h-[220px] overflow-y-auto">
                {colaFiltrada.slice(0, 6).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-gray-50 px-1 rounded-lg" onClick={() => navigate(`/solicitudes/${s.id}`)}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-semibold text-[#003D7D]">{s.codigo ?? `#${s.id}`}</span>
                      <span className="text-xs text-gray-500 truncate max-w-[180px]">{s.razon_social ?? '—'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-gray-400">{s.proyecto?.nombre ?? '—'}</span>
                      <span className="text-xs text-amber-600 font-medium">{s.fecha_creacion ? `${daysBetween(s.fecha_creacion)}d` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        <SolicitudTable title="Historial reciente" rows={recientes} onVerTodas={() => navigate('/solicitudes')} onView={(s) => navigate(`/solicitudes/${s.id}`)} showEstado />

        <ProveedorMetricasPanel />
      </div>
    </div>
  )
}

// ── EVALUADOR ────────────────────────────────────────────────────
function EvaluadorDashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<EvaluadorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    getEvaluadorData().then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState />

  const { enRevision, evaluadas, devueltas } = data

  const cmk          = currentMonthKey()
  const evaluadasMes = evaluadas.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === cmk).length
  const enRevisionMes = enRevision.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === cmk).length

  const masAntiguas = [...enRevision]
    .sort((a, b) => new Date(a.fecha_creacion ?? '').getTime() - new Date(b.fecha_creacion ?? '').getTime())
    .slice(0, 6)

  const avgDias = enRevision.length > 0
    ? Math.round(enRevision.reduce((sum, s) => sum + daysBetween(s.fecha_creacion ?? new Date().toISOString()), 0) / enRevision.length)
    : 0

  const donutData = [
    { name: 'En Revisión', value: enRevision.length },
    { name: 'Evaluadas',   value: evaluadas.length },
    { name: 'Devueltas',   value: devueltas.length },
  ].filter(d => d.value > 0)

  const donutColors = ['#3B82F6', '#8B5CF6', '#F59E0B']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <DashHeader title="Panel Evaluador" subtitle="Solicitudes en revisión pendientes de tu evaluación" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="En cola de revisión" value={enRevision.length} sub="esperando evaluación" icon={<FileText size={18} />} color="blue" alert={enRevision.length > 0} onClick={() => navigate('/solicitudes')} />
          <KpiCard label="Promedio de espera" value={`${avgDias}d`} sub="días en revisión" icon={<Clock size={18} />} color="amber" />
          <KpiCard label="Evaluadas este mes" value={evaluadasMes} sub={`${enRevisionMes} ingresaron este mes`} icon={<CheckCircle size={18} />} color="green" />
          <KpiCard label="Devueltas (Pendiente)" value={devueltas.length} sub="requieren corrección" icon={<RotateCcw size={18} />} color="indigo" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Estado de solicitudes" subtitle="Distribución actual">
            {donutData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} cx="42%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">
                    {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} formatter={(v, name) => [`${v} solicitudes`, name as string]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Más antiguas sin evaluar" subtitle="Ordenadas por tiempo de espera">
            {masAntiguas.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-300">
                <CheckCircle size={26} className="text-green-300" />
                <p className="text-xs">Sin solicitudes en revisión</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-50 max-h-[220px] overflow-y-auto">
                {masAntiguas.map(s => {
                  const dias = daysBetween(s.fecha_creacion ?? new Date().toISOString())
                  const urgente = dias >= 3
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-gray-50 px-1 rounded-lg" onClick={() => navigate(`/solicitudes/${s.id}`)}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-semibold text-[#003D7D]">{s.codigo ?? `#${s.id}`}</span>
                        <span className="text-xs text-gray-500 truncate max-w-[180px]">{s.razon_social ?? '—'}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-gray-400">{s.proyecto?.nombre ?? '—'}</span>
                        <span className={`text-xs font-semibold ${urgente ? 'text-red-500' : 'text-gray-400'}`}>{dias}d de espera</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

// ── VISUALIZADOR ─────────────────────────────────────────────────
function VisualizadorDashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<VisualizadorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    getVisualizadorData().then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState />

  const { aprobadas, detalles } = data

  const cmk           = currentMonthKey()
  const pmk           = prevMonthKey()
  const aprobadasMes  = aprobadas.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === cmk).length
  const aprobadasMesAnt = aprobadas.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === pmk).length
  const montoAprobado = montoSolicitudes(aprobadas, detalles)
  const montoMes      = montoSolicitudes(aprobadas.filter(s => s.fecha_creacion && monthKey(s.fecha_creacion) === cmk), detalles)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <DashHeader title="Panel Finanzas" subtitle="Seguimiento de solicitudes aprobadas" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total aprobadas" value={aprobadas.length} sub="solicitudes aprobadas" icon={<CheckCircle size={18} />} color="green" onClick={() => navigate('/solicitudes')} />
          <KpiCard label="Monto aprobado" value={fmtMoney(montoAprobado)} sub="total acumulado" icon={<DollarSign size={18} />} color="indigo" />
          <KpiCard label="Aprobadas este mes" value={aprobadasMes} sub={`${aprobadasMesAnt} el mes anterior`} icon={<TrendingUp size={18} />} color="blue" />
          <KpiCard label="Monto este mes" value={fmtMoney(montoMes)} sub="solicitudes aprobadas este mes" icon={<Receipt size={18} />} color="amber" />
        </div>

        <SolicitudTable
          title="Solicitudes aprobadas"
          rows={aprobadas.slice(0, 10)}
          count={aprobadas.length}
          onVerTodas={() => navigate('/solicitudes')}
          onView={(s) => navigate(`/solicitudes/${s.id}`)}
          showEstado
        />
      </div>
    </div>
  )
}

// ── USUARIO ──────────────────────────────────────────────────────
function UsuarioDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [data,    setData]    = useState<UsuarioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getUsuarioData(user.id).then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }, [user?.id])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState />

  const { solicitudes, detalles } = data

  const porEstado: Record<string, number> = {}
  for (const s of solicitudes) {
    const nombre = s.estado_soli?.nombre ?? 'Sin estado'
    porEstado[nombre] = (porEstado[nombre] ?? 0) + 1
  }

  const montoAprobado = montoSolicitudes(
    solicitudes.filter(s => s.estado_soli?.nombre === 'Aprobado'),
    detalles,
  )
  const activas = solicitudes.filter(s => !['Cancelado', 'Rechazado', 'Aprobado'].includes(s.estado_soli?.nombre ?? ''))

  const estadoItems = [
    { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700', count: porEstado['Pendiente'] ?? 0 },
    { label: 'En Revisión', color: 'bg-blue-100 text-blue-700',     count: porEstado['En Revision'] ?? 0 },
    { label: 'Evaluado',    color: 'bg-purple-100 text-purple-700', count: porEstado['Evaluado'] ?? 0 },
    { label: 'Aprobado',    color: 'bg-green-100 text-green-700',   count: porEstado['Aprobado'] ?? 0 },
    { label: 'Rechazado',   color: 'bg-red-100 text-red-700',       count: porEstado['Rechazado'] ?? 0 },
  ].filter(e => e.count > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-end justify-between">
          <DashHeader title="Mis Solicitudes" subtitle="Resumen de tus solicitudes y su estado actual" />
          <button
            onClick={() => navigate('/solicitudes/nueva')}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-medium hover:bg-[#002D5C] transition-colors"
          >
            <Plus size={15} /> Nueva solicitud
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="Solicitudes activas" value={activas.length} sub={`de ${solicitudes.length} en total`} icon={<FileText size={18} />} color="blue" onClick={() => navigate('/solicitudes')} />
          <KpiCard label="Monto aprobado" value={fmtMoney(montoAprobado)} sub="en solicitudes aprobadas" icon={<DollarSign size={18} />} color="green" />
          <KpiCard label="Pendientes de envío" value={porEstado['Pendiente'] ?? 0} sub="listas para enviar a revisión" icon={<Send size={18} />} color="amber" alert={(porEstado['Pendiente'] ?? 0) > 0} onClick={() => navigate('/solicitudes')} />
        </div>

        {estadoItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide mb-4">Por estado</h2>
            <div className="flex flex-wrap gap-3">
              {estadoItems.map(e => (
                <div key={e.label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${e.color}`}>
                  <span className="text-lg font-bold">{e.count}</span>
                  <span className="text-xs font-medium">{e.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SolicitudTable
          title="Mis últimas solicitudes"
          rows={solicitudes.slice(0, 8)}
          onVerTodas={() => navigate('/solicitudes')}
          onView={(s) => navigate(`/solicitudes/${s.id}`)}
          showEstado
        />
      </div>
    </div>
  )
}

// ── ProveedorMetricasPanel ───────────────────────────────────────
function ProveedorMetricasPanel() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<ProveedorMetricasData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProveedorMetricas().then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  const starColor = (v: number) => v >= 4 ? 'text-teal-500' : v >= 3 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">Métricas de Proveedores</h2>
          <p className="text-xs text-gray-400 mt-0.5">Basado en encuestas de satisfacción internas</p>
        </div>
        <button
          onClick={() => navigate('/proveedores')}
          className="flex items-center gap-1 text-xs text-[#003D7D] hover:underline font-medium"
        >
          Ver todos <ArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#003D7D] border-t-transparent" />
        </div>
      ) : !data ? (
        <div className="py-10 flex flex-col items-center gap-2 text-gray-300">
          <AlertCircle size={24} />
          <p className="text-xs">No se pudo cargar</p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total proveedores', value: data.totalProveedores, icon: <Users size={15} />, cls: 'bg-blue-50 text-[#003D7D]' },
              { label: 'Promedio general', value: data.promedioGeneral ? `${data.promedioGeneral} ★` : '—', icon: <Star size={15} />, cls: 'bg-amber-50 text-amber-600' },
              { label: '% Recomendarían', value: data.pctRecomendaria !== null ? `${data.pctRecomendaria}%` : '—', icon: <ThumbsUp size={15} />, cls: 'bg-teal-50 text-teal-600' },
              { label: 'Alertas (< 3★)', value: data.alertas, icon: <ThumbsDown size={15} />, cls: 'bg-red-50 text-red-500', alert: data.alertas > 0 },
            ].map(k => (
              <div key={k.label} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${k.cls}`}>
                  {k.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 leading-tight">{k.label}</p>
                  <p className={`text-base font-bold leading-tight ${k.alert ? 'text-red-500' : 'text-gray-800'}`}>{k.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Ranking */}
          {data.topProveedores.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6 text-gray-300">
              <Star size={24} />
              <p className="text-xs">Sin evaluaciones registradas aún</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top proveedores evaluados</p>
              <div className="flex flex-col gap-2">
                {data.topProveedores.map((p, i) => (
                  <div key={p.ruc} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/proveedores')}>
                    {/* Posición */}
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                      {i + 1}
                    </span>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.razon_social ?? p.ruc}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{p.ruc}</p>
                    </div>
                    {/* Score */}
                    <div className="flex items-center gap-2 shrink-0">
                      {p.pct_recomendaria !== null && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.pct_recomendaria >= 70 ? 'bg-teal-50 text-teal-600' : p.pct_recomendaria >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                          👍 {p.pct_recomendaria}%
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        <span className={`text-sm font-bold ${starColor(p.promedio_general ?? 0)}`}>
                          {p.promedio_general?.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-300">({p.total_encuestas})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── shared sub-components ────────────────────────────────────────

function DashHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

type KpiColor = 'amber' | 'blue' | 'green' | 'indigo'

const KPI_STYLES: Record<KpiColor, { icon: string; val: string; border: string }> = {
  amber:  { icon: 'bg-amber-100 text-amber-600',   val: 'text-amber-700',   border: 'border-amber-100'  },
  blue:   { icon: 'bg-blue-100 text-blue-600',     val: 'text-[#003D7D]',   border: 'border-blue-100'   },
  green:  { icon: 'bg-green-100 text-green-600',   val: 'text-green-700',   border: 'border-green-100'  },
  indigo: { icon: 'bg-indigo-100 text-indigo-600', val: 'text-indigo-700',  border: 'border-indigo-100' },
}

function KpiCard({ label, value, sub, icon, color, alert, onClick }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: KpiColor; alert?: boolean; onClick?: () => void
}) {
  const s = KPI_STYLES[color]
  return (
    <div className={`relative bg-white rounded-2xl border ${s.border} shadow-sm p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      {alert && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
      )}
      <div className={`inline-flex items-center justify-center rounded-xl p-2.5 mb-3 ${s.icon}`}>{icon}</div>
      <p className={`text-2xl font-bold tracking-tight ${s.val}`}>{value}</p>
      <p className="text-xs font-semibold text-gray-700 mt-0.5 leading-snug">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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

function SolicitudTable({ title, rows, count, badge, onVerTodas, onView, showEstado }: {
  title: string; rows: SolicitudRow[]; count?: number; badge?: boolean
  onVerTodas?: () => void; onView: (s: SolicitudRow) => void; showEstado?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">{title}</h2>
          {badge && count != null && count > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{count}</span>
          )}
        </div>
        {onVerTodas && (
          <button onClick={onVerTodas} className="flex items-center gap-1 text-xs text-[#003D7D] hover:underline font-medium">
            Ver todas <ArrowRight size={12} />
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2 text-gray-400">
          <CheckCircle size={28} className="text-green-300" />
          <p className="text-sm">Sin registros</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Código', 'Proveedor', 'Proyecto', 'Fecha pedido', ...(showEstado ? ['Estado'] : []), ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {rows.map(s => (
                <tr key={s.id} className="hover:bg-[#003D7D]/[0.03] cursor-pointer transition-colors" onClick={() => onView(s)}>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs bg-[#003D7D]/8 text-[#003D7D] px-2 py-0.5 rounded-md">{s.codigo ?? `#${s.id}`}</span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{s.razon_social ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{s.proyecto?.nombre ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {s.fecha_pedido ? new Date(s.fecha_pedido + 'T00:00:00').toLocaleDateString('es-PE', { dateStyle: 'medium' }) : '—'}
                  </td>
                  {showEstado && (
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE[s.estado_soli?.nombre ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {s.estado_soli?.nombre ?? '—'}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-xs font-semibold text-[#003D7D]">Revisar →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex h-80 items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#003D7D] border-t-transparent" />
    </div>
  )
}

function ErrorState() {
  return (
    <div className="flex h-80 flex-col items-center justify-center gap-3 text-gray-400">
      <AlertCircle size={32} className="text-red-300" />
      <p className="text-sm">No se pudo cargar el panel.</p>
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
