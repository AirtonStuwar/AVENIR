import { supabase } from '../../../api/supabase'
import ExcelJS from 'exceljs'

export type CategoriaCorreccion = 'Cuenta bancaria incorrecta' | 'Nombre mal escrito' | 'Archivo equivocado' | 'Otro'

export interface CorreccionLog {
  id: number
  tabla: string
  registro_id: number
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  categoria: CategoriaCorreccion
  motivo: string | null
  usuario_id: string
  fecha_creacion: string
}

/**
 * Corrige un campo de texto directo en `tabla` (fuera del flujo normal de edición) y deja
 * registro en `correccion_log` (quién, cuándo, valor anterior/nuevo, categoría, motivo).
 * Solo ADMIN puede llamar esto (reforzado también por RLS en correccion_log).
 */
export async function registrarCorreccion(
  tabla: string,
  registroId: number,
  campo: string,
  valorAnterior: string | null,
  valorNuevo: string,
  categoria: CategoriaCorreccion,
  motivo: string | null,
  usuarioId: string,
): Promise<void> {
  const { error: updateErr } = await supabase.from(tabla).update({ [campo]: valorNuevo }).eq('id', registroId)
  if (updateErr) throw updateErr

  const { error: logErr } = await supabase.from('correccion_log').insert({
    tabla, registro_id: registroId, campo,
    valor_anterior: valorAnterior, valor_nuevo: valorNuevo,
    categoria, motivo: motivo || null, usuario_id: usuarioId,
  })
  if (logErr) throw logErr
}

export async function getCorreccionesByRegistro(tabla: string, registroId: number): Promise<CorreccionLog[]> {
  const { data, error } = await supabase
    .from('correccion_log')
    .select('*')
    .eq('tabla', tabla)
    .eq('registro_id', registroId)
    .order('fecha_creacion', { ascending: false })
  if (error) throw error
  return (data ?? []) as CorreccionLog[]
}

// ── Reporte de correcciones (pestaña "Correcciones" en Reportes, solo ADMIN) ──

export const MODULO_LABEL: Record<string, string> = {
  solicitud: 'Solicitudes',
  solicitud_arendir: 'A Rendir',
  solicitud_reembolso: 'Reembolso',
  caja_chica: 'Caja Chica',
  devolucion_cliente: 'Devolución Cliente',
}

export interface CorreccionReporteRow extends CorreccionLog {
  modulo: string
  codigo: string | null
  corregido_por: string | null
}

export interface CorreccionReporteFiltros {
  fechaDesde: string
  fechaHasta: string
  tabla?: string | null
}

export async function getCorreccionLogReporte(filtros: CorreccionReporteFiltros): Promise<CorreccionReporteRow[]> {
  const { fechaDesde, fechaHasta, tabla } = filtros
  let q = supabase
    .from('correccion_log')
    .select('*')
    .gte('fecha_creacion', fechaDesde)
    .lte('fecha_creacion', fechaHasta + 'T23:59:59')
    .order('fecha_creacion', { ascending: false })
  if (tabla) q = q.eq('tabla', tabla)

  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as CorreccionLog[]
  if (!rows.length) return []

  // Resolver código real por tabla (cada una tiene su propia columna `codigo`)
  const idsPorTabla: Record<string, Set<number>> = {}
  for (const r of rows) {
    if (!idsPorTabla[r.tabla]) idsPorTabla[r.tabla] = new Set()
    idsPorTabla[r.tabla].add(r.registro_id)
  }
  const codigoMap: Record<string, Record<number, string | null>> = {}
  await Promise.all(Object.entries(idsPorTabla).map(async ([tabla, ids]) => {
    const { data: regs } = await supabase.from(tabla).select('id, codigo').in('id', [...ids])
    codigoMap[tabla] = Object.fromEntries((regs ?? []).map((x: { id: number; codigo: string | null }) => [x.id, x.codigo]))
  }))

  // Resolver nombre del usuario que corrigió
  const userIds = [...new Set(rows.map(r => r.usuario_id))]
  const { data: usuarios } = await supabase.from('usuario').select('id, nombre_completo').in('id', userIds)
  const userMap = Object.fromEntries((usuarios ?? []).map((u: { id: string; nombre_completo: string | null }) => [u.id, u.nombre_completo]))

  return rows.map(r => ({
    ...r,
    modulo: MODULO_LABEL[r.tabla] ?? r.tabla,
    codigo: codigoMap[r.tabla]?.[r.registro_id] ?? null,
    corregido_por: userMap[r.usuario_id] ?? null,
  }))
}

const fmtFechaHora = (s: string) => {
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s))
  } catch {
    return s
  }
}

export async function exportarCorreccionLogExcel(rows: CorreccionReporteRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AVENIR'
  const ws = wb.addWorksheet('Correcciones')

  const headerRow = ws.addRow([
    'Fecha', 'Módulo', 'Código', 'Campo', 'Valor anterior', 'Valor nuevo', 'Categoría', 'Motivo', 'Corregido por',
  ])
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }
  })

  rows.forEach(r => {
    ws.addRow([
      fmtFechaHora(r.fecha_creacion),
      r.modulo,
      r.codigo ?? `#${r.registro_id}`,
      r.campo,
      r.valor_anterior ?? '',
      r.valor_nuevo ?? '',
      r.categoria,
      r.motivo ?? '',
      r.corregido_por ?? '',
    ])
  })

  ws.columns.forEach(col => { col.width = 22 })

  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `Correcciones_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
