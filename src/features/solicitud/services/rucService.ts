import { getProveedorByRuc, upsertProveedor } from '../../proveedor/services/proveedorService'

interface RucData {
  razon_social: string
  direccion:    string
  estado:       string
  condicion:    string
}

/**
 * Busca un RUC:
 *  1. Primero en la tabla local `proveedor` (sin llamar al API)
 *  2. Si no existe, llama al API externo, guarda en `proveedor` y retorna
 */
export async function buscarRuc(ruc: string): Promise<RucData> {
  // 1️⃣ Lookup local
  const local = await getProveedorByRuc(ruc)
  if (local?.razon_social) {
    return {
      razon_social: local.razon_social,
      direccion:    local.direccion    ?? '',
      estado:       local.estado_sunat ?? '',
      condicion:    '',
    }
  }

  // 2️⃣ Llamada al API externo
  const res = await fetch(`/api/ruc?numero=${encodeURIComponent(ruc)}`)
  if (!res.ok) throw new Error('RUC no encontrado')
  const data = await res.json() as RucData

  // 3️⃣ Guardar en tabla proveedor para futuras búsquedas
  try {
    await upsertProveedor({
      ruc,
      razon_social: data.razon_social,
      direccion:    data.direccion,
      estado_sunat: data.estado,
    })
  } catch {
    // No bloquear si falla el guardado
  }

  return data
}
