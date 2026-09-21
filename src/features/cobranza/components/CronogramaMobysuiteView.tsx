import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Loader2 } from 'lucide-react'
import { getProyectosConMobysuite } from '../../proyecto/services/proyectoService'
import type { Proyecto } from '../../proyecto/types/proyecto'

interface Cuota {
  contratoId: number
  contratoEstado: string
  clienteRut: string | null
  clienteNombre: string | null
  clienteEmail: string | null
  clienteTelefono: string | null
  bienNumero: string | null
  numeroCuota: number
  descripcion: string
  categoria: 'BANCO' | 'CLIENTE'
  fechaVencimiento: string | null
  monto: number
  estado: 'Pagado' | 'Pendiente' | 'Vencido'
}

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_BADGE: Record<Cuota['estado'], string> = {
  Pagado: 'bg-green-50 text-green-700',
  Pendiente: 'bg-amber-50 text-amber-700',
  Vencido: 'bg-red-50 text-red-700',
}

export default function CronogramaMobysuiteView() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [proyectoId, setProyectoId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [totalContratos, setTotalContratos] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | Cuota['estado']>('Todos')
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | Cuota['categoria']>('CLIENTE')
  const [consultado, setConsultado] = useState(false)

  useEffect(() => {
    getProyectosConMobysuite().then(setProyectos).catch(() => toast.error('No se pudo cargar la lista de empresas con Mobysuite'))
  }, [])

  const handleConsultar = async () => {
    if (!proyectoId) { toast.error('Selecciona una empresa'); return }
    const proyecto = proyectos.find(p => String(p.id) === proyectoId)
    if (!proyecto?.moby_project_id) return

    setLoading(true)
    setConsultado(false)
    try {
      const res = await fetch(`/api/mobysuite-cronograma?mobyProjectId=${proyecto.moby_project_id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al consultar Mobysuite')
      setCuotas(json.cuotas)
      setTotalContratos(json.totalContratos)
      setConsultado(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al consultar Mobysuite')
    } finally {
      setLoading(false)
    }
  }

  const cuotasFiltradas = cuotas.filter(c =>
    (filtroEstado === 'Todos' || c.estado === filtroEstado) &&
    (filtroCategoria === 'Todos' || c.categoria === filtroCategoria)
  )
  const totalMonto = cuotasFiltradas.reduce((s, c) => s + c.monto, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Cronograma real de clientes (Mobysuite)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Consulta en vivo — no se guarda nada en AVENIR. Datos directos de Mobysuite al momento de consultar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      {consultado && (
        <>
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              {totalContratos} contratos · {cuotasFiltradas.length} cuotas · Total: <span className="font-semibold text-gray-700">S/ {fmt(totalMonto)}</span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as typeof filtroCategoria)}
                className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs">
                <option value="CLIENTE">Solo cliente (excluye banco)</option>
                <option value="BANCO">Solo financiado por banco</option>
                <option value="Todos">Todas</option>
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
                className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs">
                <option value="Todos">Todos los estados</option>
                <option value="Vencido">Solo vencidas</option>
                <option value="Pendiente">Solo pendientes</option>
                <option value="Pagado">Solo pagadas</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-5 py-2.5 font-semibold">Cliente</th>
                  <th className="px-3 py-2.5 font-semibold">Bien</th>
                  <th className="px-3 py-2.5 font-semibold">Cuota</th>
                  <th className="px-3 py-2.5 font-semibold">Vencimiento</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Monto</th>
                  <th className="px-3 py-2.5 font-semibold">Categoría</th>
                  <th className="px-5 py-2.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cuotasFiltradas.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Sin cuotas para este filtro</td></tr>
                ) : cuotasFiltradas.map(c => (
                  <tr key={`${c.contratoId}-${c.numeroCuota}-${c.descripcion}`} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-gray-800">{c.clienteNombre ?? '—'}</div>
                      <div className="text-gray-400">{c.clienteRut ?? ''}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{c.bienNumero ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{c.descripcion} (#{c.numeroCuota})</td>
                    <td className="px-3 py-2.5 text-gray-600">{c.fechaVencimiento ? new Date(c.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-PE') : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700">S/ {fmt(c.monto)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{c.categoria === 'BANCO' ? 'Banco' : 'Cliente'}</td>
                    <td className="px-5 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[c.estado]}`}>{c.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
