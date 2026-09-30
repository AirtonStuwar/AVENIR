import { supabase } from './supabase'

// fetch a los endpoints /api/* protegidos: adjunta el token de sesión de Supabase
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
