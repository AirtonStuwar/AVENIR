import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ChevronRight, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { getProyectosConMobysuite } from '../../proyecto/services/proyectoService'
import type { Proyecto } from '../../proyecto/types/proyecto'

interface Cuota {
  contratoId: number
  clienteRut: string | null
  clienteNombre: string | null
  numeroCuota: number
  descripcion: string
  fechaVencimiento: string | null
  monto: number
  estado: 'Pagado' | 'Pendiente' | 'Vencido'
}

interface ClienteFila {
  clave: string
  nombre: string
  cuotas: Cuota[]
  actual: number
  d1_30: number
  d31_60: number
  d61_90: number
  d91_120: number
  antiguos: number
  total: number
}

const fmt = (n: number) => n === 0 ? '0.00' : n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const BUCKETS: { key: keyof Omit<ClienteFila, 'clave' | 'nombre' | 'cuotas' | 'total'>; label: string }[] = [
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

function bucketDe(dias: number): keyof Omit<ClienteFila, 'clave' | 'nombre' | 'cuotas' | 'total'> {
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

  useEffect(() => {
    getProyectosConMobysuite().then(setProyectos).catch(() => toast.error('No se pudo cargar la lista de empresas con Mobysuite'))
  }, [])

  const handleConsultar = async () => {
    const proyecto = proyectos.find(p => String(p.id) === proyectoId)
    if (!proyecto?.moby_project_id) { toast.error('Selecciona una empresa'); return }
    setLoading(true)
    setCuotas(null)
    try {
      const res = await fetch(`/api/mobysuite-cronograma?mobyProjectId=${proyecto.moby_project_id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al consultar Mobysuite')
      setCuotas(json.cuotas)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al consultar Mobysuite')
    } finally {
      setLoading(false)
    }
  }

  const filas = useMemo<ClienteFila[]>(() => {
    if (!cuotas) return []
    const hoy = new Date().toISOString().slice(0, 10)
    const pendientes = cuotas.filter(c => c.estado !== 'Pagado')

    const porCliente = new Map<string, ClienteFila>()
    for (const c of pendientes) {
      const clave = c.clienteRut ?? c.clienteNombre ?? `contrato-${c.contratoId}`
      if (!porCliente.has(clave)) {
        porCliente.set(clave, {
          clave, nombre: c.clienteNombre ?? clave, cuotas: [],
          actual: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, antiguos: 0, total: 0,
        })
      }
      const fila = porCliente.get(clave)!
      const dias = diasVencido(c.fechaVencimiento, hoy)
      const bucket = bucketDe(dias)
      fila[bucket] += c.monto
      fila.total += c.monto
      fila.cuotas.push(c)
    }
    return [...porCliente.values()].sort((a, b) => b.total - a.total)
  }, [cuotas])

  const totales = useMemo(() => {
    const t = { actual: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, antiguos: 0, total: 0 }
    for (const f of filas) {
      t.actual += f.actual; t.d1_30 += f.d1_30; t.d31_60 += f.d31_60
      t.d61_90 += f.d61_90; t.d91_120 += f.d91_120; t.antiguos += f.antiguos; t.total += f.total
    }
    return t
  }, [filas])

  const toggle = (clave: string) => setExpandido(prev => ({ ...prev, [clave]: !prev[clave] }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Cuenta por Cobrar Vencida</h2>
          <p className="text-xs text-gray-500 mt-0.5">Consulta en vivo, agrupado por cliente — al corte de hoy</p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-2.5 font-semibold">Cliente</th>
                {BUCKETS.map(b => <th key={b.key} className="px-3 py-2.5 font-semibold text-right">{b.label}</th>)}
                <th className="px-5 py-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filas.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">Sin saldo pendiente para esta empresa</td></tr>
              ) : filas.map(f => (
                <>
                  <tr key={f.clave} onClick={() => toggle(f.clave)} className="hover:bg-gray-50/50 cursor-pointer font-medium text-gray-800">
                    <td className="px-5 py-2.5 flex items-center gap-1.5">
                      {expandido[f.clave] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      {f.nombre}
                    </td>
                    {BUCKETS.map(b => (
                      <td key={b.key} className={`px-3 py-2.5 text-right ${f[b.key] > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                        {fmt(f[b.key])}
                      </td>
                    ))}
                    <td className="px-5 py-2.5 text-right font-semibold text-[#003D7D]">{fmt(f.total)}</td>
                  </tr>
                  {expandido[f.clave] && f.cuotas
                    .slice()
                    .sort((a, b) => (a.fechaVencimiento ?? '').localeCompare(b.fechaVencimiento ?? ''))
                    .map(c => {
                      const dias = diasVencido(c.fechaVencimiento, new Date().toISOString().slice(0, 10))
                      const bucket = bucketDe(dias)
                      return (
                        <tr key={`${f.clave}-${c.contratoId}-${c.numeroCuota}-${c.descripcion}`} className="bg-gray-50/40 text-gray-500">
                          <td className="px-5 py-2 pl-9">
                            {c.descripcion} — plazo #{c.numeroCuota}
                            <span className="text-gray-400"> · vence {c.fechaVencimiento ? new Date(c.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-PE') : '—'}</span>
                          </td>
                          {BUCKETS.map(b => (
                            <td key={b.key} className="px-3 py-2 text-right">{b.key === bucket ? fmt(c.monto) : ''}</td>
                          ))}
                          <td className="px-5 py-2 text-right">{fmt(c.monto)}</td>
                        </tr>
                      )
                    })}
                </>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-semibold text-gray-800 bg-gray-50/70">
                  <td className="px-5 py-3">Total general</td>
                  {BUCKETS.map(b => <td key={b.key} className="px-3 py-3 text-right">{fmt(totales[b.key])}</td>)}
                  <td className="px-5 py-3 text-right text-[#003D7D]">{fmt(totales.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
