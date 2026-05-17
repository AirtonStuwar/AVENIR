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
