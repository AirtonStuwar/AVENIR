import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  TrendingUp, Users2, Wallet, PiggyBank, AlertTriangle, Info, Target, Coins,
  CalendarClock, UserX, Clock, ShieldAlert, Home, CreditCard,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { getProyectos } from '../features/proyecto/services/proyectoService'
import type { Proyecto } from '../features/proyecto/types/proyecto'

// ── Mock de datos (temporal, mientras se conecta la API de Mobysuite) ──
// Genera valores deterministas por proyecto (mismo id → mismos números siempre),
// solo para poder visualizar el layout del dashboard antes de tener datos reales.
function seedFromId(id: number) {
  return (id * 2654435761) % 1000
}

interface CarteraMock {
  ventasAcumuladas: number
  cobradoAcumulado: number
  clientesActivos: number
  clientesMorosos: number
  diasMoraPonderados: number // moraPromedioDias * clientesMorosos — así se puede sumar entre empresas y volver a promediar
  composicion: { cuotaInicial: number; planAhorro: number; desembolsoHipotecario: number; creditoDirecto: number }
  mora: { rango: string; monto: number }[] // suma = carteraVencida
  cobradoDelMes: number
  metaMensual: number
  cumplimiento: {
    planAhorro: { clientes: number; cumplidos: number }
    desembolsoHipotecario: { clientes: number; cumplidos: number }
    creditoDirecto: { clientes: number; cumplidos: number }
  }
}

function mockParaProyecto(id: number): CarteraMock {
  const s = seedFromId(id)
  const ventasAcumuladas = 800000 + (s % 40) * 45000
  const cobradoAcumulado = Math.round(ventasAcumuladas * (0.45 + (s % 35) / 100))
  const saldoPorCobrar = ventasAcumuladas - cobradoAcumulado

  const carteraVencidaTotal = Math.round(saldoPorCobrar * (0.03 + (s % 6) / 100))
  const clientesActivos = 15 + (s % 60)
  const clientesMorosos = Math.round(clientesActivos * (0.04 + (s % 12) / 100))
  const moraPromedioDias = 12 + (s % 35)

  const planAhorroClientes = Math.round(clientesActivos * 0.42)
  const desembolsoClientes = Math.round(clientesActivos * 0.28)
  const creditoClientes = Math.round(clientesActivos * 0.30)
  const planAhorroPct = 80 + (s % 18)
  const desembolsoPct = 72 + (s % 22)
  const creditoPct = 45 + (s % 28)

  const cobradoDelMes = Math.round(cobradoAcumulado / (8 + (s % 6)))
  const metaMensual = Math.round(cobradoDelMes / (0.55 + (s % 35) / 100))

  return {
    ventasAcumuladas,
    cobradoAcumulado,
    clientesActivos,
    clientesMorosos,
    diasMoraPonderados: moraPromedioDias * clientesMorosos,
    composicion: {
      cuotaInicial: Math.round(cobradoAcumulado * 0.46),
      planAhorro: Math.round(cobradoAcumulado * 0.27),
      desembolsoHipotecario: Math.round(cobradoAcumulado * 0.18),
      creditoDirecto: Math.round(cobradoAcumulado * 0.09),
    },
    mora: [
      { rango: '1-30 días',  monto: Math.round(carteraVencidaTotal * 0.44) },
      { rango: '31-60 días', monto: Math.round(carteraVencidaTotal * 0.24) },
      { rango: '61-90 días', monto: Math.round(carteraVencidaTotal * 0.16) },
      { rango: '+90 días',   monto: Math.round(carteraVencidaTotal * 0.16) },
    ],
    cobradoDelMes,
    metaMensual,
    cumplimiento: {
      planAhorro:            { clientes: planAhorroClientes, cumplidos: Math.round(planAhorroClientes * planAhorroPct / 100) },
      desembolsoHipotecario: { clientes: desembolsoClientes, cumplidos: Math.round(desembolsoClientes * desembolsoPct / 100) },
      creditoDirecto:        { clientes: creditoClientes,    cumplidos: Math.round(creditoClientes * creditoPct / 100) },
    },
  }
}

