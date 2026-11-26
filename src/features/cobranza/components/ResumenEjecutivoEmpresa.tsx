import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { CuotaMobysuite } from '../utils/carteraMobysuite'
import { calcularResumen } from '../utils/reportesEmpresa'
import type { CategoriaCobranza } from '../utils/reportesEmpresa'

const sol = (n: number) => `S/ ${Math.round(n).toLocaleString('es-PE')}`
const solMM = (n: number) => n >= 1_000_000 ? `S/ ${(n / 1_000_000).toFixed(2)} MM` : sol(n)
const p0 = (n: number) => `${n.toFixed(0)}%`
const p1 = (n: number) => `${n.toFixed(1)}%`

const COLOR_COMP: Record<CategoriaCobranza, string> = {
  cuotaInicial: '#0B1F44', fraccionamiento: '#2E8B57', letras: '#D4891A', separacion: '#C0392B', otras: '#94A3B8',
}

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d} de ${meses[m - 1]} de ${y}`
}

function Tile({ titulo, valor, sub, tono = 'normal' }: { titulo: string; valor: string; sub?: string; tono?: 'normal' | 'rojo' | 'verde' }) {
  const color = tono === 'rojo' ? 'text-red-600' : tono === 'verde' ? 'text-green-700' : 'text-[#0B1F44]'
  return (
    <div className="bg-white rounded-xl p-3.5 min-w-0">
      <p className="text-xs font-semibold text-gray-600">{titulo}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 ${color}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{sub}</p>}
    </div>
  )
}

export default function ResumenEjecutivoEmpresa({ cuotas, ventasAcumuladas, empresa, etapa }: {
  cuotas: CuotaMobysuite[]; ventasAcumuladas: number; empresa: string; etapa?: string | null
}) {
  const r = useMemo(() => calcularResumen(cuotas, ventasAcumuladas), [cuotas, ventasAcumuladas])
  const mes = r.mesMeta.toLowerCase().slice(0, 3)
  const cierreTxt = r.cierre.pct === null ? '—' : p0(r.cierre.pct)
  const sinPagoPct = r.contratosTotal > 0 ? (r.sinPago90 / r.contratosTotal) * 100 : 0
  const inicialPct = r.inicialContratos > 0 ? (r.inicialBajo / r.inicialContratos) * 100 : 0

  const alertas: { texto: string; color: string }[] = [
    { texto: `${r.sinPago90} contratos sin pago > 90 días`, color: r.sinPago90 > 0 ? 'bg-red-500' : 'bg-green-500' },
    { texto: `${r.inicialBajo} contratos bajo el 10% de inicial`, color: r.inicialBajo > 0 ? 'bg-red-500' : 'bg-green-500' },
    { texto: r.brechaAcum > 0 ? `Brecha acumulada a ${mes}: ${sol(r.brechaAcum)}` : `Meta acumulada a ${mes} cumplida`, color: r.brechaAcum > 0 ? 'bg-amber-500' : 'bg-green-500' },
  ]

  const gaugePct = Math.min(100, r.pctMeta)
  const arco = 2 * Math.PI * 40 / 2 // media circunferencia r=40

  return (
    <div className="rounded-2xl bg-[#0B1F44] p-5 sm:p-7 text-white space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-amber-400 uppercase">Resumen ejecutivo</p>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">Dashboard de Cartera y Cobranza · {empresa}</h2>
          <p className="text-sm text-blue-200 mt-1">Indicadores financieros clave al corte del {fechaLarga(r.corte)} · Soles{etapa ? ` · Etapa: ${etapa}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-[0.3em]">AVENIR</p>
          <p className="text-xs text-blue-200">Grupo Inmobiliario</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Tile titulo="Ventas" valor={solMM(r.ventas)} sub="Precio de venta" />
            <Tile titulo="Cobrado" valor={sol(r.cobrado)} sub={`Al ${r.corte.split('-').reverse().join('-')}`} />
            <Tile titulo="Saldo" valor={solMM(r.saldo)} sub={`${p1(100 - r.pctCobrado)} pendiente`} />
            <Tile titulo="% cobrado" valor={p1(r.pctCobrado)} sub="Sobre ventas" />
            <Tile titulo="Clientes" valor={String(r.clientes)} sub={`${r.contratos} contratos`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-3.5 flex flex-col items-center">
              <p className="text-xs font-semibold text-gray-600 text-center">Meta acumulada a {mes}.</p>
              <svg viewBox="0 0 100 56" className="w-28 mt-1">
                <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" strokeWidth="9" strokeLinecap="round" />
                <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#0B1F44" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(gaugePct / 100) * arco} ${arco}`} />
                <text x="50" y="48" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0B1F44">{p1(r.pctMeta)}</text>
              </svg>
            </div>
            <Tile titulo={`Cobrado a ${mes}.`} valor={sol(r.cobradoAcum)} sub={`Meta: ${sol(r.metaAcum)}`} />
            <Tile titulo={`Brecha a ${mes}.`} valor={sol(r.brechaAcum)} sub="Cuotas programadas aún no cobradas" tono={r.brechaAcum > 0 ? 'rojo' : 'verde'} />
            <Tile titulo={`Cierre al ${Number(r.corte.slice(8))}-${r.corte.slice(5, 7)}`} valor={cierreTxt}
              sub={r.cierre.pct === null ? 'Sin cuotas programadas' : `Cobrado ${sol(r.cierre.cobrado)} de ${sol(r.cierre.programado)} programado`}
              tono={r.cierre.pct !== null && r.cierre.pct >= 98 ? 'verde' : 'normal'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile titulo="Sin pago >90 d" valor={`${r.sinPago90} de ${r.contratosTotal}`} sub={`${p0(sinPagoPct)} de contratos${r.sinNingunPago ? ` (${r.sinNingunPago} sin ningún pago)` : ''}`} tono={r.sinPago90 > 0 ? 'rojo' : 'verde'} />
            <Tile titulo="Inicial < 10%" valor={`${r.inicialBajo} de ${r.inicialContratos}`} sub={`${p0(inicialPct)} de contratos (inicial cobrada sobre el precio)`} tono={r.inicialBajo > 0 ? 'rojo' : 'verde'} />
            <Tile titulo="Días sin pago" valor={r.diasPromedio === null ? '—' : `${Math.round(r.diasPromedio)} días`} sub="Promedio simple por contrato" />
            <Tile titulo="Minutas / Separaciones" valor={`${r.minutas} / ${r.separaciones}`} sub="Contratos en cada etapa" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl p-4">
            <p className="text-sm font-bold text-[#0B1F44]">Composición de la cobranza</p>
            {r.composicion.length === 0 ? (
              <p className="text-xs text-gray-500 mt-3">Aún no hay cuotas cobradas.</p>
            ) : (
              <div className="flex items-center gap-3 mt-2">
                <div className="w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={r.composicion} dataKey="monto" nameKey="nombre" innerRadius={28} outerRadius={52} paddingAngle={1} stroke="none">
                        {r.composicion.map(c => <Cell key={c.clave} fill={COLOR_COMP[c.clave]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex-1 space-y-1.5 text-xs">
                  {r.composicion.map(c => (
                    <li key={c.clave} className="flex items-center gap-2 text-gray-700">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR_COMP[c.clave] }} />
                      <span className="flex-1">{c.nombre}</span>
                      <span className="font-semibold">{p1(c.pct)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4">
            <p className="text-sm font-bold text-[#0B1F44]">Días desde el último pago</p>
            <div className="space-y-2 mt-3">
              {r.buckets.map((b, i) => (
                <div key={b.nombre} className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-12 shrink-0">{b.nombre}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: ['#0B1F44', '#2E8B57', '#D4891A', '#C0392B'][i] }} />
                  </div>
                  <span className="w-9 text-right font-semibold">{p0(b.pct)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">% de los {r.contratosTotal} contratos</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-900 bg-[#10295A] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-bold text-amber-400">Alertas</span>
        {alertas.map(a => (
          <span key={a.texto} className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${a.color}`} />{a.texto}</span>
        ))}
      </div>

      <p className="text-xs text-blue-300 leading-relaxed">
        Solo cuotas del cliente (el desembolso del banco no cuenta como cobranza). Meta = cuotas programadas con vencimiento hasta fin de {r.mesMeta.toLowerCase()}.
        Días sin pago y composición usan las fechas de pago de Mobysuite.
      </p>
    </div>
  )
}
