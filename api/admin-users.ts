import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

interface CreateUserBody {
  email: string
  nombres: string
  apellidos: string
  cargo?: string
  dni?: string
  rol: number
}

interface EstadoBody {
  usuarioId: string
  action: 'ban' | 'unban'
}

function getAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey)
}

async function requireAdmin(req: Request, admin: SupabaseClient): Promise<{ id: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  const { data: rolRow } = await admin.from('usuario_rol').select('rol').eq('usuario', user.id).maybeSingle()
  if (rolRow?.rol !== 1) return null
  return { id: user.id }
}

export default async function handler(req: Request): Promise<Response> {
  const admin = getAdminClient()
  if (!admin) {
    return Response.json({ error: 'Configuración del servidor incompleta' }, { status: 500 })
  }

  const caller = await requireAdmin(req, admin)
  if (!caller) {
    return Response.json({ error: 'Solo el administrador puede gestionar usuarios' }, { status: 403 })
  }

  // ── GET: estado (activo/inactivo) de todos los usuarios ─────────
  if (req.method === 'GET') {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const estados = data.users.map(u => ({
      id: u.id,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    }))
    return Response.json({ estados })
  }

  // ── PATCH: desactivar / reactivar ────────────────────────────────
  if (req.method === 'PATCH') {
    const { usuarioId, action } = await req.json() as EstadoBody
    if (!usuarioId || !['ban', 'unban'].includes(action)) {
      return Response.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    if (usuarioId === caller.id) {
      return Response.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 })
    }
    const { error } = await admin.auth.admin.updateUserById(usuarioId, {
      ban_duration: action === 'ban' ? '876000h' : 'none',
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  // ── POST: crear/invitar usuario ──────────────────────────────────
  if (req.method === 'POST') {
    const body = await req.json() as CreateUserBody
    const { email, nombres, apellidos, cargo, dni, rol } = body

    if (!email || !nombres || !apellidos || !rol) {
      return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    // Nunca confiar en el header Origin de la petición para el enlace de invitación
    // (puede venir de localhost si se probó en local) — se fija la URL real de producción.
    const siteUrl = process.env.SITE_URL ?? 'https://avenir-rose.vercel.app'
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
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

  return Response.json({ error: 'Método no permitido' }, { status: 405 })
}
