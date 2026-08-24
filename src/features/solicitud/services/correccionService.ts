import { supabase } from '../../../api/supabase'

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
