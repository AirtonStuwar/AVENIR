import type { AuthResponse } from '@supabase/supabase-js';
import { supabase } from '../../../api/supabase';

export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (response.error) throw response.error;
  return response;
};

/** Envía el correo de recuperación de contraseña */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
};

/** Establece una nueva contraseña — requiere una sesión de recuperación/invitación activa */
export const updatePassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};