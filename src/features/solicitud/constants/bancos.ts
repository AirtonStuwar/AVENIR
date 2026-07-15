export const BANCOS = [
  'BBVA',
  'BCP',
  'Scotiabank',
  'Interbank',
  'Banco de la Nación',
  'BanBif',
  'Pichincha',
  'Mibanco',
  'Banco GNB',
  'Citibank',
  'ICBC',
  'Alfin Banco',
]

export const esBBVA = (banco: string) => banco === 'BBVA'

export const labelNumeroCuenta = (banco: string) =>
  esBBVA(banco) ? 'Número de cuenta' : 'Número CCI'

export const maxLengthNumeroCuenta = (banco: string) =>
  esBBVA(banco) ? 18 : 20

export const placeholderNumeroCuenta = (banco: string) =>
  esBBVA(banco) ? '18 dígitos' : '20 dígitos (CCI)'

/**
 * Limpia un texto para el Excel de pagos masivos BBVA:
 * quita tildes, Ñ→N, elimina símbolos (solo deja letras, números y espacios)
 * y pasa a mayúsculas. Ej: "Muñoz & Asociados S.A.C." → "MUNOZ ASOCIADOS SAC"
 */
export function sanitizeBBVA(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.'\u2019]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
