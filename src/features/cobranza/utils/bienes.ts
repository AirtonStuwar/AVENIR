// Bienes de un contrato de Mobysuite. Un contrato puede incluir varios (ej. departamento +
// estacionamiento en un mismo plan de pagos) o uno solo, con el otro en un contrato aparte.
export interface Bien {
  numero: string
  tipo: string | null   // "Departamento", "Estacionamiento"… solo si Mobysuite lo manda; si no, null
}

// Mobysuite puede mandar el tipo en mayúsculas ("DEPARTAMENTO"): se muestra con inicial mayúscula
export function tipoLegible(tipo?: string | null): string | null {
  const t = (tipo ?? '').trim()
  if (!t) return null
  const s = t.toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Lista de bienes del contrato; si la consulta no la trae (versión anterior), cae al bien principal
export function bienesDe(c: { bienes?: Bien[] | null; bienNumero?: string | null }): Bien[] {
  if (c.bienes && c.bienes.length > 0) return c.bienes
  return c.bienNumero ? [{ numero: c.bienNumero, tipo: null }] : []
}
