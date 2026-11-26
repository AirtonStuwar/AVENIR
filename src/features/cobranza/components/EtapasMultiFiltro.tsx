import { ETAPAS, claveEtapa } from '../utils/etapas'
import type { EtapaSeleccionable } from '../utils/etapas'

interface Props {
  contratos: Array<{ estado?: string | null }>
  value: EtapaSeleccionable[]          // vacío = todas
  onChange: (v: EtapaSeleccionable[]) => void
}

/**
 * Filtro por etapa con selección MÚLTIPLE (ej. Separación + Minuta) para el panel de Ingreso.
 * Separación y Minuta salen siempre; las demás solo si la consulta trae contratos en esa etapa.
 */
export default function EtapasMultiFiltro({ contratos, value, onChange }: Props) {
  const conteo = new Map<EtapaSeleccionable, number>()
  for (const c of contratos) {
    const k = claveEtapa(c.estado)
    conteo.set(k, (conteo.get(k) ?? 0) + 1)
  }

  const opciones: Array<{ key: EtapaSeleccionable; label: string }> = [
    ...ETAPAS.map(e => ({ key: e.key as EtapaSeleccionable, label: e.label })),
    { key: 'OTRAS' as const, label: 'Otras' },
  ].filter(o => o.key === 'RESERVADO' || o.key === 'PROMESADO' || (conteo.get(o.key) ?? 0) > 0 || value.includes(o.key))

  const alternar = (k: EtapaSeleccionable) =>
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])

  const clase = (activo: boolean) =>
    `h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
      activo
        ? 'bg-[#003D7D] border-[#003D7D] text-white'
        : 'bg-white border-gray-200 text-gray-600 hover:border-[#003D7D]/40 hover:text-[#003D7D]'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Etapa del contrato">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide" title="Puedes marcar varias. Los números son contratos.">
        Etapa
      </span>
      <button type="button" onClick={() => onChange([])} aria-pressed={value.length === 0} className={clase(value.length === 0)}>
        Todas <span className={value.length === 0 ? 'text-white/70' : 'text-gray-400'}>({contratos.length})</span>
      </button>
      {opciones.map(o => {
        const activo = value.includes(o.key)
        return (
          <button type="button" key={o.key} onClick={() => alternar(o.key)} aria-pressed={activo} className={clase(activo)}>
            {activo ? '✓ ' : ''}{o.label} <span className={activo ? 'text-white/70' : 'text-gray-400'}>({conteo.get(o.key) ?? 0})</span>
          </button>
        )
      })}
    </div>
  )
}
