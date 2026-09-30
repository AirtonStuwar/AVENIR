import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

// Exige sesión válida de Supabase (evita que terceros gasten la cuota de la API key)
async function requireUser(req: Request): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const auth = req.headers.get('Authorization')
  if (!url || !key || !auth?.startsWith('Bearer ')) return false
  const admin = createClient(url, key)
  const { data: { user }, error } = await admin.auth.getUser(auth.slice(7))
  return !error && !!user
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await requireUser(req))) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const upstream = await fetch(
    'https://api.decolecta.com/v1/tipo-cambio/sunat',
    { headers: { Authorization: `Bearer ${process.env.DECOLECTA_API_KEY}` } }
  )

  const data = await upstream.json()
  return Response.json(data, { status: upstream.status })
}