function sumarMocks(mocks: CarteraMock[]): CarteraMock {
  return mocks.reduce((acc, m) => ({
    ventasAcumuladas: acc.ventasAcumuladas + m.ventasAcumuladas,
    cobradoAcumulado: acc.cobradoAcumulado + m.cobradoAcumulado,
    clientesActivos: acc.clientesActivos + m.clientesActivos,
    clientesMorosos: acc.clientesMorosos + m.clientesMorosos,
    diasMoraPonderados: acc.diasMoraPonderados + m.diasMoraPonderados,
    composicion: {
      cuotaInicial: acc.composicion.cuotaInicial + m.composicion.cuotaInicial,
      planAhorro: acc.composicion.planAhorro + m.composicion.planAhorro,
      desembolsoHipotecario: acc.composicion.desembolsoHipotecario + m.composicion.desembolsoHipotecario,
      creditoDirecto: acc.composicion.creditoDirecto + m.composicion.creditoDirecto,
    },
    mora: acc.mora.map((r, i) => ({ rango: r.rango, monto: r.monto + m.mora[i].monto })),
    cobradoDelMes: acc.cobradoDelMes + m.cobradoDelMes,
    metaMensual: acc.metaMensual + m.metaMensual,
    cumplimiento: {
      planAhorro: {
        clientes: acc.cumplimiento.planAhorro.clientes + m.cumplimiento.planAhorro.clientes,
        cumplidos: acc.cumplimiento.planAhorro.cumplidos + m.cumplimiento.planAhorro.cumplidos,
      },
      desembolsoHipotecario: {
        clientes: acc.cumplimiento.desembolsoHipotecario.clientes + m.cumplimiento.desembolsoHipotecario.clientes,
        cumplidos: acc.cumplimiento.desembolsoHipotecario.cumplidos + m.cumplimiento.desembolsoHipotecario.cumplidos,
      },
      creditoDirecto: {
        clientes: acc.cumplimiento.creditoDirecto.clientes + m.cumplimiento.creditoDirecto.clientes,
        cumplidos: acc.cumplimiento.creditoDirecto.cumplidos + m.cumplimiento.creditoDirecto.cumplidos,
      },
    },
  }), {
    ventasAcumuladas: 0, cobradoAcumulado: 0, clientesActivos: 0, clientesMorosos: 0, diasMoraPonderados: 0,
    composicion: { cuotaInicial: 0, planAhorro: 0, desembolsoHipotecario: 0, creditoDirecto: 0 },
    mora: [{ rango: '1-30 días', monto: 0 }, { rango: '31-60 días', monto: 0 }, { rango: '61-90 días', monto: 0 }, { rango: '+90 días', monto: 0 }],
    cobradoDelMes: 0,
    metaMensual: 0,
    cumplimiento: {
      planAhorro: { clientes: 0, cumplidos: 0 },
      desembolsoHipotecario: { clientes: 0, cumplidos: 0 },
      creditoDirecto: { clientes: 0, cumplidos: 0 },
    },
  })
}

const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number) => `${n.toFixed(0)}%`

const PIE_COLORS = ['#003D7D', '#0EA5A5', '#F59E0B', '#8B5CF6']

type KpiColor = 'blue' | 'green' | 'indigo' | 'amber' | 'red'
const KPI_STYLES: Record<KpiColor, { icon: string; val: string; border: string }> = {
  blue:   { icon: 'bg-blue-100 text-blue-600',     val: 'text-[#003D7D]',  border: 'border-blue-100'   },
  green:  { icon: 'bg-green-100 text-green-600',   val: 'text-green-700',  border: 'border-green-100'  },
  indigo: { icon: 'bg-indigo-100 text-indigo-600', val: 'text-indigo-700', border: 'border-indigo-100' },
  amber:  { icon: 'bg-amber-100 text-amber-600',   val: 'text-amber-700',  border: 'border-amber-100'  },
  red:    { icon: 'bg-red-100 text-red-600',       val: 'text-red-700',    border: 'border-red-100'    },
}

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color: KpiColor
}) {
  const s = KPI_STYLES[color]
  return (
    <div className={`bg-white rounded-2xl border ${s.border} shadow-sm p-5`}>
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

// ── Gauge semicircular (SVG puro, sin librería) ─────────────────
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 180) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

function GaugeCard({ pctValue, label, sub }: { pctValue: number; label: string; sub: string }) {
  const clamped = Math.max(0, Math.min(100, pctValue))
  const color = clamped >= 90 ? '#16A34A' : clamped >= 60 ? '#003D7D' : '#F59E0B'
  const bg = describeArc(100, 90, 70, 0, 180)
  const fg = describeArc(100, 90, 70, 0, (clamped / 100) * 180)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center">
      <svg viewBox="0 0 200 100" className="w-full max-w-[180px]">
        <path d={bg} fill="none" stroke="#E5E7EB" strokeWidth={14} strokeLinecap="round" />
        <path d={fg} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />
      </svg>
      <p className="text-2xl font-bold -mt-2" style={{ color }}>{clamped.toFixed(0)}%</p>
      <p className="text-xs font-semibold text-gray-700 mt-0.5 text-center">{label}</p>
      <p className="text-xs text-gray-400 text-center">{sub}</p>
    </div>
  )
}

