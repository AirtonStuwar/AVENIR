import ExcelJS from 'exceljs'
import { supabase } from '../../../api/supabase'
import type {
  MovimientoBanco, RegistroPagable, ResultadoConciliacion, MovimientoConciliado,
  ConciliacionGuardada, ModuloConciliable,
} from '../types/conciliacion'

const TOLERANCIA_DIAS = 3

/**
 * Calcula el rango de fechas real cubierto por el archivo del banco (± tolerancia del match),
 * para usarlo como límite de búsqueda en vez de confiar en el fechaDesde/fechaHasta que
 * escriba el usuario — así nunca se puede cruzar con registros fuera del período que
 * realmente cubre el estado de cuenta subido, aunque el usuario haya puesto un rango más amplio.
 */
export function rangoDesdeMovimientos(movimientos: MovimientoBanco[]): { desde: string; hasta: string } | null {
  const fechas = movimientos
    .map(m => m.fecha_oper ?? m.fecha_valor)
    .filter((f): f is string => !!f)
    .sort()
  if (fechas.length === 0) return null
  const addDias = (iso: string, dias: number) => {
    const d = new Date(iso + 'T00:00:00')
    d.setDate(d.getDate() + dias)
    return d.toISOString().slice(0, 10)
  }
  return { desde: addDias(fechas[0], -TOLERANCIA_DIAS), hasta: addDias(fechas[fechas.length - 1], TOLERANCIA_DIAS) }
}

// ── Monto neto que realmente sale del banco por cada registro ──────────────
// (mismo criterio que el "monto a girar" del Excel BBVA: descuenta detracción/retención)

interface SolicitudPagableRow {
  id: number; codigo: string | null; razon_social: string | null
  monto_total: number | null; monto_detraccion: number | null; monto_retencion: number | null
  monto_fondo_garantia: number | null
  detraccion_id: number | null; moneda: string | null; banco: string | null
  solicitud_tipo: { nombre: string } | null
  detraccion: { porcentaje: number } | null
}

async function fetchSolicitudesPagables(cuentaId: number, fechaDesde: string, fechaHasta: string): Promise<RegistroPagable[]> {
  const { data, error } = await supabase
    .from('solicitud')
    .select('id, codigo, razon_social, monto_total, monto_detraccion, monto_retencion, monto_fondo_garantia, detraccion_id, moneda, banco, fecha_pago, solicitud_tipo:tipo_id(nombre), detraccion:detraccion_id(porcentaje)')
    .eq('cuenta_pago_id', cuentaId)
    .gte('fecha_pago', fechaDesde)
    .lte('fecha_pago', fechaHasta)
  if (error) throw error

  // Las facturas con valorizacion pagadas en partes entran por cada pago (con su cuenta, fecha y monto), no por la
  // solicitud completa: su cuenta_pago_id solo guarda la del ultimo pago y el monto a girar total no sale de un solo banco.
  const ids = (data ?? []).map(r => (r as { id: number }).id)
  const enPartes = new Set<number>()
  if (ids.length) {
    const { data: conPagos } = await supabase.from('solicitud_pago').select('solicitud_id').in('solicitud_id', ids)
    for (const r of (conPagos ?? []) as { solicitud_id: number }[]) enPartes.add(r.solicitud_id)
  }
  const pagosEnPartes = await fetchPagosEnPartes(cuentaId, fechaDesde, fechaHasta)

  const individuales = ((data ?? []) as unknown as (SolicitudPagableRow & { fecha_pago: string })[]).filter(s => !enPartes.has(s.id)).map(s => {
    const total = s.monto_total ?? 0
    const tipo = s.solicitud_tipo?.nombre
    const isPEN = (s.moneda ?? 'PEN') === 'PEN'
    const fondoGarantia = s.monto_fondo_garantia ?? 0
    let monto = total - fondoGarantia
    if (tipo === 'Recibo por Honorarios' || tipo === 'Otros') {
      monto = total - (s.monto_retencion ?? 0)
    } else if (tipo !== 'Liberalidad' && s.detraccion_id) {
      if (isPEN) monto = total - (s.monto_detraccion ?? 0) - fondoGarantia
      else {
        const pct = s.detraccion?.porcentaje ?? 0
        monto = Math.round((total - total * pct / 100) * 100) / 100 - fondoGarantia
      }
    }
    return {
      modulo: 'solicitud' as ModuloConciliable,
      id: s.id, codigo: s.codigo, beneficiario: s.razon_social,
      monto, fecha_pago: s.fecha_pago, banco: s.banco,
    }
  })
  return [...individuales, ...pagosEnPartes]
}

