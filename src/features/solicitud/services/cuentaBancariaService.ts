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

export interface PagoSolicitud {
  id: number
  solicitud_id: number
  monto: number
  fecha_pago: string
  cuenta_pago_id: number
  usuario_id: string | null
  fecha_creacion: string
  cuenta?: { banco: string; numero_cuenta: string; moneda: string } | null
}

/** Pagos en partes de una Factura con Valorización, en el orden en que se hicieron. */
export async function getPagosSolicitud(solicitudId: number): Promise<PagoSolicitud[]> {
  const { data, error } = await supabase
    .from('solicitud_pago')
    .select('id, solicitud_id, monto, fecha_pago, cuenta_pago_id, usuario_id, fecha_creacion, cuenta:cuenta_pago_id(banco,numero_cuenta,moneda)')
    .eq('solicitud_id', solicitudId)
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PagoSolicitud[]
}

/**
 * Registra un pago (total o parcial) de una Factura con Valorización. La función de BD valida que el monto no
 * supere lo pendiente y, cuando la suma de los pagos cubre el monto a girar, marca la solicitud como pagada.
 * Devuelve lo que aún queda por pagar (0 = pagada por completo).
 */
export async function registrarPagoSolicitud(solicitudId: number, monto: number, cuentaId: number, fechaPago: string): Promise<number> {
  const { data, error } = await supabase.rpc('registrar_pago_solicitud', {
    p_solicitud_id: solicitudId, p_monto: monto, p_cuenta_id: cuentaId, p_fecha: fechaPago,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
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
