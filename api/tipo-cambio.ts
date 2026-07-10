export const config = { runtime: 'edge' }

export default async function handler(_req: Request): Promise<Response> {
  const upstream = await fetch(
    'https://api.decolecta.com/v1/tipo-cambio/sunat',
    { headers: { Authorization: `Bearer ${process.env.DECOLECTA_API_KEY}` } }
  )

  const data = await upstream.json()
  return Response.json(data, { status: upstream.status })
}
