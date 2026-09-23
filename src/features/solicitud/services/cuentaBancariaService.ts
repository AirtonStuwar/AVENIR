import { supabase } from '../../../api/supabase'

export interface CuentaBancaria {
  id: number
  proyecto_id: number
  proyecto_partida_id: number | null
  banco: string
  moneda: string
  tipo: string
  numero_cuenta: string
  cci: string | null
  concepto: string | null
  estado: string
  // join
  proyecto_partida?: { nombre: string } | null
  proyecto?: { nombre: string } | null
}

export async function getCuentasByProyecto(proyectoId: number): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase
    .from('cuenta_bancaria')
    .select('*, proyecto_partida:proyecto_partida_id(nombre)')
    .eq('proyecto_id', proyectoId)
    .eq('estado', 'Activo')
    .order('banco')
  if (error) throw error
  return (data ?? []) as unknown as CuentaBancaria[]
}

export async function getAllCuentasBancarias(): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase
    .from('cuenta_bancaria')
    .select('*, proyecto:proyecto_id(nombre), proyecto_partida:proyecto_partida_id(nombre)')
    .eq('estado', 'Activo')
    .order('banco')
  if (error) throw error
  return (data ?? []) as unknown as CuentaBancaria[]
}

/**
 * Banco/cuenta personal más reciente que este usuario usó como beneficiario en A Rendir o Reembolso
 * (busca en ambos módulos y devuelve el más reciente de los dos) — para autocompletar el formulario
 * de creación y evitar que el usuario la escriba mal a mano cada vez.
 */
export async function getUltimaCuentaBancariaPersonal(userId: string): Promise<{ banco: string; numero_cuenta: string } | null> {
  const [ar, re] = await Promise.all([
    supabase.from('solicitud_arendir')
      .select('banco, numero_cuenta, fecha_creacion')
      .eq('beneficiario_id', userId)
      .not('banco', 'is', null).not('numero_cuenta', 'is', null)
      .order('fecha_creacion', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('solicitud_reembolso')
      .select('banco, numero_cuenta, fecha_creacion')
      .eq('beneficiario_id', userId)
      .not('banco', 'is', null).not('numero_cuenta', 'is', null)
      .order('fecha_creacion', { ascending: false }).limit(1).maybeSingle(),
  ])

  const candidatos = [ar.data, re.data].filter(Boolean) as { banco: string; numero_cuenta: string; fecha_creacion: string }[]
  if (candidatos.length === 0) return null
  candidatos.sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion))
  return { banco: candidatos[0].banco, numero_cuenta: candidatos[0].numero_cuenta }
}

export async function marcarPagado(
  tabla: 'solicitud' | 'solicitud_arendir' | 'solicitud_reembolso' | 'caja_chica',
  id: number,
  cuentaPagoId: number,
  fechaPago: string,
  usuarioPagoId: string,
): Promise<void> {
  const { error } = await supabase
    .from(tabla)
    .update({
      fecha_pago: fechaPago,
      cuenta_pago_id: cuentaPagoId,
      usuario_pago: usuarioPagoId,
    })
    .eq('id', id)
  if (error) throw error
}
