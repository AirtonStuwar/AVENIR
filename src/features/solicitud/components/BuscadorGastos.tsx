import { useEffect, useState, type ReactNode } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

/** Un gasto (línea de detalle) encontrado, con el registro del que forma parte. */
export interface GastoEncontrado {
  id: number
  fecha_documento: string | null
  proveedor: string | null
  tipo_documento: string | null
  numero_documento: string | null
  concepto: string | null
  importe: number
  registroId: number
  codigo: string | null
  estado: string
  moneda: string | null
  empresa: string | null
}

interface Props {
  placeholder: string
  buscar: (q: string) => Promise<GastoEncontrado[]>
  onAbrir: (registroId: number) => void
  renderEstado: (estado: string) => ReactNode
  /** Avisa a la página si hay una búsqueda activa, para que oculte su propia tabla. */
  onActivo: (activo: boolean) => void
}

function fmtDate(val: string | null) {
  if (!val) return '—'
  try {
    return new Date(val.includes('T') ? val : val + 'T00:00:00').toLocaleDateString('es-PE')
  } catch {
    return '—'
  }
}

function fmtMoney(val: number, moneda: string | null) {
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  const loc = moneda === 'USD' ? 'en-US' : 'es-PE'
  return `${sym}${val.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Buscador de gastos por proveedor / N° de documento entre todos los registros del módulo. */
export default function BuscadorGastos({ placeholder, buscar, onAbrir, renderEstado, onActivo }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<GastoEncontrado[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const q = busqueda.trim()
    onActivo(!!q)
    if (!q) { setResultados(null); setBuscando(false); return }
    setBuscando(true)
    let vigente = true
    const timer = setTimeout(() => {
      buscar(q)
        .then(r => { if (vigente) setResultados(r) })
        .catch(() => toast.error('Error al buscar gastos'))
        .finally(() => { if (vigente) setBuscando(false) })
    }, 400)
    return () => { vigente = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  return (
    <>
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="relative max-w-md">
          {buscando
            ? <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
            : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {resultados !== null && busqueda.trim() && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#003D7D]/[0.03] border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Importe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {resultados.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">Sin resultados para "{busqueda}"</td></tr>
              ) : resultados.map(g => (
                <tr key={g.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => onAbrir(g.registroId)}>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(g.fecha_documento)}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{g.proveedor ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{g.tipo_documento ? `${g.tipo_documento} ` : ''}{g.numero_documento ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate">{g.concepto}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{fmtMoney(g.importe, g.moneda)}</td>
                  <td className="px-4 py-3 text-[#003D7D] font-medium">{g.codigo}</td>
                  <td className="px-4 py-3 text-gray-600">{g.empresa ?? '—'}</td>
                  <td className="px-4 py-3">{renderEstado(g.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
