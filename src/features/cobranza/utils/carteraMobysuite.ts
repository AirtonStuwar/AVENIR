// Convierte la respuesta cruda de /api/mobysuite-cronograma en el mismo formato
// (CarteraMock) que ya usa el dashboard de IngresoPage, para reemplazar los datos
// de ejemplo por datos reales sin tocar el diseño visual.
//
// ⚠️ La clasificación por "producto" (cuotaInicial/planAhorro/desembolsoHipotecario/
// creditoDirecto) es una PROPUESTA basada en los textos de descripción que ya vimos
// en los 5 proyectos probados — falta confirmarla con Comercial/Finanzas (ver nota
// al final del archivo con las preguntas exactas pendientes).

export interface CuotaMobysuite {
  contratoId: number
  contratoEstado: string
  clienteRut: string | null
  clienteNombre: string | null
  numeroCuota: number
  descripcion: string
  categoria: 'BANCO' | 'CLIENTE'
  fechaVencimiento: string | null
  fechaPago: string | null
  monto: number
  estado: 'Pagado' | 'Pendiente' | 'Vencido'
}

export interface CronogramaResponse {
  totalContratos: number
  totalCuotas: number
  ventasAcumuladas: number
  cuotas: CuotaMobysuite[]
}

export interface CarteraMock {
  ventasAcumuladas: number
  cobradoAcumulado: number
  clientesActivos: number
  clientesMorosos: number
  diasMoraPonderados: number
  composicion: { cuotaInicial: number; planAhorro: number; desembolsoHipotecario: number; creditoDirecto: number }
  mora: { rango: string; monto: number }[]
  cobradoDelMes: number
  metaMensual: number
  cumplimiento: {
    planAhorro: { clientes: number; cumplidos: number }
    desembolsoHipotecario: { clientes: number; cumplidos: number }
    creditoDirecto: { clientes: number; cumplidos: number }
  }
}

type Producto = 'cuotaInicial' | 'planAhorro' | 'desembolsoHipotecario' | 'creditoDirecto' | 'otros'

// PROPUESTA de mapeo (pendiente de confirmar con Comercial/Finanzas):
function clasificarProducto(descripcion: string): Producto {
  const d = descripcion.toUpperCase()
  if (d.includes('HIPOTECARIO')) return 'desembolsoHipotecario'
  if (d.includes('ABONO')) return 'planAhorro'
  if (d.includes('CONSTRUCCION') || d.includes('CONSTRUCCIÓN') || d.includes('FINANCIAMIENTO PROPIO')) return 'creditoDirecto'
  if (d.includes('INICIAL') || d.includes('SEPARACION') || d.includes('SEPARACIÓN')) return 'cuotaInicial'
  return 'otros'
}

function diasEntre(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()
  return Math.round(ms / 86_400_000)
}

export function construirCartera(json: CronogramaResponse, metaMensual: number): CarteraMock {
  const hoy = new Date().toISOString().slice(0, 10)
  const inicioMes = hoy.slice(0, 7) + '-01'

  let cobradoAcumulado = 0
  let cobradoDelMes = 0
  const clientesSet = new Set<string>()
  const clientesMorososSet = new Set<string>()
  let diasMoraPonderados = 0
  let clientesConMoraCount = 0

  const composicion = { cuotaInicial: 0, planAhorro: 0, desembolsoHipotecario: 0, creditoDirecto: 0 }
  const mora = [
    { rango: '1-30 días', monto: 0 },
    { rango: '31-60 días', monto: 0 },
    { rango: '61-90 días', monto: 0 },
    { rango: '+90 días', monto: 0 },
  ]

  // por producto: clientes con al menos 1 cuota, y clientes sin ninguna vencida en ese producto
  const porProducto: Record<Exclude<Producto, 'otros'>, { clientes: Set<string>; morosos: Set<string> }> = {
    cuotaInicial: { clientes: new Set(), morosos: new Set() },
    planAhorro: { clientes: new Set(), morosos: new Set() },
    desembolsoHipotecario: { clientes: new Set(), morosos: new Set() },
    creditoDirecto: { clientes: new Set(), morosos: new Set() },
  }

  for (const c of json.cuotas) {
    const clienteKey = c.clienteRut ?? `contrato-${c.contratoId}`
    clientesSet.add(clienteKey)

    if (c.estado === 'Pagado') {
      cobradoAcumulado += c.monto
      if (c.fechaPago && c.fechaPago >= inicioMes) cobradoDelMes += c.monto
      const prod = clasificarProducto(c.descripcion)
      if (prod !== 'otros') composicion[prod] += c.monto
    }

    if (c.estado === 'Vencido') {
      clientesMorososSet.add(clienteKey)
      const dias = diasEntre(c.fechaVencimiento ?? hoy, hoy)
      diasMoraPonderados += dias
      clientesConMoraCount++
      if (dias <= 30) mora[0].monto += c.monto
      else if (dias <= 60) mora[1].monto += c.monto
      else if (dias <= 90) mora[2].monto += c.monto
      else mora[3].monto += c.monto
    }

    const prod = clasificarProducto(c.descripcion)
    if (prod !== 'otros') {
      porProducto[prod].clientes.add(clienteKey)
      if (c.estado === 'Vencido') porProducto[prod].morosos.add(clienteKey)
    }
  }

  const cumplimiento = (p: Exclude<Producto, 'otros'>) => ({
    clientes: porProducto[p].clientes.size,
    cumplidos: porProducto[p].clientes.size - porProducto[p].morosos.size,
  })

  return {
    ventasAcumuladas: json.ventasAcumuladas,
    cobradoAcumulado,
    clientesActivos: clientesSet.size,
    clientesMorosos: clientesMorososSet.size,
    // diasMoraPonderados aquí es la suma de días de atraso de CUOTAS vencidas (no de clientes) —
    // se divide entre clientesMorosos.size al mostrarlo, igual que hacía el mock.
    diasMoraPonderados: clientesConMoraCount > 0 ? diasMoraPonderados : 0,
    composicion,
    mora,
    cobradoDelMes,
    metaMensual,
    cumplimiento: {
      planAhorro: cumplimiento('planAhorro'),
      desembolsoHipotecario: cumplimiento('desembolsoHipotecario'),
      creditoDirecto: cumplimiento('creditoDirecto'),
    },
  }
}

/*
 * PREGUNTAS PENDIENTES PARA COMERCIAL / FINANZAS (antes de dar por buena esta clasificación):
 *
 * 1. "Cuota Inicial" — hoy agrupa las descripciones "Inicial" y "Separación". ¿Es correcto
 *    juntarlas, o la Separación debería ser su propia categoría (no aparece en el dashboard
 *    de referencia)?
 * 2. "Plan de Ahorro" — lo mapeé a las cuotas con descripción "CUOTA ABONO". ¿Es correcto?
 * 3. "Crédito Directo" — lo mapeé a "Cuotas durante la construcción / Financiamiento Propio".
 *    ¿Es correcto, o "Crédito Directo" es otra cosa que no vimos en los 5 proyectos probados?
 * 4. "Desembolso Hipotecario" — mapeado directo a cualquier descripción con "Hipotecario". Esto
 *    ya estaba confirmado antes (categoria BANCO).
 * 5. ¿Existen otras descripciones de cuota en Mobysuite (de otros proyectos, o casos no vistos
 *    en la muestra) que deberían caer en alguna de estas 4 categorías y que hoy quedarían
 *    fuera (bucket "otros", no se muestran en la torta)?
 */
