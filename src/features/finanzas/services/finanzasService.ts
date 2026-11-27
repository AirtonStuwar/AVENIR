import { supabase } from '../../../api/supabase'

export type Moneda = 'PEN' | 'USD'

// Conceptos que SÍ son dinero salido (en este orden se muestran en el desglose)
export const CONCEPTOS_PAGADOS = [
  'Proveedores', 'Confirming repuesto', 'Detracciones',
  'A rendir', 'Reembolsos', 'Caja chica', 'Devoluciones',
] as const

export type ConceptoPagado = typeof CONCEPTOS_PAGADOS[number]
// Estos tres vienen aparte y nunca suman a lo pagado
export type Concepto = ConceptoPagado | 'Confirming sin reponer' | 'Total de facturas' | 'Por pagar'

// Una fila = un mes × empresa × moneda × categoría × concepto (ya agregada en la BD).
export interface FilaPago {
  mes: string | null            // 'YYYY-MM' en que salió el dinero; null cuando está por pagar
  empresa: string
  moneda: Moneda
  categoria: string
  concepto: Concepto
  registros: number
  monto: number
}

/**
 * Pagos de todas las empresas y módulos, agregados en la BD (función `get_finanzas_pagos`, solo
 * responde a ADMIN, APROBADOR y FINANZAS). Trae todos los meses; el mes se filtra en pantalla.
 */
export async function getFinanzasPagos(): Promise<FilaPago[]> {
  const { data, error } = await supabase.rpc('get_finanzas_pagos')
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
    mes: (r.mes as string | null) ?? null,
    empresa: String(r.empresa),
    moneda: r.moneda as Moneda,
    categoria: String(r.categoria),
    concepto: r.concepto as Concepto,
    registros: Number(r.registros),
    monto: Number(r.monto),
  }))
}

// ── Cálculos para la pantalla ─────────────────────────────────────────

export interface PuntoMes {
  mes: string
  monto: number
  facturas: number   // total de los documentos marcados como pagados ese mes (para comparar)
  parcial: boolean   // mes en curso: todavía incompleto
}

export interface BarraCategoria {
  categoria: string
  monto: number
}

export interface FilaConcepto {
  concepto: ConceptoPagado
  monto: number
  registros: number
}

export interface FilaEmpresa {
  empresa: string
  pagado: number
  porPagar: number
}

export interface ResumenPagos {
  pagado: number                   // dinero que salió en el mes elegido (o en total)
  facturas: number
  confirmingSinReponer: number
  porConcepto: FilaConcepto[]
  porPagar: number                 // siempre la foto de hoy
  registrosPorPagar: number
  porMes: PuntoMes[]               // todos los meses, sin sumarlos entre sí
  porCategoria: BarraCategoria[]
  porEmpresa: FilaEmpresa[]
  empresas: string[]               // para el filtro (todas las que aparecen en los datos)
  meses: string[]                  // para el filtro, del más reciente al más antiguo
}

export function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function siguienteMes(m: string): string {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm, 1) // mm ya es el mes siguiente en base 0
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MAX_CATEGORIAS = 7
const esPagado = (c: Concepto): c is ConceptoPagado => (CONCEPTOS_PAGADOS as readonly string[]).includes(c)
const sumar = (filas: FilaPago[]) => Math.round(filas.reduce((s, f) => s + f.monto, 0) * 100) / 100

/** `mes` vacío = todos los meses. "Por pagar" no depende del mes. */
export function resumir(filas: FilaPago[], moneda: Moneda, empresa: string, mes: string): ResumenPagos {
  const empresas = [...new Set(filas.map(f => f.empresa))].sort((a, b) => a.localeCompare(b))
  const meses = [...new Set(filas.flatMap(f => (f.mes ? [f.mes] : [])))].sort().reverse()
  const enMes = (f: FilaPago) => !mes || f.mes === mes

  const sel = filas.filter(f => f.moneda === moneda && (!empresa || f.empresa === empresa))
  const pagadas = sel.filter(f => esPagado(f.concepto) && enMes(f))
  const porPagarFilas = sel.filter(f => f.concepto === 'Por pagar')

  const porConcepto = CONCEPTOS_PAGADOS.map(concepto => {
    const delConcepto = pagadas.filter(f => f.concepto === concepto)
    return { concepto, monto: sumar(delConcepto), registros: delConcepto.reduce((s, f) => s + f.registros, 0) }
  }).filter(c => c.registros > 0)

  // Serie mensual continua, desde el primer mes con movimientos hasta el mes en curso
  const conMovimiento = sel.filter(f => f.mes && (esPagado(f.concepto) || f.concepto === 'Total de facturas'))
  const actual = mesActual()
  const porMes: PuntoMes[] = []
  if (conMovimiento.length > 0) {
    const ordenados = conMovimiento.map(f => f.mes!).sort()
    const ultimo = ordenados[ordenados.length - 1]
    const fin = ultimo > actual ? ultimo : actual
    for (let m = ordenados[0]; m <= fin; m = siguienteMes(m)) {
      const delMes = conMovimiento.filter(f => f.mes === m)
      porMes.push({
        mes: m,
        monto: sumar(delMes.filter(f => esPagado(f.concepto))),
        facturas: sumar(delMes.filter(f => f.concepto === 'Total de facturas')),
        parcial: m === actual,
      })
    }
  }

  // Categorías: las mayores, y el resto agrupado para no pasar de 8 barras.
  const cat = new Map<string, number>()
  for (const f of pagadas) cat.set(f.categoria, (cat.get(f.categoria) ?? 0) + f.monto)
  const ordenadas = [...cat.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto)
  const porCategoria = ordenadas.slice(0, MAX_CATEGORIAS)
  const resto = ordenadas.slice(MAX_CATEGORIAS).reduce((s, c) => s + c.monto, 0)
  if (resto > 0) porCategoria.push({ categoria: 'Otras categorías', monto: resto })

  // Por empresa (ignora el filtro de empresa: la tabla es justamente la comparación entre ellas)
  const delaMoneda = filas.filter(f => f.moneda === moneda)
  const porEmpresa = [...new Set(delaMoneda.map(f => f.empresa))]
    .map(e => ({
      empresa: e,
      pagado: sumar(delaMoneda.filter(f => f.empresa === e && esPagado(f.concepto) && enMes(f))),
      porPagar: sumar(delaMoneda.filter(f => f.empresa === e && f.concepto === 'Por pagar')),
    }))
    .filter(e => e.pagado !== 0 || e.porPagar !== 0)
    .sort((a, b) => b.pagado - a.pagado || b.porPagar - a.porPagar)

  return {
    pagado: sumar(pagadas),
    facturas: sumar(sel.filter(f => f.concepto === 'Total de facturas' && enMes(f))),
    confirmingSinReponer: sumar(sel.filter(f => f.concepto === 'Confirming sin reponer' && enMes(f))),
    porConcepto,
    porPagar: sumar(porPagarFilas),
    registrosPorPagar: porPagarFilas.reduce((s, f) => s + f.registros, 0),
    porMes,
    porCategoria,
    porEmpresa,
    empresas,
    meses,
  }
}
