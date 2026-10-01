// El beneficiario de un A Rendir puede identificarse con DNI (persona) o RUC
// (empresa / persona con negocio). Ambos se guardan en la misma columna
// `beneficiario_dni`: en Perú el DNI tiene 8 dígitos y el RUC 11, así que el tipo
// se deduce del propio número y no hace falta guardarlo aparte — las solicitudes
// creadas antes de este cambio (todas con DNI) siguen resolviéndose igual.

export type TipoDocBeneficiario = 'DNI' | 'RUC'

export function tipoDocBeneficiario(doc?: string | null): TipoDocBeneficiario {
  return (doc ?? '').replace(/\D/g, '').length === 11 ? 'RUC' : 'DNI'
}

/** "DOI tipo" del Excel de Pagos Masivos BBVA: 'R' para RUC, 'L' para DNI. */
export function doiTipoBBVA(doc?: string | null): 'R' | 'L' {
  return tipoDocBeneficiario(doc) === 'RUC' ? 'R' : 'L'
}
