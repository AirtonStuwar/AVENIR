// Cálculos de los dos reportes por empresa de Ingreso: "Resumen ejecutivo" y "Meta y cumplimiento mensual".
// Todo sale de las cuotas de Mobysuite (/api/mobysuite-cronograma), sin guardar nada.
//
// Reglas (propuestas, a confirmar con Finanzas):
// - Solo cuotas del CLIENTE (categoria CLIENTE): el desembolso del banco no es cobranza del cliente.
// - "Programado" = cuotas cuyo vencimiento cae en el período; "Cobrado" = cuotas pagadas con fecha de pago
//   válida (ver cobradoMes.ts) dentro del período. Una cuota pagada con fecha dudosa no se asigna a ningún mes.
// - "Sin pago" se mide por contrato (no por cliente): días desde su último pago válido.

import { fechaPagoValida, hoyLocal, mesActual } from './cobradoMes'
import { contarContratosPorEtapa } from './etapas'
import type { CuotaMobysuite } from './carteraMobysuite'

export type CategoriaCobranza = 'cuotaInicial' | 'fraccionamiento' | 'letras' | 'separacion' | 'otras'

// Por el texto de la cuota. El orden importa: "Separación" y "Fraccionamiento" antes que "Inicial".
export function clasificarCobranza(descripcion: string): CategoriaCobranza {
  const d = descripcion.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (d.includes('SEPARACI')) return 'separacion'
  if (d.includes('FRACCIONAMIENTO')) return 'fraccionamiento'
  if (d.includes('LETRA')) return 'letras'
  if (d.includes('INICIAL')) return 'cuotaInicial'
  return 'otras'
}

const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000)

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
const nombreMes = (mes: string) => MESES[Number(mes.split('-')[1]) - 1] ?? mes

function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

const fechaOk = (f: string | null | undefined) => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= '2020-01-01'

export interface ResumenEmpresa {
  corte: string
  ventas: number; cobrado: number; saldo: number; pctCobrado: number
  clientes: number; contratos: number
  mesMeta: string                      // nombre del mes anterior ('Octubre')
  metaAcum: number; cobradoAcum: number; brechaAcum: number; pctMeta: number
  cierre: { programado: number; cobrado: number; pct: number | null }
  sinPago90: number; contratosTotal: number; sinNingunPago: number
  inicialBajo: number; inicialContratos: number
  diasPromedio: number | null
  minutas: number; separaciones: number
  composicion: { clave: CategoriaCobranza; nombre: string; monto: number; pct: number }[]
  buckets: { nombre: string; pct: number }[]
}

export type EstadoMes = 'cumple' | 'parcial' | 'bajo' | 'sin_meta' | 'recupera'
export interface FilaMes { mes: string; etiqueta: string; programado: number; cobrado: number; pct: number | null; estado: EstadoMes; recuperado: number }
export interface TablaMensual {
  filas: FilaMes[]
  total: { programado: number; cobrado: number; pct: number | null }
  dudosas: { cuotas: number; monto: number }
}

const NOMBRES_COMP: Record<CategoriaCobranza, string> = {
  cuotaInicial: 'Cuota inicial', fraccionamiento: 'Fraccionamiento', letras: 'Letras', separacion: 'Separación', otras: 'Otras',
}

