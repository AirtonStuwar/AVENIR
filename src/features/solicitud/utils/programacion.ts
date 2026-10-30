import type { Solicitud } from '../types/solicitud'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Fecha de hoy en Lima como YYYY-MM-DD (no depende de la zona horaria del navegador). */
export function hoyLimaISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Mes siguiente al actual (en Lima) como YYYY-MM: es el primer mes que se puede programar. */
export function mesSiguienteISO(): string {
  const [y, m] = hoyLimaISO().split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

/** "2026-11-01" → "noviembre 2026" (o "nov 2026" si corto). */
export function etiquetaMes(iso: string | null | undefined, corto = false): string {
  if (!iso) return '—'
  const [y, m] = iso.slice(0, 10).split('-').map(Number)
  const nombre = MESES[(m || 1) - 1] ?? ''
  return `${corto ? nombre.slice(0, 3) : nombre} ${y}`
}

/**
 * Una solicitud está "programada" mientras siga Evaluada y su mes de aprobación aún no haya llegado.
 * Cuando llega el mes la tarea diaria de la BD le quita la programación y vuelve a la cola normal.
 */
export function estaProgramada(s: Pick<Solicitud, 'aprobar_desde' | 'estado_soli'>): boolean {
  return s.estado_soli?.nombre === 'Evaluado' && !!s.aprobar_desde && s.aprobar_desde.slice(0, 10) > hoyLimaISO()
}
