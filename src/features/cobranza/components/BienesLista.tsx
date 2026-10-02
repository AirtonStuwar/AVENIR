import { tipoLegible } from '../utils/bienes'
import type { Bien } from '../utils/bienes'

/** Bienes de un contrato: número tal cual, con su tipo (departamento/estacionamiento) cuando Mobysuite lo manda. */
export default function BienesLista({ bienes }: { bienes: Bien[] }) {
  if (bienes.length === 0) return <span className="text-gray-300">—</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {bienes.map((b, i) => {
        const tipo = tipoLegible(b.tipo)
        return (
          <span key={`${b.numero}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">+</span>}
            {tipo && <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-semibold">{tipo}</span>}
            <span>{b.numero || '—'}</span>
          </span>
        )
      })}
    </span>
  )
}
