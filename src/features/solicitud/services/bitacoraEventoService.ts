import { supabase } from '../../../api/supabase'
import { getNombresUsuarios } from './solicitudService'
import type { PasoBitacora } from '../components/Bitacora'
import { fmtDateHora } from '../components/Bitacora'

export type ModuloBitacora = 'solicitud' | 'arendir' | 'reembolso' | 'caja_chica' | 'devolucion'

export interface BitacoraEvento {
  id: number
  tipo: 'creacion' | 'estado' | 'pago' | 'pago_parcial' | 'factura_archivo' | 'factura_datos'
  estado_anterior: string | null
  estado_nuevo: string | null
  usuario_id: string | null
  fecha: string | null
  fecha_solo_dia: boolean
  comentario: string | null
  detalle: string | null
  origen: 'trigger' | 'reconstruido'
  orden: number
}

export async function getBitacoraEventos(modulo: ModuloBitacora, registroId: number): Promise<BitacoraEvento[]> {
  const { data, error } = await supabase
    .from('bitacora_evento')
    .select('id, tipo, estado_anterior, estado_nuevo, usuario_id, fecha, fecha_solo_dia, comentario, detalle, origen, orden')
    .eq('modulo', modulo)
    .eq('registro_id', registroId)
  if (error) throw error
  let rows = (data ?? []) as BitacoraEvento[]
  // Un cambio de estado registrado en vivo reemplaza al mismo estado reconstruido a partir de los datos antiguos
  const enVivo = new Set(rows.filter(r => r.origen === 'trigger' && r.tipo === 'estado').map(r => r.estado_nuevo))
  rows = rows.filter(r => !(r.origen === 'reconstruido' && r.tipo === 'estado' && enVivo.has(r.estado_nuevo)))
  // Primero lo reconstruido (en su orden lógico), después lo registrado en vivo por fecha
  return rows.sort((a, b) => {
    if (a.origen !== b.origen) return a.origen === 'reconstruido' ? -1 : 1
    if (a.origen === 'reconstruido' && a.orden !== b.orden) return a.orden - b.orden
    const fa = a.fecha ? Date.parse(a.fecha) : 0
    const fb = b.fecha ? Date.parse(b.fecha) : 0
    return fa - fb || a.id - b.id
  })
}

export async function getNombresEventos(eventos: BitacoraEvento[]): Promise<Record<string, string>> {
  const ids = [...new Set(eventos.map(e => e.usuario_id).filter(Boolean))] as string[]
  return getNombresUsuarios(ids)
}

function fmtDia(d: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(d))
  } catch {
    return 'Fecha inválida'
  }
}

function tituloEstado(modulo: ModuloBitacora, ant: string | null, nue: string | null): { titulo: string; warn: boolean } {
  if ((nue === 'Aprobado' || nue === 'Autorizado') && ant === 'Observado') return { titulo: 'Reenviada a Contabilidad', warn: false }
  if ((nue === 'En Revision' || nue === 'En Evaluación') && ant === 'Devuelto') return { titulo: 'Reenviada a revisión', warn: false }
  switch (nue) {
    case 'En Revision': return { titulo: modulo === 'arendir' ? 'Rendición enviada' : 'Enviada a revisión', warn: false }
    case 'En Evaluación': return { titulo: 'Enviada a evaluación', warn: false }
    case 'Evaluado': return { titulo: 'Evaluada', warn: false }
    case 'Aprobado': return { titulo: 'Aprobada', warn: false }
    case 'Autorizado': return { titulo: 'Autorizada', warn: false }
    case 'Rechazado': return { titulo: 'Rechazada', warn: true }
    case 'Devuelto': return { titulo: 'Devuelta para corregir', warn: true }
    case 'Pendiente':
      return ant === 'En Revision' || ant === 'En Evaluación'
        ? { titulo: 'Devuelta por el evaluador', warn: true }
        : { titulo: 'Vuelta a Pendiente', warn: false }
    case 'Observado': return { titulo: 'Observada por Contabilidad', warn: true }
    case 'Cancelado': return { titulo: 'Cancelada', warn: true }
    case 'Pagado':
      return ant === 'En Revision'
        ? { titulo: 'Rendición devuelta', warn: true }
        : { titulo: 'Dinero entregado', warn: false }
    case 'Cerrado': return { titulo: 'Rendición cerrada', warn: false }
    default: return { titulo: `Estado: ${nue ?? '—'}`, warn: false }
  }
}

export function pasosDesdeEventos(modulo: ModuloBitacora, eventos: BitacoraEvento[], nombres: Record<string, string>): PasoBitacora[] {
  const pasos: PasoBitacora[] = eventos.map(e => {
    const quien = e.usuario_id ? nombres[e.usuario_id] : null
    let titulo = ''
    let warn = false
    switch (e.tipo) {
      case 'creacion': titulo = 'Creada'; break
      case 'pago': titulo = modulo === 'arendir' ? 'Dinero entregado' : 'Pagada'; break
      case 'pago_parcial': titulo = 'Pago parcial registrado'; break
      case 'factura_archivo': titulo = 'Factura XML/PDF adjuntada'; break
      case 'factura_datos': titulo = 'Datos de factura registrados'; break
      default: ({ titulo, warn } = tituloEstado(modulo, e.estado_anterior, e.estado_nuevo))
    }
    const partes: string[] = []
    if (e.tipo === 'factura_archivo' && e.detalle) partes.push(e.detalle)
    if (e.tipo === 'factura_datos' && e.detalle) partes.push(`N° ${e.detalle}`)
    if (e.tipo === 'pago_parcial' && e.detalle) partes.push(e.detalle)
    if (quien) partes.push(e.tipo === 'creacion' || e.tipo === 'estado' ? `Por ${quien}` : `Registrado por ${quien}`)
    if (e.comentario) partes.push(`Motivo: ${e.comentario}`)
    return {
      titulo,
      fecha: e.fecha ? (e.fecha_solo_dia ? fmtDia(e.fecha) : fmtDateHora(e.fecha)) : null,
      detalle: partes.join(' · ') || null,
      estado: warn ? 'warn' : 'done',
    } as PasoBitacora
  })
  const ultimo = pasos[pasos.length - 1]
  if (ultimo && ultimo.estado === 'done') ultimo.estado = 'current'
  return pasos
}
