/** Tasa de IGV por defecto (18%). Algunas facturas traen otra tasa (ej. 10.5%) y se guarda en `solicitud.igv_porcentaje`. */
export const IGV_PORCENTAJE_DEFECTO = 18

interface ConIgv { igv_porcentaje?: number | null }

/** Porcentaje de IGV de la solicitud (18 si no tiene uno guardado). */
export function porcentajeIgv(s?: ConIgv | null): number {
  const p = Number(s?.igv_porcentaje)
  return Number.isFinite(p) && p >= 0 ? p : IGV_PORCENTAJE_DEFECTO
}

/** Tasa en fracción: 0.18, 0.105… */
export function tasaIgv(s?: ConIgv | null): number {
  return porcentajeIgv(s) / 100
}

/** Factor para multiplicar el subtotal y obtener el total con IGV: 1.18, 1.105… */
export function factorIgv(s?: ConIgv | null): number {
  return 1 + tasaIgv(s)
}

/** Texto del porcentaje sin ceros de más: 18, 10.5 */
export function textoPorcentajeIgv(pct: number): string {
  return String(Math.round(pct * 100) / 100)
}

/** "IGV (18%)", "IGV (10.5%)" */
export function etiquetaIgv(s?: ConIgv | null): string {
  return `IGV (${textoPorcentajeIgv(porcentajeIgv(s))}%)`
}