function ProductoCard({ nombre, clientes, pctValue, icon }: {
  nombre: string; clientes: number; pctValue: number; icon: React.ReactNode
}) {
  const textColor = pctValue >= 85 ? 'text-green-700' : pctValue >= 65 ? 'text-amber-600' : 'text-red-600'
  const barColor  = pctValue >= 85 ? 'bg-green-500'  : pctValue >= 65 ? 'bg-amber-500'  : 'bg-red-500'
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-2 rounded-lg bg-gray-50 text-gray-500">{icon}</div>
        <p className="text-sm font-semibold text-gray-800">{nombre}</p>
      </div>
      <p className="text-xs text-gray-500 mb-2">{clientes} clientes</p>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-1.5">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pctValue)}%` }} />
      </div>
      <p className={`text-xs font-semibold ${textColor}`}>{pct(pctValue)} cumplimiento</p>
    </div>
  )
}

export default function IngresoPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [proyectoId, setProyectoId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProyectos({ pageSize: 100 })
      .then(r => setProyectos(r.data))
      .catch(() => toast.error('No se pudieron cargar las empresas'))
      .finally(() => setLoading(false))
  }, [])

  const data: CarteraMock = proyectoId
    ? mockParaProyecto(Number(proyectoId))
    : sumarMocks(proyectos.length > 0 ? proyectos.map(p => mockParaProyecto(p.id)) : [mockParaProyecto(1)])

  const saldoPorCobrar = data.ventasAcumuladas - data.cobradoAcumulado
  const pctCobrado = data.ventasAcumuladas > 0 ? (data.cobradoAcumulado / data.ventasAcumuladas) * 100 : 0

  const composicionData = [
    { name: 'Cuota Inicial', value: data.composicion.cuotaInicial },
    { name: 'Plan de Ahorro', value: data.composicion.planAhorro },
    { name: 'Desembolso Hipotecario', value: data.composicion.desembolsoHipotecario },
    { name: 'Crédito Directo', value: data.composicion.creditoDirecto },
  ]

  const carteraVencida = data.mora.reduce((s, r) => s + r.monto, 0)
  const carteraCritica = data.mora.find(r => r.rango === '+90 días')?.monto ?? 0
  const pctCarteraVencida = saldoPorCobrar > 0 ? (carteraVencida / saldoPorCobrar) * 100 : 0
  const pctClientesMorosos = data.clientesActivos > 0 ? (data.clientesMorosos / data.clientesActivos) * 100 : 0
  const moraPromedioDias = data.clientesMorosos > 0 ? data.diasMoraPonderados / data.clientesMorosos : 0

  const metaPct = data.metaMensual > 0 ? (data.cobradoDelMes / data.metaMensual) * 100 : 0
  const brecha = Math.max(0, data.metaMensual - data.cobradoDelMes)
  const proyeccionCierre = Math.min(99, Math.round(metaPct + 15))

  const pctPlanAhorro = data.cumplimiento.planAhorro.clientes > 0
    ? (data.cumplimiento.planAhorro.cumplidos / data.cumplimiento.planAhorro.clientes) * 100 : 0
  const pctDesembolso = data.cumplimiento.desembolsoHipotecario.clientes > 0
    ? (data.cumplimiento.desembolsoHipotecario.cumplidos / data.cumplimiento.desembolsoHipotecario.clientes) * 100 : 0
  const pctCredito = data.cumplimiento.creditoDirecto.clientes > 0
    ? (data.cumplimiento.creditoDirecto.cumplidos / data.cumplimiento.creditoDirecto.clientes) * 100 : 0

  const productos = [
    { name: 'Planes de Ahorro', pct: pctPlanAhorro },
    { name: 'Desembolso Hipotecario', pct: pctDesembolso },
    { name: 'Crédito Directo', pct: pctCredito },
  ]
  const riesgo = productos.reduce((min, p) => p.pct < min.pct ? p : min, productos[0])

  const alertas: { text: string; color: 'red' | 'amber' | 'green' }[] = [
    { text: `Brecha mensual de ${fmt(brecha)}`, color: brecha > 0 ? 'amber' : 'green' },
    ...(riesgo.pct < 70 ? [{ text: `Mayor riesgo en ${riesgo.name}`, color: 'red' as const }] : []),
    { text: proyeccionCierre >= 90 ? 'Proyección favorable con seguimiento diario' : 'Proyección en riesgo — requiere seguimiento', color: proyeccionCierre >= 90 ? 'green' : 'amber' },
  ]
  const DOT_COLOR: Record<string, string> = { red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-green-500' }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#003D7D]/10">
          <TrendingUp size={20} className="text-[#003D7D]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cartera y Cobranza</h1>
          <p className="text-sm text-gray-500">Ventas, cobranza y mora por empresa (fuente: Mobysuite)</p>
        </div>
      </div>

      {/* Aviso de datos de ejemplo */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>
          <strong>Vista previa con datos de ejemplo.</strong> Este módulo aún no está conectado a la API de Mobysuite —
          los montos y gráficos que ves aquí son ilustrativos, para validar el diseño y los indicadores antes de integrar los datos reales.
        </p>
      </div>

      {/* Filtro */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</label>
        <select
          className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50"
          value={proyectoId}
          onChange={e => setProyectoId(e.target.value)}
          disabled={loading}
        >
          <option value="">Todas las empresas</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Fila 1: KPIs principales + Composición de la Cobranza */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Ventas Acumuladas" value={fmt(data.ventasAcumuladas)} sub="valor contractual vigente" icon={<TrendingUp size={18} />} color="blue" />
          <KpiCard label="Cobranza Acumulada" value={fmt(data.cobradoAcumulado)} sub={`${pct(pctCobrado)} del total vendido`} icon={<Wallet size={18} />} color="green" />
          <KpiCard label="Saldo por Cobrar" value={fmt(saldoPorCobrar)} sub={`${pct(100 - pctCobrado)} pendiente de cobranza`} icon={<PiggyBank size={18} />} color="amber" />
          <KpiCard label="% Cobrado" value={pct(pctCobrado)} sub="avance acumulado" icon={<Target size={18} />} color="indigo" />
          <KpiCard label="Clientes Activos" value={data.clientesActivos} sub="base vigente" icon={<Users2 size={18} />} color="blue" />
        </div>
        <div className="lg:col-span-1">
          <ChartCard title="Composición de la Cobranza" subtitle="Distribución del monto ya cobrado">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={composicionData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {composicionData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Fila 2: Meta / Cobrado del mes / Brecha / Proyección + Antigüedad de la Deuda */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <GaugeCard pctValue={metaPct} label="Meta Mensual de Cobranza" sub={`Meta: ${fmt(data.metaMensual)}`} />
          <KpiCard label="Cobrado del Mes" value={fmt(data.cobradoDelMes)} sub={`Meta: ${fmt(data.metaMensual)}`} icon={<Coins size={18} />} color="green" />
          <KpiCard label="Brecha" value={fmt(brecha)} sub="pendiente para cumplir meta" icon={<AlertTriangle size={18} />} color={brecha > 0 ? 'amber' : 'green'} />
          <KpiCard label="Proyección de Cierre" value={pct(proyeccionCierre)} sub="si se mantiene el ritmo actual" icon={<Target size={18} />} color={proyeccionCierre >= 90 ? 'green' : 'amber'} />
        </div>
        <div className="lg:col-span-1">
          <ChartCard title="Antigüedad de la Deuda" subtitle={`Cartera vencida: ${fmt(carteraVencida)}`}>
            <div className="space-y-3">
              {data.mora.map(r => {
                const p = carteraVencida > 0 ? (r.monto / carteraVencida) * 100 : 0
                const critico = r.rango === '+90 días'
                return (
                  <div key={r.rango}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-semibold flex items-center gap-1 ${critico ? 'text-red-600' : 'text-gray-600'}`}>
                        {critico && <AlertTriangle size={12} />}
                        {r.rango}
                      </span>
                      <span className="text-gray-500">{pct(p)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${critico ? 'bg-red-500' : 'bg-[#003D7D]'}`} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Fila 3: Cartera Vencida / Clientes Morosos / Mora Promedio / Cartera Crítica */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Cartera Vencida" value={fmt(carteraVencida)} sub={`${pct(pctCarteraVencida)} del saldo por cobrar`} icon={<CalendarClock size={18} />} color="red" />
        <KpiCard label="Clientes Morosos" value={data.clientesMorosos} sub={`${pct(pctClientesMorosos)} de clientes activos`} icon={<UserX size={18} />} color="red" />
        <KpiCard label="Mora Promedio" value={`${moraPromedioDias.toFixed(0)} días`} sub="atraso promedio ponderado" icon={<Clock size={18} />} color="amber" />
        <KpiCard label="Cartera Crítica" value={fmt(carteraCritica)} sub="> 90 días" icon={<ShieldAlert size={18} />} color="red" />
      </div>

      {/* Fila 4: Cumplimiento por producto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ProductoCard nombre="Planes de Ahorro" clientes={data.cumplimiento.planAhorro.clientes} pctValue={pctPlanAhorro} icon={<PiggyBank size={16} />} />
        <ProductoCard nombre="Desembolso Hipotecario" clientes={data.cumplimiento.desembolsoHipotecario.clientes} pctValue={pctDesembolso} icon={<Home size={16} />} />
        <ProductoCard nombre="Crédito Directo" clientes={data.cumplimiento.creditoDirecto.clientes} pctValue={pctCredito} icon={<CreditCard size={16} />} />
      </div>

      {/* Alertas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <AlertTriangle size={14} /> Alertas
        </span>
        {alertas.map((a, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[a.color]}`} />
            {a.text}
          </span>
        ))}
      </div>
    </div>
  )
}
