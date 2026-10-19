import { textoDocumentoDuplicado } from '../services/documentoDuplicadoService'
import type { DocumentoDuplicado } from '../services/documentoDuplicadoService'

// Aviso ámbar (no bloquea) de que el N° de documento ya fue registrado en otro lugar del sistema.
export default function AlertaDocumentoDuplicado({ duplicados, nombre = 'documento' }: { duplicados: DocumentoDuplicado[]; nombre?: string }) {
  if (duplicados.length === 0) return null
  return (
    <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
      <p className="font-semibold">⚠ Este N° de {nombre} ya está registrado:</p>
      <ul className="mt-0.5 space-y-0.5">
        {duplicados.map(d => <li key={`${d.modulo}-${d.registro_id}`}>{textoDocumentoDuplicado(d)}</li>)}
      </ul>
    </div>
  )
}
