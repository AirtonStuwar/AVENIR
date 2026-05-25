import { supabase } from '../../../api/supabase'
import type { Proveedor, ProveedorConMetricas, Encuesta, EncuestaInsert, EncuestaUpdate } from '../types/proveedor'

// ── Proveedor ─────────────────────────────────────────────────────

export async function getProveedorByRuc(ruc: string): Promise<Proveedor | null> {
  const { data, error } = await supabase
    .from('proveedor')
    .select('*')
    .eq('ruc', ruc)
    .maybeSingle()
  if (error) throw error
  return data as Proveedor | null
}

export async function upsertProveedor(payload: Partial<Proveedor> & { ruc: string }): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedor')
    .upsert({ ...payload, fecha_actualizacion: new Date().toISOString() }, { onConflict: 'ruc' })
    .select()
    .maybeSingle()
  if (error) throw error
  return data as Proveedor
}

export async function getProveedoresConMetricas(): Promise<ProveedorConMetricas[]> {
  // Traemos proveedores + métricas de encuestas via join
  const { data, error } = await supabase
    .from('proveedor')
    .select(`
      *,
      encuesta_proveedor (
        calidad, tiempo, precio, comunicacion, recomendaria, fecha_creacion
      ),
      solicitud!solicitud_ruc_fkey (
        id, fecha_creacion, codigo
      )
    `)
    .order('ruc')

  // Si falla el join (no hay FK formal), hacemos queries separadas
  if (error) {
    return getProveedoresConMetricasFallback()
  }

  return (data ?? []).map((p: any) => calcularMetricas(p))
}

async function getProveedoresConMetricasFallback(): Promise<ProveedorConMetricas[]> {
  const [provRes, encRes, solRes] = await Promise.all([
    supabase.from('proveedor').select('*').order('razon_social'),
    supabase.from('encuesta_proveedor').select('*'),
    supabase.from('solicitud').select('id, ruc, fecha_creacion, codigo').not('ruc', 'is', null),
  ])

  if (provRes.error) throw provRes.error

  const encuestas  = (encRes.data ?? []) as Encuesta[]
  const solicitudes = (solRes.data ?? []) as any[]

  return ((provRes.data ?? []) as Proveedor[]).map(p => {
    const solsDeEste  = solicitudes.filter(s => s.ruc === p.ruc)
    const encsDeEste  = encuestas.filter(e => e.proveedor_ruc === p.ruc)
    return buildMetricas(p, solsDeEste, encsDeEste)
  })
}

function buildMetricas(p: Proveedor, sols: any[], encs: Encuesta[]): ProveedorConMetricas {
  const n = encs.length
  const avg = (key: keyof Encuesta) =>
    n === 0 ? null : +(encs.reduce((s, e) => s + ((e[key] as number) ?? 0), 0) / n).toFixed(2)

  const calidad      = avg('calidad')
  const tiempo       = avg('tiempo')
  const precio       = avg('precio')
  const comunicacion = avg('comunicacion')

  const general = n === 0 ? null
    : +(((calidad ?? 0) + (tiempo ?? 0) + (precio ?? 0) + (comunicacion ?? 0)) / 4).toFixed(2)

  const recomiendan  = encs.filter(e => e.recomendaria === true).length
  const pct          = n === 0 ? null : Math.round((recomiendan / n) * 100)

  const fechas = sols.map(s => s.fecha_creacion).filter(Boolean).sort().reverse()

  return {
    ...p,
    total_solicitudes:     sols.length,
    total_encuestas:       n,
    promedio_general:      general,
    promedio_calidad:      calidad,
    promedio_tiempo:       tiempo,
    promedio_precio:       precio,
    promedio_comunicacion: comunicacion,
    pct_recomendaria:      pct,
    ultima_solicitud:      fechas[0] ?? null,
  }
}

function calcularMetricas(p: any): ProveedorConMetricas {
  const encs = (p.encuesta_proveedor ?? []) as Encuesta[]
  const sols = (p.solicitud ?? []) as any[]
  const { encuesta_proveedor: _e, solicitud: _s, ...base } = p
  return buildMetricas(base as Proveedor, sols, encs)
}

// ── Encuesta ──────────────────────────────────────────────────────

export async function getEncuestaBySolicitud(solicitud_id: number): Promise<Encuesta | null> {
  const { data, error } = await supabase
    .from('encuesta_proveedor')
    .select('*')
    .eq('solicitud_id', solicitud_id)
    .maybeSingle()
  if (error) throw error
  return data as Encuesta | null
}

export async function createEncuesta(payload: EncuestaInsert): Promise<Encuesta> {
  const { data, error } = await supabase
    .from('encuesta_proveedor')
    .insert(payload)
    .select()
    .maybeSingle()
  if (error) throw error
  return data as Encuesta
}

export async function updateEncuesta(id: number, payload: EncuestaUpdate): Promise<Encuesta> {
  const { data, error } = await supabase
    .from('encuesta_proveedor')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data as Encuesta
}
