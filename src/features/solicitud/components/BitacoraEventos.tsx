import { useEffect, useState } from 'react'
import BitacoraCard, { type PasoBitacora } from './Bitacora'
import {
  getBitacoraEventos, getNombresEventos, pasosDesdeEventos, type ModuloBitacora,
} from '../services/bitacoraEventoService'

interface Props {
  modulo: ModuloBitacora
  registroId: number
  /** Cambia cuando el registro cambia (estado, pago, factura…) para volver a leer el historial */
  marker: string
  /** Bitácora reconstruida de los datos actuales, por si el historial no se puede leer */
  fallback: PasoBitacora[]
}

/** Bitácora con el historial completo (todas las devoluciones, evaluaciones, etc.), leído de `bitacora_evento`. */
export default function BitacoraEventos({ modulo, registroId, marker, fallback }: Props) {
  const [pasos, setPasos] = useState<PasoBitacora[] | null>(null)

  useEffect(() => {
    let vigente = true
    ;(async () => {
      try {
        const eventos = await getBitacoraEventos(modulo, registroId)
        if (!eventos.length) { if (vigente) setPasos(null); return }
        const nombres = await getNombresEventos(eventos).catch(() => ({}))
        if (vigente) setPasos(pasosDesdeEventos(modulo, eventos, nombres))
      } catch {
        if (vigente) setPasos(null)
      }
    })()
    return () => { vigente = false }
  }, [modulo, registroId, marker])

  return <BitacoraCard pasos={pasos ?? fallback} />
}
