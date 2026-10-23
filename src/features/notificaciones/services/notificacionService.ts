import { supabase } from '../../../api/supabase'

export interface Notificacion {
  id: number
  titulo: string
  mensaje: string | null
  ruta: string | null
  modulo: string | null
  leida: boolean
  fecha_creacion: string
}

/** Las últimas 30 del usuario (la RLS ya limita a las propias). */
export async function getNotificaciones(): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from('notificacion')
    .select('id, titulo, mensaje, ruta, modulo, leida, fecha_creacion')
    .order('fecha_creacion', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as Notificacion[]
}

export async function marcarLeida(id: number): Promise<void> {
  const { error } = await supabase.from('notificacion').update({ leida: true }).eq('id', id)
  if (error) throw error
}

export async function marcarTodasLeidas(): Promise<void> {
  const { error } = await supabase.from('notificacion').update({ leida: true }).eq('leida', false)
  if (error) throw error
}
