import * as XLSX from 'xlsx'
import type { EstadoCuentaBBVA, MovimientoBanco } from '../types/conciliacion'

function norm(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ') // quita caracteres de control/no imprimibles que trae el export del banco
    .trim()
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** Convierte "30-05" (DD-MM, sin año) a "YYYY-MM-DD", infiriendo el año a partir de fechaHasta. */
function resolverFecha(ddmm: string, fechaHastaRef: string): string | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(ddmm.trim())
  if (!m) return null
  const dia = parseInt(m[1], 10)
  const mes = parseInt(m[2], 10)
  const ref = new Date(fechaHastaRef + 'T00:00:00')
  let anio = ref.getFullYear()
  // Si el mes del movimiento es varios meses posterior al de fechaHasta, es del año anterior (cruce de año)
  if (mes - (ref.getMonth() + 1) > 6) anio -= 1
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Parsea el reporte "Consulta de Estado de Cuenta" (CI00) de BBVA — soporta .xlsb y .xlsx.
 * fechaHastaRef se usa para inferir el año de las fechas del banco (el reporte no trae año en cada fila).
 */
export async function parseEstadoCuentaBBVA(file: File, fechaHastaRef: string): Promise<EstadoCuentaBBVA> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })

  let empresa: string | null = null
  let moneda: string | null = null
  let cuentaCci: string | null = null
  let headerRowIdx = -1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? []
    const c0 = norm(row[0])
    if (!empresa && c0.toUpperCase().includes('EMPRESA:')) {
      empresa = c0.split(/EMPRESA:/i)[1]?.trim() || null
    }
    if (!moneda && c0.toUpperCase().startsWith('MONEDA:')) {
      moneda = c0.split(':')[1]?.trim() || null
    }
    if (c0.toUpperCase().includes('CODIGO CUENTA INTERBANCARIA') && rows[i + 1]) {
      cuentaCci = norm(rows[i + 1][0]) || null
    }
    if (headerRowIdx === -1 && c0.toUpperCase().startsWith('FECHA OPER')) {
      headerRowIdx = i
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('No se reconoce el formato del archivo — no se encontró la tabla de movimientos (columna "FECHA OPER.").')
  }

  let saldoAnterior: number | null = null
  const movimientos: MovimientoBanco[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const descripcion = norm(row[2])
    const fechaTxt = norm(row[0])

    if (descripcion.toUpperCase().includes('SALDO ANTERIOR')) {
      saldoAnterior = toNumber(row[8])
      continue
    }
    if (descripcion.toUpperCase().includes('TOTALES POR ITF')) break
    if (!fechaTxt && !descripcion) {
      if (movimientos.length > 0) break
      continue
    }
    if (!fechaTxt) continue

    const monto = toNumber(row[6])
    if (monto == null) continue

    movimientos.push({
      fecha_oper: resolverFecha(fechaTxt, fechaHastaRef),
      fecha_valor: resolverFecha(norm(row[1]), fechaHastaRef),
      descripcion,
      n_operacion: norm(row[5]) || null,
      monto,
      itf: toNumber(row[7]),
      saldo_contable: toNumber(row[8]),
    })
  }

  if (movimientos.length === 0) {
    throw new Error('No se encontraron movimientos en el archivo.')
  }

  return { empresa, cuentaCci, moneda, saldoAnterior, movimientos }
}
