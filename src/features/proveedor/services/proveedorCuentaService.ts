import { supabase } from '../../../api/supabase'
import type { ProveedorCuenta, ProveedorCuentaInsert, ProveedorCuentaUpdate } from '../types/proveedor'

export async function getCuentasByProveedor(ruc: string): Promise<ProveedorCuenta[]> {
  const { data, error } = await supabase
    .from('proveedor_cuenta_bancaria')
    .select('*')
    .eq('proveedor_ruc', ruc)
    .eq('estado', 'Activo')
    .order('fecha_creacion')
  if (error) throw error
  return (data ?? []) as ProveedorCuenta[]
}

export async function createCuentaProveedor(payload: ProveedorCuentaInsert): Promise<ProveedorCuenta> {
  const { data, error } = await supabase
    .from('proveedor_cuenta_bancaria')
    .insert(payload)
    .select()
    .maybeSingle()
  if (error) throw error
  return data as ProveedorCuenta
}

export async function updateCuentaProveedor(id: number, payload: ProveedorCuentaUpdate): Promise<ProveedorCuenta> {
  const { data, error } = await supabase
    .from('proveedor_cuenta_bancaria')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data as ProveedorCuenta
}

export async function deleteCuentaProveedor(id: number): Promise<void> {
  const { error } = await supabase
    .from('proveedor_cuenta_bancaria')
    .delete()
    .eq('id', id)
  if (error) throw error
}
