import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronRight, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { getProyectosConMobysuite } from '../../proyecto/services/proyectoService'
import type { Proyecto } from '../../proyecto/types/proyecto'
import { authFetch } from '../../../api/authFetch'
import EtapaFiltro from './EtapaFiltro'
import BienesLista from './BienesLista'
import { coincideEtapa, etapaLabel } from '../utils/etapas'
import type { FiltroEtapa } from '../utils/etapas'
import { bienesDe } from '../utils/bienes'
import type { Bien } from '../utils/bienes'
import { cobradoDudoso, cobradoEnMes, diferenciaCuota, fechaPagoValida, hoyLocal, mesActual, mesCorto } from '../utils/cobradoMes'

interface Cuota {
  contratoId: number
  contratoEstado: string
  clienteRut: string | null
  clienteNombre: string | null
  bienNumero?: string | null
  bienes?: Bien[]
  numeroCuota: number
  descripcion: string
  fechaVencimiento: string | null
  fechaPago?: string | null
  monto: number
  ejecutado: number
  saldo: number
  adelanto: number
  abonos: { fecha: string | null; monto: number }[]
  estado: 'Pagado' | 'Pendiente' | 'Vencido'
  categoria: 'BANCO' | 'CLIENTE'
}

// Una fila por CONTRATO: si el cliente compró departamento y estacionamiento en contratos separados,
// cada uno va en su propia línea; si ambos bienes vienen en un mismo contrato (un solo plan de pagos),
// es una sola línea que lista los dos bienes.
interface ClienteFila {
  clave: string
  nombre: string
  clienteClave: string
  contratoId: number
  contratoEstado: string
  bienes: Bien[]
  contratosDelCliente: number
  cuotas: Cuota[]
  actual: number
  d1_30: number
  d31_60: number
  d61_90: number
  d91_120: number
  antiguos: number
  pagado: number
  cobradoMes: number
  total: number
  pactadoPagado: number // pactado de las cuotas que tienen algún pago
  deMas: number
  deMenos: number
}

const fmt = (n: number) => n === 0 ? '0.00' : n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type BucketKey = Exclude<keyof ClienteFila, 'clave' | 'nombre' | 'clienteClave' | 'contratoId' | 'contratoEstado' | 'bienes' | 'contratosDelCliente' | 'cuotas' | 'total' | 'pagado' | 'cobradoMes' | 'pactadoPagado' | 'deMas' | 'deMenos'>

const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: 'actual', label: 'A la fecha' },
  { key: 'd1_30', label: '1-30' },
  { key: 'd31_60', label: '31-60' },
  { key: 'd61_90', label: '61-90' },
  { key: 'd91_120', label: '91-120' },
  { key: 'antiguos', label: 'Antiguos' },
]

function diasVencido(fechaVencimiento: string | null, hoy: string): number {
  if (!fechaVencimiento) return 0
  const ms = new Date(hoy + 'T00:00:00').getTime() - new Date(fechaVencimiento + 'T00:00:00').getTime()
  return Math.round(ms / 86_400_000)
}

function bucketDe(dias: number): BucketKey {
  if (dias <= 0) return 'actual'
  if (dias <= 30) return 'd1_30'
  if (dias <= 60) return 'd31_60'
  if (dias <= 90) return 'd61_90'
  if (dias <= 120) return 'd91_120'
  return 'antiguos'
}

