export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const numero = searchParams.get('numero')

  if (!numero) {
    return Response.json({ error: 'número requerido' }, { status: 400 })
  }

  const upstream = await fetch(
    `https://api.decolecta.com/v1/sunat/ruc?numero=${encodeURIComponent(numero)}`,
    { headers: { Authorization: `Bearer ${process.env.DECOLECTA_API_KEY}` } }
  )

  const data = await upstream.json()
  return Response.json(data, { status: upstream.status })
}
