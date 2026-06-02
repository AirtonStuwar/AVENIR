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