export default function CarteraVencidaTable() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [proyectoId, setProyectoId] = useState('')
  const [loading, setLoading] = useState(false)
  const [cuotas, setCuotas] = useState<Cuota[] | null>(null)
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  // Por defecto solo las cuotas que paga el cliente: el Crédito Hipotecario lo desembolsa
  // el banco, no es mora del cliente, y mezclarlo multiplicaba la deuda mostrada.
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | Cuota['categoria']>('CLIENTE')
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>('TODAS')
  // Mes calendario para la columna Cobrado (por defecto el mes en curso)
  const [mes, setMes] = useState(mesActual())
  // Solo contratos donde lo documentado no coincide con lo pactado
  const [soloDiferencias, setSoloDiferencias] = useState(false)
  const [sinMonto, setSinMonto] = useState(0)

  useEffect(() => {
    getProyectosConMobysuite().then(setProyectos).catch(() => toast.error('No se pudo cargar la lista de empresas con Mobysuite'))
  }, [])

  const handleConsultar = async () => {
    const proyecto = proyectos.find(p => String(p.id) === proyectoId)
    if (!proyecto?.moby_project_id) { toast.error('Selecciona una empresa'); return }
    setLoading(true)
    setCuotas(null)
    try {
      const res = await authFetch(`/api/mobysuite-cronograma?mobyProjectId=${proyecto.moby_project_id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al consultar Mobysuite')
      setCuotas(json.cuotas)
      setSinMonto(json.recibosSinMonto ?? 0)
      setFiltroEtapa('TODAS')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al consultar Mobysuite')
    } finally {
      setLoading(false)
    }
  }

  const filas = useMemo<ClienteFila[]>(() => {
    if (!cuotas) return []
    const hoy = new Date().toISOString().slice(0, 10)
    const hoyFecha = hoyLocal()
    const visibles = cuotas.filter(c =>
      (filtroCategoria === 'Todos' || c.categoria === filtroCategoria) &&
      coincideEtapa(c.contratoEstado, filtroEtapa))

    // Cuántos contratos tiene cada cliente en total (sin filtros), para avisar cuando una línea
    // es solo uno de varios contratos del mismo cliente
    const contratosPorCliente = new Map<string, Set<number>>()
    for (const c of cuotas) {
      const k = c.clienteRut ?? c.clienteNombre ?? `contrato-${c.contratoId}`
      if (!contratosPorCliente.has(k)) contratosPorCliente.set(k, new Set())
      contratosPorCliente.get(k)!.add(c.contratoId)
    }

    const porContrato = new Map<string, ClienteFila>()
    for (const c of visibles) {
      const clave = `contrato-${c.contratoId}`
      const clienteClave = c.clienteRut ?? c.clienteNombre ?? clave
      if (!porContrato.has(clave)) {
        porContrato.set(clave, {
          clave, nombre: c.clienteNombre ?? clienteClave, clienteClave,
          contratoId: c.contratoId, contratoEstado: c.contratoEstado, bienes: bienesDe(c),
          contratosDelCliente: contratosPorCliente.get(clienteClave)?.size ?? 1,
          cuotas: [],
          actual: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, antiguos: 0, pagado: 0, cobradoMes: 0, total: 0, pactadoPagado: 0, deMas: 0, deMenos: 0,
        })
      }
      const fila = porContrato.get(clave)!
      // "Ejecutado" es lo documentado en Mobysuite y va aparte; los tramos de antigüedad y
      // "Por pagar" usan el saldo de cada cuota. Total = Por pagar + Ejecutado.
      if (c.ejecutado > 0) {
        fila.pagado += c.ejecutado
        fila.pactadoPagado += c.monto
        fila.cobradoMes += cobradoEnMes(c.abonos, mes, hoyFecha)
        const dif = diferenciaCuota(c)
        if (dif > 0) fila.deMas += dif
        else fila.deMenos -= dif
      }
      if (c.saldo > 0) {
        fila[bucketDe(diasVencido(c.fechaVencimiento, hoy))] += c.saldo
        fila.total += c.saldo
      }
      fila.cuotas.push(c)
    }
    return [...porContrato.values()]
      .filter(f => !soloDiferencias || f.deMas > 0 || f.deMenos > 0)
      .sort((a, b) => b.total - a.total)
  }, [cuotas, filtroCategoria, filtroEtapa, mes, soloDiferencias])

  const totales = useMemo(() => {
    const t = { actual: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, antiguos: 0, pagado: 0, cobradoMes: 0, total: 0 }
    for (const f of filas) {
      t.actual += f.actual; t.d1_30 += f.d1_30; t.d31_60 += f.d31_60
      t.d61_90 += f.d61_90; t.d91_120 += f.d91_120; t.antiguos += f.antiguos
      t.pagado += f.pagado; t.cobradoMes += f.cobradoMes; t.total += f.total
    }
    return t
  }, [filas])

  // Cuotas pagadas cuya fecha de pago no es creible (antes de 2020, futura o vacia): no se asignan a ningun mes
  const dudosas = useMemo(() => {
    const hoyFecha = hoyLocal()
    let n = 0, monto = 0
    for (const f of filas) for (const c of f.cuotas) {
      const dudoso = cobradoDudoso(c.abonos, hoyFecha)
      if (dudoso > 0) { n++; monto += dudoso }
    }
    return { n, monto }
  }, [filas])

  const toggle = (clave: string) => setExpandido(prev => ({ ...prev, [clave]: !prev[clave] }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Cuenta por Cobrar Vencida</h2>
          <p className="text-xs text-gray-500 mt-0.5">Consulta en vivo, una línea por contrato — al corte de hoy</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as typeof filtroCategoria)}
            className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20">
            <option value="CLIENTE">Solo cliente (excluye banco)</option>
            <option value="BANCO">Solo financiado por banco</option>
            <option value="Todos">Todas</option>
          </select>
          <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20">
            <option value="">Selecciona empresa</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button onClick={handleConsultar} disabled={loading || !proyectoId}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Consultar
          </button>
        </div>
      </div>

      {cuotas !== null && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-x-4 gap-y-2">
          <EtapaFiltro cuotas={cuotas} value={filtroEtapa} onChange={setFiltroEtapa} />
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Cobrado en
            <input type="month" value={mes} max={mesActual()} onChange={e => e.target.value && setMes(e.target.value)}
              className="h-8 px-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={soloDiferencias} onChange={e => setSoloDiferencias(e.target.checked)} />
            Solo con diferencias
          </label>
          <span className="ml-auto text-xs text-gray-500">
            {filas.length} {filas.length === 1 ? 'contrato' : 'contratos'} · {new Set(filas.map(f => f.clienteClave)).size} clientes
          </span>
        </div>
      )}

      {cuotas !== null && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-2.5 font-semibold">Cliente</th>
                {BUCKETS.map(b => <th key={b.key} className="px-3 py-2.5 font-semibold text-right">{b.label}</th>)}
                <th className="px-3 py-2.5 font-semibold text-right text-[#003D7D]">Por pagar</th>
                <th className="px-3 py-2.5 font-semibold text-right text-emerald-600">Ejecutado</th>
                <th className="px-3 py-2.5 font-semibold text-right text-sky-600 whitespace-nowrap">Cobrado {mesCorto(mes)}</th>
                <th className="px-5 py-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filas.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-8 text-center text-gray-400">Sin cuotas para esta empresa con el filtro elegido</td></tr>
              ) : filas.map(f => (
                <Fragment key={f.clave}>
                  <tr key={f.clave} onClick={() => toggle(f.clave)} className="hover:bg-gray-50/50 cursor-pointer font-medium text-gray-800">
                    <td className="px-5 py-2.5">
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">
                          {expandido[f.clave] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        </span>
                        <div className="min-w-0">
                          <div>{f.nombre}</div>
                          {/* Contrato (el mismo N° que muestra Mobysuite), sus bienes y su etapa */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-normal text-gray-500">
                            <span>Contrato N° {f.contratoId}</span>
                            <BienesLista bienes={f.bienes} />
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-semibold">{etapaLabel(f.contratoEstado)}</span>
                            {f.contratosDelCliente > 1 && (
                              <span className="text-gray-400">· cliente con {f.contratosDelCliente} contratos</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {BUCKETS.map(b => (
                      <td key={b.key} className={`px-3 py-2.5 text-right ${f[b.key] > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                        {fmt(f[b.key])}
                      </td>
                    ))}
                    <td className={`px-3 py-2.5 text-right font-semibold ${f.total > 0 ? 'text-[#003D7D]' : 'text-gray-300'}`}>{fmt(f.total)}</td>
                    <td className={`px-3 py-2.5 text-right ${f.pagado > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                      {fmt(f.pagado)}
                      {(f.deMas > 0 || f.deMenos > 0) && (
                        <div className="mt-0.5 text-[10px] font-normal text-gray-500 whitespace-nowrap">
                          pactado {fmt(f.pactadoPagado)}
                          {f.deMas > 0 && <span className="ml-1 font-semibold text-blue-600">+{fmt(f.deMas)}</span>}
                          {f.deMenos > 0 && <span className="ml-1 font-semibold text-red-600">−{fmt(f.deMenos)}</span>}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${f.cobradoMes > 0 ? 'text-sky-600' : 'text-gray-300'}`}>{fmt(f.cobradoMes)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-gray-900">{fmt(f.total + f.pagado)}</td>
                  </tr>
                  {expandido[f.clave] && f.cuotas
                    .slice()
                    .sort((a, b) => (a.fechaVencimiento ?? '').localeCompare(b.fechaVencimiento ?? ''))
                    .map(c => {
                      const hoyFecha = hoyLocal()
                      const enMes = cobradoEnMes(c.abonos, mes, hoyFecha)
                      const dudoso = cobradoDudoso(c.abonos, hoyFecha)
                      const dif = diferenciaCuota(c)
                      const fechas = c.abonos.map(a => a.fecha).filter(x => fechaPagoValida(x, hoyFecha)) as string[]
                      const bucket = c.saldo > 0 ? bucketDe(diasVencido(c.fechaVencimiento, new Date().toISOString().slice(0, 10))) : null
                      const etiqueta = c.ejecutado > 0
                        ? (c.saldo > 0 ? { texto: 'Pago parcial', clase: 'bg-amber-50 text-amber-700' } : { texto: 'Pagado', clase: 'bg-emerald-50 text-emerald-600' })
                        : (c.adelanto > 0 && c.saldo === 0 ? { texto: 'Cubierto por adelanto', clase: 'bg-blue-50 text-blue-700' } : null)
                      return (
                        <tr key={`${f.clave}-${c.contratoId}-${c.numeroCuota}-${c.descripcion}`} className="bg-gray-50/40 text-gray-500">
                          <td className="px-5 py-2 pl-9">
                            {c.descripcion} — plazo #{c.numeroCuota}
                            <span className="text-gray-400"> · vence {c.fechaVencimiento ? new Date(c.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-PE') : '—'}</span>
                            {etiqueta && (
                              <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${etiqueta.clase}`}>{etiqueta.texto}</span>
                            )}
                            {fechas.length > 0 && (
                              <span className="text-gray-400"> · pagó {fechas.map(x => new Date(x + 'T00:00:00').toLocaleDateString('es-PE')).join(', ')}</span>
                            )}
                            {dudoso > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-semibold"
                                title="Mobysuite trae una fecha de pago imposible o vacia; no se asigna a ningun mes">
                                fecha de pago dudosa
                              </span>
                            )}
                            <div className="mt-0.5 text-[11px]">
                              Pactado {fmt(c.monto)} · Documentado {fmt(c.ejecutado)}
                              {dif !== 0 && (
                                <span className={`ml-1 font-semibold ${dif > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  · {dif > 0 ? `+${fmt(dif)} de más` : `−${fmt(-dif)} de menos`}
                                </span>
                              )}
                              {c.adelanto > 0 && <span className="ml-1 text-blue-600">· cubierto por adelanto {fmt(c.adelanto)}</span>}
                            </div>
                          </td>
                          {BUCKETS.map(b => (
                            <td key={b.key} className="px-3 py-2 text-right">{b.key === bucket ? fmt(c.saldo) : ''}</td>
                          ))}
                          <td className="px-3 py-2 text-right">{c.saldo > 0 ? fmt(c.saldo) : ''}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{c.ejecutado > 0 ? fmt(c.ejecutado) : ''}</td>
                          <td className="px-3 py-2 text-right text-sky-600">{enMes > 0 ? fmt(enMes) : ''}</td>
                          <td className="px-5 py-2 text-right">{fmt(c.saldo + c.ejecutado)}</td>
                        </tr>
                      )
                    })}
                </Fragment>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-semibold text-gray-800 bg-gray-50/70">
                  <td className="px-5 py-3">Total general</td>
                  {BUCKETS.map(b => <td key={b.key} className="px-3 py-3 text-right">{fmt(totales[b.key])}</td>)}
                  <td className="px-3 py-3 text-right text-[#003D7D]">{fmt(totales.total)}</td>
                  <td className="px-3 py-3 text-right text-emerald-600">{fmt(totales.pagado)}</td>
                  <td className="px-3 py-3 text-right text-sky-600">{fmt(totales.cobradoMes)}</td>
                  <td className="px-5 py-3 text-right text-gray-900">{fmt(totales.total + totales.pagado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {cuotas !== null && filas.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400 space-y-1">
          <p>
            Por pagar = lo que falta cobrar (los tramos de antigüedad suman esta columna) · Ejecutado = monto documentado en Mobysuite · Total = Por pagar + Ejecutado. Lo pagado de más se descuenta de la última cuota pendiente del cliente.
          </p>
          <p>
            Cobrado {mesCorto(mes)} suma los pagos documentados con fecha dentro de ese mes, aunque la cuota haya vencido antes. Respeta los filtros de categoria y etapa.
          </p>
          {sinMonto > 0 && (
            <p className="text-amber-700">
              {sinMonto} cuotas tienen un recibo pagado sin monto documentado en Mobysuite: se cuentan por el monto pactado.
            </p>
          )}
          {dudosas.n > 0 && (
            <p className="text-amber-700">
              {dudosas.n} {dudosas.n === 1 ? 'cuota tiene' : 'cuotas tienen'} fecha de pago dudosa (S/ {fmt(dudosas.monto)}) y no se incluyen en ningun mes — conviene revisarlas en Mobysuite.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