async function fetchPagosEnPartes(cuentaId: number, fechaDesde: string, fechaHasta: string): Promise<RegistroPagable[]> {
  const { data, error } = await supabase
    .from('solicitud_pago')
    .select('id, solicitud_id, monto, fecha_pago, solicitud:solicitud_id(codigo, razon_social, banco)')
    .eq('cuenta_pago_id', cuentaId)
    .gte('fecha_pago', fechaDesde)
    .lte('fecha_pago', fechaHasta)
  if (error) throw error
  type Fila = { id: number; solicitud_id: number; monto: number; fecha_pago: string; solicitud: { codigo: string | null; razon_social: string | null; banco: string | null } | null }
  const filas = (data ?? []) as unknown as Fila[]
  // Numera las partes de cada factura (parte 1, 2...) para distinguirlas en pantalla
  const total = new Map<number, number>()
  if (filas.length) {
    const { data: todas } = await supabase.from('solicitud_pago').select('id, solicitud_id').in('solicitud_id', [...new Set(filas.map(f => f.solicitud_id))]).order('id')
    const cont = new Map<number, number>()
    for (const t of (todas ?? []) as { id: number; solicitud_id: number }[]) {
      const n = (cont.get(t.solicitud_id) ?? 0) + 1
      cont.set(t.solicitud_id, n); total.set(t.id, n)
    }
  }
  return filas.map(f => ({
    modulo: 'solicitud' as ModuloConciliable,
    id: f.solicitud_id,
    pagoId: f.id,
    codigo: f.solicitud?.codigo ? `${f.solicitud.codigo} (pago ${total.get(f.id) ?? 1})` : null,
    beneficiario: f.solicitud?.razon_social ?? null,
    monto: Number(f.monto),
    fecha_pago: f.fecha_pago,
    banco: f.solicitud?.banco ?? null,
  }))
}

async function fetchGenericoPagables(
  tabla: string, moduloKey: ModuloConciliable, campoMonto: string, campoBeneficiario: string,
  cuentaId: number, fechaDesde: string, fechaHasta: string,
): Promise<RegistroPagable[]> {
  const { data, error } = await supabase
    .from(tabla)
    .select(`id, codigo, ${campoBeneficiario}, ${campoMonto}, fecha_pago, banco`)
    .eq('cuenta_pago_id', cuentaId)
    .gte('fecha_pago', fechaDesde)
    .lte('fecha_pago', fechaHasta)
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
    modulo: moduloKey,
    id: r.id as number,
    codigo: (r.codigo as string | null) ?? null,
    beneficiario: (r[campoBeneficiario] as string | null) ?? null,
    monto: (r[campoMonto] as number | null) ?? 0,
    fecha_pago: r.fecha_pago as string,
    banco: (r.banco as string | null) ?? null,
  }))
}

const DIAS_COBRO_CHEQUE = 45   // un cheque de gerencia puede cobrarse hasta ~45 dias despues de emitido

const sumaDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const x = new Date(y, m - 1, d + dias)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/**
 * Devoluciones de cliente pagadas desde esta cuenta. Las transferencias entran por su fecha de pago como los demas
 * modulos; los cheques de gerencia tambien se buscan hasta 45 dias antes del archivo (se cobran despues de emitirse),
 * salvo los que ya quedaron cruzados en una conciliacion guardada.
 */
