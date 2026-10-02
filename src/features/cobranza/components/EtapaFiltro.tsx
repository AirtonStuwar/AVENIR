import { useMemo } from 'react'
import { ETAPAS, contarContratosPorEtapa } from '../utils/etapas'
import type { FiltroEtapa } from '../utils/etapas'

interface Props {
  cuotas: Array<{ contratoId: number; contratoEstado?: string | null }>
  value: FiltroEtapa
  onChange: (v: FiltroEtapa) => void
}

/**
 * Filtro por etapa del contrato (separación, minuta, escrituración, entregado). Cada botón muestra
 * cuántos contratos hay en esa etapa. Los conteos salen de TODAS las cuotas de la empresa, no del
 * resultado ya filtrado, para que no cambien mientras se prueban otros filtros.
 */
export default function EtapaFiltro({ cuotas, value, onChange }: Props) {
  const conteo = useMemo(() => contarContratosPorEtapa(cuotas), [cuotas])

  const opciones: Array<{ key: FiltroEtapa; label: string; n: number }> = [
    { key: 'TODAS', label: 'Todas', n: conteo.total },
    ...ETAPAS.map(e => ({ key: e.key as FiltroEtapa, label: e.label, n: conteo.porEtapa[e.key] })),
  ]
  if (conteo.porEtapa.OTRAS > 0) opciones.push({ key: 'OTRAS', label: 'Otras', n: conteo.porEtapa.OTRAS })

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Etapa del contrato">
      <span className="text-[11px] font-medium text-gray-500" title="Cantidad de contratos en cada etapa. Un cliente con dos contratos cuenta dos veces.">
        Etapa del contrato
      </span>
      {opciones.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
            value === o.key
              ? 'bg-[#003D7D] border-[#003D7D] text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-[#003D7D]/40 hover:text-[#003D7D]'
          }`}>
          {o.label} <span className={value === o.key ? 'text-white/70' : 'text-gray-400'}>({o.n})</span>
        </button>
      ))}
    </div>
  )
}
