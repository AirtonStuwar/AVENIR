// Etapa de un contrato en Mobysuite (campo `contratoEstado` que ya trae cada cuota).
// Equivalencia confirmada por el usuario: RESERVADO = separación, PROMESADO = minuta.
export const ETAPAS = [
  { key: 'RESERVADO',   label: 'Separación' },
  { key: 'PROMESADO',   label: 'Minuta' },
  { key: 'ESCRITURADO', label: 'Escrituración' },
  { key: 'ENTREGADO',   label: 'Entregado' },
] as const

export type EtapaKey = typeof ETAPAS[number]['key']
// 'OTRAS' agrupa cualquier estado de contrato que Mobysuite mande y no esté en la lista de arriba
export type FiltroEtapa = 'TODAS' | EtapaKey | 'OTRAS'

const normalizar = (estado?: string | null) => (estado ?? '').trim().toUpperCase()
const KEYS: string[] = ETAPAS.map(e => e.key)

export function etapaLabel(contratoEstado?: string | null): string {
  const n = normalizar(contratoEstado)
  const e = ETAPAS.find(x => x.key === n)
  if (e) return e.label
  // Estado desconocido: se muestra tal cual llega, con inicial mayúscula
  return n ? n.charAt(0) + n.slice(1).toLowerCase() : '—'
}

// Posición de la etapa en el proceso (para ordenar etiquetas); las desconocidas van al final
export function ordenEtapa(contratoEstado?: string | null): number {
  const i = KEYS.indexOf(normalizar(contratoEstado))
  return i === -1 ? KEYS.length : i
}

export function coincideEtapa(contratoEstado: string | null | undefined, filtro: FiltroEtapa): boolean {
  if (filtro === 'TODAS') return true
  const n = normalizar(contratoEstado)
  return filtro === 'OTRAS' ? !KEYS.includes(n) : n === filtro
}

export interface ConteoEtapas {
  total: number
  porEtapa: Record<EtapaKey | 'OTRAS', number>
}

/**
 * Cuenta CONTRATOS (no cuotas ni clientes) por etapa. Un cliente con dos contratos cuenta dos veces,
 * una en cada contrato — la etapa es del contrato, no de la persona.
 */
export function contarContratosPorEtapa(cuotas: Array<{ contratoId: number; contratoEstado?: string | null }>): ConteoEtapas {
  const porContrato = new Map<number, string>()
  for (const c of cuotas) porContrato.set(c.contratoId, normalizar(c.contratoEstado))
  const porEtapa: ConteoEtapas['porEtapa'] = { RESERVADO: 0, PROMESADO: 0, ESCRITURADO: 0, ENTREGADO: 0, OTRAS: 0 }
  for (const estado of porContrato.values()) {
    if (KEYS.includes(estado)) porEtapa[estado as EtapaKey] += 1
    else porEtapa.OTRAS += 1
  }
  return { total: porContrato.size, porEtapa }
}
