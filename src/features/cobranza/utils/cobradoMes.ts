// Regla única de "cobrado en el mes", compartida por la tabla Cuenta por Cobrar Vencida y la
// tarjeta "Cobrado del Mes" del dashboard, para que ambas siempre den el mismo número.
//
// Cada pago documentado cuenta como cobrado en un mes cuando su fecha cae dentro de ese
// mes calendario, sin importar cuándo venció (una cuota vencida que se paga este mes es cobranza
// de este mes). Mobysuite a veces trae fechas de pago imposibles (1902, 2235…): una fecha anterior
// a 2020 o posterior a hoy se considera DUDOSA y no se asigna a ningún mes — se informa aparte para
// que se corrija en Mobysuite, sin ocultarla ni inventar una fecha.

const ANIO_MINIMO = 2020

const dos = (n: number) => String(n).padStart(2, '0')

// Fecha de hoy en hora LOCAL (no toISOString, que corre el día en Perú después de las 7 p.m.)
export function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

export function mesActual(): string {
  return hoyLocal().slice(0, 7)
}

export function fechaPagoValida(fecha: string | null | undefined, hoy: string): boolean {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  return fecha >= `${ANIO_MINIMO}-01-01` && fecha <= hoy
}

export type ClasePago = 'en_mes' | 'otro_mes' | 'dudosa'

// Solo para cuotas ya pagadas. `mes` es 'YYYY-MM'.
export function clasePago(fechaPago: string | null | undefined, mes: string, hoy: string): ClasePago {
  if (!fechaPagoValida(fechaPago, hoy)) return 'dudosa'
  return fechaPago!.slice(0, 7) === mes ? 'en_mes' : 'otro_mes'
}

// Pagos documentados (abonos) de una cuota dentro de un mes, y los de fecha dudosa
type Abono = { fecha: string | null; monto: number }

export function cobradoEnMes(abonos: Abono[], mes: string, hoy: string): number {
  return abonos.reduce((s, a) => s + (clasePago(a.fecha, mes, hoy) === 'en_mes' ? a.monto : 0), 0)
}

export function cobradoDudoso(abonos: Abono[], hoy: string): number {
  return abonos.reduce((s, a) => s + (fechaPagoValida(a.fecha, hoy) ? 0 : a.monto), 0)
}

// Diferencia entre lo documentado y lo pactado de una cuota con pago (0 si coincide o no hay pago)
export function diferenciaCuota(c: { monto: number; ejecutado: number }): number {
  const d = Math.round((c.ejecutado - c.monto) * 100) / 100
  return c.ejecutado > 0 && Math.abs(d) > 1 ? d : 0
}

// Quién paga la cuota: todas, solo el cliente o solo el banco (crédito hipotecario)
export type FiltroCategoria = 'Todos' | 'CLIENTE' | 'BANCO'

export function incluyeCategoria(categoria: string, filtro: FiltroCategoria): boolean {
  return filtro === 'Todos' || categoria === filtro
}

export function textoCategoria(filtro: FiltroCategoria): string {
  return filtro === 'CLIENTE' ? 'Solo cuotas del cliente (sin lo que paga el banco).'
    : filtro === 'BANCO' ? 'Solo cuotas que paga el banco.'
    : 'Incluye las cuotas del cliente y las del banco.'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// '2026-10' → 'oct 2026'
export function mesCorto(mes: string): string {
  const [y, m] = mes.split('-')
  return `${MESES[Number(m) - 1] ?? m} ${y}`
}
