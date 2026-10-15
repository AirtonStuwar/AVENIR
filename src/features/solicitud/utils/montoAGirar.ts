import type { Solicitud } from '../types/solicitud'

// Monto neto que corresponde girar al proveedor (descuenta detracción en OC y retención en RxH;
// Liberalidad ya viene neteada en monto_total desde que se crea). Factura con Valorización también descuenta
// su fondo de garantía. Mismo criterio que la función registrar_pago_solicitud() de la base de datos.
export function montoAGirar(s: Solicitud): number {
  const total = s.monto_total ?? 0
  const tipo  = s.solicitud_tipo?.nombre
  if (tipo === 'Liberalidad') return total
  if (tipo === 'Recibo por Honorarios' || tipo === 'Otros') return total - (s.monto_retencion ?? 0)

  const fondoGarantia = s.monto_fondo_garantia ?? 0
  if (!s.detraccion_id) return total - fondoGarantia
  const isPEN = (s.moneda ?? 'PEN') === 'PEN'
  if (isPEN) return total - (s.monto_detraccion ?? 0) - fondoGarantia
  const pct = s.detraccion?.porcentaje ?? 0
  return Math.round((total - total * pct / 100) * 100) / 100 - fondoGarantia
}

// Lo que aún falta pagar cuando una Factura con Valorización se está pagando en partes.
export function montoPendientePago(s: Solicitud): number {
  return Math.max(0, Math.round((montoAGirar(s) - (s.monto_pagado ?? 0)) * 100) / 100)
}

// Pago parcial = ya se registró al menos un pago pero todavía no se cubre el monto a girar.
export const esPagoParcial = (s: Solicitud) => !s.fecha_pago && (s.monto_pagado ?? 0) > 0
