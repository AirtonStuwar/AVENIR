import { History } from 'lucide-react'

export interface PasoBitacora {
  titulo: string
  fecha?: string | null
  detalle?: string | null
  estado: 'done' | 'current' | 'warn'
}

// fecha_creacion/fecha_aprobacion son `timestamp without time zone` en BD, llenadas con now()
// en UTC — el string que llega (ej. "2026-08-26T19:36:20") no trae 'Z' ni offset, así que el
// navegador lo interpretaría como su propia hora local (ambiguo). Se fuerza 'Z' para dejar claro
// que ese reloj ya es UTC, y luego se muestra convertido a hora de Lima.
export function fmtDateHora(d: string | null | undefined) {
  if (!d) return '—'
  try {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(d) ? d : `${d.replace(' ', 'T')}Z`
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(iso))
  } catch {
    return 'Fecha inválida'
  }
}

function BitacoraPaso({ paso, esUltimo }: { paso: PasoBitacora; esUltimo: boolean }) {
  const dot = paso.estado === 'done'
    ? 'bg-green-500'
    : paso.estado === 'warn'
      ? 'bg-amber-500'
      : 'bg-blue-500'
  return (
    <div className="relative pl-7 pb-6 last:pb-0">
      {!esUltimo && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200" />}
      <span className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white ${dot}`} />
      <p className="text-sm font-semibold text-gray-900">{paso.titulo}</p>
      {paso.fecha && <p className="text-xs text-gray-400 mt-0.5">{paso.fecha}</p>}
      {paso.detalle && <p className="text-sm text-gray-600 mt-1">{paso.detalle}</p>}
    </div>
  )
}

/** Timeline de solo lectura reutilizado en los 5 módulos (Solicitud, A Rendir, Reembolso, Caja Chica, Devolución). */
export default function BitacoraCard({ pasos }: { pasos: PasoBitacora[] }) {
  if (pasos.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <History size={15} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Bitácora</h2>
      </div>
      <div className="px-6 py-5">
        {pasos.map((paso, i) => (
          <BitacoraPaso key={i} paso={paso} esUltimo={i === pasos.length - 1} />
        ))}
      </div>
    </div>
  )
}
