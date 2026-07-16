import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

interface CreateUserBody {
  email: string
  nombres: string
  apellidos: string
  cargo?: string
  dni?: string
  rol: number
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
  }
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: rolRow } = await admin.from('usuario_rol').select('rol').eq('usuario', user.id).maybeSingle()
  if (rolRow?.rol !== 1) {
    return Response.json({ error: 'Solo el administrador puede crear usuarios' }, { status: 403 })
  }

  const body = await req.json() as CreateUserBody
  const { email, nombres, apellidos, cargo, dni, rol } = body

  if (!email || !nombres || !apellidos || !rol) {
    return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? ''
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })
  if (inviteErr || !invited?.user) {
    return Response.json({ error: inviteErr?.message ?? 'Error al invitar usuario' }, { status: 400 })
  }

  const newUserId = invited.user.id

  const { error: profileErr } = await admin.from('usuario')
    .update({ nombres, apellidos, cargo: cargo ?? null, dni: dni ?? null })
    .eq('id', newUserId)
  if (profileErr) {
    return Response.json({ error: `Usuario invitado pero falló al guardar el perfil: ${profileErr.message}` }, { status: 500 })
  }

  const { error: rolErr } = await admin.from('usuario_rol').insert({ usuario: newUserId, rol })
  if (rolErr) {
    return Response.json({ error: `Usuario invitado pero falló al asignar el rol: ${rolErr.message}` }, { status: 500 })
  }

  return Response.json({ success: true, userId: newUserId })
}
