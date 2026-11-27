import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LineChart, RefreshCw, Loader2, BarChart3, Table2, Info } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import { getFinanzasPagos, resumir, mesActual } from '../features/finanzas/services/finanzasService'
import type { FilaPago, Moneda, PuntoMes, ConceptoPagado } from '../features/finanzas/services/finanzasService'

const AZUL = '#003D7D'
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

const labelMes = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MESES[mm - 1]} ${String(y).slice(2)}` }
const labelMesLargo = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MESES[mm - 1]} ${y}` }
const simbolo = (mon: Moneda) => (mon === 'USD' ? '$' : 'S/')
const fmt = (n: number, mon: Moneda) =>
  `${simbolo(mon)} ${n.toLocaleString(mon === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtEntero = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 })

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
const nombreMes = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MESES_LARGOS[mm - 1]} ${y}` }

const TEXTO_CONCEPTO: Record<ConceptoPagado, string> = {
  'Proveedores': 'Proveedores (neto de solicitudes)',
  'Confirming repuesto': 'Confirming repuesto',
  'Detracciones': 'Detracciones depositadas',
  'A rendir': 'A rendir (adelantos entregados)',
  'Reembolsos': 'Reembolsos',
  'Caja chica': 'Caja chica (reposiciones)',
  'Devoluciones': 'Devoluciones a clientes',
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
      <p className="mt-1 text-gray-700">Pagado: {fmt(p.monto, moneda)}</p>
      <p className="text-gray-500">Total de facturas: {fmt(p.facturas, moneda)}</p>
    </div>
  )
}

