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
