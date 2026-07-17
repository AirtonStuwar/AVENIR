import { supabase } from '../../../api/supabase'
import type { Usuario } from '../../solicitud/types/solicitud'

const FIRMA_BUCKET = 'firmas-usuario'

// ── Perfil ────────────────────────────────────────────────────────

/** Actualiza los campos editables del perfil en la tabla usuario */
export async function updateUsuarioPerfil(
  userId: string,
  data: Pick<Usuario, 'nombres' | 'apellidos' | 'cargo'>,
): Promise<void> {
  const { error } = await supabase
    .from('usuario')
    .update({ nombres: data.nombres, apellidos: data.apellidos, cargo: data.cargo })
    .eq('id', userId)
  if (error) throw error
}

/** Cambia la contraseña del usuario autenticado */
export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Ruta determinista en Storage: {userId}/firma.png */
function firmaPath(userId: string) {
  return `${userId}/firma.png`
}

/** Obtiene una URL firmada (1 h) para la firma del usuario */
export async function getUserFirmaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FIRMA_BUCKET)
    .createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Descarga la firma del usuario como Blob (para reutilizarla en solicitudes) */
export async function getUserFirmaBlob(path: string): Promise<Blob> {
  const url = await getUserFirmaUrl(path)
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo descargar la firma')
  return res.blob()
}

/**
 * Sube/reemplaza la firma del usuario en Storage y actualiza usuario.firma_path.
 * Devuelve el path guardado.
 */
export async function saveUserFirma(userId: string, blob: Blob): Promise<string> {
  const path = firmaPath(userId)

  const { error: storageErr } = await supabase.storage
    .from(FIRMA_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (storageErr) throw storageErr

  const { error: dbErr } = await supabase
    .from('usuario')
    .update({ firma_path: path })
    .eq('id', userId)
  if (dbErr) throw dbErr

  return path
}

/**
 * Elimina la firma del usuario de Storage y limpia usuario.firma_path.
 */
export async function deleteUserFirma(userId: string): Promise<void> {
  const path = firmaPath(userId)

  const { error: storageErr } = await supabase.storage
    .from(FIRMA_BUCKET)
    .remove([path])
  if (storageErr) throw storageErr

  const { error: dbErr } = await supabase
    .from('usuario')
    .update({ firma_path: null })
    .eq('id', userId)
  if (dbErr) throw dbErr
}

// ── Administración de usuarios (solo ADMIN) ─────────────────────────

export interface UsuarioConRol {
  id: string
  correo: string | null
  nombres: string | null
  apellidos: string | null
  nombre_completo: string | null
  cargo: string | null
  dni: string | null
  rol: number | null
}

/** Lista todos los perfiles con su rol asignado (o null si no tienen) */
export async function getUsuariosConRol(): Promise<UsuarioConRol[]> {
  const [usRes, rolRes] = await Promise.all([
    supabase.from('usuario').select('id, correo, nombres, apellidos, nombre_completo, cargo, dni').order('nombres'),
    supabase.from('usuario_rol').select('usuario, rol'),
  ])
  if (usRes.error) throw usRes.error
  if (rolRes.error) throw rolRes.error
  const rolMap = Object.fromEntries((rolRes.data ?? []).map(r => [r.usuario, r.rol]))
  return (usRes.data ?? []).map(u => ({ ...u, rol: rolMap[u.id] ?? null }))
}

/** ADMIN: asigna o cambia el rol de un usuario existente */
export async function cambiarRolUsuario(usuarioId: string, rol: number): Promise<void> {
  const { error } = await supabase
    .from('usuario_rol')
    .upsert({ usuario: usuarioId, rol }, { onConflict: 'usuario' })
  if (error) throw error
}

/** Lista todas las áreas disponibles (código de costos) */
export async function getAreas(): Promise<{ id: number; nombre: string }[]> {
  const { data, error } = await supabase.from('area').select('id, nombre').order('nombre')
  if (error) throw error
  return (data ?? []) as { id: number; nombre: string }[]
}

/** Área activa (estado=1) asignada a cada usuario, keyed por usuario_id */
export async function getAreasUsuarios(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('area_usuario')
    .select('usuario_id, area_id')
    .eq('estado', 1)
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of (data ?? []) as { usuario_id: string; area_id: number }[]) map[r.usuario_id] = r.area_id
  return map
}

/** ADMIN: asigna/cambia el área de un usuario, preservando el histórico (desactiva la anterior) */
export async function asignarAreaUsuario(usuarioId: string, areaId: number): Promise<void> {
  const { error: deactErr } = await supabase
    .from('area_usuario')
    .update({ estado: 0 })
    .eq('usuario_id', usuarioId)
    .eq('estado', 1)
  if (deactErr) throw deactErr

  const { error: insErr } = await supabase
    .from('area_usuario')
    .insert({ usuario_id: usuarioId, area_id: areaId, estado: 1 })
  if (insErr) throw insErr
}

/** ADMIN: crea un usuario nuevo (invitación por correo) y le asigna rol, área y datos de perfil */
export async function crearUsuario(payload: {
  email: string
  nombres: string
  apellidos: string
  cargo?: string
  dni?: string
  rol: number
  areaId?: number
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error al crear usuario')
}

/** ADMIN: edita nombres, apellidos, cargo y DNI de cualquier usuario */
export async function actualizarPerfilUsuario(usuarioId: string, data: {
  nombres: string
  apellidos: string
  cargo?: string
  dni?: string
}): Promise<void> {
  const { error } = await supabase
    .from('usuario')
    .update({ nombres: data.nombres, apellidos: data.apellidos, cargo: data.cargo ?? null, dni: data.dni ?? null })
    .eq('id', usuarioId)
  if (error) throw error
}

export interface EstadoUsuario {
  banned: boolean
  pending: boolean
}

/** ADMIN: trae el estado (activo/desactivado/pendiente de confirmar) de todos los usuarios */
export async function getEstadoUsuarios(): Promise<Record<string, EstadoUsuario>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const res = await fetch('/api/admin-users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error al obtener estado de usuarios')
  const map: Record<string, EstadoUsuario> = {}
  for (const e of data.estados as { id: string; banned: boolean; pending: boolean }[]) {
    map[e.id] = { banned: e.banned, pending: e.pending }
  }
  return map
}

/**
 * Reenvía la invitación a un usuario que aún no completó su registro (o cuyo
 * enlace caducó). `inviteUserByEmail` falla si la cuenta ya existe, así que
 * se usa el flujo de recuperación de contraseña — funciona igual: le llega
 * un correo con un enlace para crear su contraseña.
 */
export async function reenviarInvitacion(correo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

/** ADMIN: desactiva o reactiva el acceso de un usuario (no borra su historial) */
export async function cambiarEstadoUsuario(usuarioId: string, action: 'ban' | 'unban'): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')

  const res = await fetch('/api/admin-users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ usuarioId, action }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error al cambiar estado')
}