export default function FinanzasEgresosPage() {
  const { userRole } = useAuthStore()
  const esAdmin = userRole === ROLES.ADMIN || userRole === ROLES.APROBADOR || userRole === ROLES.FINANZAS   // nombre histórico: ADMIN, APROBADOR y FINANZAS (solo lectura)

  const [filas, setFilas] = useState<FilaPago[]>([])
  const [loading, setLoading] = useState(true)
  const [moneda, setMoneda] = useState<Moneda>('PEN')
  const [empresa, setEmpresa] = useState('')
  const [mes, setMes] = useState('')   // '' = todos los meses
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico')

  const load = () => {
    setLoading(true)
    getFinanzasPagos()
      .then(setFilas)
      .catch(() => toast.error('No se pudieron cargar los egresos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (esAdmin) load() }, [esAdmin])

  const r = useMemo(() => resumir(filas, moneda, empresa, mes), [filas, moneda, empresa, mes])

  const maxCategoria = r.porCategoria.reduce((m, c) => Math.max(m, c.monto), 0)
  const hayFiltros = !!(empresa || mes)
  const vacio = !loading && r.pagado === 0 && r.porPagar === 0 && r.facturas === 0
  const enPeriodo = mes ? `en ${nombreMes(mes)}` : 'en todos los meses'

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
            Mes de pago
            <select value={mes} onChange={e => setMes(e.target.value)} className={selectCls}>
              <option value="">Todos los meses</option>
              {r.meses.map(m => <option key={m} value={m}>{nombreMes(m).replace(/^./, c => c.toUpperCase())}{m === mesActual() ? ' (en curso)' : ''}</option>)}
            </select>
          </label>
          {hayFiltros && (
            <button onClick={() => { setEmpresa(''); setMes('') }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Tile label={`Pagado realmente ${enPeriodo}`} value={fmt(r.pagado, moneda)}>
                <p>Total de facturas: <span className="tabular-nums">{fmt(r.facturas, moneda)}</span></p>
                {r.confirmingSinReponer > 0 && (
                  <p className="mt-1 text-amber-700">
                    Aparte, sin sumar: {fmt(r.confirmingSinReponer, moneda)} pagado con confirming que aún no figura como repuesto.
                  </p>
                )}
              </Tile>
              <Tile label="Por pagar (aprobado, sin pagar)" value={fmt(r.porPagar, moneda)}>
                {fmtEntero(r.registrosPorPagar)} {r.registrosPorPagar === 1 ? 'registro' : 'registros'} · al día de hoy, no depende del mes
              </Tile>
            </div>

            {vacio ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">
                No hay movimientos en {moneda === 'PEN' ? 'soles' : 'dólares'} {empresa ? `para ${empresa}` : ''} con los filtros elegidos.
              </div>
            ) : (
              <>
                {/* En qué consiste lo pagado */}
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-sm font-semibold text-gray-900">Detalle de lo pagado {enPeriodo}</h2>
                  <p className="text-xs text-gray-400 mb-4">Dinero que salió, según la fecha en que salió</p>
                  {r.porConcepto.length === 0 ? (
                    <p className="text-xs text-gray-400 py-6 text-center">Sin pagos en el periodo</p>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-50 text-gray-700">
                        {r.porConcepto.map(c => (
                          <tr key={c.concepto}>
                            <td className="py-2 pr-2">{TEXTO_CONCEPTO[c.concepto]}</td>
                            <td className="py-2 text-right tabular-nums text-gray-400">{fmtEntero(c.registros)} {c.registros === 1 ? 'pago' : 'pagos'}</td>
                            <td className="py-2 pl-4 text-right tabular-nums text-gray-900">{fmt(c.monto, moneda)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                          <td className="py-2.5" colSpan={2}>Pagado realmente</td>
                          <td className="py-2.5 pl-4 text-right tabular-nums">{fmt(r.pagado, moneda)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </section>

                {/* Por mes: solo cuando no se eligió un mes */}
                {!mes && <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Pagado realmente por mes</h2>
                      <p className="text-xs text-gray-400">Cada mes por separado · en {moneda === 'PEN' ? 'soles' : 'dólares'}</p>
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
                            <th className="py-2 font-semibold text-right">Total de facturas</th>
                            <th className="py-2 font-semibold text-right">Pagado realmente</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-gray-700">
                          {r.porMes.map(p => (
                            <tr key={p.mes}>
                              <td className="py-2"><span className="capitalize">{labelMesLargo(p.mes)}</span>{p.parcial && <span className="ml-2 text-gray-400">(en curso)</span>}</td>
                              <td className="py-2 text-right tabular-nums text-gray-400">{fmt(p.facturas, moneda)}</td>
                              <td className="py-2 text-right tabular-nums">{fmt(p.monto, moneda)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                            <td className="py-2.5">Total</td>
                            <td className="py-2.5 text-right tabular-nums text-gray-400">{fmt(r.facturas, moneda)}</td>
                            <td className="py-2.5 text-right tabular-nums">{fmt(r.pagado, moneda)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Por categoría */}
                  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h2 className="text-sm font-semibold text-gray-900">En qué se gasta</h2>
                    <p className="text-xs text-gray-400 mb-4">Pagado realmente {enPeriodo}, por categoría del plan contable</p>
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
                    <p className="text-xs text-gray-400 mb-4">Pagado realmente {enPeriodo} y pendiente de pago hoy</p>
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
              Pagado realmente: dinero que salió, en el mes en que salió. De las solicitudes se cuenta el neto al proveedor (sin detracción,
              retención ni fondo de garantía); las detracciones se suman en la fecha en que se depositaron; el confirming recién cuando se marca
              como repuesto; en Caja Chica, lo transferido para reponer el fondo; en A Rendir, el adelanto entregado. No incluye el pago a SUNAT
              de las retenciones (no se registra su fecha) ni está verificado contra los estados de cuenta.
              Total de facturas: monto de los documentos marcados como pagados ese mes, antes de descuentos.
              Por pagar: registros Aprobados o Autorizados sin fecha de pago (no incluye los Observados), al día de hoy.
              Soles y dólares no se suman: se ven por separado.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