async function fetchDevolucionesPagables(cuentaId: number, fechaDesde: string, fechaHasta: string): Promise<RegistroPagable[]> {
  const { data, error } = await supabase
    .from('devolucion_cliente')
    .select('id, codigo, cliente_nombre, monto, fecha_pago, banco, medio_pago, numero_cheque')
    .eq('cuenta_pago_id', cuentaId)
    .gte('fecha_pago', sumaDias(fechaDesde, -DIAS_COBRO_CHEQUE))
    .lte('fecha_pago', fechaHasta)
  if (error) throw error

  type Fila = { id: number; codigo: string | null; cliente_nombre: string | null; monto: number | null; fecha_pago: string; banco: string | null; medio_pago: string | null; numero_cheque: string | null }
  const filas = (data ?? []) as unknown as Fila[]
  const esCheque = (f: Fila) => f.medio_pago === 'Cheque de gerencia'

  // Cheques emitidos antes del rango: solo los que aun no se cruzaron en una conciliacion guardada
  const previos = filas.filter(f => esCheque(f) && f.fecha_pago < fechaDesde).map(f => f.id)
  let yaCruzados = new Set<number>()
  if (previos.length > 0) {
    const { data: m } = await supabase.from('conciliacion_match').select('registro_id').eq('modulo', 'devolucion_cliente').in('registro_id', previos)
    yaCruzados = new Set(((m ?? []) as { registro_id: number }[]).map(x => x.registro_id))
  }

  return filas
    .filter(f => esCheque(f) ? !(f.fecha_pago < fechaDesde && yaCruzados.has(f.id)) : f.fecha_pago >= fechaDesde)
    .map(f => ({
      modulo: 'devolucion_cliente' as ModuloConciliable,
      id: f.id,
      codigo: f.codigo,
      beneficiario: esCheque(f) ? `${f.cliente_nombre ?? ''} (cheque N° ${f.numero_cheque ?? ''})`.trim() : f.cliente_nombre,
      monto: f.monto ?? 0,
      fecha_pago: f.fecha_pago,
      banco: f.banco,
      esCheque: esCheque(f),
      numero_cheque: f.numero_cheque,
    }))
}

/** Trae todos los registros (5 módulos) pagados desde esta cuenta bancaria, en el rango de fechas. */
export async function getRegistrosPagables(cuentaId: number, fechaDesde: string, fechaHasta: string): Promise<RegistroPagable[]> {
  const [sol, ar, reemb, cc, dev] = await Promise.all([
    fetchSolicitudesPagables(cuentaId, fechaDesde, fechaHasta),
    fetchGenericoPagables('solicitud_arendir', 'solicitud_arendir', 'total_reembolso', 'beneficiario_id', cuentaId, fechaDesde, fechaHasta)
      .then(rows => resolveBeneficiarios(rows)),
    fetchGenericoPagables('solicitud_reembolso', 'solicitud_reembolso', 'total_reembolso', 'beneficiario_id', cuentaId, fechaDesde, fechaHasta)
      .then(rows => resolveBeneficiarios(rows)),
    fetchGenericoPagables('caja_chica', 'caja_chica', 'transferencia', 'responsable_id', cuentaId, fechaDesde, fechaHasta)
      .then(rows => resolveBeneficiarios(rows)),
    fetchDevolucionesPagables(cuentaId, fechaDesde, fechaHasta),
  ])
  return [...sol, ...ar, ...reemb, ...cc, ...dev]
}

// beneficiario en A Rendir/Reembolso/Caja Chica viene como UUID (usuario) — hay que resolver el nombre
async function resolveBeneficiarios(rows: RegistroPagable[]): Promise<RegistroPagable[]> {
  const ids = [...new Set(rows.map(r => r.beneficiario).filter(Boolean))] as string[]
  if (!ids.length) return rows
  const { data } = await supabase.from('usuario').select('id, nombre_completo').in('id', ids)
  const map = Object.fromEntries((data ?? []).map((u: { id: string; nombre_completo: string | null }) => [u.id, u.nombre_completo]))
  return rows.map(r => ({ ...r, beneficiario: r.beneficiario ? (map[r.beneficiario] ?? r.beneficiario) : null }))
}

// ── Algoritmo de cruce ───────────────────────────────────────────────────

const centavos = (n: number) => Math.round(n * 100)
const diffDias = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
// Mismo criterio que el Excel de pago masivo BBVA: 'P' = cuenta propia BBVA, 'I' = interbancario (CCI).
const tipoAbono = (r: RegistroPagable): 'P' | 'I' => (r.banco === 'BBVA' ? 'P' : 'I')

// Un cheque cuenta como "cercano" si el movimiento del banco cae entre 1 dia antes y 45 despues de su emision;
// el resto de pagos, dentro de ±3 dias de su fecha de pago.
const fechaCerca = (r: RegistroPagable, fechaRef: string) => {
  if (!r.esCheque) return diffDias(r.fecha_pago, fechaRef) <= 3
  const dif = (new Date(fechaRef).getTime() - new Date(r.fecha_pago).getTime()) / 86400000
  return dif >= -1 && dif <= DIAS_COBRO_CHEQUE
}
// ¿El N° de cheque aparece en la descripcion / N° de operacion del movimiento? (desempata cheques del mismo monto)
const mencionaCheque = (r: RegistroPagable, mov: MovimientoBanco) => {
  const num = (r.numero_cheque ?? '').replace(/\D/g, '')
  if (!num) return false
  return [mov.descripcion, mov.n_operacion].some(t => String(t ?? '').replace(/\D/g, '').includes(num))
}

