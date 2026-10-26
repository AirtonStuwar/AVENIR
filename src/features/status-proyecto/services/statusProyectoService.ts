import { authFetch } from '../../../api/authFetch'

export interface Conteo { promesado: number; reservado: number }

/** Resumen comercial de un proyecto, ya agregado en el servidor (sin datos de clientes). */
export interface StatusMobysuite {
  totalContratos: number
  contratosPorEstado: Record<string, number>
  deptos: Conteo
  estacionamientos: Conteo
  depositos: Conteo
  venta: Conteo          // suma de precioTotal de los contratos (incluye estacionamientos y depósitos)
  ventaDeptos: Conteo
  precioM2: { minutas: number | null; todos: number | null }
  porDormitorios: Record<string, Conteo>
  porPiso: Record<string, Conteo>
  cobrado: number
  valorContratos: number
}

export async function getStatusMobysuite(mobyProjectId: number): Promise<StatusMobysuite> {
  const res = await authFetch(`/api/mobysuite-status?mobyProjectId=${mobyProjectId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `Error ${res.status}`)
  }
  return res.json() as Promise<StatusMobysuite>
}
