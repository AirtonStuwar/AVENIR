interface RucData {
  razon_social: string
  direccion: string
  estado: string
  condicion: string
}

export async function buscarRuc(ruc: string): Promise<RucData> {
  const res = await fetch(`/api/ruc?numero=${encodeURIComponent(ruc)}`)
  if (!res.ok) throw new Error('RUC no encontrado')
  return res.json() as Promise<RucData>
}