function buscarSubconjunto(candidatos: RegistroPagable[], objetivoCentavos: number, maxItems = 12): RegistroPagable[] | null {
  if (candidatos.length === 0 || candidatos.length > maxItems) return null
  const ordenados = [...candidatos].sort((a, b) => centavos(b.monto) - centavos(a.monto))
  const n = ordenados.length
  let resultado: RegistroPagable[] | null = null

  function backtrack(idx: number, restante: number, acumulado: RegistroPagable[]) {
    if (resultado) return
    if (restante === 0 && acumulado.length > 0) { resultado = [...acumulado]; return }
    if (idx >= n || restante < 0) return
    // incluir
    acumulado.push(ordenados[idx])
    backtrack(idx + 1, restante - centavos(ordenados[idx].monto), acumulado)
    acumulado.pop()
    if (resultado) return
    // excluir
    backtrack(idx + 1, restante, acumulado)
  }

  backtrack(0, objetivoCentavos, [])
  return resultado
}

/** Cruza los movimientos del banco (solo cargos = pagos) contra los registros pagables de AVENIR. */
export function conciliar(movimientos: MovimientoBanco[], registros: RegistroPagable[]): ResultadoConciliacion {
  const cargos = movimientos.filter(m => m.monto < 0)
  const disponibles = [...registros]
  const conciliados: MovimientoConciliado[] = []
  const sinMatchBanco: MovimientoConciliado[] = []

  for (const mov of cargos) {
    const objetivo = centavos(Math.abs(mov.monto))
    const fechaRef = mov.fecha_oper ?? mov.fecha_valor

    // 1) Match individual: mismo monto, fecha cercana (±3 días)
    const candidatos = disponibles
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => centavos(r.monto) === objetivo && (!fechaRef || fechaCerca(r, fechaRef)))
    const idx1a1 = (candidatos.find(({ r }) => mencionaCheque(r, mov)) ?? candidatos[0])?.i ?? -1
    if (idx1a1 !== -1) {
      const registro = disponibles.splice(idx1a1, 1)[0]
      conciliados.push({ movimiento: mov, estado: 'individual', registros: [registro] })
      continue
    }

    // 2) Match por grupo: varios registros de la misma fecha_pago Y mismo tipo de abono
    // (BBVA propio 'P' vs interbancario 'I' — BBVA nunca mezcla ambos en un mismo movimiento
    // de pago masivo, así que agrupar por esta clave evita combinaciones falsas y grupos
    // demasiado grandes para el buscador de subconjuntos).
    let matched = false
    if (fechaRef) {
      // Los cheques nunca forman parte de un pago masivo: se cruzan solo de a uno
      const cercanos = disponibles.filter(r => !r.esCheque && diffDias(r.fecha_pago, fechaRef) <= 3)
      const porFechaYTipo = new Map<string, RegistroPagable[]>()
      for (const r of cercanos) {
        const clave = `${r.fecha_pago}|${tipoAbono(r)}`
        const arr = porFechaYTipo.get(clave) ?? []
        arr.push(r); porFechaYTipo.set(clave, arr)
      }
      for (const grupo of porFechaYTipo.values()) {
        const combinacion = buscarSubconjunto(grupo, objetivo)
        if (combinacion) {
          for (const r of combinacion) {
            const i = disponibles.findIndex(d => d.modulo === r.modulo && d.id === r.id && d.pagoId === r.pagoId)
            if (i !== -1) disponibles.splice(i, 1)
          }
          conciliados.push({ movimiento: mov, estado: 'grupo', registros: combinacion })
          matched = true
          break
        }
      }
    }
    if (!matched) {
      sinMatchBanco.push({ movimiento: mov, estado: 'sin_match', registros: [] })
    }
  }

  return { conciliados, sinMatchBanco, sinMatchSistema: disponibles }
}

// ── Guardar / listar conciliaciones ─────────────────────────────────────

