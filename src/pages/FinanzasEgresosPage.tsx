import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LineChart, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, Minus, BarChart3, Table2, Info } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import {
  getFinanzasEgresos, resumir,
} from '../features/finanzas/services/finanzasService'
import type { FilaEgreso, Moneda, PuntoMes } from '../features/finanzas/services/finanzasService'

const AZUL = '#003D7D'
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

const labelMes = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MESES[mm - 1]} ${String(y).slice(2)}` }
const labelMesLargo = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MESES[mm - 1]} ${y}` }
const simbolo = (mon: Moneda) => (mon === 'USD' ? '$' : 'S/')
const fmt = (n: number, mon: Moneda) =>
  `${simbolo(mon)} ${n.toLocaleString(mon === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtEntero = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 })

function ultimoDia(mesYYYYMM: string): string {
  const [y, m] = mesYYYYMM.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Tarjeta numérica ──────────────────────────────────────────────────
function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
      <div className="mt-1.5 text-xs text-gray-500">{children}</div>
    </div>
  )
}

// ── Tooltip del gráfico mensual ───────────────────────────────────────
function TooltipMes({ active, payload, moneda }: { active?: boolean; payload?: ReadonlyArray<{ payload?: PuntoMes }>; moneda: Moneda }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-900"><span className="capitalize">{labelMesLargo(p.mes)}</span>{p.parcial ? ' · en curso' : ''}</p>
      <p className="mt-1 text-gray-700">{fmt(p.monto, moneda)}</p>
      <p className="text-gray-500">{p.registros} {p.registros === 1 ? 'pago' : 'pagos'}</p>
    </div>
  )
}

export default function FinanzasEgresosPage() {
  const { userRole } = useAuthStore()
  const esAdmin = userRole === ROLES.ADMIN

  const [filas, setFilas] = useState<FilaEgreso[]>([])
  const [loading, setLoading] = useState(true)
  const [moneda, setMoneda] = useState<Moneda>('PEN')
  const [empresa, setEmpresa] = useState('')
  const [desdeMes, setDesdeMes] = useState('')
  const [hastaMes, setHastaMes] = useState('')
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico')

  const load = () => {
    setLoading(true)
    getFinanzasEgresos(desdeMes ? `${desdeMes}-01` : undefined, hastaMes ? ultimoDia(hastaMes) : undefined)
      .then(setFilas)
      .catch(() => toast.error('No se pudieron cargar los egresos'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (esAdmin) load() }, [esAdmin, desdeMes, hastaMes])

  const r = useMemo(() => resumir(filas, moneda, empresa), [filas, moneda, empresa])

  // Promedio solo de meses completos: el mes en curso distorsiona el promedio hacia abajo.
  const completos = r.porMes.filter(p => !p.parcial)
  const promedio = completos.length ? completos.reduce((s, p) => s + p.monto, 0) / completos.length : null
  const maxCategoria = r.porCategoria.reduce((m, c) => Math.max(m, c.monto), 0)
  const hayFiltros = !!(empresa || desdeMes || hastaMes)
  const vacio = !loading && r.pagado === 0 && r.porPagar === 0

  if (!esAdmin) return <Navigate to="/dashboard" replace />

  const selectCls = 'h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center gap-3 shadow-sm">
        <LineChart size={20} className="text-[#003D7D]" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900">Finanzas · Egresos</h1>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">Primera versión</span>
          </div>
          <p className="text-xs text-gray-400">Lo pagado y lo pendiente de pago en todas las empresas, según los registros de AVENIR</p>
        </div>
        <button onClick={load} disabled={loading} aria-label="Actualizar"
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Aviso de alcance */}
        <div className="flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            Esta primera versión muestra el <strong>gasto ejecutado real</strong> registrado en AVENIR (desde que cada empresa empezó a usarlo).
            El <strong>proyectado</strong> y los <strong>ingresos</strong> se incorporarán en las siguientes etapas.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5" role="group" aria-label="Moneda">
            {(['PEN', 'USD'] as const).map(m => (
              <button key={m} onClick={() => setMoneda(m)} aria-pressed={moneda === m}
                className={`h-8 px-3.5 rounded-[10px] text-xs font-semibold transition-colors ${moneda === m ? 'bg-[#003D7D] text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                {m === 'PEN' ? 'Soles (S/)' : 'Dólares ($)'}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
            Empresa
            <select value={empresa} onChange={e => setEmpresa(e.target.value)} className={selectCls}>
              <option value="">Todas las empresas</option>
              {r.empresas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
            Pagado desde
            <input type="month" value={desdeMes} onChange={e => setDesdeMes(e.target.value)} className={selectCls} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-500">
            Pagado hasta
            <input type="month" value={hastaMes} onChange={e => setHastaMes(e.target.value)} className={selectCls} />
          </label>
          {hayFiltros && (
            <button onClick={() => { setEmpresa(''); setDesdeMes(''); setHastaMes('') }}
              className="h-9 px-3 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>

        {loading && filas.length === 0 ? (
          <div className="flex justify-center py-24"><Loader2 size={24} className="animate-spin text-[#003D7D]" /></div>
        ) : (
          <>
            {/* Cifras principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Tile label="Pagado en el periodo" value={fmt(r.pagado, moneda)}>
                {fmtEntero(r.registrosPagados)} {r.registrosPagados === 1 ? 'pago' : 'pagos'}
              </Tile>
              <Tile label="Por pagar (aprobado, sin pagar)" value={fmt(r.porPagar, moneda)}>
                {fmtEntero(r.registrosPorPagar)} {r.registrosPorPagar === 1 ? 'registro' : 'registros'} · al día de hoy
              </Tile>
              <Tile label={r.ultimoMesCompleto ? `Último mes completo (${labelMes(r.ultimoMesCompleto.mes)})` : 'Último mes completo'}
                    value={r.ultimoMesCompleto ? fmt(r.ultimoMesCompleto.monto, moneda) : '—'}>
                {r.variacionPct === null ? (
                  <span>{r.ultimoMesCompleto ? 'Sin mes anterior para comparar' : 'Aún no hay un mes completo'}</span>
                ) : (
                  // Subir o bajar el gasto no es bueno ni malo por sí solo: la variación va en gris, sin verde/rojo.
                  <span className="inline-flex items-center gap-1 text-gray-600">
                    {r.variacionPct > 0.05 ? <ArrowUpRight size={13} /> : r.variacionPct < -0.05 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                    {Math.abs(r.variacionPct).toLocaleString('es-PE', { maximumFractionDigits: 1 })}% vs mes anterior
                  </span>
                )}
              </Tile>
              <Tile label="Promedio mensual" value={promedio === null ? '—' : fmt(promedio, moneda)}>
                {completos.length > 0
                  ? `Sobre ${completos.length} ${completos.length === 1 ? 'mes completo' : 'meses completos'}`
                  : 'Aún no hay meses completos'}
              </Tile>
            </div>

            {vacio ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">
                No hay movimientos en {moneda === 'PEN' ? 'soles' : 'dólares'} {empresa ? `para ${empresa}` : ''} con los filtros elegidos.
              </div>
            ) : (
              <>
                {/* Por mes */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Egresos pagados por mes</h2>
                      <p className="text-xs text-gray-400">Según la fecha de pago · en {moneda === 'PEN' ? 'soles' : 'dólares'}</p>
                    </div>
                    <div className="inline-flex rounded-xl border border-gray-200 p-0.5" role="group" aria-label="Tipo de vista">
                      {([['grafico', BarChart3, 'Gráfico'], ['tabla', Table2, 'Tabla']] as const).map(([k, Icon, txt]) => (
                        <button key={k} onClick={() => setVista(k)} aria-pressed={vista === k}
                          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-[10px] text-xs font-medium transition-colors ${vista === k ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                          <Icon size={12} /> {txt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {vista === 'grafico' ? (
                    <>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={r.porMes} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="mes" tickFormatter={labelMes} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <YAxis tickFormatter={(v: number) => v.toLocaleString('es-PE')} tickLine={false} axisLine={false} width={76} tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <Tooltip cursor={{ fill: 'rgba(0,61,125,0.06)' }} content={<TooltipMes moneda={moneda} />} />
                            <Bar dataKey="monto" maxBarSize={24} radius={[4, 4, 0, 0]}>
                              {r.porMes.map(p => <Cell key={p.mes} fill={AZUL} fillOpacity={p.parcial ? 0.4 : 1} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {r.porMes.some(p => p.parcial) && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: AZUL, opacity: 0.4 }} />
                          Mes en curso: todavía incompleto
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                            <th className="py-2 font-semibold">Mes</th>
                            <th className="py-2 font-semibold text-right">Pagos</th>
                            <th className="py-2 font-semibold text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                          {r.porMes.map(p => (
                            <tr key={p.mes}>
                              <td className="py-2"><span className="capitalize">{labelMesLargo(p.mes)}</span>{p.parcial && <span className="ml-2 text-gray-400">(en curso)</span>}</td>
                              <td className="py-2 text-right tabular-nums">{fmtEntero(p.registros)}</td>
                              <td className="py-2 text-right tabular-nums">{fmt(p.monto, moneda)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right tabular-nums">{fmtEntero(r.registrosPagados)}</td>
                            <td className="py-2.5 text-right tabular-nums">{fmt(r.pagado, moneda)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Por categoría */}
                  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h2 className="text-sm font-semibold text-gray-900">En qué se gasta</h2>
                    <p className="text-xs text-gray-400 mb-4">Pagado en el periodo, por categoría del plan contable</p>
                    {r.porCategoria.length === 0 ? (
                      <p className="text-xs text-gray-400 py-6 text-center">Sin pagos en el periodo</p>
                    ) : (
                      <ul className="space-y-3">
                        {r.porCategoria.map(c => (
                          <li key={c.categoria} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-xs">
                            <span className={`truncate ${c.categoria === 'Sin plan contable' || c.categoria === 'Otras categorías' ? 'text-gray-400' : 'text-gray-700'}`} title={c.categoria}>{c.categoria}</span>
                            <div className="border-l border-gray-300 h-3">
                              <div className="h-3 rounded-r-[4px]" style={{ width: `${maxCategoria > 0 ? (c.monto / maxCategoria) * 100 : 0}%`, background: AZUL }} />
                            </div>
                            <span className="text-gray-900 tabular-nums text-right">
                              {fmt(c.monto, moneda)}
                              <span className="ml-1.5 text-gray-400">{r.pagado > 0 ? Math.round((c.monto / r.pagado) * 100) : 0}%</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.porCategoria.some(c => c.categoria === 'Sin plan contable') && (
                      <p className="mt-4 text-[11px] text-gray-400">
                        "Sin plan contable": A Rendir y algunos registros no pasan por la asignación de plan contable.
                      </p>
                    )}
                  </section>

                  {/* Por empresa */}
                  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h2 className="text-sm font-semibold text-gray-900">Por empresa</h2>
                    <p className="text-xs text-gray-400 mb-4">Pagado en el periodo y pendiente de pago</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                            <th className="py-2 font-semibold">Empresa</th>
                            <th className="py-2 font-semibold text-right">Pagado</th>
                            <th className="py-2 font-semibold text-right">Por pagar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                          {r.porEmpresa.map(e => (
                            <tr key={e.empresa} className={empresa && e.empresa !== empresa ? 'text-gray-300' : ''}>
                              <td className="py-2 pr-2">{e.empresa}</td>
                              <td className="py-2 text-right tabular-nums">{fmt(e.pagado, moneda)}</td>
                              <td className="py-2 text-right tabular-nums">{fmt(e.porPagar, moneda)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right tabular-nums">{fmt(r.porEmpresa.reduce((s, e) => s + e.pagado, 0), moneda)}</td>
                            <td className="py-2.5 text-right tabular-nums">{fmt(r.porEmpresa.reduce((s, e) => s + e.porPagar, 0), moneda)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* Cómo se calcula */}
            <p className="text-[11px] leading-relaxed text-gray-400">
              <strong className="font-semibold text-gray-500">Cómo se calcula.</strong>{' '}
              Pagado: registros de Solicitudes, A Rendir, Reembolso, Caja Chica y Devolución con fecha de pago, en el mes de ese pago.
              Los montos de OC incluyen IGV y se muestran brutos, antes de detracción o retención. En A Rendir se cuenta el adelanto entregado.
              Por pagar: registros Aprobados o Autorizados que aún no tienen fecha de pago (no incluye los Observados), sin importar el periodo elegido.
              Soles y dólares no se suman: se ven por separado.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