export function calcularResumen(cuotas: CuotaMobysuite[], ventasAcumuladas: number): ResumenEmpresa {
  const hoy = hoyLocal()
  const mesPrev = mesAnterior(mesActual())
  const cliente = cuotas.filter(c => c.categoria === 'CLIENTE')
  const pagadas = cliente.filter(c => c.estado === 'Pagado')

  const cobrado = pagadas.reduce((s, c) => s + c.monto, 0)
  const metaAcum = cliente.filter(c => fechaOk(c.fechaVencimiento) && c.fechaVencimiento!.slice(0, 7) <= mesPrev).reduce((s, c) => s + c.monto, 0)
  const cobradoAcum = pagadas.filter(c => fechaPagoValida(c.fechaPago, hoy) && c.fechaPago!.slice(0, 7) <= mesPrev).reduce((s, c) => s + c.monto, 0)
  const progHoy = cliente.filter(c => fechaOk(c.fechaVencimiento) && c.fechaVencimiento! <= hoy).reduce((s, c) => s + c.monto, 0)
  const cobHoy = pagadas.filter(c => fechaPagoValida(c.fechaPago, hoy)).reduce((s, c) => s + c.monto, 0)

  // Por contrato
  const contratos = new Map<number, { ultimo: string | null; precio: number; inicial: number }>()
  for (const c of cuotas) {
    const k = contratos.get(c.contratoId) ?? { ultimo: null, precio: 0, inicial: 0 }
    k.precio += c.monto
    if (c.categoria === 'CLIENTE' && c.estado === 'Pagado') {
      if (fechaPagoValida(c.fechaPago, hoy) && (!k.ultimo || c.fechaPago! > k.ultimo)) k.ultimo = c.fechaPago!
      const cat = clasificarCobranza(c.descripcion)
      if (cat === 'cuotaInicial' || cat === 'separacion') k.inicial += c.monto
    }
    contratos.set(c.contratoId, k)
  }
  const lista = [...contratos.values()]
  const dias = lista.map(k => k.ultimo ? diasEntre(k.ultimo, hoy) : null)
  const conPago = dias.filter((d): d is number => d !== null)
  const sinNingunPago = dias.length - conPago.length
  const sinPago90 = dias.filter(d => d === null || d > 90).length
  const conPrecio = lista.filter(k => k.precio > 0)
  const inicialBajo = conPrecio.filter(k => k.inicial / k.precio < 0.10).length

  const rango = (min: number, max: number) => dias.filter(d => d !== null && d >= min && d <= max).length
  const nCont = lista.length || 1
  const buckets = [
    { nombre: '0–30 d', n: rango(0, 30) }, { nombre: '31–60 d', n: rango(31, 60) },
    { nombre: '61–90 d', n: rango(61, 90) }, { nombre: '>90 d', n: sinPago90 },
  ].map(b => ({ nombre: b.nombre, pct: (b.n / nCont) * 100 }))

  const comp: Record<CategoriaCobranza, number> = { cuotaInicial: 0, fraccionamiento: 0, letras: 0, separacion: 0, otras: 0 }
  for (const c of pagadas) comp[clasificarCobranza(c.descripcion)] += c.monto
  const composicion = (Object.keys(comp) as CategoriaCobranza[])
    .map(clave => ({ clave, nombre: NOMBRES_COMP[clave], monto: comp[clave], pct: cobrado > 0 ? (comp[clave] / cobrado) * 100 : 0 }))
    .filter(x => x.monto > 0)
    .sort((a, b) => b.monto - a.monto)

  const etapas = contarContratosPorEtapa(cuotas)
  return {
    corte: hoy,
    ventas: ventasAcumuladas, cobrado, saldo: ventasAcumuladas - cobrado,
    pctCobrado: ventasAcumuladas > 0 ? (cobrado / ventasAcumuladas) * 100 : 0,
    clientes: new Set(cuotas.map(c => c.clienteRut ?? `contrato-${c.contratoId}`)).size,
    contratos: etapas.total,
    mesMeta: nombreMes(mesPrev), metaAcum, cobradoAcum,
    brechaAcum: Math.max(0, metaAcum - cobradoAcum),
    pctMeta: metaAcum > 0 ? (cobradoAcum / metaAcum) * 100 : 0,
    cierre: { programado: progHoy, cobrado: cobHoy, pct: progHoy > 0 ? (cobHoy / progHoy) * 100 : null },
    sinPago90, contratosTotal: lista.length, sinNingunPago,
    inicialBajo, inicialContratos: conPrecio.length,
    diasPromedio: conPago.length ? conPago.reduce((s, d) => s + d, 0) / conPago.length : null,
    minutas: etapas.porEtapa.PROMESADO, separaciones: etapas.porEtapa.RESERVADO,
    composicion, buckets,
  }
}

export function calcularTablaMensual(cuotas: CuotaMobysuite[]): TablaMensual {
  const hoy = hoyLocal()
  const mesHoy = mesActual()
  const prog = new Map<string, number>()
  const cob = new Map<string, number>()
  const dudosas = { cuotas: 0, monto: 0 }

  for (const c of cuotas) {
    if (c.categoria !== 'CLIENTE') continue
    if (fechaOk(c.fechaVencimiento) && c.fechaVencimiento! <= hoy) {
      const m = c.fechaVencimiento!.slice(0, 7)
      prog.set(m, (prog.get(m) ?? 0) + c.monto)
    }
    if (c.estado === 'Pagado') {
      if (fechaPagoValida(c.fechaPago, hoy)) {
        const m = c.fechaPago!.slice(0, 7)
        cob.set(m, (cob.get(m) ?? 0) + c.monto)
      } else { dudosas.cuotas++; dudosas.monto += c.monto }
    }
  }

  const meses = [...new Set([...prog.keys(), ...cob.keys()])].sort()
  const filas: FilaMes[] = []
  let progAcum = 0, cobAcum = 0
  for (const mes of meses) {
    const p = prog.get(mes) ?? 0, c = cob.get(mes) ?? 0
    const gapPrev = Math.max(0, progAcum - cobAcum)
    let estado: EstadoMes
    const pctMes: number | null = p > 0 ? (c / p) * 100 : null
    if (c > p && gapPrev > 0) estado = 'recupera'
    else if (p === 0) estado = 'sin_meta'
    else estado = pctMes! >= 98 ? 'cumple' : pctMes! >= 80 ? 'parcial' : 'bajo'
    const etiqueta = mes === mesHoy ? `${nombreMes(mes)} (al ${Number(hoy.slice(8))})` : mes.slice(0, 4) === hoy.slice(0, 4) ? nombreMes(mes) : `${nombreMes(mes)} ${mes.slice(0, 4)}`
    filas.push({ mes, etiqueta, programado: p, cobrado: c, pct: pctMes, estado, recuperado: estado === 'recupera' ? Math.min(c - p, gapPrev) : 0 })
    progAcum += p; cobAcum += c
  }
  return { filas, total: { programado: progAcum, cobrado: cobAcum, pct: progAcum > 0 ? (cobAcum / progAcum) * 100 : null }, dudosas }
}