export async function guardarConciliacion(
  cuentaBancariaId: number, fechaDesde: string, fechaHasta: string,
  saldoAnterior: number | null, saldoFinal: number | null, nombreArchivo: string | null, usuarioId: string,
  resultado: ResultadoConciliacion,
): Promise<number> {
  const { data: cab, error: errCab } = await supabase
    .from('conciliacion_bancaria')
    .insert({
      cuenta_bancaria_id: cuentaBancariaId, fecha_desde: fechaDesde, fecha_hasta: fechaHasta,
      saldo_anterior: saldoAnterior, saldo_final: saldoFinal, nombre_archivo: nombreArchivo, usuario_id: usuarioId,
    })
    .select('id').single()
  if (errCab) throw errCab
  const conciliacionId = cab.id as number

  const todos = [...resultado.conciliados, ...resultado.sinMatchBanco]
  for (const mc of todos) {
    const { data: mov, error: errMov } = await supabase
      .from('conciliacion_movimiento')
      .insert({
        conciliacion_id: conciliacionId,
        fecha_oper: mc.movimiento.fecha_oper, fecha_valor: mc.movimiento.fecha_valor,
        descripcion: mc.movimiento.descripcion, n_operacion: mc.movimiento.n_operacion,
        monto: mc.movimiento.monto, itf: mc.movimiento.itf, saldo_contable: mc.movimiento.saldo_contable,
        estado_match: mc.estado,
      })
      .select('id').single()
    if (errMov) throw errMov
    if (mc.registros.length > 0) {
      const { error: errMatch } = await supabase.from('conciliacion_match').insert(
        mc.registros.map(r => ({ movimiento_id: mov.id, modulo: r.modulo, registro_id: r.id, monto: r.monto }))
      )
      if (errMatch) throw errMatch
    }
  }

  return conciliacionId
}

// ── Exportar Excel ────────────────────────────────────────────────────────

const MODULO_LABEL: Record<ModuloConciliable, string> = {
  solicitud: 'Solicitud (OC/RxH)',
  solicitud_arendir: 'A Rendir',
  solicitud_reembolso: 'Reembolso',
  caja_chica: 'Caja Chica',
  devolucion_cliente: 'Devolución',
}

export async function exportarConciliacionExcel(
  resultado: ResultadoConciliacion, cuentaLabel: string, fechaDesde: string, fechaHasta: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook()

  const wsConc = wb.addWorksheet('Conciliados')
  wsConc.addRow(['FECHA BANCO', 'DESCRIPCIÓN BANCO', 'MONTO BANCO', 'TIPO MATCH', 'MÓDULO', 'CÓDIGO', 'BENEFICIARIO', 'MONTO SISTEMA'])
  wsConc.getRow(1).font = { bold: true }
  for (const mc of resultado.conciliados) {
    if (mc.registros.length === 0) continue
    mc.registros.forEach((r, i) => {
      wsConc.addRow([
        i === 0 ? mc.movimiento.fecha_oper : '',
        i === 0 ? mc.movimiento.descripcion : '',
        i === 0 ? mc.movimiento.monto : '',
        i === 0 ? (mc.estado === 'grupo' ? 'Grupo' : 'Individual') : '',
        MODULO_LABEL[r.modulo], r.codigo, r.beneficiario, r.monto,
      ])
    })
  }
  wsConc.columns.forEach(c => { c.width = 20 })

  const wsBanco = wb.addWorksheet('Solo en el banco')
  wsBanco.addRow(['FECHA', 'DESCRIPCIÓN', 'N° OPERACIÓN', 'MONTO'])
  wsBanco.getRow(1).font = { bold: true }
  for (const mc of resultado.sinMatchBanco) {
    wsBanco.addRow([mc.movimiento.fecha_oper, mc.movimiento.descripcion, mc.movimiento.n_operacion, mc.movimiento.monto])
  }
  wsBanco.columns.forEach(c => { c.width = 24 })

  const wsSistema = wb.addWorksheet('Solo en AVENIR')
  wsSistema.addRow(['MÓDULO', 'CÓDIGO', 'BENEFICIARIO', 'MONTO', 'FECHA DE PAGO'])
  wsSistema.getRow(1).font = { bold: true }
  for (const r of resultado.sinMatchSistema) {
    wsSistema.addRow([MODULO_LABEL[r.modulo], r.codigo, r.beneficiario, r.monto, r.fecha_pago])
  }
  wsSistema.columns.forEach(c => { c.width = 22 })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conciliacion_${cuentaLabel.replace(/\s+/g, '_')}_${fechaDesde}_${fechaHasta}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function getConciliaciones(cuentaBancariaId?: number): Promise<ConciliacionGuardada[]> {
  let q = supabase.from('conciliacion_bancaria').select('*').order('fecha_creacion', { ascending: false })
  if (cuentaBancariaId) q = q.eq('cuenta_bancaria_id', cuentaBancariaId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ConciliacionGuardada[]
}
