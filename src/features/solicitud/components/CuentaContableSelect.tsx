import { useEffect, useRef, useState } from 'react'
import type { PlanContable } from '../types/solicitud'

// Buscador de cuenta contable de REFERENCIA (solo informativa, no entra en ningún cálculo ni reporte).
// Filtra por código Starsoft, nombre de la cuenta o tipo de gasto. `compact` lo adapta a una celda de tabla:
// la lista se dibuja con posición fija para que no la recorte el scroll horizontal de la tabla.

interface Props {
  value: number | null
  onChange: (id: number | null) => void
  opciones: PlanContable[]
  compact?: boolean
  placeholder?: string
}

export const cuentaContableLabel = (p: PlanContable) =>
  [p.codigo_starsoft, p.nombre_cuenta_contable].filter(Boolean).join(' — ') || (p.tipo_gasto_costo ?? '')

export default function CuentaContableSelect({ value, onChange, opciones, compact, placeholder }: Props) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const escribiendo = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Refleja la cuenta elegida (o la limpia si se quitó desde afuera), sin pisar lo que el usuario está tecleando
  useEffect(() => {
    if (escribiendo.current) return
    const p = value != null ? opciones.find(x => x.id === value) : null
    setTexto(p ? cuentaContableLabel(p) : '')
  }, [value, opciones])

  const abrir = () => {
    if (compact && inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    setAbierto(true)
  }

  const q = texto.trim().toLowerCase()
  const filtradas = opciones
    .filter(p => !q || [p.codigo_starsoft, p.nombre_cuenta_contable, p.tipo_gasto_costo].some(v => (v ?? '').toLowerCase().includes(q)))
    .slice(0, 40)

  const elegir = (p: PlanContable) => {
    escribiendo.current = false
    setTexto(cuentaContableLabel(p))
    setAbierto(false)
    onChange(p.id)
  }

  const lista = abierto && (
    <ul
      className={`bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto ${compact ? 'z-50' : 'mt-1'}`}
      style={compact && rect ? { position: 'fixed', left: rect.left, top: rect.bottom + 2, width: Math.max(rect.width, 340) } : undefined}
    >
      {filtradas.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Sin resultados</li>}
      {filtradas.map(p => (
        <li key={p.id} onMouseDown={() => elegir(p)} className="px-3 py-2 cursor-pointer hover:bg-[#003D7D]/5">
          <p className="text-xs font-medium text-gray-800">{p.nombre_cuenta_contable || p.tipo_gasto_costo}</p>
          <p className="text-[11px] text-gray-400">{[p.codigo_starsoft, p.tipo_gasto_costo].filter(Boolean).join(' · ')}</p>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={texto}
        placeholder={placeholder ?? 'Buscar por código, cuenta o tipo de gasto…'}
        onChange={e => { escribiendo.current = true; setTexto(e.target.value); if (value != null) onChange(null); abrir() }}
        onFocus={abrir}
        onBlur={() => {
          setAbierto(false)
          // Un texto sin elegir de la lista no cuenta como selección
          if (value == null) { escribiendo.current = false; setTexto('') }
          else escribiendo.current = false
        }}
        className={compact
          ? 'w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#003D7D]/40'
          : 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20'}
      />
      {value != null && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { escribiendo.current = false; setTexto(''); setAbierto(false); onChange(null) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-gray-600"
        >
          Quitar
        </button>
      )}
      {lista}
    </div>
  )
}
