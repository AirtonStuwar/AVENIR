import { supabase } from '../../../api/supabase'

export type Moneda = 'PEN' | 'USD'

// Una fila = un mes × empresa × moneda × categoría × estado de pago (ya agregada en la BD).
export interface FilaEgreso {
  mes: string | null            // 'YYYY-MM' del pago; null cuando está por pagar
  empresa: string
  moneda: Moneda
  categoria: string
  estado_pago: 'Pagado' | 'Por pagar'
  registros: number
  monto: number
}

/**
 * Egresos de todas las empresas y módulos, agregados en la BD (función `get_finanzas_egresos`,
 * solo responde a ADMIN). El rango de fechas aplica solo a lo ya pagado: "por pagar" es siempre
 * la foto de hoy.
 */
export async function getFinanzasEgresos(desde?: string, hasta?: string): Promise<FilaEgreso[]> {
  const { data, error } = await supabase.rpc('get_finanzas_egresos', {
    p_desde: desde || null,
    p_hasta: hasta || null,
  })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
    mes: (r.mes as string | null) ?? null,
    empresa: String(r.empresa),
    moneda: r.moneda as Moneda,
    categoria: String(r.categoria),
    estado_pago: r.estado_pago as 'Pagado' | 'Por pagar',
    registros: Number(r.registros),
    monto: Number(r.monto),
  }))
}

// ── Cálculos para la pantalla ─────────────────────────────────────────

export interface PuntoMes {
  mes: string
  monto: number
  registros: number
  parcial: boolean   // mes en curso: todavía incompleto
}

export interface BarraCategoria {
  categoria: string
  monto: number
}

export interface FilaEmpresa {
  empresa: string
  pagado: number
  registros: number
  porPagar: number
}

export interface ResumenEgresos {
  pagado: number
  registrosPagados: number
  porPagar: number
  registrosPorPagar: number
  porMes: PuntoMes[]
  ultimoMesCompleto: { mes: string; monto: number } | null
  variacionPct: number | null      // último mes completo vs el anterior; null si no hay con qué comparar
  porCategoria: BarraCategoria[]
  porEmpresa: FilaEmpresa[]
  empresas: string[]               // para el filtro (todas las que aparecen en los datos)
}

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function siguienteMes(m: string): string {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm, 1) // mm ya es el mes siguiente en base 0
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MAX_CATEGORIAS = 7

export function resumir(filas: FilaEgreso[], moneda: Moneda, empresa: string): ResumenEgresos {
  const empresas = [...new Set(filas.map(f => f.empresa))].sort((a, b) => a.localeCompare(b))
  const sel = filas.filter(f => f.moneda === moneda && (!empresa || f.empresa === empresa))
  const pagadas = sel.filter(f => f.estado_pago === 'Pagado' && f.mes)
  const porPagarFilas = sel.filter(f => f.estado_pago === 'Por pagar')

  // Serie mensual continua: desde el primer mes con datos hasta el mes en curso (los meses
  // sin pagos aparecen en cero, para no esconder huecos).
  const acumulado = new Map<string, { monto: number; registros: number }>()
  for (const f of pagadas) {
    const a = acumulado.get(f.mes!) ?? { monto: 0, registros: 0 }
    a.monto += f.monto
    a.registros += f.registros
    acumulado.set(f.mes!, a)
  }
  const actual = mesActual()
  const porMes: PuntoMes[] = []
  if (acumulado.size > 0) {
    const primero = [...acumulado.keys()].sort()[0]
    const ultimoConDatos = [...acumulado.keys()].sort().slice(-1)[0]
    const fin = ultimoConDatos > actual ? ultimoConDatos : actual
    for (let m = primero; m <= fin; m = siguienteMes(m)) {
      const a = acumulado.get(m)
      porMes.push({ mes: m, monto: a?.monto ?? 0, registros: a?.registros ?? 0, parcial: m === actual })
    }
  }

  // Variación: solo entre meses completos (comparar un mes a medias contra uno entero engaña).
  const completos = porMes.filter(p => !p.parcial)
  const ultimo = completos.length ? completos[completos.length - 1] : null
  const previo = completos.length > 1 ? completos[completos.length - 2] : null
  const variacionPct = ultimo && previo && previo.monto > 0
    ? ((ultimo.monto - previo.monto) / previo.monto) * 100
    : null

  // Categorías: las mayores, y el resto agrupado para no pasar de 8 barras.
  const cat = new Map<string, number>()
  for (const f of pagadas) cat.set(f.categoria, (cat.get(f.categoria) ?? 0) + f.monto)
  const ordenadas = [...cat.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto)
  const porCategoria = ordenadas.slice(0, MAX_CATEGORIAS)
  const resto = ordenadas.slice(MAX_CATEGORIAS).reduce((s, c) => s + c.monto, 0)
  if (resto > 0) porCategoria.push({ categoria: 'Otras categorías', monto: resto })

  // Por empresa (ignora el filtro de empresa: la tabla es justamente la comparación entre ellas)
  const delaMoneda = filas.filter(f => f.moneda === moneda)
  const emp = new Map<string, FilaEmpresa>()
  for (const f of delaMoneda) {
    const e = emp.get(f.empresa) ?? { empresa: f.empresa, pagado: 0, registros: 0, porPagar: 0 }
    if (f.estado_pago === 'Pagado') { e.pagado += f.monto; e.registros += f.registros }
    else e.porPagar += f.monto
    emp.set(f.empresa, e)
  }
  const porEmpresa = [...emp.values()].sort((a, b) => (b.pagado + b.porPagar) - (a.pagado + a.porPagar))

  return {
    pagado: pagadas.reduce((s, f) => s + f.monto, 0),
    registrosPagados: pagadas.reduce((s, f) => s + f.registros, 0),
    porPagar: porPagarFilas.reduce((s, f) => s + f.monto, 0),
    registrosPorPagar: porPagarFilas.reduce((s, f) => s + f.registros, 0),
    porMes,
    ultimoMesCompleto: ultimo ? { mes: ultimo.mes, monto: ultimo.monto } : null,
    variacionPct,
    porCategoria,
    porEmpresa,
    empresas,
  }
}
